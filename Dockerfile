# Imagen única: API (Fastify) + interfaz compilada (Vite) servidas desde el mismo origen.
# Construcción:  docker build -t scrum-assistant .
# Ejecución:     docker run -p 3000:3000 --env-file .env.production scrum-assistant

# ---- Etapa 1: dependencias y compilación del frontend ----
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json tsconfig.base.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
COPY e2e/package.json e2e/
# `postinstall` de backend ejecuta `prisma generate`, que necesita el esquema.
COPY backend/prisma backend/prisma
COPY backend/prisma.config.ts backend/
RUN npm ci --ignore-scripts && npm run postinstall -w backend

COPY shared shared
COPY frontend frontend
COPY backend backend
RUN npm run build -w shared && npm run build -w frontend

# ---- Etapa 2: imagen final ----
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=3000
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Se conservan node_modules completos: el servidor arranca con `tsx` (sin paso de compilación del backend)
# y `prisma migrate deploy` necesita la CLI de Prisma.
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/package.json /app/tsconfig.base.json ./
COPY --from=build /app/shared shared
COPY --from=build /app/backend backend
COPY --from=build /app/frontend/dist frontend/dist

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Aplica las migraciones pendientes y arranca el servidor (API en /api/v1, estáticos en /).
CMD ["sh", "-c", "npm run db:deploy -w backend && node_modules/.bin/tsx backend/src/main.ts"]
