FROM oven/bun:1-alpine

WORKDIR /app

COPY server/package.json ./
COPY server/src ./src

CMD ["bun", "run", "src/index.ts"]
