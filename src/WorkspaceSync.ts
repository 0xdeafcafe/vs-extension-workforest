import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import type { WorktreeTreeProvider } from "./WorktreeTreeProvider";

const DIVIDER_PREFIX = "\u{1F333} "; // 🌳
const WORKTREE_PREFIX = "\u{1F334} "; // 🌴

export class WorkspaceSync implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];
  private syncing = false;

  constructor(private readonly treeProvider: WorktreeTreeProvider) {
    // Sync whenever the tree data changes (which means worktrees were re-discovered)
    this.disposables.push(
      treeProvider.onDidChangeTreeData(() => this.sync())
    );
  }

  private async sync(): Promise<void> {
    if (this.syncing) return;
    this.syncing = true;

    try {
      const folders = vscode.workspace.workspaceFolders;
      if (!folders) return;

      const worktrees = this.treeProvider.getAllWorktrees();

      // Build set of worktree paths that currently exist
      const activeWorktreePaths = new Set(worktrees.map((w) => w.path));

      // Find existing workspace folder entries that are worktrees (path contains .claude/worktrees/)
      const existingWorktreeIndices: number[] = [];
      const existingDividerIndices: number[] = [];
      const existingWorktreePaths = new Set<string>();

      for (let i = 0; i < folders.length; i++) {
        const folder = folders[i];
        const fsPath = folder.uri.fsPath;

        if (
          fsPath.includes(`${path.sep}.claude${path.sep}worktrees${path.sep}`) ||
          folder.name.startsWith(WORKTREE_PREFIX)
        ) {
          existingWorktreeIndices.push(i);
          existingWorktreePaths.add(fsPath);
        } else if (folder.name.startsWith(DIVIDER_PREFIX) && folder.name.endsWith(" worktrees")) {
          existingDividerIndices.push(i);
        }
      }

      // Remove worktree entries whose directories no longer exist
      const toRemove: number[] = [];
      for (const idx of existingWorktreeIndices) {
        const fsPath = folders[idx].uri.fsPath;
        if (!activeWorktreePaths.has(fsPath) || !fs.existsSync(fsPath)) {
          toRemove.push(idx);
        }
      }

      // Add new worktrees that aren't yet in the workspace
      const toAdd: { info: typeof worktrees[0]; afterFolder: string }[] = [];
      for (const wt of worktrees) {
        if (!existingWorktreePaths.has(wt.path)) {
          toAdd.push({
            info: wt,
            afterFolder: wt.workspaceFolder.name,
          });
        }
      }

      if (toRemove.length === 0 && toAdd.length === 0) return;

      // Remove stale entries (in reverse order to preserve indices)
      for (const idx of toRemove.sort((a, b) => b - a)) {
        vscode.workspace.updateWorkspaceFolders(idx, 1);
      }

      // Group new worktrees by their parent workspace folder
      const byParent = new Map<string, typeof worktrees>();
      for (const item of toAdd) {
        const key = item.afterFolder;
        if (!byParent.has(key)) byParent.set(key, []);
        byParent.get(key)!.push(item.info);
      }

      // For each parent, find or create the divider, then insert worktrees after it
      const currentFolders = vscode.workspace.workspaceFolders ?? [];
      for (const [parentName, newWorktrees] of byParent) {
        const dividerName = `${DIVIDER_PREFIX}${parentName} worktrees`;

        // Find existing divider
        let dividerIdx = currentFolders.findIndex(
          (f) => f.name === dividerName
        );

        if (dividerIdx === -1) {
          // Find the parent folder to insert after
          const parentIdx = currentFolders.findIndex(
            (f) => f.name === parentName
          );
          const insertAt =
            parentIdx >= 0 ? parentIdx + 1 : currentFolders.length;

          // Find the parent folder's path for the divider
          const parentFolder = currentFolders.find(
            (f) => f.name === parentName
          );
          const dividerPath = parentFolder
            ? parentFolder.uri.fsPath
            : currentFolders[0]?.uri.fsPath ?? ".";

          // Insert divider
          vscode.workspace.updateWorkspaceFolders(insertAt, 0, {
            uri: vscode.Uri.file(dividerPath),
            name: dividerName,
          });

          dividerIdx = insertAt;
        }

        // Find the end of this section (next divider or end of list)
        const updatedFolders = vscode.workspace.workspaceFolders ?? [];
        let sectionEnd = updatedFolders.length;
        for (let i = dividerIdx + 1; i < updatedFolders.length; i++) {
          const name = updatedFolders[i].name;
          // Stop at any emoji-prefixed divider
          if (/^[\u{1F000}-\u{1FFFF}]/u.test(name)) {
            sectionEnd = i;
            break;
          }
        }

        // Insert new worktrees at the end of the section
        const foldersToAdd = newWorktrees.map((wt) => ({
          uri: vscode.Uri.file(wt.path),
          name: `${WORKTREE_PREFIX}${path.basename(wt.path)}`,
        }));

        vscode.workspace.updateWorkspaceFolders(
          sectionEnd,
          0,
          ...foldersToAdd
        );
      }

      // Clean up empty divider sections
      this.cleanupEmptyDividers();
    } finally {
      this.syncing = false;
    }
  }

  private cleanupEmptyDividers(): void {
    const folders = vscode.workspace.workspaceFolders ?? [];
    const toRemove: number[] = [];

    for (let i = 0; i < folders.length; i++) {
      const name = folders[i].name;
      if (!name.startsWith(DIVIDER_PREFIX) || !name.endsWith(" worktrees")) {
        continue;
      }

      // Check if the next entry is a worktree or another divider/end
      const nextIdx = i + 1;
      const hasWorktrees =
        nextIdx < folders.length &&
        (folders[nextIdx].name.startsWith(WORKTREE_PREFIX) ||
          folders[nextIdx].uri.fsPath.includes(
            `${path.sep}.claude${path.sep}worktrees${path.sep}`
          ));

      if (!hasWorktrees) {
        toRemove.push(i);
      }
    }

    for (const idx of toRemove.sort((a, b) => b - a)) {
      vscode.workspace.updateWorkspaceFolders(idx, 1);
    }
  }

  dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
  }
}
