import * as vscode from 'vscode';

import { getWebviewContent, findWheelFiles } from './extension';
import { MessageDispatcher } from './message-dispatcher';

export class SpreadsheetEditorProvider implements vscode.CustomTextEditorProvider {
    public static readonly viewType = 'vscode-md-spreadsheet.editor';

    // Track all active webview panels
    private static activePanels: Map<string, vscode.WebviewPanel> = new Map();
    private static currentActiveUri: string | undefined;

    constructor(private readonly context: vscode.ExtensionContext) { }

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
     * Post a message to the currently active webview panel
     */
    public static postMessageToActive(message: unknown): boolean {
        if (SpreadsheetEditorProvider.currentActiveUri) {
            const panel = SpreadsheetEditorProvider.activePanels.get(SpreadsheetEditorProvider.currentActiveUri);
            if (panel) {
                panel.webview.postMessage(message);
                return true;
            }
        }
        return false;
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
        const wheels = await findWheelFiles(this.context);
        webviewPanel.webview.html = getWebviewContent(webviewPanel.webview, this.context, document, wheels);

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

        // Track this panel
        const docUri = document.uri.toString();
        SpreadsheetEditorProvider.activePanels.set(docUri, webviewPanel);

        // Track when this panel becomes active/inactive
        webviewPanel.onDidChangeViewState((e) => {
            if (e.webviewPanel.active) {
                SpreadsheetEditorProvider.currentActiveUri = docUri;
            } else if (SpreadsheetEditorProvider.currentActiveUri === docUri) {
                SpreadsheetEditorProvider.currentActiveUri = undefined;
            }
        });

        // Set as active if it's currently visible
        if (webviewPanel.active) {
            SpreadsheetEditorProvider.currentActiveUri = docUri;
        }

        // Make sure we get rid of the listener when our editor is closed.
        webviewPanel.onDidDispose(() => {
            changeDocumentSubscription.dispose();
            changeConfigSubscription.dispose();
            SpreadsheetEditorProvider.activePanels.delete(docUri);
            if (SpreadsheetEditorProvider.currentActiveUri === docUri) {
                SpreadsheetEditorProvider.currentActiveUri = undefined;
            }
        });

        // Initial update
        webviewPanel.webview.postMessage({
            type: 'update',
            content: document.getText()
        });
    }
}
