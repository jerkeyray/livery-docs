# Livery documentation

The canonical Livery documentation and Studio site for <https://livery.jerkeyray.com>. The site is a Next.js/Fumadocs application that builds against an exact Livery compiler snapshot and generates its language reference from that compiler.

## Local development

Install dependencies, bootstrap LiveryScript, and start the site:

```bash
bun run bootstrap:livery
bun install
bun run dev
```

The bootstrap script prefers a sibling checkout at `../../livery`. In a standalone checkout it clones `LIVERY_REPOSITORY_URL` into ignored `.vendor/source`, checks out `LIVERY_REPOSITORY_REF`, builds all private workspaces, then vendors the single public `liveryscript` artifact. Pin `LIVERY_REPOSITORY_REF` to a release tag or immutable commit for production documentation.

## Environment

Copy `.env.example` to `.env.local`. Studio requires an OpenAI API key and model names. Hosted production also requires Upstash Redis credentials and a long random `STUDIO_RATE_LIMIT_SALT`; production generation fails closed when durable quotas are unavailable.

Configure a project-level provider spend cap before enabling Studio. Generation requests set provider storage off, and application telemetry must record timing, status, model, and quota state without recording prompts or generated source.

## Generated reference and verification

```bash
bun run verify
```

For focused checks while editing:

```bash
bun run docs:generate
bun run docs:check
bun run types:check
bun test
bun run build
```

`docs:generate` emits syntax and standard-library reference content from `getLanguageCatalog()`. `docs:check` fails on generated drift, invalid Livery examples, broken internal links, missing navigation, or agent-text route coverage. The production build also regenerates the reference so deployed docs cannot silently diverge from the compiler.

## Deployment

Vercel runs the configured bootstrap and Next.js build. Set `NEXT_PUBLIC_SITE_URL=https://livery.jerkeyray.com`, pin `LIVERY_REPOSITORY_REF`, and provide the Studio environment variables in the production project. Deploy package installation copy only after `npm view liveryscript` confirms the documented version exists.

The agent-readable surfaces are `/llms.txt`, `/llms-full.txt`, and the Markdown representation of every documentation page.
