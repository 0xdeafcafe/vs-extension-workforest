# Workforest

claude code loves making worktrees. it spins up a new one every time it wants to try something, dumps it in `.claude/worktrees/`, and never tells you about it. you end up with a forest of half-finished branches buried in your project directory that you can only find by running `git worktree list` like some kind of cave person.

this fixes that. it adds a sidebar panel to VS Code that shows all your active claude code worktrees across every project in your workspace. branch names, changed files, commit history — all right there. it also auto-manages your `.code-workspace` file so new worktrees show up as workspace folders (prefixed with 🌴 so you can spot them) and dead ones get cleaned out. worktrees with no commits in the last 5 days are considered stale and hidden automatically.

designed in my head, built in claude. loved by people who have too many worktrees and know it.

## install

grab the `.vsix` from the latest [GitHub Actions build](https://github.com/0xdeafcafe/vs-extension-workforest/actions), then in VS Code:

```
Extensions: Install from VSIX...
```

that's it. if any of your workspace folders have a `.claude/worktrees/` directory, the sidebar icon appears automatically.

## what you get

a tree view in the sidebar that looks like this:

```
feat+ops-functions
  branch: feat/ops-functions
  ├── Changed Files (3)
  │     ├── M  src/index.ts
  │     ├── A  new-file.ts
  │     └── ?? untracked.ts
  └── Commits (42 ahead of main)
        ├── abc1234  fix: thing       2h ago
        └── def5678  feat: other      1d ago
```

worktree details (changed files, commits) load lazily when you expand a node. the worktree list itself refreshes on window focus, filesystem changes, or the manual refresh button.

## actions

| button | what it does |
|--------|-------------|
| refresh icon | re-scan for worktrees |
| window icon (on worktree) | open in a new VS Code window |
| terminal icon (on worktree) | open a terminal cd'd there |
| diff icon (on changed file) | show the working tree diff |

## workspace sync

if you use VS Code's multi-root workspaces (`.code-workspace` files), workforest keeps them in sync with your worktrees. new worktrees get added under a `🌳 <project> worktrees` divider section, each prefixed with 🌴 so they're visually distinct from your real project folders. stale worktrees (nothing committed in 5 days) and deleted ones get removed automatically. empty sections get cleaned up too. you don't have to touch your workspace file.

```json
{ "name": "langwatch", "path": "langwatch-saas/langwatch" },
{ "name": "🌳 langwatch worktrees", "path": "langwatch-saas/langwatch" },
{ "name": "🌴 feat+ops-functions", "path": "langwatch-saas/langwatch/.claude/worktrees/feat+ops-functions" },
{ "name": "🌴 observe-package", "path": "langwatch-saas/langwatch/.claude/worktrees/observe-package" },
```

## how it finds worktrees

scans every workspace folder for a `.claude/worktrees/` directory. runs `git worktree list --porcelain` to discover them, then individual git commands (`status`, `log`, `rev-list`) per worktree for details. all git calls use `execFile` with a 10-second timeout, no shell.

## build it yourself

```bash
npm install
npm run build
npx @vscode/vsce package --no-dependencies -o workforest.vsix
```
