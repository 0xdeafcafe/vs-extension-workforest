import * as vscode from "vscode";
import * as path from "path";
import { listWorktrees, getLastCommitEpoch } from "./GitOperations";
import type { WorktreeInfo } from "./types";

const STALE_DAYS = 5;

export class WorktreeDiscovery implements vscode.Disposable {
  private watchers: vscode.Disposable[] = [];
  private readonly onChangeCallback: () => void;

  constructor(onChange: () => void) {
    this.onChangeCallback = onChange;
    this.setupWatchers();
    this.watchWorkspaceFolderChanges();
  }

  async discover(): Promise<Map<string, WorktreeInfo[]>> {
    const result = new Map<string, WorktreeInfo[]>();
    const folders = vscode.workspace.workspaceFolders ?? [];

    const promises = folders.map(async (folder) => {
      try {
        const raw = await listWorktrees(folder.uri.fsPath);
        if (raw.length === 0) return;

        const cutoff = Math.floor(Date.now() / 1000) - STALE_DAYS * 86400;

        const withDates = await Promise.all(
          raw.map(async (entry) => ({
            info: {
              path: entry.path,
              workspaceFolder: folder,
              branch: entry.branch,
              head: entry.head,
            },
            epoch: await getLastCommitEpoch(entry.path),
          }))
        );

        const recent = withDates
          .filter((w) => w.epoch >= cutoff)
          .map((w) => w.info);

        if (recent.length > 0) {
          result.set(folder.uri.toString(), recent);
        }
      } catch {
        // Not a git repo or git not available — skip
      }
    });

    await Promise.all(promises);
    return result;
  }

  private setupWatchers(): void {
    // Watch for changes in .claude/worktrees/ across all workspace folders
    const watcher = vscode.workspace.createFileSystemWatcher(
      "**/.claude/worktrees/*"
    );

    const debounced = debounce(() => this.onChangeCallback(), 500);
    watcher.onDidCreate(debounced);
    watcher.onDidDelete(debounced);
    this.watchers.push(watcher);
  }

  private watchWorkspaceFolderChanges(): void {
    const sub = vscode.workspace.onDidChangeWorkspaceFolders(() => {
      this.onChangeCallback();
    });
    this.watchers.push(sub);
  }

  dispose(): void {
    for (const w of this.watchers) {
      w.dispose();
    }
    this.watchers = [];
  }
}

function debounce(fn: () => void, delayMs: number): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(fn, delayMs);
  };
}

/** Get the worktree directory name from its full path */
export function worktreeDirName(worktreePath: string): string {
  return path.basename(worktreePath);
}
