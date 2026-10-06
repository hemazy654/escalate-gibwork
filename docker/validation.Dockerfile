# BASE_IMAGE is resolved to the official Node image's immutable registry digest.
ARG BASE_IMAGE
FROM ${BASE_IMAGE}
# Installed, lockfile-controlled tooling only. No repository or wallet is baked in.
COPY typescript /opt/typescript
COPY node-types /opt/types/node
COPY undici-types /opt/types/node/node_modules/undici-types
RUN node --version && git --version && node /opt/typescript/bin/tsc --version
