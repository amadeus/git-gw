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
- GitHub CLI (`gh`) for `gw pr`
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

Shell integration is required for `gw clone`, `gw switch`, and `gw pr` to change
the current shell directory. Without it, the Node CLI can only print the target
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

Persistent setup writes generated integration to the user's config directory.
For `bash`, `zsh`, and `nu`, it adds a small managed source block to the shell
rc file. For `fish`, it installs an autoloaded `gw` function file under
`$XDG_CONFIG_HOME/fish/functions`. If shell integration is already active in the
current session, `gw setup --install` also sources the generated integration
immediately. If shell integration is not active yet, `gw setup --install` prints
the exact `source` command to run once in the current shell. New shell sessions
load the persistent integration automatically.

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

Check out a GitHub pull request into a `pr_<number>` worktree and switch to it:

```bash
gw pr 123
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
gw pr <number>
gw remove|rm [--force] [--remote] [--ignore-prefix] <branch>
gw clone [--branch-prefix <prefix>] <project-name> <repo-url>
gw init [--branch-prefix <prefix>]
gw shell-init [--shell bash|zsh|fish|nu]
gw setup [--install] [--shell bash|zsh|fish|nu]
gw --version | gw -v
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
- `gw switch` treats explicit prefixed names as exact branch names. When a
  branch prefix is configured and an unprefixed name is provided, it checks both
  the prefixed and raw branch names locally and remotely, prompts if both exist,
  and creates the prefixed variant if neither exists.
- `gw pr <number>` requires `gh`, reads the PR head branch and owner, creates or
  reuses a fork remote, checks out local branch `pr_<number>`, and switches to
  the `pr_<number>` worktree.
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

## Local npm Link Testing

Use `npm link` when you want to test the built package as a real `gw` command
from your normal shell without publishing or packing a tarball.

From the repository root:

```bash
bun install
bun run build
npm link
gw --help
```

The linked `gw` command points at this checkout's `dist/cli.js`. After source
changes, rebuild before retesting:

```bash
bun run build
gw --help
```

To test commands that change directories, activate shell integration in the same
shell session after linking. For example, in `zsh`:

```bash
eval "$(gw shell-init --shell zsh)"
```

Replace `zsh` with `bash`, `fish`, or `nu` as needed; see Shell Integration for
the shell-specific activation commands. Then test in a disposable project with
commands such as `gw clone`, `gw switch`, and `gw list`.

When finished, remove the global link:

```bash
npm unlink -g @amadeusdemarzi/git-gw
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
npm install -g --prefix /tmp/gw-prefix ./amadeusdemarzi-git-gw-<version>.tgz
PATH="/tmp/gw-prefix/bin:$PATH" gw --help
```

## npm Release

Before publishing, update `package.json` to the exact release version you want
to ship and commit that change. Use prerelease versions such as `0.1.0-beta.5`
for beta builds.

Run the full verification set from a clean checkout:

```bash
bun install
bun run format:check
bun run lint
bun run typecheck
bun run test
bun run pack:smoke
```

Check the package contents that npm will publish:

```bash
npm pack --dry-run
```

For a beta prerelease, publish with the `beta` dist-tag so it does not replace
the default `latest` install:

```bash
npm publish --access public --tag beta
```

For a stable release, publish to `latest`:

```bash
npm publish --access public --tag latest
```

After publishing, verify the npm metadata and install path:

```bash
npm view @amadeusdemarzi/git-gw version dist-tags
npm install -g @amadeusdemarzi/git-gw@beta
gw --help
```

Use `@latest` instead of `@beta` when verifying a stable release.

## Beta Distribution

Prerelease builds use semver prerelease versions like `0.1.0-beta.0`,
`0.1.0-beta.1`, and so on. Use exact versions and commit SHAs when asking
testers to reproduce a beta result.

For a local tarball beta:

```bash
bun run pack:smoke
npm pack
npm install -g ./amadeusdemarzi-git-gw-<version>.tgz
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
   `gw clone`, `gw switch`, `gw pr`, and `gw list` in a disposable worktree
   project.

## Troubleshooting

`gw clone`, `gw switch`, or `gw pr` prints a path but does not change
directories: shell integration is not active in the current shell. Run
`gw setup`, or run the session activation command for your shell.

If this starts after updating `gw`, the current shell may still have older
generated integration loaded. Run `gw setup --install --shell <shell>`, then
open a new shell or run the session activation command printed by `gw setup`.

`command gw switch ...` or `command gw pr ...` does not change directories:
`command gw` bypasses the shell wrapper. Use `gw switch ...` or `gw pr ...`.

`gw switch` without a branch fails in CI or scripts: the picker requires an
interactive terminal. Pass an explicit branch name.

`gw clone` cannot detect the remote default branch: verify that the repo URL is
reachable and that the remote advertises `HEAD`.

`gw pr` says GitHub CLI is required: install `gh` from https://cli.github.com/
and run `gh auth login`, then retry the command.

Persistent setup succeeded but the command still behaves the same: the shell
wrapper was not active yet. Open a new shell or run the session activation
command printed by `gw setup`. In `fish`, run the printed
`source ~/.config/fish/functions/gw.fish` command or open a new shell; a shell
that already resolved `gw` as an external command may not autoload the new
function until then.
