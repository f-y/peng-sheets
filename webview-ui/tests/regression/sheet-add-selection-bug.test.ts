/**
 * Regression tests for Sheet Add Selection bug.
 *
 * Bug: When a new sheet was added via the '+' button, the previously selected
 * sheet remained selected instead of the newly added sheet.
 *
 * Fix: Added `_previousSheetCount` tracking in `willUpdate` to detect sheet
 * additions even if `pendingAddSheet` flag timing is off due to update cycles.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fixture, html } from '@open-wc/testing';
import { MyEditor } from '../../main';
import { awaitView } from '../helpers/test-helpers';

// Mock vscode API
const postMessage = vi.fn();
vi.stubGlobal('acquireVsCodeApi', () => ({
    postMessage: postMessage,
    getState: () => ({}),
    setState: () => {}
}));

// Mock Pyodide (minimal, won't be called in this unit test)
vi.stubGlobal('loadPyodide', async () => ({
    loadPackage: async () => {},
    pyimport: () => ({ install: async () => {} }),
    globals: { set: () => {}, get: () => {} },
    runPythonAsync: async () => 'null'
}));

describe('Sheet Add Selection Bug - Regression', () => {
    let el: MyEditor;

    beforeEach(async () => {
        document.body.innerHTML = '';
        // Stub _parseWorkbook to prevent it from resetting tabs
        (MyEditor.prototype as any)._parseWorkbook = async () => {};

        el = (await fixture(html`<md-spreadsheet-editor></md-spreadsheet-editor>`)) as MyEditor;
    });

    it('should select Sheet 2 when adding to a workbook with 1 sheet', async () => {
        (el as any).tabs = [
            { type: 'sheet', title: 'Sheet1', index: 0, sheetIndex: 0, data: { tables: [] } },
            { type: 'add-sheet', title: '+', index: 1 }
        ];
        (el as any).activeTabIndex = 0;
        await awaitView(el as any);

        (el as any)._handleAddSheet(); // pendingAddSheet = true

        (el as any).tabs = [
            { type: 'sheet', title: 'Sheet1', index: 0, sheetIndex: 0, data: { tables: [] } },
            { type: 'sheet', title: 'Sheet 2', index: 1, sheetIndex: 1, data: { tables: [] } },
            { type: 'add-sheet', title: '+', index: 2 }
        ];

        await awaitView(el as any);

        expect((el as any).activeTabIndex).toBe(1); // Sheet 2
        expect((el as any).tabs[(el as any).activeTabIndex].title).toBe('Sheet 2');
    });

    it('should select Sheet 3 when adding to a workbook with 2 sheets', async () => {
        (el as any).tabs = [
            { type: 'sheet', title: 'Sheet1', index: 0, sheetIndex: 0, data: { tables: [] } },
            { type: 'sheet', title: 'Sheet2', index: 1, sheetIndex: 1, data: { tables: [] } },
            { type: 'add-sheet', title: '+', index: 2 }
        ];
        (el as any).activeTabIndex = 0;
        await awaitView(el as any);

        (el as any)._handleAddSheet(); // pendingAddSheet = true

        (el as any).tabs = [
            { type: 'sheet', title: 'Sheet1', index: 0, sheetIndex: 0, data: { tables: [] } },
            { type: 'sheet', title: 'Sheet2', index: 1, sheetIndex: 1, data: { tables: [] } },
            { type: 'sheet', title: 'Sheet 3', index: 2, sheetIndex: 2, data: { tables: [] } },
            { type: 'add-sheet', title: '+', index: 3 }
        ];

        await awaitView(el as any);

        expect((el as any).activeTabIndex).toBe(2); // Sheet 3
        expect((el as any).tabs[(el as any).activeTabIndex].title).toBe('Sheet 3');
    });

    it('should select Sheet 3 in a hybrid workbook with documents', async () => {
        // Initial: [Intro(doc), Sheet1, Sheet2, +, Appendix(doc)]
        (el as any).tabs = [
            { type: 'document', title: 'Intro', index: 0, docIndex: 0 },
            { type: 'sheet', title: 'Sheet1', index: 1, sheetIndex: 0, data: { tables: [] } },
            { type: 'sheet', title: 'Sheet2', index: 2, sheetIndex: 1, data: { tables: [] } },
            { type: 'add-sheet', title: '+', index: 3 },
            { type: 'document', title: 'Appendix', index: 4, docIndex: 1 }
        ];
        (el as any).activeTabIndex = 1; // Start on Sheet1
        await awaitView(el as any);

        (el as any)._handleAddSheet(); // pendingAddSheet = true

        // After add: [Intro(doc), Sheet1, Sheet2, Sheet3, +, Appendix(doc)]
        (el as any).tabs = [
            { type: 'document', title: 'Intro', index: 0, docIndex: 0 },
            { type: 'sheet', title: 'Sheet1', index: 1, sheetIndex: 0, data: { tables: [] } },
            { type: 'sheet', title: 'Sheet2', index: 2, sheetIndex: 1, data: { tables: [] } },
            { type: 'sheet', title: 'Sheet 3', index: 3, sheetIndex: 2, data: { tables: [] } },
            { type: 'add-sheet', title: '+', index: 4 },
            { type: 'document', title: 'Appendix', index: 5, docIndex: 1 }
        ];

        await awaitView(el as any);

        // Sheet 3 is at index 3
        expect((el as any).activeTabIndex).toBe(3);
        expect((el as any).tabs[(el as any).activeTabIndex].title).toBe('Sheet 3');
    });
});
