// サーバーの起動（設計書 5.1、8章）。Socket.IO と、ビルド済みの client の配信を1台で行う
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer, type Server as HttpServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { type CardRegistry, defaultRegistry } from "@deckbuild/core";
import { Server } from "socket.io";
import type { ClientToServer, ServerToClient } from "./protocol.js";
import type { RoomTimings } from "./Room.js";
import { RoomManager } from "./RoomManager.js";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".webp": "image/webp",
  ".txt": "text/plain; charset=utf-8",
};

/** どの応答にも付ける、安全のためのヘッダー */
const SECURITY_HEADERS = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "x-frame-options": "DENY",
};

/** 圧縮して送る種類（フォントや画像は圧縮済みなのでそのまま） */
const COMPRESSIBLE = new Set([".html", ".js", ".css", ".svg", ".json", ".txt"]);

/** 圧縮した中身の控え（ファイル → 圧縮したもの）。配信するファイルはビルドのあと変わらないので、一度作れば使い回せる */
const gzipCache = new Map<string, { mtimeMs: number; body: Buffer }>();

function gzipped(file: string): Buffer {
  const mtimeMs = statSync(file).mtimeMs;
  const hit = gzipCache.get(file);
  if (hit && hit.mtimeMs === mtimeMs) return hit.body;
  const body = gzipSync(readFileSync(file), { level: 9 });
  gzipCache.set(file, { mtimeMs, body });
  return body;
}

/** ビルドで作られるファイル（名前に中身のハッシュが入る）の置き場所 */
const ASSETS = /^assets[/\\]/;

export interface StartOptions {
  port?: number;
  reg?: CardRegistry;
  timings?: RoomTimings;
  /** ビルド済みの client（index.html のあるフォルダ）。なければ配信しない */
  staticDir?: string | null;
  /** 同時に存在できるルームの数 */
  maxRooms?: number;
  log?: (message: string, data?: unknown) => void;
}

export interface RunningServer {
  http: HttpServer;
  io: Server<ClientToServer, ServerToClient>;
  manager: RoomManager;
  port: number;
  close(): Promise<void>;
}

export async function startServer(opts: StartOptions = {}): Promise<RunningServer> {
  const staticDir = opts.staticDir === undefined ? defaultStaticDir() : opts.staticDir;
  const http = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    // 公開先の死活監視用
    if (url.pathname === "/healthz") {
      res.writeHead(200, { ...SECURITY_HEADERS, "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" }).end("ok");
      return;
    }
    if (!staticDir || (req.method !== "GET" && req.method !== "HEAD")) {
      res.writeHead(404, SECURITY_HEADERS).end("not found");
      return;
    }
    let rel: string;
    try {
      rel = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, "");
    } catch {
      res.writeHead(400, SECURITY_HEADERS).end("bad request");
      return;
    }
    let file = resolve(staticDir, rel);
    // フォルダの外は見せない
    const found = file.startsWith(resolve(staticDir)) && existsSync(file) && !statSync(file).isDirectory();
    if (!found) {
      // assets/ のファイルがないときは 404。それ以外は index.html（画面の切り替えはブラウザ側）
      if (ASSETS.test(rel)) {
        res.writeHead(404, SECURITY_HEADERS).end("not found");
        return;
      }
      file = join(staticDir, "index.html");
    }
    // 文字のファイルは、ブラウザが受け取れれば圧縮して送る（通信量を減らす）
    const gzip = COMPRESSIBLE.has(extname(file)) && /\bgzip\b/.test(String(req.headers["accept-encoding"] ?? ""));
    const body = gzip ? gzipped(file) : null;
    res.writeHead(200, {
      ...SECURITY_HEADERS,
      "content-type": MIME[extname(file)] ?? "application/octet-stream",
      // assets/ は中身が変われば名前も変わるので長く保存してよい。index.html などは毎回確認させる
      "cache-control": found && ASSETS.test(rel) ? "public, max-age=31536000, immutable" : "no-cache",
      vary: "accept-encoding",
      ...(body ? { "content-encoding": "gzip", "content-length": String(body.length) } : {}),
    });
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    if (body) res.end(body);
    else createReadStream(file).pipe(res);
  });
  // 画面と同じアドレスから接続する（開発中は Vite が中継する）ので、他のサイトからの接続は受け付けない
  const io = new Server<ClientToServer, ServerToClient>(http, {
    maxHttpBufferSize: 64 * 1024,
  });
  const manager = new RoomManager(io, opts.reg ?? defaultRegistry(), opts.timings, opts.log, opts.maxRooms);
  await new Promise<void>((ok) => http.listen(opts.port ?? 0, ok));
  const addr = http.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  return {
    http,
    io,
    manager,
    port,
    close: () =>
      new Promise<void>((ok) => {
        for (const room of manager.rooms.values()) room.dispose();
        io.close(() => ok());
      }),
  };
}

function defaultStaticDir(): string | null {
  const dir = fileURLToPath(new URL("../../client/dist", import.meta.url));
  return existsSync(join(dir, "index.html")) ? dir : null;
}

// 直接起動されたとき
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 3000);
  const s = await startServer({ port });
  console.log(`サーバーを起動しました: http://localhost:${s.port}`);
  // 公開先が止めるとき（SIGTERM）や Ctrl+C で、接続を閉じてから終わる
  const stop = (signal: string) => {
    console.log(`${signal} を受けたので終了します`);
    void s.close().then(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.once("SIGTERM", () => stop("SIGTERM"));
  process.once("SIGINT", () => stop("SIGINT"));
}
