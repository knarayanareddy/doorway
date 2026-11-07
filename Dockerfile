# Doorway demo harness, as a hosted service (see docs/15-hosting-the-demo.md).
#
# One image, two deployments: ROLE=door and ROLE=platform. They must be different origins,
# because the Door is a sandboxed iframe that is only isolated from the page if it lives elsewhere.
# This image contains MOCK DATA ONLY. Do not point real visitors at it.
#
# Written to Maritime's container contract (https://maritime.sh/docs/frameworks/custom):
#   - bind 0.0.0.0:$PORT (never hardcode a port; do not bind 8080 yourself)
#   - GET /health returns 2xx
#   - ca-certificates installed (slim images lack them)
#   - the command is a real program, never "sh -c ..." (the micro-VM init flattens the quoting)

# Stage 1: build the prototype app. It imports the real core from packages/ (the @repo alias in
# prototype/vite.config.ts), so packages/ is copied too. Only its index.html is kept, in the runtime stage.
FROM node:24-slim AS app
WORKDIR /app
COPY prototype/package.json prototype/package-lock.json ./prototype/
RUN npm --prefix prototype ci
COPY packages ./packages
COPY prototype ./prototype
RUN npm --prefix prototype run build

# Stage 2: the runtime.
FROM node:24-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
# Production dependencies only. esbuild is one of them: the loader bakes the Door's origin in at build time, and the
# server builds it at start-up so that one image can serve any deployment. No wrangler, eslint or Playwright.
RUN npm ci --omit=dev

COPY packages ./packages
COPY edge ./edge
COPY desk ./desk
COPY integrations ./integrations
COPY mock-platform ./mock-platform
COPY scripts ./scripts
# The built app, and only that file: /app/ serves it.
COPY --from=app /app/prototype/dist/index.html ./prototype/dist/index.html

ENV NODE_ENV=production
ENV PROTO_DIST=/app/prototype/dist
# ROLE, DOOR_ORIGIN and PLATFORM_ORIGIN are required and are set per deployment (maritime env set ... --reload).
CMD ["node", "scripts/serve-demo.mjs"]
