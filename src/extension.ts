import * as vscode from "vscode";
import * as path from "path";
import { WorktreeTreeProvider } from "./WorktreeTreeProvider";
import { WorktreeNode } from "./WorktreeNode";
import { WorkspaceSync } from "./WorkspaceSync";
import * as GitOperations from "./GitOperations";

export function activate(context: vscode.ExtensionContext): void {
  const treeProvider = new WorktreeTreeProvider();

  const treeView = vscode.window.createTreeView("workforest.worktrees", {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });

  const workspaceSync = new WorkspaceSync(treeProvider);

  // Register diff content provider
  const diffProvider = new WorkforestDiffProvider();
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(
      "workforest-git",
      diffProvider
    )
  );

  // Register commands
  context.subscriptions.push(
    treeView,
    treeProvider,
    workspaceSync,

    vscode.commands.registerCommand("workforest.refresh", () =>
      treeProvider.refresh()
    ),

    vscode.commands.registerCommand(
      "workforest.openInNewWindow",
      (node: WorktreeNode) => {
        if (node.worktreePath) {
          vscode.commands.executeCommand(
            "vscode.openFolder",
            vscode.Uri.file(node.worktreePath),
            { forceNewWindow: true }
          );
        }
      }
    ),

    vscode.commands.registerCommand(
      "workforest.openInTerminal",
      (node: WorktreeNode) => {
        if (node.worktreePath) {
          const terminal = vscode.window.createTerminal({
            name: path.basename(node.worktreePath),
            cwd: node.worktreePath,
          });
          terminal.show();
        }
      }
    ),

    vscode.commands.registerCommand(
      "workforest.openDiff",
      (node: WorktreeNode) => {
        if (!node.worktreePath || !node.changedFile) return;

        const file = node.changedFile;
        const absPath = path.join(node.worktreePath, file.relativePath);

        // Untracked files — just open the file directly
        if (file.staged === "?" && file.unstaged === "?") {
          vscode.window.showTextDocument(vscode.Uri.file(absPath));
          return;
        }

        const leftUri = vscode.Uri.parse(
          `workforest-git://show?${encodeURIComponent(
            JSON.stringify({
              worktreePath: node.worktreePath,
              relativePath: file.relativePath,
            })
          )}`
        );
        const rightUri = vscode.Uri.file(absPath);
        const fileName = path.basename(file.relativePath);

        vscode.commands.executeCommand(
          "vscode.diff",
          leftUri,
          rightUri,
          `${fileName} (Working Tree)`
        );
      }
    )
  );

  // Auto-refresh on window focus
  context.subscriptions.push(
    vscode.window.onDidChangeWindowState((e) => {
      if (e.focused) treeProvider.refresh();
    })
  );
}

class WorkforestDiffProvider implements vscode.TextDocumentContentProvider {
  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    const params = JSON.parse(decodeURIComponent(uri.query));
    const { worktreePath, relativePath } = params as {
      worktreePath: string;
      relativePath: string;
    };

    try {
      return await GitOperations.showFile(
        worktreePath,
        `HEAD:${relativePath}`
      );
    } catch {
      return "";
    }
  }
}

export function deactivate(): void {
  // Disposed via context.subscriptions
}
