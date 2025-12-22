import * as vscode from 'vscode';
import * as path from 'path';
import { SpreadsheetEditorProvider } from './spreadsheet-editor-provider';

export function activate(context: vscode.ExtensionContext) {
    // Register Custom Editor Provider
    context.subscriptions.push(SpreadsheetEditorProvider.register(context));

    // New Workbook command: create a new .md file with workbook template
    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-md-spreadsheet.newWorkbook', newWorkbookHandler)
    );

    // Open Editor command (wrapper for vscode.openWith)
    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-md-spreadsheet.openEditor', async () => {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                await vscode.commands.executeCommand(
                    'vscode.openWith',
                    editor.document.uri,
                    SpreadsheetEditorProvider.viewType
                );
            } else {
                vscode.window.showErrorMessage('No active editor found to open.');
            }
        })
    );
}

export function deactivate() { }

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

    // Open using Custom Editor
    // This assumes the user wants to edit it immediately in the spreadsheet view.
    await vscode.commands.executeCommand('vscode.openWith', uri, SpreadsheetEditorProvider.viewType);
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
    let pyodideUri: vscode.Uri | string;
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
        pyodideUri = webview.asWebviewUri(
            vscode.Uri.joinPath(context.extensionUri, 'out', 'webview', 'pyodide')
        );

        cspScriptSrc = `'unsafe-eval' ${webview.cspSource}`;
        cspConnectSrc = `${webview.cspSource}`;
        cspFontSrc = `${webview.cspSource}`;
    } else {
        scriptUri = 'http://localhost:5173/webview-ui/main.ts';
        wheelUri = webview.asWebviewUri(
            vscode.Uri.joinPath(context.extensionUri, 'resources', 'md_spreadsheet_parser-0.5.0-py3-none-any.whl')
        );
        codiconFontUri = 'http://localhost:5173/node_modules/@vscode/codicons/dist/codicon.ttf';
        pyodideUri = 'http://localhost:5173/pyodide';

        cspScriptSrc = `'unsafe-eval' http://localhost:5173`;
        cspConnectSrc = `http://localhost:5173 ws://localhost:5173 ${webview.cspSource}`;
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
            window.pyodideIndexUrl = "${pyodideUri}";
            window.vscodeLanguage = ${JSON.stringify(extensionLanguage)};
            window.initialContent = \`${escapedContent}\`;
            window.initialConfig = ${JSON.stringify(config)};
        </script>
        <script src="${pyodideUri}/pyodide.js"></script>
        ${viteClient}
        <script type="module" src="${scriptUri}"></script>
    </body>
    </html>`;
}
