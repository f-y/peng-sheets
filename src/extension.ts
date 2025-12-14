import * as vscode from 'vscode';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    let currentPanel: vscode.WebviewPanel | undefined = undefined;
    let activeDocument: vscode.TextDocument | undefined = undefined;

    context.subscriptions.push(vscode.commands.registerCommand('vscode-md-spreadsheet.openEditor', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.languageId !== 'markdown') {
            vscode.window.showErrorMessage('No active Markdown editor found');
            return;
        }

        if (currentPanel) {
            currentPanel.reveal(vscode.ViewColumn.Beside);
            if (activeDocument !== editor.document) {
                updatePanel(editor.document);
            }
        } else {
            createPanel(editor.document);
        }
    }));

    // Switch context when active editor changes
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
        if (currentPanel && editor && editor.document.languageId === 'markdown') {
            if (activeDocument !== editor.document) {
                updatePanel(editor.document);
            }
        }
    }));

    // Detect content changes
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(e => {
        if (currentPanel && activeDocument && e.document.uri.toString() === activeDocument.uri.toString()) {
            currentPanel.webview.postMessage({
                type: 'update',
                content: e.document.getText()
            });
        }
    }));

    // Detect config changes
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (currentPanel && e.affectsConfiguration('mdSpreadsheet.parsing')) {
            currentPanel.webview.postMessage({
                type: 'configUpdate',
                config: vscode.workspace.getConfiguration('mdSpreadsheet.parsing')
            });
        }
    }));

    function updatePanel(document: vscode.TextDocument) {
        if (!currentPanel) return;
        activeDocument = document;
        currentPanel.title = `MD Spreadsheet - ${path.basename(document.fileName)}`;
        currentPanel.webview.postMessage({
            type: 'update',
            content: document.getText()
        });
    }

    function createPanel(document: vscode.TextDocument) {
        activeDocument = document;
        currentPanel = vscode.window.createWebviewPanel(
            'mdSpreadsheet',
            `MD Spreadsheet - ${path.basename(document.fileName)}`,
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true, // Keep Pyodide alive when switching tabs
                localResourceRoots: [
                    vscode.Uri.joinPath(context.extensionUri, 'out', 'webview'),
                    vscode.Uri.joinPath(context.extensionUri, 'resources')
                ]
            }
        );

        currentPanel.webview.html = getWebviewContent(currentPanel.webview, context, document);

        currentPanel.onDidDispose(() => {
            currentPanel = undefined;
            activeDocument = undefined;
        }, null, context.subscriptions);

        currentPanel.webview.onDidReceiveMessage(
            async message => {
                if (!activeDocument) {
                    console.error("No active document!");
                    return;
                }
                // console.log("Received message from webview:", message);
                switch (message.type) {
                    case 'updateRange':
                        const startPosition = new vscode.Position(message.startLine, 0);
                        const endPosition = new vscode.Position(message.endLine, message.endCol ?? 0);
                        const range = new vscode.Range(startPosition, endPosition);

                        // Find editor
                        const editor = vscode.window.visibleTextEditors.find(e => e.document.uri.toString() === activeDocument?.uri.toString());

                        // Internal validation
                        let targetRange = range;
                        if (activeDocument) {
                            const validatedRange = activeDocument.validateRange(range);
                            if (!validatedRange.isEqual(range)) {
                                console.log(`Adjusting invalid range: ${range.start.line}-${range.end.line} -> ${validatedRange.start.line}-${validatedRange.end.line}`);
                            }
                            targetRange = validatedRange;
                        }

                        if (editor) {
                            editor.edit(editBuilder => {
                                editBuilder.replace(targetRange, message.content);
                            }).then(success => {
                                if (!success) {
                                    console.warn("TextEditor.edit failed. Retrying with WorkspaceEdit...");
                                    const edit = new vscode.WorkspaceEdit();
                                    edit.replace(activeDocument!.uri, targetRange, message.content);
                                    vscode.workspace.applyEdit(edit).then(wsSuccess => {
                                        if (!wsSuccess) {
                                            console.error("Fallback WorkspaceEdit failed.");
                                            vscode.window.showErrorMessage("Failed to update spreadsheet: Sync error.");
                                        }
                                    });
                                }
                            });
                        } else if (activeDocument) {
                            // Fallback to WorkspaceEdit
                            const edit = new vscode.WorkspaceEdit();
                            edit.replace(activeDocument.uri, targetRange, message.content);
                            vscode.workspace.applyEdit(edit).then(success => {
                                if (!success) {
                                    // This often fails if file changed "in the meantime" (version mismatch implicit)
                                    console.error("Workspace edit failed");
                                    vscode.window.showErrorMessage("Failed to update spreadsheet: Document version conflict.");
                                }
                            });
                        }
                        return;
                    case 'undo':
                        const editorForUndo = vscode.window.visibleTextEditors.find(e => e.document.uri.toString() === activeDocument?.uri.toString());
                        if (editorForUndo) {
                            await vscode.window.showTextDocument(editorForUndo.document, { viewColumn: editorForUndo.viewColumn, preserveFocus: false });
                            await vscode.commands.executeCommand('undo');
                            // Optional: Return focus to webview? 
                            // currentPanel?.reveal(vscode.ViewColumn.Beside, true); 
                            // But maybe syncing focus is confusing. Let's start with just executing it.
                        }
                        return;
                    case 'redo':
                        const editorForRedo = vscode.window.visibleTextEditors.find(e => e.document.uri.toString() === activeDocument?.uri.toString());
                        if (editorForRedo) {
                            await vscode.window.showTextDocument(editorForRedo.document, { viewColumn: editorForRedo.viewColumn, preserveFocus: false });
                            await vscode.commands.executeCommand('redo');
                        }
                        return;
                    case 'createSpreadsheet':
                        const wsEdit = new vscode.WorkspaceEdit();
                        const docText = activeDocument.getText();
                        const config = vscode.workspace.getConfiguration('mdSpreadsheet.parsing');
                        const rootMarker = config.get<string>('rootMarker') || '# Tables';

                        // Robust check: allow flexible whitespace in matched marker
                        // Escape regex characters
                        const escapedRoot = rootMarker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        // Allow one or more spaces where single spaces exist
                        const pattern = escapedRoot.replace(/\\ /g, '\\s+').replace(/\s+/g, '\\s+');
                        const rootRegex = new RegExp(pattern);

                        const hasRoot = rootRegex.test(docText);
                        const isZombie = docText.trim().match(new RegExp(`^${pattern}$`));

                        // Case 1: Document is effectively just the root marker (Zombie State) -> Replace All
                        if (isZombie) {
                            const template = `${rootMarker}\n\n## Sheet 1\n\n### Table 1\n\n| A | B |\n|---|---|\n|   |   |\n`;
                            const fullRange = new vscode.Range(
                                activeDocument.positionAt(0),
                                activeDocument.positionAt(docText.length)
                            );
                            wsEdit.replace(activeDocument.uri, fullRange, template);
                        }
                        // Case 2: Document contains root marker -> Append Sheet
                        else if (hasRoot) {
                            const template = `## Sheet 1\n\n### Table 1\n\n| A | B |\n|---|---|\n|   |   |\n`;
                            const prefix = docText.length > 0 && !docText.endsWith('\n') ? '\n\n' : (docText.length > 0 ? '\n' : '');
                            const insertPos = activeDocument.lineAt(activeDocument.lineCount - 1).range.end;
                            wsEdit.insert(activeDocument.uri, insertPos, prefix + template);
                        }
                        // Case 3: No root marker -> Append Full Structure
                        else {
                            const template = `${rootMarker}\n\n## Sheet 1\n\n### Table 1\n\n| A | B |\n|---|---|\n|   |   |\n`;
                            const prefix = docText.length > 0 && !docText.endsWith('\n') ? '\n\n' : (docText.length > 0 ? '\n' : '');
                            const insertPos = activeDocument.lineAt(activeDocument.lineCount - 1).range.end;
                            wsEdit.insert(activeDocument.uri, insertPos, prefix + template);
                        }

                        vscode.workspace.applyEdit(wsEdit);
                        return;
                }
            },
            undefined,
            context.subscriptions
        );
    }
}

function getWebviewContent(webview: vscode.Webview, context: vscode.ExtensionContext, document: vscode.TextDocument): string {
    const isProduction = context.extensionMode === vscode.ExtensionMode.Production;
    let scriptUri: vscode.Uri | string;
    let wheelUri: vscode.Uri | string;
    let cspScriptSrc: string;
    let cspConnectSrc: string;
    let viteClient = '';

    if (isProduction) {
        scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(context.extensionUri, 'out', 'webview', 'main.js')
        );
        wheelUri = webview.asWebviewUri(
            vscode.Uri.joinPath(context.extensionUri, 'resources', 'md_spreadsheet_parser-0.3.2-py3-none-any.whl')
        );
        cspScriptSrc = `'unsafe-eval' https://cdn.jsdelivr.net ${webview.cspSource}`;
        cspConnectSrc = `https://cdn.jsdelivr.net ${webview.cspSource}`;
    } else {
        scriptUri = "http://localhost:5173/webview-ui/main.ts";
        // Use local resource for wheel even in dev mode to bypass Vite 404/MIME issues
        wheelUri = webview.asWebviewUri(
            vscode.Uri.joinPath(context.extensionUri, 'resources', 'md_spreadsheet_parser-0.3.2-py3-none-any.whl')
        );
        cspScriptSrc = `'unsafe-eval' https://cdn.jsdelivr.net http://localhost:5173`;
        cspConnectSrc = `https://cdn.jsdelivr.net http://localhost:5173 ws://localhost:5173 ${webview.cspSource}`;
        viteClient = '<script type="module" src="http://localhost:5173/@vite/client"></script>';
    }

    const config = vscode.workspace.getConfiguration('mdSpreadsheet.parsing');
    const initialContent = document.getText();
    const escapedContent = initialContent.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline' ${cspScriptSrc}; connect-src ${cspConnectSrc};">
        <title>Markdown Spreadsheet</title>
    </head>
    <body>
        <md-spreadsheet-editor></md-spreadsheet-editor>
        <script>
            window.wheelUri = "${wheelUri}";
            window.initialContent = \`${escapedContent}\`;
            window.initialConfig = ${JSON.stringify(config)};
        </script>
        <script src="https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js"></script>
        ${viteClient}
        <script type="module" src="${scriptUri}"></script>
    </body>
    </html>`;
}

export function deactivate() { }
