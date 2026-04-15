import type * as vscode from "vscode";

export interface WorktreeInfo {
  /** Absolute path to the worktree directory */
  path: string;
  /** The workspace folder this worktree belongs to */
  workspaceFolder: vscode.WorkspaceFolder;
  /** Branch name (e.g., "feat/ops-functions") */
  branch: string;
  /** Short HEAD SHA */
  head: string;
}

export interface WorktreeDetails {
  changedFiles: ChangedFile[];
  commitsAhead: number;
  recentCommits: CommitInfo[];
  mainBranch: string;
}

export interface ChangedFile {
  /** Path relative to worktree root */
  relativePath: string;
  /** X column from porcelain: staged status */
  staged: string;
  /** Y column from porcelain: unstaged status */
  unstaged: string;
}

export interface CommitInfo {
  sha: string;
  message: string;
  relativeDate: string;
}
