// 公開用の配信（ビルド済みの画面・死活監視）と、ルームの数の上限を確かめる
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { io as connect, type Socket } from "socket.io-client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type RunningServer, startServer } from "../src/index.js";
import type { JoinReply } from "../src/protocol.js";

let server: RunningServer;
let dir: string;
const sockets: Socket[] = [];
const url = (path: string) => `http://localhost:${server.port}${path}`;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "deckbuild-static-"));
  mkdirSync(join(dir, "assets"));
  writeFileSync(join(dir, "index.html"), "<!doctype html><title>test</title>");
  writeFileSync(join(dir, "assets", "app-abc123.js"), "console.log(1)");
  server = await startServer({ port: 0, staticDir: dir, maxRooms: 1, log: () => {} });
});
afterAll(async () => {
  for (const s of sockets) s.disconnect();
  await server.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("配信", () => {
  it("/healthz は ok を返す", async () => {
    const r = await fetch(url("/healthz"));
    expect(r.status).toBe(200);
    expect(await r.text()).toBe("ok");
  });

  it("assets/ のファイルは長く保存してよいことを伝える", async () => {
    const r = await fetch(url("/assets/app-abc123.js"));
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("text/javascript");
    expect(r.headers.get("cache-control")).toContain("immutable");
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("index.html は毎回確認させる。知らないアドレスも index.html を返す", async () => {
    for (const path of ["/", "/some/page"]) {
      const r = await fetch(url(path));
      expect(r.status).toBe(200);
      expect(r.headers.get("cache-control")).toBe("no-cache");
      expect(await r.text()).toContain("<title>test</title>");
    }
  });

  it("assets/ にないファイルは 404", async () => {
    expect((await fetch(url("/assets/none.js"))).status).toBe(404);
  });

  it("フォルダの外は見せない", async () => {
    const r = await fetch(url("/..%2f..%2fpackage.json"));
    expect(await r.text()).toContain("<title>test</title>");
  });

  it("GET 以外は受け付けない", async () => {
    expect((await fetch(url("/"), { method: "POST" })).status).toBe(404);
  });
});

describe("ルームの数の上限", () => {
  it("上限を超えると作れない", async () => {
    const make = async () => {
      const s = connect(url(""), { transports: ["websocket"], forceNew: true });
      sockets.push(s);
      return new Promise<JoinReply>((ok) => s.emit("room:create", { name: "テスト", stageId: "stage1" }, ok));
    };
    expect((await make()).ok).toBe(true);
    const second = await make();
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error).toContain("混み合っています");
  });
});
