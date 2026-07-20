<div align="center">

<p>
  <img src="livery-docs/public/livery-lockup.svg" alt="Livery" width="168">
</p>

<p>
  <strong>Documentation and Studio for programmable visuals.</strong>
</p>

<p>
  Compiler-derived reference &middot; Agent-readable routes &middot; Validated visual workbench
</p>

<p>
  <a href="https://livery.jerkeyray.com/docs">Documentation</a> &middot;
  <a href="https://livery.jerkeyray.com/studio">Studio</a> &middot;
  <a href="https://github.com/jerkeyray/livery">Livery source</a> &middot;
  <a href="https://github.com/jerkeyray/livery-docs/actions/workflows/ci.yml">CI</a>
</p>

</div>

---

## The documentation is part of the product.

This repository powers [livery.jerkeyray.com](https://livery.jerkeyray.com): the canonical human documentation, prompt-first Studio, generated language reference, and agent-readable `/llms.txt`, `/llms-full.txt`, and per-page Markdown routes for [Livery](https://github.com/jerkeyray/livery).

The site builds against an exact compiler revision. It generates its standard-library reference from `getLanguageCatalog()` and compiles every documented Livery program before it ships.

```text
Livery compiler snapshot
  -> generated language reference
  -> human docs / agent text / Studio examples
  -> deployed documentation
```

If the compiler, catalog, example, link, or route drifts, verification fails instead of publishing a misleading guide.

## What's included

- **Two clear journeys:** build a figure with Livery, or build a bounded agent generation and repair loop.
- **Compiler-derived reference:** components, values, calls, contexts, ports, and status are generated—not maintained by hand.
- **Source-backed examples:** every gallery example opens instantly in Studio and compiles at desktop and compact widths.
- **Agent-readable documentation:** `/llms.txt`, `/llms-full.txt`, and Markdown page representations mirror the human information architecture.
- **Prompt-first Studio:** chat, source, examples, retained valid renders, revision history, export, and responsive canvas controls in one workbench.
- **Hosted safeguards:** HMAC-keyed Upstash quotas, no raw-IP storage, production fail-closed behavior, and prompt-free operational telemetry.

## Public preview

Livery is available from source and in the hosted [Studio](https://livery.jerkeyray.com/studio). The `liveryscript` npm package remains a preview claim until npm publication and fresh npm/Bun installation checks have completed.

For the current source checkout:

```sh
git clone https://github.com/jerkeyray/livery-docs.git
cd livery-docs/livery-docs
bun run bootstrap:livery
bun install --frozen-lockfile
bun run dev
```

When publishing is verified, installation documentation will use `bun add liveryscript`; PNG additionally requires `bun add @resvg/resvg-js`.

## Verification

The deployable Next.js/Fumadocs application lives in [`livery-docs/`](./livery-docs). Run its complete local gate:

```sh
cd livery-docs
bun run verify
```

This checks generated-reference drift, all Livery examples, internal links, navigation, agent-text routes, TypeScript, unit tests, and the production build.

## Deploying the site

Create a Vercel project with `livery-docs` as its root directory. Pin `LIVERY_REPOSITORY_REF` to the release tag or immutable compiler commit that the site documents, set `NEXT_PUBLIC_SITE_URL=https://livery.jerkeyray.com`, and configure the Studio secrets in [the application README](./livery-docs/README.md).

The repository CI runs the same verification gate for pull requests and pushes to `main`. Publishing, DNS, provider spend limits, Upstash provisioning, and production deployment remain explicit maintainer actions.

## Contributing and security

Read [CONTRIBUTING.md](./CONTRIBUTING.md) before changing language examples or generated reference content. Security boundaries and Studio limits are documented in [Security and limits](https://livery.jerkeyray.com/docs/operations/security); report vulnerabilities according to [SECURITY.md](./SECURITY.md).

## Status

Livery is pre-1.0 and in public preview. The docs foundation and Studio are ready to evaluate from source; npm availability becomes a documented fact only after trusted publication and clean-consumer verification.

## License

[MIT](./LICENSE), Copyright 2026 Aditya Srivastava
