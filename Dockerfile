# Imagen única: build del frontend (Vite) + servidor Node que sirve API y estáticos.
FROM node:24-slim AS web
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.js postcss.config.js tailwind.config.js ./
COPY public ./public
COPY src ./src
RUN npm run build

FROM node:24-slim AS server-deps
WORKDIR /srv
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

FROM node:24-slim
ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/data/campo.sqlite \
    STATIC_DIR=/srv/web \
    NODE_OPTIONS=--disable-warning=ExperimentalWarning
WORKDIR /srv
COPY --from=server-deps /srv/node_modules ./node_modules
COPY server/package.json ./
COPY server/src ./src
COPY server/scripts ./scripts
COPY --from=web /app/dist ./web
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
CMD ["node", "src/index.js"]
