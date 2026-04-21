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
- The CLI entrypoint is `src/cli.ts`; the npm `bin.gw` entry must point at the
  bundled Node output `dist/cli.js`.
- Keep the `prepare` script Node/npm-compatible so Git branch or commit installs
  can build without Bun.
- Use `oxfmt` for formatting JavaScript, TypeScript, and JSON files.
- Use `oxlint` for repository lint checks.

## Import Style

- Use the `@/` alias for imports from the TypeScript source root.
- Do not use relative imports inside `src/`.

## Project Workflow

- Keep `PLAN.md` current as phases and checklist items are completed.
- Add new conventions to this file when they become important project rules.

## Runtime Behavior

- Preserve compatibility with existing `.gw_project` files and the `flat-tilde`
  worktree folder layout.
- `gw switch` and `gw clone` are the commands that need shell-side directory
  changes. They communicate target directories through `GW_CWD_FILE`; keep the
  shell wrappers in `src/core/shell.ts` synchronized if that command set
  changes.
- Shell integration targets `bash`, `zsh`, `fish`, and `nu`. Missing shells may
  cause local smoke tests to skip, not fail.

## Packaging

- Published package contents should stay minimal: `package.json`, `README.md`,
  `LICENSE`, and `dist/cli.js`.
- Use `bun run pack:smoke` to verify the packed artifact, `bin` wiring, and
  shell handoff behavior from an installed tarball.
- Beta versions use semver prerelease identifiers such as `0.1.0-beta.0`; prefer
  exact tarball versions or Git commit SHAs for tester installs.
