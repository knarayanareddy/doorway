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

ENV NODE_ENV=production
# ROLE, DOOR_ORIGIN and PLATFORM_ORIGIN are required and are set per deployment (maritime env set ... --reload).
CMD ["node", "scripts/serve-demo.mjs"]
