// サーバーの起動（設計書 5.1、8章）。Socket.IO と、ビルド済みの client の配信を1台で行う
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer, type Server as HttpServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
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
};

export interface StartOptions {
  port?: number;
  reg?: CardRegistry;
  timings?: RoomTimings;
  /** ビルド済みの client（index.html のあるフォルダ）。なければ配信しない */
  staticDir?: string | null;
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
    if (!staticDir) {
      res.writeHead(404).end("not found");
      return;
    }
    const url = new URL(req.url ?? "/", "http://localhost");
    const rel = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, "");
    let file = resolve(staticDir, rel);
    // フォルダの外は見せない。見つからなければ index.html（画面の切り替えはブラウザ側）
    if (!file.startsWith(resolve(staticDir)) || !existsSync(file) || statSync(file).isDirectory()) {
      file = join(staticDir, "index.html");
    }
    res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
    createReadStream(file).pipe(res);
  });
  const io = new Server<ClientToServer, ServerToClient>(http, {
    // 開発中は Vite（別ポート）から接続する
    cors: { origin: true },
    maxHttpBufferSize: 64 * 1024,
  });
  const manager = new RoomManager(io, opts.reg ?? defaultRegistry(), opts.timings, opts.log);
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
}
