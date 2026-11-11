# Stage 1: Install dependencies and build
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
# The prepare script (git hooks) runs during npm ci, before the rest of the
# source arrives; it exits early here because there is no git repository.
COPY scripts ./scripts

# Install all dependencies (including devDependencies). No browser here: this
# stage is Alpine, which Playwright has no Firefox for — the runner installs it.
RUN npm ci

# Copy source code
COPY . .

# Build the Next.js app
RUN npm run build

# Stage 2: Production image (Debian-based for glibc compatibility with Playwright)
FROM node:22-bookworm-slim AS runner

WORKDIR /app

# Add non-root user for security
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs --home /home/nextjs --create-home nextjs

# Create writable cache directories for the non-root user
RUN mkdir -p /app/.cache /home/nextjs/.cache && \
    chown -R nextjs:nodejs /app/.cache /home/nextjs

ENV HOME=/home/nextjs

# Copy standalone output from builder
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy node_modules (needed for Playwright to find its browser downloader)
COPY --from=builder /app/node_modules ./node_modules

# Set PLAYWRIGHT_BROWSERS_PATH to a shared location inside the app directory
ENV PLAYWRIGHT_BROWSERS_PATH=/app/ms-playwright
ENV XDG_CACHE_HOME=/app/.cache

# Firefox in Docker: disable content sandbox (seccomp blocks CLONE_NEWUSER)
# and WebRender GPU acceleration (no display available in container).
ENV MOZ_DISABLE_CONTENT_SANDBOX=1
ENV MOZ_WEBRENDER=0

# Let the app know it's running inside Docker so it can adjust browser args.
ENV RUNNING_IN_DOCKER=1

# Install Playwright Firefox browser and all its system dependencies.
# Local / Docker runs Firefox; Vercel uses Browserless Chromium.
RUN npx playwright install firefox && \
    npx playwright install-deps firefox

# Ensure the nextjs user can read the browser binaries
RUN chown -R nextjs:nodejs /app/ms-playwright

# Set Node.js memory limits
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Set the port
ENV PORT=3000
EXPOSE 3000

# Switch to non-root user
USER nextjs

# Start the Next.js app
CMD ["node", "server.js"]