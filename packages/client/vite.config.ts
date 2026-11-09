import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // マルチプレイの通信はサーバー（packages/server、ポート3000）へ中継する
    proxy: { "/socket.io": { target: "http://localhost:3000", ws: true } },
  },
});
