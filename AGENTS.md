# AGENTS

Project conventions to keep updated as the repo evolves.

## Dependency Policy

- Pin dependency versions exactly in `package.json`.
- Do not use semver range prefixes like `^` or `~`.
- Prefer the latest stable release when adding or updating dependencies, unless
  there is a documented compatibility reason not to.

## Tooling

- Use Bun for local development convenience.
- Do not require Bun for end users of the published CLI.
- Keep the published CLI as normal Node-compatible build output.
- Use `oxfmt` for formatting JavaScript, TypeScript, and JSON files.
- Use `oxlint` for repository lint checks.

## Import Style

- Use the `@/` alias for imports from the TypeScript source root.
- Do not use relative imports inside `src/`.

## Project Workflow

- Keep `PLAN.md` current as phases and checklist items are completed.
- Add new conventions to this file when they become important project rules.
