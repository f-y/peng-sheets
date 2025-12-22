import * as assert from 'assert';
import * as vscode from 'vscode';
import { MessageDispatcher, HandlerContext } from '../message-dispatcher'; // Adjust path if needed

suite('MessageDispatcher Test Suite', () => {
    let mockContext: HandlerContext;
    let isSaving = false;

    setup(() => {
        isSaving = false;
        mockContext = {
            activeDocument: undefined,
            webviewPanel: undefined,
            getSavingState: () => isSaving,
            setSavingState: (state) => {
                isSaving = state;
            }
        };
    });

    test('Should reject invalid messages', async () => {
        const dispatcher = new MessageDispatcher(mockContext);

        // We can't easily spy on console.warn without a library, but we can ensure it doesn't throw
        await dispatcher.dispatch(null);
        await dispatcher.dispatch({});
        await dispatcher.dispatch({ type: 'unknownType' });

        // If we reached here without error, it's a pass (basic valid/invalid check)
        // Ideally we would verify that no handler was called.
    });

    test('Save: Should call save() on dirty document', async () => {
        let saveCalled = false;
        const mockDoc = {
            isDirty: true,
            save: async () => {
                saveCalled = true;
                return true;
            },
            uri: vscode.Uri.file('/tmp/test')
        } as unknown as vscode.TextDocument;

        mockContext.activeDocument = mockDoc;
        const dispatcher = new MessageDispatcher(mockContext);

        await dispatcher.dispatch({ type: 'save' });

        assert.strictEqual(saveCalled, true, 'Document.save() should be called');
        assert.strictEqual(isSaving, false, 'Lock should be released');
    });

    test('Save: Should NOT call save() on clean document', async () => {
        let saveCalled = false;
        const mockDoc = {
            isDirty: false, // Not dirty
            save: async () => {
                saveCalled = true;
                return true;
            }
        } as unknown as vscode.TextDocument;

        mockContext.activeDocument = mockDoc;
        const dispatcher = new MessageDispatcher(mockContext);

        await dispatcher.dispatch({ type: 'save' });

        assert.strictEqual(saveCalled, false, 'Document.save() should NOT be called');
    });

    test('Save: Should prevent concurrent saves (Locking)', async () => {
        isSaving = true; // Simulate lock held
        let saveCalled = false;
        const mockDoc = {
            isDirty: true,
            save: async () => {
                saveCalled = true;
                return true;
            }
        } as unknown as vscode.TextDocument;

        mockContext.activeDocument = mockDoc;
        const dispatcher = new MessageDispatcher(mockContext);

        await dispatcher.dispatch({ type: 'save' });

        assert.strictEqual(saveCalled, false, 'Should skip save if lock is held');
    });

    test('Save: Should release lock even if save fails', async () => {
        const mockDoc = {
            isDirty: true,
            save: async () => {
                throw new Error('Save failed');
            }
        } as unknown as vscode.TextDocument;

        mockContext.activeDocument = mockDoc;
        const dispatcher = new MessageDispatcher(mockContext);

        await dispatcher.dispatch({ type: 'save' });

        assert.strictEqual(isSaving, false, 'Lock should be released in finally block');
    });
});
