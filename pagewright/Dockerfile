# Playwright's image already carries Chromium and its system libraries, which is the
# one thing a plain node image cannot provide for a PDF engine.
FROM mcr.microsoft.com/playwright:v1.49.0-jammy

WORKDIR /app
ENV NODE_ENV=production PORT=4310
# Public origin baked into canonical/og/sitemap at build time:
#   docker build --build-arg SITE_URL=https://yourdomain.com .
ARG SITE_URL=http://localhost:4310
ENV VITE_SITE_URL=$SITE_URL

# Dependencies first, so code changes don't reinstall them.
COPY package*.json ./
COPY pagewright-site/package*.json ./pagewright-site/
RUN npm ci --omit=dev --no-audit --no-fund \
 && npm --prefix pagewright-site ci --no-audit --no-fund

COPY . .

# The SPA is built at image time and served by the same process as the API.
RUN npm --prefix pagewright-site run build \
 && rm -rf pagewright-site/node_modules

EXPOSE 4310
CMD ["npx", "tsx", "server.ts"]
