# syntax=docker/dockerfile:1
#
# One file, two images. Both are built from a fresh `yarn install` + `yarn build` of the
# monorepo source — nothing is reused from the host's node_modules or dist directories
# (see .dockerignore), so a run always exercises the code as it is on disk right now.
#
#   --target core-api  -> node, runs examples/core-api
#   --target core-web  -> nginx, serves the prerendered SPA + proxies core-api
#
# The expensive `workspace` stage is shared, so the two images build it once.

# ---------------------------------------------------------------------------------------------
# workspace — install the monorepo and build every publishable package plus core-api.
# ---------------------------------------------------------------------------------------------
FROM node:24-slim AS workspace

WORKDIR /app

# Yarn 4 ships via corepack; the version is pinned by the root package.json `packageManager`.
RUN corepack enable

# Copy the root manifests and *every* workspace package.json first. `--immutable` validates the
# lockfile against the full workspace graph, so a missing manifest fails the install — and this
# layer only busts when a dependency actually changes, not on every source edit.
COPY package.json yarn.lock .yarnrc.yml yarn.config.cjs ./
COPY packages/models/package.json packages/models/
COPY packages/utils/package.json packages/utils/
COPY packages/db/package.json packages/db/
COPY packages/core/package.json packages/core/
COPY packages/cms/package.json packages/cms/
COPY packages/vue/package.json packages/vue/
COPY examples/cms-api/package.json examples/cms-api/
COPY examples/cms-web/package.json examples/cms-web/
COPY examples/core-api/package.json examples/core-api/
COPY examples/core-web/package.json examples/core-web/
COPY examples/simple-todo-api/package.json examples/simple-todo-api/

RUN yarn install --immutable

COPY . .

# Stale .tsbuildinfo files that slipped into the build context would make `tsc -b` skip work it
# has to redo here, emitting nothing. Drop them, then build from source.
RUN find . -name '*.tsbuildinfo' -delete 2>/dev/null; yarn build

# ---------------------------------------------------------------------------------------------
# core-api — the real NestJS server.
# ---------------------------------------------------------------------------------------------
FROM workspace AS core-api

WORKDIR /app/examples/core-api

EXPOSE 4001

# Launched through `yarn` so Yarn's PnP loader is injected into NODE_OPTIONS — core-api's
# dependency graph (better-auth and friends) is ESM-only and will not resolve under a bare `node`.
CMD ["yarn", "start:prod"]

# ---------------------------------------------------------------------------------------------
# spa — generate the typed client from core-api's own OpenAPI spec, then build core-web.
# ---------------------------------------------------------------------------------------------
FROM workspace AS spa

# `examples/core-web/src/client/Api.ts` and `examples/core-api/docs/api-json.json` are both
# git-ignored generated artifacts, so a fresh clone does not have them. Regenerate both here
# rather than depending on whatever happens to be on the developer's disk. `GENERATE_SPEC=true`
# swaps in @trailmix-cms/db's stub connection and relaxes the required env, so the spec builds
# with no MongoDB and no real secret — the app writes the document and exits.
RUN yarn workspace core-api generate-spec \
    && yarn workspace core-api generate-client

# Vite inlines import.meta.env at build time, so the API origin is baked into the bundle.
ARG VITE_SERVICE_HOST
ARG VITE_BUILD_ID=e2e
ENV VITE_SERVICE_HOST=${VITE_SERVICE_HOST}
ENV VITE_BUILD_ID=${VITE_BUILD_ID}

# vite-ssg prerenders each route to static HTML; the router guard re-runs on the client after
# hydration, so the prerendered shell is safe to serve to signed-out and signed-in users alike.
RUN yarn workspace core-web build

# ---------------------------------------------------------------------------------------------
# core-web — the browser-facing edge: SPA on :8080, core-api proxy on :8081.
# ---------------------------------------------------------------------------------------------
FROM nginx:1.29-alpine AS core-web

COPY --from=spa /app/examples/core-web/dist /usr/share/nginx/html
COPY test/e2e/nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080 8081
