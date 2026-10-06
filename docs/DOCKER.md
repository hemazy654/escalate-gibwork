# Milestone 3: actual Docker validation

Verified on 2026-10-06 on an Apple silicon macOS test environment with Docker Desktop 4.94.0 and Engine 29.8.2. The Milestone 2 offline demo was neither changed nor rerun. This milestone exercises the production Docker validator using a fresh copy of the existing trusted fixture.

## Prepare a validation image

Docker Desktop must be running. Check `docker version` for both Client and Server. If the terminal cannot find Docker Desktop's CLI helpers, temporarily add its binaries:

```sh
export PATH="/Applications/Docker.app/Contents/Resources/bin:$HOME/.docker/bin:$PATH"
# Run from the cloned repository root
# One explicit public image download:
docker pull node:22-bookworm
# Build from the resolved registry digest, using installed lockfile-controlled tooling:
npm run docker:prepare
# Actual Docker validation; this does not invoke npm run demo:
npm run test:docker
```

On another clone, substitute its directory for the `cd` path and run `npm ci` first. The preparation command uses a tiny temporary build context containing only TypeScript, Node type declarations and their undici declarations from node_modules. Neither repository context, SDK credentials nor wallet material is baked into the image. The base is the official Node Debian image, which includes Git. Docker RUN build steps use `--network=none`; image acquisition and BuildKit registry metadata resolution are preparation activities, not sandbox execution.

Preparation stores the base registry digest and complete local image ID in `.escalate/docker-image.json`. Validation accepts either `repository@sha256:<digest>` or `sha256:<full-local-image-ID>`. Both are immutable references; mutable tags and shortened IDs are rejected. A locally built image need not be pushed to a registry. The local image ID addresses its image configuration and is distinct from a registry manifest digest. Validation keeps `--pull=never`.

The image remains installed for reuse. No container remains after checks. To deliberately remove only this validation image later, inspect `.escalate/docker-image.json` and use Docker's image removal command; do not prune unrelated Docker resources.

## What the checks prove

`npm run test:docker` performs real container execution and fails instead of skipping if Docker or the prepared image is missing:

1. A harmless patch leaves the genuine retry-policy bug intact; compiled tests return FAIL.
2. The existing candidate patch fixes the bug; TypeScript compiles in the container and both tests return PASS.
3. Runtime probes verify non-root execution, only loopback networking, rejected connection to an external IP, rejected root/input writes, no Docker socket, no forwarded synthetic host canary and no mounted original `.git`.
4. An invalid patch returns FAIL with exit code 2 before tests run.
5. `escalate review` retrieves the selected mock submission using the official SDK-backed offline transport, then validates its local patch through the actual Docker runner and returns a Docker-labelled PASS with the matching patch digest.
6. Docker inspection confirms read-only root and input mount, no capabilities, no-new-privileges, 512 MiB memory, one CPU and 128 PIDs. The original repository is unchanged and the named validation containers are removed.

These are observed settings and runtime boundary probes; they are not a kernel security audit or an exhaustive resource-exhaustion test. A trusted image and maintainer-selected test command remain required. PASS is advisory and a contributor can change tests, so maintainers must inspect patch/test integrity.

## Evidence

`.escalate/docker-validation.json` records full FAIL/PASS output, invalid-patch outcome, runtime boundary results, CLI review result, baseline, image references, patch digest, inspected settings and cleanup verification. It is ignored by Git. Tests must succeed before this artifact is written; compare its image with current preparation metadata when reviewing older results.

The fixture is recreated in temporary directories and removed afterward. Compiler and tests run inside the production container, never in the trusted local demo runner. Every result has `runner: "docker"` and `isolation: "docker"`.

## Gibwork and privacy constraints

This Docker test uses exclusively offline Gibwork transport. A separate Phase A discovery read was verified; see LIVE-READONLY.md. No real wallet is loaded; no transactions, bounty creation, funding, approvals, payouts, paid submissions or refunds occur. There are no automatic merges or agent resumes. The only network download is image preparation; candidate execution has no external networking.

The upstream SDK dependency advisories and UNLICENSED metadata still need review before any future live integration. Docker Desktop shares a Linux VM/kernel across containers; high-risk submissions warrant a dedicated hardened disposable VM. The environment verified here does not prove another user's Docker daemon or image is configured safely.
