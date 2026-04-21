# git-gw

`gw` is an opinionated CLI for working with Git worktrees without dropping down
into the full verbosity of `git worktree` commands. It gives each branch its own
working directory while keeping everyday operations close to the branching
workflow you already know: clone a project, switch branches, list active
worktrees, and remove finished work with short `gw` commands.

Much of this project has been vibe coded from a reference fish helper function I
had before. Early beta will probably have some bugs/issues until I get
everything fully tested.

## Requirements

- Node.js 18.18 or newer
- Git
- npm for installation
- Bun only for repository development

## Install

After the package is published:

```bash
npm install -g @amadeusdemarzi/git-gw
gw setup
```

`gw setup` prints the session-only activation command and can install persistent
shell integration. To install persistent integration without prompting:

```bash
gw setup --install --shell zsh
```

Replace `zsh` with `bash`, `fish`, or `nu` as needed.

## Shell Integration

Shell integration is required for `gw clone` and `gw switch` to change the
current shell directory. Without it, the Node CLI can only print the target
path.

For a current-session setup:

```bash
# bash / zsh
eval "$(gw shell-init --shell bash)"
eval "$(gw shell-init --shell zsh)"

# fish
gw shell-init --shell fish | source

# nushell
let _gw_init = ($nu.default-config-dir | path join "gw-init.nu")
gw shell-init --shell nu | save --force $_gw_init
source $_gw_init
```

For persistent setup, prefer:

```bash
gw setup --install --shell bash
gw setup --install --shell zsh
gw setup --install --shell fish
gw setup --install --shell nu
```

Persistent setup writes generated integration to the user's config directory and
adds a small managed source block to the shell rc file.

## Quick Start

Clone a repository into a new gw project:

```bash
gw clone my-project git@github.com:owner/repo.git
```

This creates:

```text
my-project/
  .gw_project
  main/
```

The primary branch directory name comes from the remote default branch.

List worktrees:

```bash
gw list
```

Switch to an existing branch or create a worktree for it:

```bash
gw switch feature/login
```

Remove a worktree and its local branch:

```bash
gw remove feature/login
```

Remove with a remote branch delete:

```bash
gw remove --remote feature/login
```

Initialize an existing directory of child worktrees:

```bash
gw init
```

Use `--branch-prefix` when your local branch names have a shared prefix that
should not appear in folder names:

```bash
gw clone --branch-prefix amadeus/ my-project git@github.com:owner/repo.git
gw switch fix-build
```

With that config, `gw switch fix-build` resolves to `amadeus/fix-build` and uses
the folder `fix-build`.

## `gw switch` Picker

Running `gw switch` without a branch opens a searchable single-select picker in
an interactive terminal. It searches branch names, folder names, and paths.

The current worktree is preselected when possible and marked with `*`. Each row
shows the folder and branch, with path context available in the prompt hint.

In non-interactive contexts, `gw switch` without a branch fails with a clear
error instead of guessing.

## Command Reference

```text
gw list
gw switch [--ignore-prefix] [branch]
gw remove|rm [--force] [--remote] [--ignore-prefix] <branch>
gw clone [--branch-prefix <prefix>] <project-name> <repo-url>
gw init [--branch-prefix <prefix>]
gw shell-init [--shell bash|zsh|fish|nu]
gw setup [--install] [--shell bash|zsh|fish|nu]
gw help
```

## Behavior Notes

- `.gw_project` is the project marker file.
  - `version` is the config format version.
  - `primary` is the primary/default branch directory, usually `main` or
    `master`.
  - `remote` is the Git remote used for remote branch lookups and deletes,
    usually `origin`.
  - `path_style` controls worktree folder naming. The current supported value is
    `flat-tilde`.
  - `branch-prefix` is an optional branch prefix that `gw switch` can apply
    during branch resolution and strip from folder names.
- Worktree folders use the existing `flat-tilde` layout: branch slashes become
  `~`, so `feature/login` becomes `feature~login`.
- `gw switch` first accepts an existing worktree folder name, then checks local
  branches, remote branches, and branch-prefix-aware fallbacks.
- `gw remove` refuses to remove the primary branch and refuses to remove the
  current worktree while the shell is inside it.
- Relative `core.hooksPath` directories are copied from the primary worktree to
  newly created worktrees when possible.
- The npm package ships a Node CLI plus shell wrappers for `bash`, `zsh`,
  `fish`, and `nu`.
- The no-argument `gw switch` picker is searchable and interactive.

## Local Development

Development uses Bun for convenience. The published CLI ships as normal
Node-compatible build output and should not require Bun for end users.

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

Use `npm link` when you want a real `gw` command in your shell while developing:

```bash
bun run build
npm link
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

To validate a tarball with a temporary global prefix:

```bash
npm install -g --prefix /tmp/gw-prefix ./amadeusdemarzi-git-gw-0.1.0-beta.0.tgz
PATH="/tmp/gw-prefix/bin:$PATH" gw --help
```

## Beta Distribution

Prerelease builds use semver prerelease versions like `0.1.0-beta.0`,
`0.1.0-beta.1`, and so on. Use exact versions and commit SHAs when asking
testers to reproduce a beta result.

For a local tarball beta:

```bash
bun run pack:smoke
npm pack
npm install -g ./amadeusdemarzi-git-gw-0.1.0-beta.0.tgz
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

## Troubleshooting

`gw clone` or `gw switch` prints a path but does not change directories: shell
integration is not active in the current shell. Run `gw setup`, or run the
session activation command for your shell.

`command gw switch ...` does not change directories: `command gw` bypasses the
shell wrapper. Use `gw switch ...`.

`gw switch` without a branch fails in CI or scripts: the picker requires an
interactive terminal. Pass an explicit branch name.

`gw clone` cannot detect the remote default branch: verify that the repo URL is
reachable and that the remote advertises `HEAD`.

Persistent setup succeeded but the command still behaves the same: open a new
shell or source the updated shell rc file.
