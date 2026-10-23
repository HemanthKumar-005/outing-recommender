FROM node:20-alpine AS deps
WORKDIR /app
<<<<<<< HEAD
# npm ci = reproducible install from the committed lockfile (fails if it is out of date)
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
=======
COPY package.json ./
RUN npm install
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
<<<<<<< HEAD
# NEXT_PUBLIC_* values are inlined into the browser bundle at BUILD time, so every one of them
# must be declared here as an ARG. None of these is a secret.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY
ARG NEXT_PUBLIC_TILE_URL
ARG NEXT_PUBLIC_SUPPORT_EMAIL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY \
    NEXT_PUBLIC_TILE_URL=$NEXT_PUBLIC_TILE_URL \
    NEXT_PUBLIC_SUPPORT_EMAIL=$NEXT_PUBLIC_SUPPORT_EMAIL
RUN mkdir -p public && npm run build
=======
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_API_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_KEY=$NEXT_PUBLIC_API_KEY
RUN npm run build
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
<<<<<<< HEAD
RUN addgroup -S app && adduser -S app -G app
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
COPY --from=builder --chown=app:app /app/public ./public
USER app
=======
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
EXPOSE 3000
CMD ["node", "server.js"]
