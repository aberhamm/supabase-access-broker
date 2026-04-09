# Base stage - dependencies
FROM node:20-alpine AS base
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Dependencies stage
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Builder stage
FROM base AS builder
WORKDIR /app

# Declare build-time variables BEFORE copying source so that any arg change
# invalidates the cache from this point forward, preventing stale baked-in values.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_AUTH_PASSKEYS=false
ARG NEXT_PUBLIC_AUTH_GOOGLE=false
ARG NEXT_PUBLIC_AUTH_GITHUB=false
ARG NEXT_PUBLIC_AUTH_EMAIL_OTP=false
ARG NEXT_PUBLIC_AUTH_PASSWORD=true
ARG NEXT_PUBLIC_AUTH_MAGIC_LINK=false

# Validate that required build args are provided
RUN if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ "$NEXT_PUBLIC_SUPABASE_URL" = "https://placeholder.supabase.co" ]; then \
        echo "ERROR: NEXT_PUBLIC_SUPABASE_URL must be set and cannot be placeholder" >&2; \
        exit 1; \
    fi && \
    if [ -z "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ] || [ "$NEXT_PUBLIC_SUPABASE_ANON_KEY" = "placeholder-anon-key" ]; then \
        echo "ERROR: NEXT_PUBLIC_SUPABASE_ANON_KEY must be set and cannot be placeholder" >&2; \
        exit 1; \
    fi && \
    if [ -z "$NEXT_PUBLIC_APP_URL" ]; then \
        echo "ERROR: NEXT_PUBLIC_APP_URL must be set (e.g. https://your-domain.com)" >&2; \
        exit 1; \
    fi

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_AUTH_PASSKEYS=$NEXT_PUBLIC_AUTH_PASSKEYS
ENV NEXT_PUBLIC_AUTH_GOOGLE=$NEXT_PUBLIC_AUTH_GOOGLE
ENV NEXT_PUBLIC_AUTH_GITHUB=$NEXT_PUBLIC_AUTH_GITHUB
ENV NEXT_PUBLIC_AUTH_EMAIL_OTP=$NEXT_PUBLIC_AUTH_EMAIL_OTP
ENV NEXT_PUBLIC_AUTH_PASSWORD=$NEXT_PUBLIC_AUTH_PASSWORD
ENV NEXT_PUBLIC_AUTH_MAGIC_LINK=$NEXT_PUBLIC_AUTH_MAGIC_LINK
ENV NEXT_TELEMETRY_DISABLED=1

# Copy dependencies and source AFTER args are declared and validated
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the application
RUN pnpm build

# Production stage
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy necessary files from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

# Copy built Next.js files
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3050

ENV PORT=3050
ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3050/api/health || exit 1

# Start the application
CMD ["node", "server.js"]
