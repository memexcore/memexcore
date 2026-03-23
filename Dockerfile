FROM oven/bun:1-alpine

WORKDIR /app

COPY server/package.json ./
COPY server/src ./src
COPY server/pages ./pages

CMD ["bun", "run", "src/index.ts"]
