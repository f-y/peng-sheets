import * as assert from 'assert';
import * as vscode from 'vscode';
// import { MessageDispatcher, HandlerContext } from '../message-dispatcher'; // MessageDispatcher logic test
// Note: importing from ../message-dispatcher might fail if it uses vscode types and runs outside of extension entry point context?
// Actually in 'vscode-test', we are in the extension host, so vscode module is available.

suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

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
});
