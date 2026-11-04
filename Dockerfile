# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
# ปรับแพ็กเกจระบบ (เช่น openssl) ให้เป็นรุ่นล่าสุดที่แก้ช่องโหว่แล้ว
RUN apk upgrade --no-cache
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# ตอนรันใช้แค่ `node server.js` → ลบ npm/npx/corepack ที่แถมมา (มีช่องโหว่ใน dependency ของ npm เอง)
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
      /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack

# uid/gid 1000 = ผู้ใช้ node ในอิมเมจ (ตรงกับ user: "1000:1000" ใน docker compose)
RUN mkdir -p /app/backups /app/private/uploads /app/public/uploads \
      /app/public/infographics /app/public/flood-maps /app/.next/cache \
 && chown -R 1000:1000 /app

COPY --from=builder --chown=1000:1000 /app/public ./public
COPY --from=builder --chown=1000:1000 /app/.next/standalone ./
COPY --from=builder --chown=1000:1000 /app/.next/static ./.next/static

USER node
EXPOSE 3000
CMD ["node", "server.js"]
