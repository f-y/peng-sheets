import * as vscode from 'vscode';
import * as path from 'path';
import { MessageDispatcher } from './message-dispatcher';
import { SpreadsheetEditorProvider } from './spreadsheet-editor-provider';

export function activate(context: vscode.ExtensionContext) {
    // Register Custom Editor Provider
    context.subscriptions.push(SpreadsheetEditorProvider.register(context));

    let currentPanel: vscode.WebviewPanel | undefined = undefined;
    let activeDocument: vscode.TextDocument | undefined = undefined;
    let isSaving = false;

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-md-spreadsheet.openEditor', () => {
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
        })
    );

    // New Workbook command: create a new .md file with workbook template
    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-md-spreadsheet.newWorkbook', newWorkbookHandler)
    );

    // Switch context when active editor changes
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (currentPanel && editor && editor.document.languageId === 'markdown') {
                if (activeDocument !== editor.document) {
                    updatePanel(editor.document);
                }
            }
        })
    );

    // Detect content changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument((e) => {
            if (currentPanel && activeDocument && e.document.uri.toString() === activeDocument.uri.toString()) {
                currentPanel.webview.postMessage({
                    type: 'update',
                    content: e.document.getText()
                });
            }
        })
    );

    // Detect config changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (currentPanel && e.affectsConfiguration('mdSpreadsheet.parsing')) {
                currentPanel.webview.postMessage({
                    type: 'configUpdate',
                    config: vscode.workspace.getConfiguration('mdSpreadsheet.parsing')
                });
            }
        })
    );

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

        currentPanel.onDidDispose(
            () => {
                currentPanel = undefined;
                activeDocument = undefined;
            },
            null,
            context.subscriptions
        );

        currentPanel.webview.onDidReceiveMessage(
            async (message) => {
                const dispatcher = new MessageDispatcher({
                    activeDocument,
                    webviewPanel: currentPanel,
                    getSavingState: () => isSaving,
                    setSavingState: (state) => {
                        isSaving = state;
                    }
                });
                await dispatcher.dispatch(message);
            },
            undefined,
            context.subscriptions
        );
    }
}

export function getWebviewContent(
    webview: vscode.Webview,
    context: vscode.ExtensionContext,
    document: vscode.TextDocument
): string {
    const isProduction = context.extensionMode === vscode.ExtensionMode.Production;
    let scriptUri: vscode.Uri | string;
    let wheelUri: vscode.Uri | string;
    let codiconFontUri: vscode.Uri | string;
    let cspScriptSrc: string;
    let cspConnectSrc: string;
    let cspFontSrc: string;
    let viteClient = '';

    if (isProduction) {
        scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'out', 'webview', 'main.js'));
        wheelUri = webview.asWebviewUri(
            vscode.Uri.joinPath(context.extensionUri, 'resources', 'md_spreadsheet_parser-0.5.0-py3-none-any.whl')
        );
        codiconFontUri = webview.asWebviewUri(
            vscode.Uri.joinPath(context.extensionUri, 'out', 'webview', 'codicon.ttf')
        );
        cspScriptSrc = `'unsafe-eval' https://cdn.jsdelivr.net ${webview.cspSource}`;
        cspConnectSrc = `https://cdn.jsdelivr.net ${webview.cspSource}`;
        cspFontSrc = `${webview.cspSource}`;
    } else {
        scriptUri = 'http://localhost:5173/webview-ui/main.ts';
        // Use local resource for wheel even in dev mode to bypass Vite 404/MIME issues
        wheelUri = webview.asWebviewUri(
            vscode.Uri.joinPath(context.extensionUri, 'resources', 'md_spreadsheet_parser-0.5.0-py3-none-any.whl')
        );
        // In dev, we can try to point to the file in node_modules if served, or fallback to the local file if copied?
        // Vite dev server might not serve node_modules assets at root.
        // For simplicity in dev, we might assume it works or point to localhost if possible.
        // Actually, let's use the production logic for font even in dev if it exists in out, OR rely on localhost.
        // But out/webview might not be populated in dev.
        // Let's fallback to specific path if straightforward, or just 'self' http://localhost:5173.
        codiconFontUri = 'http://localhost:5173/node_modules/@vscode/codicons/dist/codicon.ttf';

        cspScriptSrc = `'unsafe-eval' https://cdn.jsdelivr.net http://localhost:5173`;
        cspConnectSrc = `https://cdn.jsdelivr.net http://localhost:5173 ws://localhost:5173 ${webview.cspSource}`;
        cspFontSrc = `http://localhost:5173 ${webview.cspSource}`;
        viteClient = '<script type="module" src="http://localhost:5173/@vite/client"></script>';
    }

    const config = vscode.workspace.getConfiguration('mdSpreadsheet.parsing');
    const generalConfig = vscode.workspace.getConfiguration('mdSpreadsheet');
    const languageSetting = generalConfig.get<string>('language') || 'auto';
    const extensionLanguage = languageSetting === 'auto' ? vscode.env.language : languageSetting;
    const initialContent = document.getText();
    const escapedContent = initialContent.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src ${cspFontSrc}; script-src 'unsafe-inline' ${cspScriptSrc}; connect-src ${cspConnectSrc};">
        <title>Markdown Spreadsheet</title>
        <style>
            @font-face {
                font-family: "codicon";
                src: url("${codiconFontUri}") format("truetype");
            }
        </style>
    </head>
    <body>
        <md-spreadsheet-editor></md-spreadsheet-editor>
        <script>
            window.wheelUri = "${wheelUri}";
            window.vscodeLanguage = ${JSON.stringify(extensionLanguage)};
            window.initialContent = \`${escapedContent}\`;
            window.initialConfig = ${JSON.stringify(config)};
        </script>
        <script src="https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js"></script>
        ${viteClient}
        <script type="module" src="${scriptUri}"></script>
    </body>
    </html>`;
}

export function deactivate() {}

export async function newWorkbookHandler() {
    // Get workspace folder
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

    let uri: vscode.Uri | undefined;

    if (workspaceFolder) {
        // Prompt for filename if in workspace
        const fileName = await vscode.window.showInputBox({
            prompt: 'Enter filename for new workbook',
            value: 'workbook.md',
            validateInput: (value) => {
                if (!value) {
                    return 'Filename is required';
                }
                if (!value.endsWith('.md')) {
                    return 'Filename must end with .md';
                }
                return null;
            }
        });

        if (!fileName) return;
        uri = vscode.Uri.joinPath(workspaceFolder.uri, fileName);
    } else {
        // No workspace: use save dialog
        const saveUri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file('workbook.md'),
            filters: { Markdown: ['md'] }
        });
        if (!saveUri) return;
        uri = saveUri;
    }

    // Create template content
    const config = vscode.workspace.getConfiguration('mdSpreadsheet.parsing');
    const rootMarker = config.get<string>('rootMarker') || '# Tables';
    const template = `${rootMarker}\n\n## Sheet 1\n\n### Table 1\n\n| A | B | C |\n|---|---|---|\n|   |   |   |\n`;

    // Write file
    await vscode.workspace.fs.writeFile(uri, Buffer.from(template, 'utf8'));

    // Open document and show in editor
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc);

    // Open spreadsheet editor
    await vscode.commands.executeCommand('vscode-md-spreadsheet.openEditor');
}
