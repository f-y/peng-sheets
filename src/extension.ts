import * as vscode from 'vscode';

import { SpreadsheetEditorProvider } from './spreadsheet-editor-provider';
import { getDefaultColumnNames } from './i18n-utils';

export function activate(context: vscode.ExtensionContext) {
    // Register Custom Editor Provider
    context.subscriptions.push(SpreadsheetEditorProvider.register(context));

    // Listen for configuration changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('mdSpreadsheet.validation')) {
                const newConfig = vscode.workspace.getConfiguration('mdSpreadsheet.validation');
                SpreadsheetEditorProvider.postMessageToActive({
                    type: 'update_config',
                    config: { validation: newConfig }
                });
            }
        })
    );

    // New Workbook command: create a new .md file with workbook template
    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-md-spreadsheet.newWorkbook', newWorkbookHandler)
    );

    // Open Editor command (wrapper for vscode.openWith)
    const openEditorFunction = async () => {
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
    };
    context.subscriptions.push(vscode.commands.registerCommand('vscode-md-spreadsheet.openEditor', openEditorFunction));

    // Open Editor from Context Menu command
    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-md-spreadsheet.openEditorFromContextMenu', async (uri: vscode.Uri) => {
            if (uri) {
                await vscode.commands.executeCommand('vscode.openWith', uri, SpreadsheetEditorProvider.viewType);
            } else {
                // Fallback if no URI provided (though unlikely from context menu)
                openEditorFunction();
            }
        })
    );

    // Insert current date command (Excel-like: Ctrl+;)
    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-md-spreadsheet.insertDate', () => {
            const now = new Date();
            const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
            SpreadsheetEditorProvider.postMessageToActive({
                type: 'insertValue',
                value: dateStr
            });
        })
    );

    // Insert current time command (Excel-like: Ctrl+Shift+;)
    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-md-spreadsheet.insertTime', () => {
            const now = new Date();
            const timeStr = now.toTimeString().slice(0, 5); // HH:MM
            SpreadsheetEditorProvider.postMessageToActive({
                type: 'insertValue',
                value: timeStr
            });
        })
    );
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
    const [col1, col2, col3] = getDefaultColumnNames();
    const template = `${rootMarker}\n\n## Sheet 1\n\n### Table 1\n\n| ${col1} | ${col2} | ${col3} |\n|---|---|---|\n|   |   |   |\n`;

    // Write file
    await vscode.workspace.fs.writeFile(uri, Buffer.from(template, 'utf8'));

    // Open using Custom Editor
    // This assumes the user wants to edit it immediately in the spreadsheet view.
    await vscode.commands.executeCommand('vscode.openWith', uri, SpreadsheetEditorProvider.viewType);
}

export async function findWheelFile(context: vscode.ExtensionContext): Promise<string> {
    const isProduction = context.extensionMode === vscode.ExtensionMode.Production;
    const searchUri = isProduction
        ? vscode.Uri.joinPath(context.extensionUri, 'out', 'webview', 'pyodide')
        : vscode.Uri.joinPath(context.extensionUri, 'resources');

    try {
        const entries = await vscode.workspace.fs.readDirectory(searchUri);
        const wheelEntry = entries.find(([name]) => name.endsWith('.whl'));
        if (wheelEntry) {
            return wheelEntry[0];
        }
    } catch (e) {
        console.warn(`Failed to find wheel file in ${searchUri.fsPath}`, e);
    }
    return 'md_spreadsheet_parser-0.7.1-py3-none-any.whl'; // Fallback
}

export function getWebviewContent(
    webview: vscode.Webview,
    context: vscode.ExtensionContext,
    document: vscode.TextDocument,
    wheelFilename: string
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
            vscode.Uri.joinPath(context.extensionUri, 'out', 'webview', 'pyodide', wheelFilename)
        );
        codiconFontUri = webview.asWebviewUri(
            vscode.Uri.joinPath(context.extensionUri, 'out', 'webview', 'codicon.ttf')
        );
        pyodideUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'out', 'webview', 'pyodide'));

        cspScriptSrc = `'unsafe-eval' ${webview.cspSource}`;
        cspConnectSrc = `${webview.cspSource}`;
        cspFontSrc = `${webview.cspSource}`;
    } else {
        scriptUri = 'http://localhost:5173/webview-ui/main.ts';
        wheelUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'resources', wheelFilename));
        codiconFontUri = 'http://localhost:5173/node_modules/@vscode/codicons/dist/codicon.ttf';
        pyodideUri = 'http://localhost:5173/pyodide';

        cspScriptSrc = `'unsafe-eval' http://localhost:5173`;
        cspConnectSrc = `http://localhost:5173 ws://localhost:5173 ${webview.cspSource}`;
        cspFontSrc = `http://localhost:5173 ${webview.cspSource}`;
        viteClient = '<script type="module" src="http://localhost:5173/@vite/client"></script>';
    }

    const config = vscode.workspace.getConfiguration('mdSpreadsheet.parsing');
    const validationConfig = vscode.workspace.getConfiguration('mdSpreadsheet.validation');
    const initialConfig = {
        ...config,
        validation: validationConfig
    };
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
            window.initialConfig = ${JSON.stringify(initialConfig)};
        </script>
        <script src="${pyodideUri}/pyodide.js"></script>
        ${viteClient}
        <script type="module" src="${scriptUri}"></script>
    </body>
    </html>`;
}
