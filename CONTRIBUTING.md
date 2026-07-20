# Contributing to Livery documentation

Thank you for helping improve Livery. Documentation changes should stay synchronized with the compiler revision they describe.

## Before opening a change

1. Bootstrap the selected Livery compiler and install the site dependencies.
2. Keep public examples on `liveryscript` imports; private workspace packages are implementation details.
3. Do not manually edit generated catalog data. Change the compiler catalog, then regenerate the reference.
4. Ensure every fenced `livery` example compiles at the supported widths.
5. Run the full verification command.

```bash
cd livery-docs
bun run bootstrap:livery
bun install --frozen-lockfile
bun run verify
```

For content organization, language changes, geometry review, and commit conventions, see the [complete contribution guide](https://livery.jerkeyray.com/docs/operations/contributing).

Use concise lowercase conventional commit messages, such as `docs: clarify source installation` or `fix: correct connector example`.
