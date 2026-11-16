# ReelMind Backend & Media Processing Service
FROM node:22-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json* ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
COPY client/package.json ./client/

RUN npm install --workspace=shared --workspace=server

COPY shared/ ./shared/
COPY server/ ./server/

RUN npm run build --workspace=shared && npm run build --workspace=server

FROM node:22-alpine
RUN apk add --no-cache ffmpeg curl

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/shared/package.json ./shared/
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/server/package.json ./server/
COPY --from=builder /app/server/dist ./server/dist

RUN mkdir -p /app/uploads /app/thumbnails && chmod -R 777 /app/uploads /app/thumbnails

EXPOSE 5001
CMD ["node", "server/dist/server.js"]

