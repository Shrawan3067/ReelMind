FROM node:22-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json* ./
COPY shared/package.json ./shared/
COPY client/package.json ./client/
COPY server/package.json ./server/

RUN npm install --workspace=shared --workspace=client

COPY shared/ ./shared/
COPY client/ ./client/

RUN npm run build --workspace=shared && npm run build --workspace=client

FROM nginx:1.27-alpine
COPY --from=builder /app/client/dist /usr/share/nginx/html
COPY client/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80 443
CMD ["nginx", "-g", "daemon off;"]

