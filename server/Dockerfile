# =========================================================
#  构建阶段（builder）：安装全部依赖 + 编译 TypeScript
# =========================================================
FROM node:20-slim AS builder
WORKDIR /app

# better-sqlite3 是 C++ native 模块，编译它需要这些工具
RUN apt-get update && apt-get install -y python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# 先只拷贝 package 文件：依赖没变时可命中 Docker 缓存，跳过重装
COPY package*.json ./
RUN npm ci

# 再拷贝源码并编译
COPY . .
RUN npm run build

# 删掉 devDependencies，只留生产依赖（此时 better-sqlite3 已编译好）
RUN npm prune --omit=dev

# =========================================================
#  运行阶段（runner）：只带必要产物，镜像更小、更干净
# =========================================================
FROM node:20-slim
WORKDIR /app

# 直接复用 builder 里已经编译好的依赖与产物，无需再装编译工具
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

# 数据库持久化目录（compose 会把它挂载到主机）
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/data/calorie.db

EXPOSE 3000
CMD ["node", "dist/main.js"]
