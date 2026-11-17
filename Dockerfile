# Stage 1: Install dependencies and build
FROM node:26-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
# The prepare script (git hooks) runs during npm ci, before the rest of the
# source arrives; it exits early here because there is no git repository.
COPY scripts ./scripts

# Install all dependencies (including devDependencies)
RUN npm ci

# Copy source code
COPY . .

# Build the Next.js app
RUN npm run build

# Stage 2: Production image. The standalone output is plain Node.js — site
# captures run in each visitor's Chrome extension, so there is no browser to
# install here.
FROM node:26-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Add non-root user for security
RUN addgroup -S -g 1001 nodejs && \
    adduser -S -u 1001 -G nodejs nextjs

# Copy standalone output from builder
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Set the port
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
EXPOSE 3000

# Switch to non-root user
USER nextjs

# Start the Next.js app
CMD ["node", "server.js"]
