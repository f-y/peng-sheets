import * as vscode from 'vscode';

import { getWebviewContent } from './extension';
import { MessageDispatcher } from './message-dispatcher';

export class SpreadsheetEditorProvider implements vscode.CustomTextEditorProvider {
    public static readonly viewType = 'vscode-md-spreadsheet.editor';

    constructor(private readonly context: vscode.ExtensionContext) {}

    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        const provider = new SpreadsheetEditorProvider(context);
        const providerRegistration = vscode.window.registerCustomEditorProvider(
            SpreadsheetEditorProvider.viewType,
            provider,
            {
                webviewOptions: {
                    retainContextWhenHidden: true,
                    enableFindWidget: true
                }
            }
        );
        return providerRegistration;
    }

    /**
     * Called when our custom editor is opened.
     */
    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        // Setup initial content for the webview
        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this.context.extensionUri, 'out', 'webview'),
                vscode.Uri.joinPath(this.context.extensionUri, 'resources')
            ]
        };
        webviewPanel.webview.html = getWebviewContent(webviewPanel.webview, this.context, document);

        let isSaving = false;

        const dispatcher = new MessageDispatcher({
            activeDocument: document,
            webviewPanel: webviewPanel,
            getSavingState: () => isSaving,
            setSavingState: (state) => {
                isSaving = state;
            }
        });

        // Hook up event handlers so that we can synchronize the webview with the text document.
        //
        // The text document acts as our model, so we have to sync change in the document to our
        // editor and sync changes in the editor back to the document.
        //
        // Remember that a single text document can also be shared between multiple custom
        // editors (this happens for example when you split a custom editor)

        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument((e) => {
            if (e.document.uri.toString() === document.uri.toString()) {
                webviewPanel.webview.postMessage({
                    type: 'update',
                    content: e.document.getText()
                });
            }
        });

        const changeConfigSubscription = vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('mdSpreadsheet.parsing')) {
                webviewPanel.webview.postMessage({
                    type: 'configUpdate',
                    config: vscode.workspace.getConfiguration('mdSpreadsheet.parsing')
                });
            }
        });

        // Receive message from the webview.
        webviewPanel.webview.onDidReceiveMessage((e) => {
            dispatcher.dispatch(e);
        });

        // Make sure we get rid of the listener when our editor is closed.
        webviewPanel.onDidDispose(() => {
            changeDocumentSubscription.dispose();
            changeConfigSubscription.dispose();
        });

        // Initial update
        webviewPanel.webview.postMessage({
            type: 'update',
            content: document.getText()
        });
    }
}
