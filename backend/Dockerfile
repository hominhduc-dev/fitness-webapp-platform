# ============ Stage 1: Base ============
FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl python3 make g++

# ============ Stage 2: Deps ============
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# ============ Stage 3: Builder ============
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# ============ Stage 4: Runner (image cuối) ============
FROM base AS runner
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY --from=deps /app/node_modules ./node_modules
RUN npm prune --omit=dev \
 && npx prisma generate \
 && npm cache clean --force
COPY --from=builder /app/dist ./dist
EXPOSE 4000
CMD ["npm", "run", "start"]
