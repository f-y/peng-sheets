import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from 'vitest';

// Mock vscode API globally before importing main.ts which calls acquireVsCodeApi()
const postMessageSpy = vi.fn();
const mockVsCode = {
    postMessage: postMessageSpy,
    getState: () => ({}),
    setState: () => {}
};

// Stub the global function
vi.stubGlobal('acquireVsCodeApi', () => mockVsCode);
// Also stub the global usage in test if any
vi.stubGlobal('vscode', mockVsCode);

describe('Sheet Rename Logic', () => {
    let MyEditor: any;
    let el: any;

    beforeAll(async () => {
        // Dynamic import to ensure global is set before module execution
        const module = await import('../main');
        MyEditor = module.MyEditor;

        if (!customElements.get('md-spreadsheet-editor')) {
            customElements.define('md-spreadsheet-editor', MyEditor);
        }
    });

    beforeEach(() => {
        el = new MyEditor();
        document.body.appendChild(el);
        postMessageSpy.mockClear();
    });

    afterEach(() => {
        document.body.removeChild(el);
        vi.clearAllMocks();
    });

    it('Rename Sheet correctly replaces the header line', async () => {
        // Setup State
        // Tab Definition: { type: 'sheet', title: 'OldName', index: 0, sheetIndex: 0, data: { header_line: 10 } }
        const tabs: any[] = [
            {
                type: 'sheet',
                title: 'OldName',
                index: 0,
                sheetIndex: 0,
                data: { header_line: 10, tables: [] }
            }
        ];
        el.tabs = tabs;
        el.editingTabIndex = 0;

        // Mock Config (default header level 2)
        el.config = { sheetHeaderLevel: 2 };

        // Mock Pyodide and Workbook
        (el as any).pyodide = {
            runPythonAsync: vi.fn().mockResolvedValue(
                JSON.stringify({
                    startLine: 10,
                    endLine: 11,
                    content: '## NewName\n'
                })
            )
        };
        (el as any).workbook = {}; // Truthy

        // Invoke Rename
        // Private method: _handleTabRename(index, tab, newName)
        await (el as any)._handleTabRename(0, tabs[0], 'NewName');

        // Verify vscode.postMessage calls
        expect(postMessageSpy).toHaveBeenCalled();

        const callArgs = postMessageSpy.mock.calls[0][0];

        // Assert: Type is updateRange
        expect(callArgs.type).toBe('updateRange');

        // Assert: Content has new name AND newline
        // ## NewName\n
        expect(callArgs.content).toBe('## NewName\n');
    });

    it('Rename Sheet does nothing if name unchanged', async () => {
        const tabs: any[] = [
            {
                type: 'sheet',
                title: 'OldName',
                index: 0,
                sheetIndex: 0,
                data: { header_line: 10, tables: [] }
            }
        ];
        el.tabs = tabs;
        el.editingTabIndex = 0;

        el._handleTabRename(0, tabs[0], 'OldName');

        expect(postMessageSpy).not.toHaveBeenCalled();
    });
});
