# Single Railway service: internal Anvil + Fastify + public built Vite frontend
FROM node:22-bookworm-slim
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && update-ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt
ENV CURL_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt
RUN npm install --global pnpm@12.15.0
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @greenflow/shared build && VITE_API_URL= pnpm --filter @greenflow/web build && pnpm contracts:build
ENV PORT=8080
EXPOSE 8080
CMD ["node", "scripts/hosted-demo.mjs"]
