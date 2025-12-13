import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MyEditor } from './main';

// Ensure MyEditor is defined (it might be defined by import side effect)
if (!customElements.get('md-spreadsheet-editor')) {
    customElements.define('md-spreadsheet-editor', MyEditor);
}

describe('Sheet Rename Logic', () => {
    let el: MyEditor;

    beforeEach(() => {
        el = new MyEditor();
        document.body.appendChild(el);
    });

    afterEach(() => {
        document.body.removeChild(el);
        vi.clearAllMocks();
    });

    it('Rename Sheet correctly replaces the header line', async () => {
        // Setup State
        // Tab Definition: { type: 'sheet', title: 'OldName', index: 0, sheetIndex: 0, data: { header_line: 10 } }
        const tabs: any[] = [{
            type: 'sheet',
            title: 'OldName',
            index: 0,
            sheetIndex: 0,
            data: { header_line: 10, tables: [] }
        }];
        (el as any).tabs = tabs;
        (el as any).editingTabIndex = 0;

        // Mock Config (default header level 2)
        (el as any).config = { sheetHeaderLevel: 2 };

        // Invoke Rename
        // Private method: _handleTabRename(index, tab, newName)
        (el as any)._handleTabRename(0, tabs[0], 'NewName');

        // Verify vscode.postMessage calls
        const vscode = (global as any).vscode;
        expect(vscode.postMessage).toHaveBeenCalled();

        const callArgs = vscode.postMessage.mock.calls[0][0];

        // Assert: Type is updateRange
        expect(callArgs.type).toBe('updateRange');

        // Assert: StartLine is header_line (10)
        expect(callArgs.startLine).toBe(10);

        // Assert: EndLine is header_line + 1 (11) - REPLACEMENT LOGIC
        expect(callArgs.endLine).toBe(11);

        // Assert: Content has new name AND newline
        // ## NewName\n
        expect(callArgs.content).toBe('## NewName\n');
    });

    it('Rename Sheet does nothing if name unchanged', async () => {
        const tabs: any[] = [{
            type: 'sheet',
            title: 'OldName',
            index: 0,
            sheetIndex: 0,
            data: { header_line: 10, tables: [] }
        }];
        (el as any).tabs = tabs;
        (el as any).editingTabIndex = 0;

        (el as any)._handleTabRename(0, tabs[0], 'OldName');

        const vscode = (global as any).vscode;
        expect(vscode.postMessage).not.toHaveBeenCalled();
    });
});
