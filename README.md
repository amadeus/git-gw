# git-gw

TypeScript reimplementation of the `gw` fish function for managing git worktree projects.

Development uses Bun for convenience. The published CLI will still ship as normal Node-compatible build output.

## Status

The project scaffold is in place. Command parity and shell integration are the next implementation steps.

## Local Development

```bash
bun install
bun run dev -- --help
bun run build
bun run test
bun run typecheck
bun run pack:check
```

## Install

Publishing and shell integration docs will be added as the CLI implementation lands.
