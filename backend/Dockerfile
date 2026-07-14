# ============ Stage 1: Base ============
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl              # Prisma cần openssl

# ============ Stage 2: Deps ============
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci                                   # cài cả dev deps (cần tsc)

# ============ Stage 3: Builder ============
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate                      # sinh Prisma Client
RUN npm run build                            # tsc → dist/

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