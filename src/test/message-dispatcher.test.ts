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
                save: async () => true,
                getText: () => '',
                positionAt: (offset: number) => new vscode.Position(0, offset),
                lineAt: (line: number) => ({ range: new vscode.Range(0, 0, 0, 0) } as vscode.TextLine),
                validateRange: (range: vscode.Range) => range
            } as unknown as vscode.TextDocument,
            webviewPanel: undefined,
            getSavingState: () => isSaving,
            setSavingState: (state) => { isSaving = state; }
        };
    });

    teardown(() => {
        sandbox.restore();
    });

    test('Should reject invalid messages and NOT call handlers', async () => {
        const dispatcher = new MessageDispatcher(mockContext);

        // Spy on private methods by casting to any
        const saveSpy = sandbox.spy(dispatcher as any, 'handleSave');
        const undoSpy = sandbox.spy(dispatcher as any, 'handleUndo');

        // Dispatch invalid messages
        await dispatcher.dispatch(null);
        await dispatcher.dispatch({});
        await dispatcher.dispatch({ type: 'unknownType' });

        assert.ok(saveSpy.notCalled, 'handleSave should not be called for invalid messages');
        assert.ok(undoSpy.notCalled, 'handleUndo should not be called for invalid messages');
    });

    test('Undo: Should execute vscode undo command', async () => {
        // Mock visibleTextEditors to find our document
        const showTextDocumentStub = sandbox.stub(vscode.window, 'showTextDocument').resolves({} as vscode.TextEditor);
        const executeCommandStub = sandbox.stub(vscode.commands, 'executeCommand').resolves();

        // Stub visibleTextEditors getter
        sandbox.stub(vscode.window, 'visibleTextEditors').get(() => [{
            document: mockContext.activeDocument,
            viewColumn: vscode.ViewColumn.One
        } as vscode.TextEditor]);

        const dispatcher = new MessageDispatcher(mockContext);
        await dispatcher.dispatch({ type: 'undo' });

        assert.ok(showTextDocumentStub.calledOnce, 'Should focus text document');
        assert.ok(executeCommandStub.calledWith('undo'), 'Should execute "undo" command');
    });

    test('Redo: Should execute vscode redo command', async () => {
        const showTextDocumentStub = sandbox.stub(vscode.window, 'showTextDocument').resolves({} as vscode.TextEditor);
        const executeCommandStub = sandbox.stub(vscode.commands, 'executeCommand').resolves();

        sandbox.stub(vscode.window, 'visibleTextEditors').get(() => [{
            document: mockContext.activeDocument,
            viewColumn: vscode.ViewColumn.One
        } as vscode.TextEditor]);

        const dispatcher = new MessageDispatcher(mockContext);
        await dispatcher.dispatch({ type: 'redo' });

        assert.ok(showTextDocumentStub.calledOnce, 'Should focus text document');
        assert.ok(executeCommandStub.calledWith('redo'), 'Should execute "redo" command');
    });

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

    test('UpdateRange: Should use WorkspaceEdit if editor not visible', async () => {
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
        const editArgs = applyEditStub.firstCall.args[0] as vscode.WorkspaceEdit;
        assert.ok(editArgs instanceof vscode.WorkspaceEdit, 'Should pass a WorkspaceEdit');
    });
});
