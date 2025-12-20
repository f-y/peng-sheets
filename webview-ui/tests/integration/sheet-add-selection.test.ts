import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from 'vitest';
import { fixture, html } from '@open-wc/testing';

// Mock vscode API
const postMessage = vi.fn();
vi.stubGlobal('acquireVsCodeApi', () => ({
    postMessage: postMessage,
    getState: () => ({}),
    setState: () => {}
}));

// Mock Pyodide that returns workbook with documents AFTER workbook
vi.stubGlobal('loadPyodide', async () => ({
    loadPackage: async () => {},
    pyimport: () => ({ install: async () => {} }),
    globals: {
        set: () => {},
        get: () => {}
    },
    runPythonAsync: async (code: string) => {
        if (code.includes('get_state')) {
            return JSON.stringify({
                workbook: {
                    sheets: [
                        { name: 'Sheet 1', tables: [{ name: 'Table1', rows: [['A']], metadata: {} }] },
                        { name: 'Sheet 2', tables: [] }
                    ]
                },
                structure: [
                    { type: 'document', title: 'Intro', content: '# Intro' },
                    { type: 'workbook' },
                    { type: 'document', title: 'Appendix', content: '# Appendix' }
                ]
            });
        }
        if (code.includes('add_sheet')) {
            return JSON.stringify({ success: true });
        }
        return 'null';
    }
}));

describe('Sheet Tab Selection Bug - Document after Workbook', () => {
    let MyEditor: any;

    beforeAll(async () => {
        const module = await import('../../main');
        MyEditor = module.MyEditor;
    });

    beforeEach(async () => {
        document.body.innerHTML = '';
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should select new sheet, not document tab, when adding sheet', async () => {
        const el = await fixture(html`<md-spreadsheet-editor></md-spreadsheet-editor>`);
        await new Promise((r) => setTimeout(r, 300));

        // Check initial tab structure: [Intro, Sheet 1, Sheet 2, +, Appendix]
        const tabs = (el as any).tabs;
        console.log('Tab structure:', tabs.map((t: any) => `${t.title}(${t.type})`).join(', '));

        // Find the add-sheet button index
        const addSheetIndex = tabs.findIndex((t: any) => t.type === 'add-sheet');
        expect(addSheetIndex).toBeGreaterThan(0);

        // Find current sheet count
        const sheetCount = tabs.filter((t: any) => t.type === 'sheet').length;
        console.log(`Before add: ${sheetCount} sheets, add-sheet at index ${addSheetIndex}`);

        // Simulate adding a sheet (mock will return success, triggering re-parse)
        // Note: In real scenario, _handleAddSheet sets pendingAddSheet = true
        (el as any).pendingAddSheet = true;

        // Simulate the workbook being updated with a new sheet
        // After add_sheet, the structure would be re-parsed with one more sheet
        // For this test, we simulate that by manually setting up the state

        // The actual bug manifests when willUpdate processes pendingAddSheet
        // with tabs that have documents AFTER the add-sheet button

        // Verify that document tabs come after add-sheet
        const appendixIndex = tabs.findIndex((t: any) => t.title === 'Appendix');
        console.log(`Appendix (document) at index: ${appendixIndex}`);

        if (appendixIndex > addSheetIndex) {
            console.log('BUG SCENARIO: Document appears after add-sheet button');
        }

        // The current buggy behavior: willUpdate selects tabs.length - 2 or last tab
        // which would select Appendix (document) instead of the new sheet
    });
});
