import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "vscode-md-spreadsheet" is now active!');

    let disposable = vscode.commands.registerCommand('vscode-md-spreadsheet.openEditor', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }

        const document = editor.document;
        if (document.languageId !== 'markdown') {
            vscode.window.showErrorMessage('Active file is not a Markdown file');
            return;
        }

        const initialContent = document.getText();
        // Escape backticks and backslashes to prevent JS syntax errors in the template string
        const escapedContent = initialContent.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');

        const panel = vscode.window.createWebviewPanel(
            'mdSpreadsheet',
            'Markdown Spreadsheet',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(context.extensionUri, 'out', 'webview')
                ]
            }
        );

        // Listen for changes to the document
        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document.uri.toString() === document.uri.toString()) {
                const content = e.document.getText();
                panel.webview.postMessage({
                    type: 'update',
                    content: content
                });
            }
        });

        // Listen for messages from the webview
        panel.webview.onDidReceiveMessage(
            message => {
                switch (message.type) {
                    case 'updateRange':
                        const edit = new vscode.WorkspaceEdit();
                        const startPosition = new vscode.Position(message.startLine, 0);
                        const endPosition = new vscode.Position(message.endLine, 0);
                        const range = new vscode.Range(startPosition, endPosition);

                        edit.replace(document.uri, range, message.content);
                        vscode.workspace.applyEdit(edit);
                        return;
                }
            },
            undefined,
            context.subscriptions
        );

        // Listen for configuration changes
        const changeConfigSubscription = vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('mdSpreadsheet.parsing')) {
                const config = vscode.workspace.getConfiguration('mdSpreadsheet.parsing');
                panel.webview.postMessage({
                    type: 'configUpdate',
                    config: config
                });
            }
        });

        // Make sure we get rid of the listener when our editor is closed.
        panel.onDidDispose(() => {
            changeDocumentSubscription.dispose();
            changeConfigSubscription.dispose();
        });

        const isProduction = context.extensionMode === vscode.ExtensionMode.Production;
        let scriptUri: vscode.Uri | string;
        let wheelUri: vscode.Uri | string;
        let cspScriptSrc: string;
        let cspConnectSrc: string;
        let viteClient = '';

        if (isProduction) {
            scriptUri = panel.webview.asWebviewUri(
                vscode.Uri.joinPath(context.extensionUri, 'out', 'webview', 'main.js')
            );
            wheelUri = panel.webview.asWebviewUri(
                vscode.Uri.joinPath(context.extensionUri, 'out', 'webview', 'md_spreadsheet_parser-0.1.2-py3-none-any.whl')
            );
            cspScriptSrc = `'unsafe-eval' https://cdn.jsdelivr.net ${panel.webview.cspSource}`;
            cspConnectSrc = `https://cdn.jsdelivr.net ${panel.webview.cspSource}`;
        } else {
            scriptUri = "http://localhost:5173/webview-ui/main.ts";
            wheelUri = "http://localhost:5173/md_spreadsheet_parser-0.1.2-py3-none-any.whl";
            cspScriptSrc = `'unsafe-eval' https://cdn.jsdelivr.net http://localhost:5173`;
            cspConnectSrc = `https://cdn.jsdelivr.net http://localhost:5173 ws://localhost:5173`;
            viteClient = '<script type="module" src="http://localhost:5173/@vite/client"></script>';
        }

        const config = vscode.workspace.getConfiguration('mdSpreadsheet.parsing');

        panel.webview.html = `<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline' ${cspScriptSrc}; connect-src ${cspConnectSrc};">
			<title>Markdown Spreadsheet</title>
		</head>
		<body>
			<my-editor></my-editor>
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
    });
    context.subscriptions.push(disposable);
}

export function deactivate() { }
