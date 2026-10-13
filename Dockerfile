# Satun Geo-EOC — image สำหรับ production (Next.js standalone)
#   build:  docker compose build app
#   รัน migration หลัง deploy:  docker compose exec app node scripts/migrate.mjs up
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN groupadd --system app && useradd --system --gid app --home /app app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
# สำหรับ migration และสคริปต์ดูแลระบบ (pdpa:retention, test-data:cleanup) ภายใน container
COPY --from=build --chown=app:app /app/migrations ./migrations
COPY --from=build --chown=app:app /app/scripts ./scripts
COPY --from=build --chown=app:app /app/lib/pdpaRetention.mjs /app/lib/testDataCleanup.mjs ./lib/
RUN mkdir -p private/uploads public/uploads public/infographics public/flood-maps backups && chown -R app:app private public backups
USER app
EXPOSE 3000
HEALTHCHECK --interval=60s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/stn-eoc/api/health/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
