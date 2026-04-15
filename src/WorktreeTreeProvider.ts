import * as vscode from "vscode";
import { WorktreeNode } from "./WorktreeNode";
import { WorktreeDiscovery } from "./WorktreeDiscovery";
import * as GitOperations from "./GitOperations";
import type { WorktreeDetails, WorktreeInfo } from "./types";

export class WorktreeTreeProvider
  implements vscode.TreeDataProvider<WorktreeNode>, vscode.Disposable
{
  private worktreesByFolder = new Map<string, WorktreeInfo[]>();
  private detailsCache = new Map<string, WorktreeDetails>();
  private discovery: WorktreeDiscovery;

  private readonly _onDidChangeTreeData = new vscode.EventEmitter<
    WorktreeNode | undefined
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor() {
    this.discovery = new WorktreeDiscovery(() => this.refresh());
    this.refresh();
  }

  async refresh(): Promise<void> {
    this.detailsCache.clear();
    this.worktreesByFolder = await this.discovery.discover();
    this._onDidChangeTreeData.fire(undefined);
  }

  /** Returns all discovered worktrees (flat list across all folders) */
  getAllWorktrees(): WorktreeInfo[] {
    const all: WorktreeInfo[] = [];
    for (const infos of this.worktreesByFolder.values()) {
      all.push(...infos);
    }
    return all;
  }

  getTreeItem(element: WorktreeNode): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: WorktreeNode): Promise<WorktreeNode[]> {
    if (!element) {
      return this.getRootChildren();
    }

    switch (element.kind) {
      case "workspaceFolder":
        return this.getWorktreeNodes(element.workspaceFolderUri!);
      case "worktree":
        return this.getWorktreeDetails(element.worktreePath!);
      case "changedFilesGroup":
        return this.getChangedFileNodes(element.worktreePath!);
      case "recentCommitsGroup":
        return this.getCommitNodes(element.worktreePath!);
      default:
        return [];
    }
  }

  private getRootChildren(): WorktreeNode[] {
    const foldersWithWorktrees = [...this.worktreesByFolder.entries()];

    if (foldersWithWorktrees.length === 0) {
      return [];
    }

    // If only one workspace folder has worktrees, skip the folder level
    if (foldersWithWorktrees.length === 1) {
      const [folderUri] = foldersWithWorktrees[0];
      return this.getWorktreeNodes(folderUri);
    }

    // Multiple folders — show folder grouping
    return foldersWithWorktrees.map(([folderUri, infos]) => {
      const folderName = infos[0].workspaceFolder.name;
      return WorktreeNode.workspaceFolder(folderName, folderUri);
    });
  }

  private getWorktreeNodes(folderUri: string): WorktreeNode[] {
    const infos = this.worktreesByFolder.get(folderUri) ?? [];
    return infos.map((info) => WorktreeNode.worktree(info));
  }

  private async getWorktreeDetails(
    worktreePath: string
  ): Promise<WorktreeNode[]> {
    const details = await this.fetchDetails(worktreePath);
    return [
      WorktreeNode.changedFilesGroup(
        details.changedFiles.length,
        worktreePath
      ),
      WorktreeNode.recentCommitsGroup(
        details.commitsAhead,
        details.mainBranch,
        worktreePath
      ),
    ];
  }

  private async getChangedFileNodes(
    worktreePath: string
  ): Promise<WorktreeNode[]> {
    const details = await this.fetchDetails(worktreePath);
    return details.changedFiles.map((f) =>
      WorktreeNode.changedFileNode(f, worktreePath)
    );
  }

  private async getCommitNodes(
    worktreePath: string
  ): Promise<WorktreeNode[]> {
    const details = await this.fetchDetails(worktreePath);
    return details.recentCommits.map((c) => WorktreeNode.commitNode(c));
  }

  private async fetchDetails(worktreePath: string): Promise<WorktreeDetails> {
    const cached = this.detailsCache.get(worktreePath);
    if (cached) return cached;

    const [mainBranch, changedFiles, recentCommits] = await Promise.all([
      GitOperations.getMainBranch(worktreePath),
      GitOperations.getStatus(worktreePath),
      GitOperations.getRecentCommits(worktreePath, 10),
    ]);

    const commitsAhead = await GitOperations.getCommitsAhead(
      worktreePath,
      mainBranch
    );

    const details: WorktreeDetails = {
      changedFiles,
      commitsAhead,
      recentCommits,
      mainBranch,
    };
    this.detailsCache.set(worktreePath, details);
    return details;
  }

  dispose(): void {
    this.discovery.dispose();
    this._onDidChangeTreeData.dispose();
  }
}
