FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY . .

ENV NODE_ENV=production
EXPOSE 3000

RUN npm run build

CMD ["npx", "tsx", "server.ts"]
