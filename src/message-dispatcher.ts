import * as vscode from 'vscode';
import { WebviewMessage, UpdateRangeMessage } from './types/messages';

export interface HandlerContext {
    activeDocument: vscode.TextDocument | undefined;
    webviewPanel: vscode.WebviewPanel | undefined;
    setSavingState: (isSaving: boolean) => void;
    getSavingState: () => boolean;
}

export class MessageDispatcher {
    constructor(private context: HandlerContext) { }

    public async dispatch(message: unknown): Promise<void> {
        if (!this.isValidMessage(message)) {
            console.warn('Received invalid message format:', message);
            return;
        }

        console.log('[Extension] Processing message:', message.type);

        switch (message.type) {
            case 'updateRange':
                await this.handleUpdateRange(message);
                break;
            case 'createSpreadsheet':
                await this.handleCreateSpreadsheet();
                break;
            case 'save':
                await this.handleSave();
                break;
        }
    }

    private isValidMessage(message: unknown): message is WebviewMessage {
        const msg = message as { type?: unknown };
        return (
            !!message &&
            typeof message === 'object' &&
            typeof msg.type === 'string' &&
            ['updateRange', 'createSpreadsheet', 'save'].includes(msg.type)
        );
    }

    private async handleUpdateRange(message: UpdateRangeMessage) {
        if (!this.context.activeDocument) {
            console.error('No active document!');
            return;
        }

        const { activeDocument } = this.context;
        const startPosition = new vscode.Position(message.startLine, 0);
        const endPosition = new vscode.Position(message.endLine, message.endCol ?? 0);
        const range = new vscode.Range(startPosition, endPosition);

        // Find editor
        const editor = vscode.window.visibleTextEditors.find(
            (e) => e.document.uri.toString() === activeDocument.uri.toString()
        );

        let targetRange = range;
        const validatedRange = activeDocument.validateRange(range);
        if (!validatedRange.isEqual(range)) {
            console.log(
                `Adjusting invalid range: ${range.start.line}-${range.end.line} -> ${validatedRange.start.line}-${validatedRange.end.line}`
            );
        }
        targetRange = validatedRange;

        if (editor) {
            const success = await editor.edit((editBuilder) => {
                editBuilder.replace(targetRange, message.content);
            });

            if (!success) {
                console.warn('TextEditor.edit failed. Retrying with WorkspaceEdit...');
                const edit = new vscode.WorkspaceEdit();
                edit.replace(activeDocument.uri, targetRange, message.content);
                const wsSuccess = await vscode.workspace.applyEdit(edit);
                if (!wsSuccess) {
                    console.error('Fallback WorkspaceEdit failed.');
                    vscode.window.showErrorMessage('Failed to update spreadsheet: Sync error.');
                }
            }
        } else {
            // Fallback to WorkspaceEdit
            const edit = new vscode.WorkspaceEdit();
            edit.replace(activeDocument.uri, targetRange, message.content);
            const success = await vscode.workspace.applyEdit(edit);
            if (!success) {
                console.error('Workspace edit failed');
                vscode.window.showErrorMessage('Failed to update spreadsheet: Document version conflict.');
            }
        }
    }

    private async handleCreateSpreadsheet() {
        if (!this.context.activeDocument) return;
        const { activeDocument } = this.context;

        const wsEdit = new vscode.WorkspaceEdit();
        const docText = activeDocument.getText();
        const config = vscode.workspace.getConfiguration('mdSpreadsheet.parsing');
        const rootMarker = config.get<string>('rootMarker') || '# Tables';

        const escapedRoot = rootMarker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = escapedRoot.replace(/\\ /g, '\\s+').replace(/\s+/g, '\\s+');
        const rootRegex = new RegExp(pattern);

        const hasRoot = rootRegex.test(docText);
        const isZombie = docText.trim().match(new RegExp(`^${pattern}$`));

        if (isZombie) {
            const template = `${rootMarker}\n\n## Sheet 1\n\n### Table 1\n\n| A | B |\n|---|---|\n|   |   |\n`;
            const fullRange = new vscode.Range(activeDocument.positionAt(0), activeDocument.positionAt(docText.length));
            wsEdit.replace(activeDocument.uri, fullRange, template);
        } else if (hasRoot) {
            const template = `## Sheet 1\n\n### Table 1\n\n| A | B |\n|---|---|\n|   |   |\n`;
            const prefix = !docText.endsWith('\n') ? '\n\n' : '\n';
            const insertPos = activeDocument.lineAt(activeDocument.lineCount - 1).range.end;
            wsEdit.insert(activeDocument.uri, insertPos, prefix + template);
        } else {
            const template = `${rootMarker}\n\n## Sheet 1\n\n### Table 1\n\n| A | B |\n|---|---|\n|   |   |\n`;
            const prefix = docText.length > 0 && !docText.endsWith('\n') ? '\n\n' : docText.length > 0 ? '\n' : '';
            const insertPos = activeDocument.lineAt(activeDocument.lineCount - 1).range.end;
            wsEdit.insert(activeDocument.uri, insertPos, prefix + template);
        }

        await vscode.workspace.applyEdit(wsEdit);
    }

    private async handleSave() {
        console.log('Received save request');
        if (this.context.getSavingState()) {
            console.log('Save already in progress, skipping');
            return;
        }

        this.context.setSavingState(true);

        try {
            const { activeDocument } = this.context;
            if (activeDocument) {
                if (activeDocument.isDirty) {
                    const saved = await activeDocument.save();
                    console.log(`Document saved: ${saved}`);
                    if (!saved) {
                        console.warn('Save returned false, but document may have been saved by another process');
                    }
                } else {
                    console.log('Document is not dirty, nothing to save');
                }
            } else {
                console.error('No active document to save');
                vscode.window.showErrorMessage('No active document to save.');
            }
        } catch (error) {
            console.error('Error saving document:', error);
            vscode.window.showErrorMessage('Failed to save document.');
        } finally {
            this.context.setSavingState(false);
        }
    }
}
