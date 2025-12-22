import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { MessageDispatcher, HandlerContext } from '../message-dispatcher';

suite('MessageDispatcher Test Suite', () => {
    let mockContext: HandlerContext;
    let isSaving = false;
    let sandbox: sinon.SinonSandbox;

    setup(() => {
        sandbox = sinon.createSandbox();
        isSaving = false;
        mockContext = {
            activeDocument: {
                uri: vscode.Uri.file('/tmp/test.md'),
                isDirty: false,
                save: sandbox.stub().resolves(true),
                getText: sandbox.stub().returns(''),
                positionAt: (offset: number) => new vscode.Position(0, offset),
                lineAt: (_line: number) => ({ range: new vscode.Range(0, 0, 0, 0) }) as vscode.TextLine,
                validateRange: (range: vscode.Range) => range
            } as unknown as vscode.TextDocument,
            webviewPanel: undefined,
            getSavingState: () => isSaving,
            setSavingState: (state) => {
                isSaving = state;
            }
        };
    });

    teardown(() => {
        sandbox.restore();
    });

    test('Should reject invalid messages and NOT call handlers', async () => {
        const dispatcher = new MessageDispatcher(mockContext);

        // Spy on private methods by casting to any
        const saveSpy = sandbox.spy(dispatcher as any, 'handleSave');


        // Dispatch invalid messages
        await dispatcher.dispatch(null);
        await dispatcher.dispatch({});
        await dispatcher.dispatch({ type: 'unknownType' });

        assert.ok(saveSpy.notCalled, 'handleSave should not be called for invalid messages');

    });

    // Undo/Redo tests removed as logic is handled by VS Code Native Undo

    test('Save: Should call save() on dirty document', async () => {
        // Setup dirty document
        const saveStub = sandbox.stub().resolves(true);
        (mockContext.activeDocument as any).isDirty = true;
        (mockContext.activeDocument as any).save = saveStub;

        const dispatcher = new MessageDispatcher(mockContext);
        await dispatcher.dispatch({ type: 'save' });

        assert.ok(saveStub.calledOnce, 'Document.save() should be called');
        assert.strictEqual(isSaving, false, 'Lock should be released');
    });

    test('updateRange: Should use editor.edit if editor not visible', async () => {
        sandbox.stub(vscode.window, 'visibleTextEditors').get(() => []); // No visible editors

        const applyEditStub = sandbox.stub(vscode.workspace, 'applyEdit').resolves(true);

        const dispatcher = new MessageDispatcher(mockContext);
        const startLine = 0;
        const endLine = 0;
        const content = 'new content';

        await dispatcher.dispatch({
            type: 'updateRange',
            startLine,
            endLine,
            content
        });

        assert.ok(applyEditStub.calledOnce, 'Should call workspace.applyEdit');
        const _editArgs = applyEditStub.firstCall.args[0] as vscode.WorkspaceEdit;
        assert.ok(_editArgs instanceof vscode.WorkspaceEdit, 'Should pass a WorkspaceEdit');
    });

    test('updateRange: Should use editor.edit if editor IS visible', async () => {
        const replaceStub = sandbox.stub();
        const editorEditStub = sandbox.stub().callsFake(async (callback) => {
            callback({ replace: replaceStub });
            return true;
        });

        const activeEditor = {
            document: mockContext.activeDocument,
            edit: editorEditStub,
            viewColumn: vscode.ViewColumn.One
        } as unknown as vscode.TextEditor;

        sandbox.stub(vscode.window, 'visibleTextEditors').get(() => [activeEditor]);
        const applyEditStub = sandbox.stub(vscode.workspace, 'applyEdit');

        const dispatcher = new MessageDispatcher(mockContext);
        await dispatcher.dispatch({
            type: 'updateRange',
            startLine: 0,
            endLine: 0,
            content: 'foo'
        });

        assert.ok(editorEditStub.calledOnce, 'Should use editor.edit');
        assert.ok(replaceStub.calledOnce, 'Should call replace inside edit builder');
        assert.ok(applyEditStub.notCalled, 'Should NOT use workspace.applyEdit fallback');
    });

    test('CreateSpreadsheet: Should insert generic sheet if marker exists', async () => {
        // Mock config
        sandbox.stub(vscode.workspace, 'getConfiguration').returns({
            get: (key: string) => (key.includes('rootMarker') ? '# Tables' : undefined)
        } as any);

        // Document has marker
        const docText = '# Tables\nExisting Content';
        (mockContext.activeDocument!.getText as sinon.SinonStub).returns(docText);

        const applyEditStub = sandbox.stub(vscode.workspace, 'applyEdit').resolves(true);

        const dispatcher = new MessageDispatcher(mockContext);
        await dispatcher.dispatch({ type: 'createSpreadsheet' });

        assert.ok(applyEditStub.calledOnce, 'Should apply edit');
        // Logic should use insert, but checking call count is enough for coverage here
    });

    test('CreateSpreadsheet: Should append new structure if marker missing', async () => {
        // Mock config
        sandbox.stub(vscode.workspace, 'getConfiguration').returns({
            get: (key: string) => (key.includes('rootMarker') ? '# Tables' : undefined)
        } as any);

        // Document has NO marker
        const docText = 'Some other text';
        (mockContext.activeDocument!.getText as sinon.SinonStub).returns(docText);

        const applyEditStub = sandbox.stub(vscode.workspace, 'applyEdit').resolves(true);

        const dispatcher = new MessageDispatcher(mockContext);
        await dispatcher.dispatch({ type: 'createSpreadsheet' });

        assert.ok(applyEditStub.calledOnce, 'Should apply edit');
    });

    test('CreateSpreadsheet: Should replace ALL if zombie state (only marker)', async () => {
        // Mock config
        sandbox.stub(vscode.workspace, 'getConfiguration').returns({
            get: (key: string) => (key.includes('rootMarker') ? '# Tables' : undefined)
        } as any);

        // Document is JUST the marker (Zombie state)
        const docText = '# Tables\n';
        (mockContext.activeDocument!.getText as sinon.SinonStub).returns(docText);

        const applyEditStub = sandbox.stub(vscode.workspace, 'applyEdit').resolves(true);

        const dispatcher = new MessageDispatcher(mockContext);
        await dispatcher.dispatch({ type: 'createSpreadsheet' });

        assert.ok(applyEditStub.calledOnce, 'Should apply edit');
    });

    test('CreateSpreadsheet: Should use default marker when config is undefined', async () => {
        sandbox.stub(vscode.workspace, 'getConfiguration').returns({
            get: (_key: string) => undefined
        } as any);
        (mockContext.activeDocument!.getText as sinon.SinonStub).returns('');
        const applyEditStub = sandbox.stub(vscode.workspace, 'applyEdit').resolves(true);

        const dispatcher = new MessageDispatcher(mockContext);
        await dispatcher.dispatch({ type: 'createSpreadsheet' });

        assert.ok(applyEditStub.calledOnce);
    });

    test('CreateSpreadsheet: Should handle document ending with newline', async () => {
        sandbox.stub(vscode.workspace, 'getConfiguration').returns({
            get: (_key: string) => '# Tables'
        } as any);
        // hasRoot = false (no marker), but ends with newline
        (mockContext.activeDocument!.getText as sinon.SinonStub).returns('Some text\n');

        const applyEditStub = sandbox.stub(vscode.workspace, 'applyEdit').resolves(true);

        const dispatcher = new MessageDispatcher(mockContext);
        await dispatcher.dispatch({ type: 'createSpreadsheet' });

        assert.ok(applyEditStub.calledOnce);
    });

    test('CreateSpreadsheet: Should handle marker presence with trailing newline', async () => {
        sandbox.stub(vscode.workspace, 'getConfiguration').returns({
            get: (_key: string) => '# Tables'
        } as any);
        // hasRoot = true, and ends with newline
        (mockContext.activeDocument!.getText as sinon.SinonStub).returns('# Tables\nContent\n');

        const applyEditStub = sandbox.stub(vscode.workspace, 'applyEdit').resolves(true);

        const dispatcher = new MessageDispatcher(mockContext);
        await dispatcher.dispatch({ type: 'createSpreadsheet' });

        assert.ok(applyEditStub.calledOnce);
    });

    // --- New Tests for Full Coverage ---

    test('updateRange: Should handle null activeDocument gracefully', async () => {
        // Mock context with undefined activeDocument
        mockContext.activeDocument = undefined;
        const dispatcher = new MessageDispatcher(mockContext);

        // Should not throw
        await dispatcher.dispatch({
            type: 'updateRange',
            startLine: 0,
            endLine: 0,
            content: 'foo'
        });
    });

    test('updateRange: Should handle range validation adjustment', async () => {
        // Return a different range from validateRange
        const adjustedRange = new vscode.Range(0, 0, 0, 5);

        // Stub validateRange on the object instance
        mockContext.activeDocument!.validateRange = sandbox.stub().returns(adjustedRange);

        const applyEditStub = sandbox.stub(vscode.workspace, 'applyEdit').resolves(true);
        sandbox.stub(vscode.window, 'visibleTextEditors').get(() => []);

        const dispatcher = new MessageDispatcher(mockContext);
        await dispatcher.dispatch({
            type: 'updateRange',
            startLine: 0,
            endLine: 100,
            content: 'adjusted'
        });

        // Check if applyEdit was called with the ADJUCTED range
        assert.ok(applyEditStub.calledOnce);

        // Since we can't easily spy on WorkspaceEdit argument internals without valid URI,
        // we rely on the line coverage hitting the logic that uses 'validatedRange'.
        // We verify that our stub was actually called, meaning logic flowed through it.
        const validateStub = mockContext.activeDocument!.validateRange as sinon.SinonStub;
        assert.ok(validateStub.calledOnce);
    });

    test('updateRange: Should handle editor.edit failure and fallback failure', async () => {
        const editorEditStub = sandbox.stub().resolves(false); // Simulate failure
        const activeEditor = {
            document: mockContext.activeDocument,
            edit: editorEditStub,
            viewColumn: vscode.ViewColumn.One
        } as unknown as vscode.TextEditor;

        sandbox.stub(vscode.window, 'visibleTextEditors').get(() => [activeEditor]);
        const applyEditStub = sandbox.stub(vscode.workspace, 'applyEdit').resolves(false); // Fallback also fails
        const showErrorMessageSpy = sandbox.spy(vscode.window, 'showErrorMessage');

        const dispatcher = new MessageDispatcher(mockContext);
        await dispatcher.dispatch({
            type: 'updateRange',
            startLine: 0,
            endLine: 0,
            content: 'fail'
        });

        assert.ok(editorEditStub.calledOnce, 'Should try editor.edit');
        assert.ok(applyEditStub.calledOnce, 'Should try fallback workspace.applyEdit');
        assert.ok(showErrorMessageSpy.calledWith('Failed to update spreadsheet: Sync error.'), 'Should show error');
    });

    test('updateRange: Should handle WorkspaceEdit failure (no visible editor)', async () => {
        sandbox.stub(vscode.window, 'visibleTextEditors').get(() => []);
        sandbox.stub(vscode.workspace, 'applyEdit').resolves(false); // Fail
        const showErrorMessageSpy = sandbox.spy(vscode.window, 'showErrorMessage');

        const dispatcher = new MessageDispatcher(mockContext);
        await dispatcher.dispatch({
            type: 'updateRange',
            startLine: 0,
            endLine: 0,
            content: 'fail'
        });

        assert.ok(showErrorMessageSpy.calledWith('Failed to update spreadsheet: Document version conflict.'));
    });

    // Undo/Redo null/error handling tests removed

    test('CreateSpreadsheet: Should handle null activeDocument', async () => {
        mockContext.activeDocument = undefined;
        const dispatcher = new MessageDispatcher(mockContext);
        const applyEditStub = sandbox.stub(vscode.workspace, 'applyEdit');

        await dispatcher.dispatch({ type: 'createSpreadsheet' });
        assert.ok(applyEditStub.notCalled);
    });

    test('Save: Should skip if already saving', async () => {
        mockContext.getSavingState = () => true; // Locked
        const saveSpy = (mockContext.activeDocument as any).save; // Stubbed in setup

        const dispatcher = new MessageDispatcher(mockContext);
        await dispatcher.dispatch({ type: 'save' });

        assert.ok(saveSpy.notCalled);
    });

    test('Save: Should handle null activeDocument', async () => {
        mockContext.activeDocument = undefined;
        const showErrorMessageSpy = sandbox.spy(vscode.window, 'showErrorMessage');

        const dispatcher = new MessageDispatcher(mockContext);
        await dispatcher.dispatch({ type: 'save' });

        assert.ok(showErrorMessageSpy.calledWith('No active document to save.'));
    });

    test('Save: Should handle non-dirty document', async () => {
        (mockContext.activeDocument as any).isDirty = false;
        const saveSpy = (mockContext.activeDocument as any).save;

        const dispatcher = new MessageDispatcher(mockContext);
        await dispatcher.dispatch({ type: 'save' });

        assert.ok(saveSpy.notCalled);
    });

    test('Save: Should handle save returning false', async () => {
        (mockContext.activeDocument as any).isDirty = true;
        (mockContext.activeDocument as any).save.resolves(false); // Save failed?

        const dispatcher = new MessageDispatcher(mockContext);
        await dispatcher.dispatch({ type: 'save' });

        // Covered if no error thrown
    });

    test('Save: Should handle exception during save', async () => {
        (mockContext.activeDocument as any).isDirty = true;
        (mockContext.activeDocument as any).save.rejects(new Error('Disk error'));
        const showErrorMessageSpy = sandbox.spy(vscode.window, 'showErrorMessage');

        const dispatcher = new MessageDispatcher(mockContext);
        await dispatcher.dispatch({ type: 'save' });

        assert.ok(showErrorMessageSpy.calledWith('Failed to save document.'));
    });
});
