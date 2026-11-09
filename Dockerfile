# 公開用のイメージ。サーバー1台で、画面の配信と協力プレイの通信の両方を行う
# 作り方：docker build -t deckbuild-rpg .
# 動かし方：docker run -p 3000:3000 deckbuild-rpg → http://localhost:3000

# ---- 1. 画面を組み立てる ----
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/client/package.json packages/client/
COPY packages/server/package.json packages/server/
COPY packages/sim/package.json packages/sim/
RUN npm ci
COPY tsconfig.base.json ./
COPY data data
COPY packages packages
RUN npm run build

# ---- 2. 動かす（開発用のパッケージは入れない） ----
FROM node:24-slim
ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/client/package.json packages/client/
COPY packages/server/package.json packages/server/
COPY packages/sim/package.json packages/sim/
RUN npm ci --omit=dev && npm cache clean --force
COPY data data
COPY packages/core/src packages/core/src
COPY packages/server/src packages/server/src
COPY --from=build /app/packages/client/dist packages/client/dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://localhost:'+process.env.PORT+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--import", "tsx", "packages/server/src/index.ts"]
