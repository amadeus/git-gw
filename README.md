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

## Beta Distribution

Prerelease builds use semver prerelease versions like `0.1.0-beta.0`,
`0.1.0-beta.1`, and so on. Use exact versions and commit SHAs when asking
testers to reproduce a beta result.

For a local tarball beta:

```bash
bun run pack:smoke
npm pack
npm install -g ./git-gw-0.1.0-beta.0.tgz
gw setup
```

For a Git branch or commit beta, install from the branch name or, preferably, a
commit SHA:

```bash
npm install -g git+ssh://git@github.com/<owner>/<repo>.git#<branch-or-sha>
```

Git-based installs run the package `prepare` script, which builds `dist/cli.js`
with `tsup`. This path requires Node and npm in the tester environment, but it
does not require Bun.

Recommended branch/PR beta workflow:

1. Update the beta branch and run `bun run lint`, `bun run typecheck`,
   `bun run test`, and `bun run pack:smoke`.
2. Share either the generated tarball or a Git install command pinned to the
   tested commit SHA.
3. Have testers run `gw setup` or `eval "$(gw shell-init)"`, then verify
   `gw clone`, `gw switch`, and `gw list` in a disposable worktree project.

## Install

Publishing docs will be expanded as release workflow and prerelease distribution
are finalized.
