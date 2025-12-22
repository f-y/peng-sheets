import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { getWebviewContent, newWorkbookHandler, activate } from '../extension';

suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');
    let sandbox: sinon.SinonSandbox;

    setup(() => {
        sandbox = sinon.createSandbox();
    });

    teardown(() => {
        sandbox.restore();
    });

    test('Extension should be present', () => {
        assert.ok(vscode.extensions.getExtension('f-y.vscode-md-spreadsheet'));
    });

    test('Extension should activate', async () => {
        const ext = vscode.extensions.getExtension('f-y.vscode-md-spreadsheet');
        assert.ok(ext);
        if (ext) {
            await ext.activate();
            assert.ok(ext.isActive);
        }
    });

    test('Command: newWorkbook should register', async () => {
        const commands = await vscode.commands.getCommands(true);
        assert.ok(commands.includes('vscode-md-spreadsheet.openEditor'));
        assert.ok(commands.includes('vscode-md-spreadsheet.newWorkbook'));
    });

    suite('getWebviewContent', () => {
        test('Should generate correct HTML content in Production mode', () => {
            const mockWebview = {
                asWebviewUri: (uri: vscode.Uri) => uri,
                cspSource: "'self'"
            } as vscode.Webview;

            const mockContext = {
                extensionUri: vscode.Uri.file('/mock/extension'),
                extensionMode: vscode.ExtensionMode.Production
            } as vscode.ExtensionContext;

            const mockDocument = {
                getText: () => 'Initial Content'
            } as vscode.TextDocument;

            const html = getWebviewContent(mockWebview, mockContext, mockDocument);

            assert.ok(html.includes('<title>Markdown Spreadsheet</title>'));
            assert.ok(html.includes('window.initialContent = `Initial Content`'));
            assert.ok(html.includes('window.vscodeLanguage = "en"'), 'Defaults to en if not specified'); // Assuming default env
        });

        test('Should generate correct HTML content in Development mode', () => {
            const mockWebview = {
                asWebviewUri: (uri: vscode.Uri) => uri,
                cspSource: "'self'"
            } as vscode.Webview;

            const mockContext = {
                extensionUri: vscode.Uri.file('/mock/extension'),
                extensionMode: vscode.ExtensionMode.Development
            } as vscode.ExtensionContext;

            const mockDocument = {
                getText: () => 'Initial Content'
            } as vscode.TextDocument;

            const html = getWebviewContent(mockWebview, mockContext, mockDocument);

            assert.ok(html.includes('http://localhost:5173'), 'Should include localhost in Dev mode');
            assert.ok(html.includes('type="module"'), 'Should use module script');
        });
    });

    suite('Command: newWorkbook', () => {
        test('Should create a new workbook in workspace', async () => {
            const writeFileStub = sandbox.stub();
            // Stub fs property on workspace
            sandbox.stub(vscode.workspace, 'fs').get(() => ({
                writeFile: writeFileStub
            }));

            sandbox.stub(vscode.workspace, 'openTextDocument').resolves({} as vscode.TextDocument);
            sandbox.stub(vscode.window, 'showTextDocument').resolves({} as vscode.TextEditor);
            const executeCommandStub = sandbox.stub(vscode.commands, 'executeCommand').resolves();
            const showInputBoxStub = sandbox.stub(vscode.window, 'showInputBox').resolves('test.md');

            // Mock workspace folder presence
            sandbox.stub(vscode.workspace, 'workspaceFolders').get(() => [{ uri: vscode.Uri.file('/workspace') }]);

            await newWorkbookHandler();

            assert.ok(showInputBoxStub.calledOnce, 'showInputBox should be called');
            assert.ok(writeFileStub.calledOnce, 'writeFile should be called');
            assert.ok(
                executeCommandStub.calledWith('vscode-md-spreadsheet.openEditor'),
                'openEditor command should be executed'
            );
        });

        test('Should create a new workbook via Save Dialog if no workspace', async () => {
            // Mock no workspace folders
            sandbox.stub(vscode.workspace, 'workspaceFolders').get(() => undefined);

            const showSaveDialogStub = sandbox
                .stub(vscode.window, 'showSaveDialog')
                .resolves(vscode.Uri.file('/tmp/test.md'));

            const writeFileStub = sandbox.stub();
            sandbox.stub(vscode.workspace, 'fs').get(() => ({
                writeFile: writeFileStub
            }));

            sandbox.stub(vscode.workspace, 'openTextDocument').resolves({} as vscode.TextDocument);
            sandbox.stub(vscode.window, 'showTextDocument').resolves({} as vscode.TextEditor);
            sandbox.stub(vscode.commands, 'executeCommand').resolves();

            await newWorkbookHandler();

            assert.ok(showSaveDialogStub.calledOnce);
            assert.ok(writeFileStub.calledOnce);
        });
        test('Should handle validation logic in InputBox', async () => {
            sandbox.stub(vscode.workspace, 'workspaceFolders').get(() => [{ uri: vscode.Uri.file('/workspace') }]);

            let validateCallback: any;

            sandbox.stub(vscode.window, 'showInputBox').callsFake(async (options) => {
                validateCallback = options ? options.validateInput : undefined;
                return 'valid.md';
            });

            sandbox.stub(vscode.workspace, 'fs').get(() => ({ writeFile: sandbox.stub() }));
            sandbox.stub(vscode.workspace, 'openTextDocument').resolves({} as vscode.TextDocument);
            sandbox.stub(vscode.window, 'showTextDocument').resolves({} as vscode.TextEditor);
            sandbox.stub(vscode.commands, 'executeCommand').resolves();

            await newWorkbookHandler();

            assert.ok(validateCallback!);
            assert.strictEqual(validateCallback!(''), 'Filename is required');
            assert.strictEqual(validateCallback!('invalid'), 'Filename must end with .md');
            assert.strictEqual(validateCallback!('valid.md'), null);
        });

        test('Should handle cancellation in InputBox', async () => {
            sandbox.stub(vscode.workspace, 'workspaceFolders').get(() => [{ uri: vscode.Uri.file('/workspace') }]);

            const writeFileStub = sandbox.stub();
            sandbox.stub(vscode.workspace, 'fs').get(() => ({ writeFile: writeFileStub }));

            // Returns undefined (cancellation)
            sandbox.stub(vscode.window, 'showInputBox').resolves(undefined);

            await newWorkbookHandler();

            assert.ok(writeFileStub.notCalled);
        });

        test('Should handle cancellation in SaveDialog', async () => {
            sandbox.stub(vscode.workspace, 'workspaceFolders').get(() => undefined);

            // Returns undefined (cancellation)
            sandbox.stub(vscode.window, 'showSaveDialog').resolves(undefined);
            const writeFileStub = sandbox.stub();
            sandbox.stub(vscode.workspace, 'fs').get(() => ({ writeFile: writeFileStub }));

            await newWorkbookHandler();

            assert.ok(writeFileStub.notCalled);
        });
    });

    suite('Unit: Activate Function Logic', () => {
        let createWebviewPanelStub: sinon.SinonStub;
        let mockPanel: any;
        let postMessageSpy: sinon.SinonSpy;
        let mockContext: vscode.ExtensionContext;
        let onDidDisposeCallback: () => void;
        let showErrorMessageSpy: sinon.SinonSpy;

        // Callbacks captured from stubs
        let onDidChangeActiveTextEditorCallback: (e: vscode.TextEditor | undefined) => void;
        let onDidChangeTextDocumentCallback: (e: vscode.TextDocumentChangeEvent) => void;
        let onDidChangeConfigurationCallback: (e: vscode.ConfigurationChangeEvent) => void;

        setup(async () => {
            postMessageSpy = sinon.spy();
            showErrorMessageSpy = sandbox.spy(vscode.window, 'showErrorMessage');
            onDidDisposeCallback = () => {};

            // Reset callbacks
            onDidChangeActiveTextEditorCallback = () => {};
            onDidChangeTextDocumentCallback = () => {};
            onDidChangeConfigurationCallback = () => {};

            let mockTitle = '';

            mockPanel = {
                webview: {
                    postMessage: postMessageSpy,
                    asWebviewUri: (uri: vscode.Uri) => uri,
                    cspSource: 'mock-csp',
                    html: '',
                    onDidReceiveMessage: sinon.stub(),
                    options: {}
                },
                get title() {
                    return mockTitle;
                },
                set title(v: string) {
                    mockTitle = v;
                },
                reveal: sinon.stub(),
                onDidDispose: (callback: () => void) => {
                    onDidDisposeCallback = callback;
                },
                dispose: sinon.stub()
            };

            createWebviewPanelStub = sandbox.stub(vscode.window, 'createWebviewPanel').callsFake((viewType, title) => {
                mockPanel.title = title;
                return mockPanel;
            });

            // Stub Events
            const disposable = { dispose: () => {} };

            sandbox.stub(vscode.window, 'onDidChangeActiveTextEditor').callsFake((cb: any) => {
                onDidChangeActiveTextEditorCallback = cb;
                // Trigger immediately for initial state? No, activate doesn't do that.
                return disposable;
            });

            sandbox.stub(vscode.workspace, 'onDidChangeTextDocument').callsFake((cb: any) => {
                onDidChangeTextDocumentCallback = cb;
                return disposable;
            });

            sandbox.stub(vscode.workspace, 'onDidChangeConfiguration').callsFake((cb: any) => {
                onDidChangeConfigurationCallback = cb;
                return disposable;
            });

            // Stub RegisterCommand to capture handlers?
            // We can just execute the command handler logic directly if we export calls or trigger commands.
            // But since we are unit testing `activate`, we want to ensure it REGISTERS commands.
            sandbox.stub(vscode.commands, 'registerCommand').returns(disposable);

            // Prepare Mock Context
            mockContext = {
                subscriptions: [],
                extensionUri: vscode.Uri.file('/mock/extension'),
                extensionMode: vscode.ExtensionMode.Test
            } as unknown as vscode.ExtensionContext;

            // Import and call activate
            activate(mockContext);

            // Note: calling activate registers commands and listeners into `mockContext.subscriptions`
            // AND specifically adds listeners to `vscode.window` etc via our stubs.
        });

        test('openEditor command should create panel', async () => {
            // Find the registered command handler for openEditor
            // We stubbed registerCommand. We need to capture the callback.
            // But simpler: `activate` registers 'vscode-md-spreadsheet.openEditor'.
            // We can search the stub calls.

            const registerStub = vscode.commands.registerCommand as sinon.SinonStub;
            const openEditorCall = registerStub
                .getCalls()
                .find((call) => call.args[0] === 'vscode-md-spreadsheet.openEditor');
            assert.ok(openEditorCall, 'openEditor should be registered');
            const openEditorHandler = openEditorCall.args[1];

            // Mock Active Editor
            const document = {
                uri: vscode.Uri.file('/test.md'),
                fileName: '/test.md',
                getText: () => 'content',
                languageId: 'markdown'
            } as vscode.TextDocument;
            sandbox.stub(vscode.window, 'activeTextEditor').value({ document });

            // Run handler
            await openEditorHandler();

            assert.ok(createWebviewPanelStub.calledOnce, 'createPanel should be called');
            assert.strictEqual(mockPanel.title, 'MD Spreadsheet - test.md');
        });

        test('onDidChangeActiveTextEditor should update panel', async () => {
            // 1. Create panel first
            const registerStub = vscode.commands.registerCommand as sinon.SinonStub;
            const openEditorHandler = registerStub
                .getCalls()
                .find((call) => call.args[0] === 'vscode-md-spreadsheet.openEditor')!.args[1];

            const doc1 = {
                uri: vscode.Uri.file('/doc1.md'),
                fileName: '/doc1.md',
                getText: () => 'doc1',
                languageId: 'markdown'
            } as vscode.TextDocument;
            sandbox.stub(vscode.window, 'activeTextEditor').value({ document: doc1 });
            await openEditorHandler(); // Create panel
            postMessageSpy.resetHistory();

            // 2. Trigger Event
            const doc2 = {
                uri: vscode.Uri.file('/doc2.md'),
                fileName: '/doc2.md',
                getText: () => 'doc2',
                languageId: 'markdown'
            } as vscode.TextDocument;

            // Trigger callback manually
            onDidChangeActiveTextEditorCallback({ document: doc2 } as vscode.TextEditor);

            assert.ok(postMessageSpy.calledWithMatch({ type: 'update', content: 'doc2' }));
        });

        test('onDidChangeTextDocument should sync content', async () => {
            // 1. Create panel
            const registerStub = vscode.commands.registerCommand as sinon.SinonStub;
            const openEditorHandler = registerStub
                .getCalls()
                .find((call) => call.args[0] === 'vscode-md-spreadsheet.openEditor')!.args[1];
            const doc = {
                uri: vscode.Uri.file('/doc.md'),
                fileName: '/doc.md',
                getText: () => 'initial',
                languageId: 'markdown',
                version: 1,
                isClosed: false
            } as vscode.TextDocument;
            // Important: activeDocument must match event doc uri.
            // toString() is called.
            doc.uri.toString = () => 'file:///doc.md';

            sandbox.stub(vscode.window, 'activeTextEditor').value({ document: doc });
            await openEditorHandler();
            postMessageSpy.resetHistory();

            // 2. Trigger Event
            // We need an event object
            const event = {
                document: { ...doc, getText: () => 'updated' } as any,
                contentChanges: [],
                reason: undefined // Fix: Add required 'reason' property
            };

            onDidChangeTextDocumentCallback(event);

            assert.ok(postMessageSpy.calledWithMatch({ type: 'update', content: 'updated' }));
        });

        test('onDidChangeConfiguration should sync settings', async () => {
            // 1. Create panel
            const registerStub = vscode.commands.registerCommand as sinon.SinonStub;
            const openEditorHandler = registerStub
                .getCalls()
                .find((call) => call.args[0] === 'vscode-md-spreadsheet.openEditor')!.args[1];
            const doc = {
                uri: vscode.Uri.file('/doc.md'),
                fileName: '/doc.md',
                getText: () => 'content',
                languageId: 'markdown'
            } as vscode.TextDocument;
            sandbox.stub(vscode.window, 'activeTextEditor').value({ document: doc });
            await openEditorHandler();
            postMessageSpy.resetHistory();

            // 2. Trigger config changes
            const event = {
                affectsConfiguration: (section: string) => section === 'mdSpreadsheet.parsing'
            } as vscode.ConfigurationChangeEvent;

            onDidChangeConfigurationCallback(event);

            assert.ok(postMessageSpy.calledWithMatch({ type: 'configUpdate' }));
        });

        test('onDidDispose should cleanup', async () => {
            const registerStub = vscode.commands.registerCommand as sinon.SinonStub;
            const openEditorHandler = registerStub
                .getCalls()
                .find((call) => call.args[0] === 'vscode-md-spreadsheet.openEditor')!.args[1];

            const doc = {
                uri: vscode.Uri.file('/doc.md'),
                fileName: '/doc.md',
                getText: () => 'content',
                languageId: 'markdown'
            } as vscode.TextDocument;
            sandbox.stub(vscode.window, 'activeTextEditor').value({ document: doc });

            // 1. Create
            await openEditorHandler();
            assert.ok(createWebviewPanelStub.calledOnce);
            createWebviewPanelStub.resetHistory();

            // 2. Dispose
            onDidDisposeCallback(); // Simulate dispose

            // 3. Create again -> Should create NEW panel
            await openEditorHandler();
            assert.ok(createWebviewPanelStub.calledOnce);
        });
        test('openEditor should show error if no active editor', async () => {
            const registerStub = vscode.commands.registerCommand as sinon.SinonStub;
            const openEditorHandler = registerStub
                .getCalls()
                .find((call) => call.args[0] === 'vscode-md-spreadsheet.openEditor')!.args[1];

            sandbox.stub(vscode.window, 'activeTextEditor').value(undefined);

            await openEditorHandler();

            assert.ok(createWebviewPanelStub.notCalled);
            assert.ok(showErrorMessageSpy.calledWith('No active Markdown editor found'));
        });

        test('openEditor should show error if language is not markdown', async () => {
            const registerStub = vscode.commands.registerCommand as sinon.SinonStub;
            const openEditorHandler = registerStub
                .getCalls()
                .find((call) => call.args[0] === 'vscode-md-spreadsheet.openEditor')!.args[1];

            const doc = { languageId: 'plaintext' } as vscode.TextDocument;
            sandbox.stub(vscode.window, 'activeTextEditor').value({ document: doc });

            await openEditorHandler();

            assert.ok(createWebviewPanelStub.notCalled);
            assert.ok(showErrorMessageSpy.calledWith('No active Markdown editor found'));
        });

        test('openEditor should update panel if switching documents while panel is open', async () => {
            // 1. Setup mock editor with mutable document
            const registerStub = vscode.commands.registerCommand as sinon.SinonStub;
            const openEditorHandler = registerStub
                .getCalls()
                .find((call) => call.args[0] === 'vscode-md-spreadsheet.openEditor')!.args[1];

            const doc1 = {
                uri: vscode.Uri.file('/doc1.md'),
                fileName: '/doc1.md',
                getText: () => 'doc1',
                languageId: 'markdown'
            } as vscode.TextDocument;

            const doc2 = {
                uri: vscode.Uri.file('/doc2.md'),
                fileName: '/doc2.md',
                getText: () => 'doc2',
                languageId: 'markdown'
            } as vscode.TextDocument;

            const mockEditor = { document: doc1 };
            sandbox.stub(vscode.window, 'activeTextEditor').value(mockEditor);

            // 1. Create panel
            await openEditorHandler();
            postMessageSpy.resetHistory();

            // 2. Switch doc and run openEditor again
            mockEditor.document = doc2;

            await openEditorHandler();

            assert.ok(createWebviewPanelStub.calledOnce, 'Should NOT create new panel, simple reveal');
            assert.ok(mockPanel.reveal.calledOnce);
            assert.ok(postMessageSpy.calledWithMatch({ type: 'update', content: 'doc2' }), 'Should update content');
            assert.strictEqual(mockPanel.title, 'MD Spreadsheet - doc2.md');
        });

        test('onDidChangeActiveTextEditor should ignore non-markdown documents', async () => {
            const registerStub = vscode.commands.registerCommand as sinon.SinonStub;
            const openEditorHandler = registerStub
                .getCalls()
                .find((call) => call.args[0] === 'vscode-md-spreadsheet.openEditor')!.args[1];

            // Setup panel
            const doc1 = {
                uri: vscode.Uri.file('/doc1.md'),
                fileName: '/doc1.md',
                getText: () => 'doc1',
                languageId: 'markdown'
            } as vscode.TextDocument;
            sandbox.stub(vscode.window, 'activeTextEditor').value({ document: doc1 });
            await openEditorHandler();
            postMessageSpy.resetHistory();

            // Switch to text file
            const doc2 = {
                uri: vscode.Uri.file('/doc2.txt'),
                fileName: '/doc2.txt',
                getText: () => 'text',
                languageId: 'plaintext'
            } as vscode.TextDocument;

            onDidChangeActiveTextEditorCallback({ document: doc2 } as vscode.TextEditor);

            assert.ok(postMessageSpy.notCalled);
        });

        test('onDidChangeActiveTextEditor should ignore undefined editor', async () => {
            const registerStub = vscode.commands.registerCommand as sinon.SinonStub;
            const openEditorHandler = registerStub
                .getCalls()
                .find((call) => call.args[0] === 'vscode-md-spreadsheet.openEditor')!.args[1];

            const doc1 = {
                uri: vscode.Uri.file('/doc1.md'),
                fileName: '/doc1.md',
                getText: () => 'doc1',
                languageId: 'markdown'
            } as vscode.TextDocument;
            sandbox.stub(vscode.window, 'activeTextEditor').value({ document: doc1 });
            await openEditorHandler();
            postMessageSpy.resetHistory();

            onDidChangeActiveTextEditorCallback(undefined);

            assert.ok(postMessageSpy.notCalled);
        });

        test('onDidChangeActiveTextEditor should ignore same document', async () => {
            const registerStub = vscode.commands.registerCommand as sinon.SinonStub;
            const openEditorHandler = registerStub
                .getCalls()
                .find((call) => call.args[0] === 'vscode-md-spreadsheet.openEditor')!.args[1];

            const doc1 = {
                uri: vscode.Uri.file('/doc1.md'),
                fileName: '/doc1.md',
                getText: () => 'doc1',
                languageId: 'markdown'
            } as vscode.TextDocument;
            sandbox.stub(vscode.window, 'activeTextEditor').value({ document: doc1 });
            await openEditorHandler();
            postMessageSpy.resetHistory();

            // Trigger same doc
            onDidChangeActiveTextEditorCallback({ document: doc1 } as vscode.TextEditor);

            assert.ok(postMessageSpy.notCalled);
        });

        test('onDidChangeTextDocument should ignore unrelated documents', async () => {
            const registerStub = vscode.commands.registerCommand as sinon.SinonStub;
            const openEditorHandler = registerStub
                .getCalls()
                .find((call) => call.args[0] === 'vscode-md-spreadsheet.openEditor')!.args[1];
            const doc = {
                uri: vscode.Uri.file('/doc.md'),
                fileName: '/doc.md',
                getText: () => 'initial',
                languageId: 'markdown'
            } as vscode.TextDocument;
            doc.uri.toString = () => 'file:///doc.md';

            sandbox.stub(vscode.window, 'activeTextEditor').value({ document: doc });
            await openEditorHandler();
            postMessageSpy.resetHistory();

            // Event for different file
            const otherDoc = { ...doc, uri: vscode.Uri.file('/other.md') };
            otherDoc.uri.toString = () => 'file:///other.md';

            const event = {
                document: otherDoc as any,
                contentChanges: [],
                reason: undefined
            };

            onDidChangeTextDocumentCallback(event);

            assert.ok(postMessageSpy.notCalled);
        });

        test('onDidChangeConfiguration should ignore unrelated settings', async () => {
            const registerStub = vscode.commands.registerCommand as sinon.SinonStub;
            const openEditorHandler = registerStub
                .getCalls()
                .find((call) => call.args[0] === 'vscode-md-spreadsheet.openEditor')!.args[1];
            const doc = {
                uri: vscode.Uri.file('/doc.md'),
                fileName: '/doc.md',
                getText: () => 'content',
                languageId: 'markdown'
            } as vscode.TextDocument;
            sandbox.stub(vscode.window, 'activeTextEditor').value({ document: doc });
            await openEditorHandler();
            postMessageSpy.resetHistory();

            const event = {
                affectsConfiguration: (section: string) => section === 'workbench.editor'
            } as vscode.ConfigurationChangeEvent;

            onDidChangeConfigurationCallback(event);

            assert.ok(postMessageSpy.notCalled);
        });
    });
});
