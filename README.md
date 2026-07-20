# Livery documentation

[![ci](https://github.com/jerkeyray/livery-docs/actions/workflows/ci.yml/badge.svg)](https://github.com/jerkeyray/livery-docs/actions/workflows/ci.yml)

This repository contains the canonical documentation and hosted Studio for [Livery](https://github.com/jerkeyray/livery), a programmable visual language for validated technical diagrams.

The public site lives at [livery.jerkeyray.com](https://livery.jerkeyray.com). It serves the human documentation, Studio, generated language reference, and agent-readable `/llms.txt`, `/llms-full.txt`, and per-page Markdown routes.

> **Alpha preview:** the `liveryscript` npm package is not presented as available until registry publication and clean-install verification succeed. Use Studio or a source checkout during the preview.

## Repository layout

The deployable Next.js and Fumadocs application is in [`livery-docs/`](./livery-docs). The site bootstraps an exact Livery compiler revision, generates its reference from `getLanguageCatalog()`, and compiles every documented Livery example.

```text
.
├── livery-docs/       Next.js site, Studio, content, and verification scripts
├── .github/workflows  Documentation CI
└── LICENSE
```

## Local development

Requires Bun 1.3 or newer and Node.js 22 or newer.

```bash
cd livery-docs
bun run bootstrap:livery
bun install --frozen-lockfile
bun run dev
```

When this repository is checked out beside the Livery monorepo, bootstrap uses `../../livery`. Otherwise it clones `LIVERY_REPOSITORY_URL` into the ignored `.vendor/source` directory and checks out `LIVERY_REPOSITORY_REF`.

Copy `livery-docs/.env.example` to `livery-docs/.env.local` before using hosted Studio generation. The documentation itself does not require provider credentials.

## Verification

Run the same foundation checks used by CI:

```bash
cd livery-docs
bun run verify
```

The verification pass checks generated-reference drift, all Livery examples, internal links, navigation, agent-text routes, TypeScript, unit tests, and the production build.

## Deployment

The Vercel project root must be `livery-docs`. Pin `LIVERY_REPOSITORY_REF` to the release tag or immutable commit the site documents, set `NEXT_PUBLIC_SITE_URL=https://livery.jerkeyray.com`, and configure the Studio secrets described in [the application README](./livery-docs/README.md).

Publishing, DNS, provider spending limits, Upstash provisioning, and production deployment remain explicit maintainer actions.

## Contributing and security

Read [CONTRIBUTING.md](./CONTRIBUTING.md) before changing language examples or generated reference content. Security boundaries and hosted Studio controls are documented in [Security and limits](https://livery.jerkeyray.com/docs/operations/security); report vulnerabilities according to [SECURITY.md](./SECURITY.md).

Livery is available under the [MIT License](./LICENSE).
