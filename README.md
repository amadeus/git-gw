# git-gw

TypeScript reimplementation of the `gw` fish function for managing git worktree
projects.

Development uses Bun for convenience. The published CLI will still ship as
normal Node-compatible build output.

## Status

The core commands, shell integration, and searchable `gw switch` picker are in
place.

## Local Development

```bash
bun install
bun run dev -- --help
bun run build
bun run format
bun run format:check
bun run lint
bun run test
bun run typecheck
bun run pack:check
bun run pack:smoke
```

`bun run format` also rewrites internal relative imports to the `@/` alias
before running `oxfmt`.

## Linked CLI Workflow

Use `npm link` when you want a real `gw` command in your shell while developing:

```bash
bun run build
npm link
```

For current-session shell integration without editing rc files:

```bash
# bash / zsh
eval "$(gw shell-init)"

# fish
gw shell-init | source
```

If you want help choosing between session-only activation and a persistent
install, run:

```bash
gw setup
```

To install persistent shell integration explicitly:

```bash
gw setup --install
```

After code changes, rebuild before retesting the linked CLI:

```bash
bun run build
```

## Pack Workflow

Use `npm pack` verification before publishing or sharing a beta tarball:

```bash
bun run pack:check
bun run pack:smoke
```

`bun run pack:smoke` builds the CLI, creates a real tarball with `npm pack`,
installs it into a clean temp directory, and verifies that the packaged `gw`
binary and `shell-init` flow work from the installed artifact.

If you want the tarball itself for manual testing or sharing:

```bash
npm pack
```

## Install

Publishing docs will be expanded as release workflow and prerelease distribution
are finalized.
