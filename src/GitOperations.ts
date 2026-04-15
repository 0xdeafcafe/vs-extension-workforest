import { execFile } from "child_process";
import * as path from "path";
import type { ChangedFile, CommitInfo } from "./types";

const TIMEOUT_MS = 10_000;

function execGit(
  cwd: string,
  args: string[]
): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile("git", args, { cwd, timeout: TIMEOUT_MS }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(`git ${args[0]} failed in ${cwd}: ${stderr || err.message}`));
        return;
      }
      resolve(stdout);
    });
  });
}

export interface RawWorktreeEntry {
  path: string;
  head: string;
  branch: string;
}

/** Parse `git worktree list --porcelain` output into entries */
function parseWorktreeList(output: string): RawWorktreeEntry[] {
  const entries: RawWorktreeEntry[] = [];
  let current: Partial<RawWorktreeEntry> = {};

  for (const line of output.split("\n")) {
    if (line.startsWith("worktree ")) {
      current = { path: line.slice("worktree ".length) };
    } else if (line.startsWith("HEAD ")) {
      current.head = line.slice("HEAD ".length).substring(0, 8);
    } else if (line.startsWith("branch ")) {
      // Strip refs/heads/ prefix
      current.branch = line.slice("branch ".length).replace("refs/heads/", "");
    } else if (line === "" && current.path) {
      entries.push({
        path: current.path,
        head: current.head ?? "unknown",
        branch: current.branch ?? "detached",
      });
      current = {};
    }
  }

  // Handle last entry if output doesn't end with blank line
  if (current.path) {
    entries.push({
      path: current.path,
      head: current.head ?? "unknown",
      branch: current.branch ?? "detached",
    });
  }

  return entries;
}

export async function listWorktrees(repoRoot: string): Promise<RawWorktreeEntry[]> {
  const output = await execGit(repoRoot, ["worktree", "list", "--porcelain"]);
  const all = parseWorktreeList(output);

  // Filter to only .claude/worktrees/ entries
  const claudeWorktreesDir = path.join(repoRoot, ".claude", "worktrees") + path.sep;
  return all.filter((entry) => entry.path.startsWith(claudeWorktreesDir));
}

export async function getStatus(worktreePath: string): Promise<ChangedFile[]> {
  const output = await execGit(worktreePath, ["status", "--porcelain"]);
  const files: ChangedFile[] = [];

  for (const line of output.split("\n")) {
    if (line.length < 4) continue;
    const staged = line[0];
    const unstaged = line[1];
    const relativePath = line.slice(3);
    files.push({ staged, unstaged, relativePath });
  }

  return files;
}

export async function getRecentCommits(
  worktreePath: string,
  count: number = 10
): Promise<CommitInfo[]> {
  const output = await execGit(worktreePath, [
    "log",
    `--format=%h\x1f%s\x1f%cr`,
    `-${count}`,
  ]);

  const commits: CommitInfo[] = [];
  for (const line of output.split("\n")) {
    if (!line) continue;
    const [sha, message, relativeDate] = line.split("\x1f");
    if (sha && message && relativeDate) {
      commits.push({ sha, message, relativeDate });
    }
  }

  return commits;
}

export async function getMainBranch(worktreePath: string): Promise<string> {
  try {
    const output = await execGit(worktreePath, [
      "symbolic-ref",
      "refs/remotes/origin/HEAD",
    ]);
    // Output: refs/remotes/origin/main
    const ref = output.trim();
    return ref.split("/").pop() ?? "main";
  } catch {
    return "main";
  }
}

export async function getCommitsAhead(
  worktreePath: string,
  mainBranch: string
): Promise<number> {
  try {
    const output = await execGit(worktreePath, [
      "rev-list",
      "--count",
      `HEAD`,
      `^origin/${mainBranch}`,
    ]);
    return parseInt(output.trim(), 10) || 0;
  } catch {
    return 0;
  }
}

export async function showFile(
  worktreePath: string,
  ref: string
): Promise<string> {
  return execGit(worktreePath, ["show", ref]);
}
