import * as vscode from "vscode";
import * as path from "path";
import type { ChangedFile, CommitInfo, WorktreeInfo } from "./types";

export type NodeKind =
  | "workspaceFolder"
  | "worktree"
  | "changedFilesGroup"
  | "changedFile"
  | "recentCommitsGroup"
  | "commit";

export class WorktreeNode extends vscode.TreeItem {
  constructor(
    public readonly kind: NodeKind,
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly worktreePath?: string,
    public readonly workspaceFolderUri?: string
  ) {
    super(label, collapsibleState);
  }

  /** Extra data stored on specific node kinds */
  changedFile?: ChangedFile;
  commit?: CommitInfo;
  worktreeInfo?: WorktreeInfo;

  static workspaceFolder(
    folderName: string,
    folderUri: string
  ): WorktreeNode {
    const node = new WorktreeNode(
      "workspaceFolder",
      folderName,
      vscode.TreeItemCollapsibleState.Expanded,
      undefined,
      folderUri
    );
    node.iconPath = new vscode.ThemeIcon("root-folder");
    return node;
  }

  static worktree(info: WorktreeInfo): WorktreeNode {
    const dirName = path.basename(info.path);
    const node = new WorktreeNode(
      "worktree",
      dirName,
      vscode.TreeItemCollapsibleState.Collapsed,
      info.path,
      info.workspaceFolder.uri.toString()
    );
    node.description = info.branch;
    node.tooltip = `${info.path}\nBranch: ${info.branch}\nHEAD: ${info.head}`;
    node.iconPath = new vscode.ThemeIcon("git-branch");
    node.contextValue = "worktree";
    node.worktreeInfo = info;
    return node;
  }

  static changedFilesGroup(
    count: number,
    worktreePath: string
  ): WorktreeNode {
    const node = new WorktreeNode(
      "changedFilesGroup",
      "Changed Files",
      count > 0
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None,
      worktreePath
    );
    node.description = `(${count})`;
    node.iconPath = new vscode.ThemeIcon("diff");
    return node;
  }

  static changedFileNode(
    file: ChangedFile,
    worktreePath: string
  ): WorktreeNode {
    const fileName = path.basename(file.relativePath);
    const dirPath = path.dirname(file.relativePath);
    const node = new WorktreeNode(
      "changedFile",
      fileName,
      vscode.TreeItemCollapsibleState.None,
      worktreePath
    );
    node.description = dirPath === "." ? "" : dirPath;
    node.changedFile = file;
    node.contextValue = "changedFile";

    // Pick icon based on status
    const status = file.staged !== " " && file.staged !== "?" ? file.staged : file.unstaged;
    switch (status) {
      case "M":
        node.iconPath = new vscode.ThemeIcon(
          "diff-modified",
          new vscode.ThemeColor("gitDecoration.modifiedResourceForeground")
        );
        break;
      case "A":
        node.iconPath = new vscode.ThemeIcon(
          "diff-added",
          new vscode.ThemeColor("gitDecoration.addedResourceForeground")
        );
        break;
      case "D":
        node.iconPath = new vscode.ThemeIcon(
          "diff-removed",
          new vscode.ThemeColor("gitDecoration.deletedResourceForeground")
        );
        break;
      case "?":
        node.iconPath = new vscode.ThemeIcon(
          "question",
          new vscode.ThemeColor("gitDecoration.untrackedResourceForeground")
        );
        break;
      default:
        node.iconPath = new vscode.ThemeIcon("diff-modified");
    }

    return node;
  }

  static recentCommitsGroup(
    commitsAhead: number,
    mainBranch: string,
    worktreePath: string
  ): WorktreeNode {
    const node = new WorktreeNode(
      "recentCommitsGroup",
      "Commits",
      vscode.TreeItemCollapsibleState.Collapsed,
      worktreePath
    );
    node.description =
      commitsAhead > 0
        ? `(${commitsAhead} ahead of ${mainBranch})`
        : `(up to date with ${mainBranch})`;
    node.iconPath = new vscode.ThemeIcon("git-commit");
    return node;
  }

  static commitNode(commit: CommitInfo): WorktreeNode {
    const node = new WorktreeNode(
      "commit",
      commit.message,
      vscode.TreeItemCollapsibleState.None
    );
    node.description = `${commit.sha}  ${commit.relativeDate}`;
    node.iconPath = new vscode.ThemeIcon("git-commit");
    node.commit = commit;
    return node;
  }
}
