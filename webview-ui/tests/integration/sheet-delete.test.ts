import { expect, fixture, html } from '@open-wc/testing';
import { describe, it, beforeEach, vi } from 'vitest';
import { MyEditor } from '../../main';
import '../../main'; // Ensure custom element is defined
import '../../components/confirmation-modal'; // Ensure modal is defined
import { awaitView } from '../helpers/test-helpers';

describe('MyEditor Sheet Deletion', () => {
    let el: MyEditor;

    beforeEach(async () => {
        // Stub _parseWorkbook to prevent it from resetting tabs
        const originalParse = (MyEditor.prototype as any)._parseWorkbook;
        (MyEditor.prototype as any)._parseWorkbook = async () => {};

        try {
            el = (await fixture(html`<md-spreadsheet-editor></md-spreadsheet-editor>`)) as MyEditor;
            // Mock tabs data
            (el as any).tabs = [
                { type: 'sheet', title: 'Sheet1', index: 0, sheetIndex: 0, data: { tables: [] } },
                { type: 'sheet', title: 'Sheet2', index: 1, sheetIndex: 1, data: { tables: [] } }
            ];
            await awaitView(el);
        } finally {
            // Restore (optional if we want clean state, but vitest resets modules usually? No, JSDOM env might persist class)
            // Ideally restore after test.
            // (MyEditor.prototype as any)._parseWorkbook = originalParse;
        }
    });

    it('sets confirmDeleteIndex when _deleteSheet is called', async () => {
        // Access private method
        expect((el as any).tabs.length).to.equal(2);
        (el as any)._deleteSheet(1);

        expect((el as any).confirmDeleteIndex).to.equal(1);
    });

    it('clears confirmDeleteIndex when _cancelDelete is called', async () => {
        (el as any).confirmDeleteIndex = 1;
        (el as any)._cancelDelete();

        expect((el as any).confirmDeleteIndex).to.be.null;
    });

    it('performs delete and clears state when _performDelete is called', async () => {
        let deleteSheetCalled = false;
        // Mock spreadsheetService
        (el as any).spreadsheetService = {
            deleteSheet: (sheetIdx: number) => {
                deleteSheetCalled = true;
            }
        };

        (el as any).confirmDeleteIndex = 1;
        await (el as any)._performDelete();

        expect(deleteSheetCalled).to.be.true;
        expect((el as any).confirmDeleteIndex).to.be.null;
    });

    it('adjusts activeTabIndex when current sheet becomes add-sheet button', async () => {
        // Initial state: Sheet1, Sheet2, +
        (el as any).tabs = [
            { type: 'sheet', title: 'Sheet1', index: 0, sheetIndex: 0, data: { tables: [] } },
            { type: 'sheet', title: 'Sheet2', index: 1, sheetIndex: 1, data: { tables: [] } },
            { type: 'add-sheet', title: '+', index: 2 }
        ];
        (el as any).activeTabIndex = 1; // Select Sheet2
        await awaitView(el);

        // Simulate deletion of Sheet2. New state: Sheet1, +
        (el as any).tabs = [
            { type: 'sheet', title: 'Sheet1', index: 0, sheetIndex: 0, data: { tables: [] } },
            { type: 'add-sheet', title: '+', index: 1 }
        ];
        // Trigger update
        await awaitView(el);

        // activeTabIndex was 1. At 1 is "+". Should move to 0.
        expect((el as any).activeTabIndex).to.equal(0);
    });

    it('selects new sheet when added via _handleAddSheet', async () => {
        (el as any).tabs = [
            { type: 'sheet', title: 'Sheet1', index: 0, sheetIndex: 0, data: { tables: [] } },
            { type: 'add-sheet', title: '+', index: 1 }
        ];
        (el as any).activeTabIndex = 0;
        await awaitView(el);

        (el as any)._handleAddSheet(); // Sets pendingAddSheet = true

        // Simulate update with new sheet
        (el as any).tabs = [
            { type: 'sheet', title: 'Sheet1', index: 0, sheetIndex: 0, data: { tables: [] } },
            { type: 'sheet', title: 'Sheet 2', index: 1, sheetIndex: 1, data: { tables: [] } },
            { type: 'add-sheet', title: '+', index: 2 }
        ];
        await awaitView(el);

        // Should select index 1 (Sheet 2)
        expect((el as any).activeTabIndex).to.equal(1);
        expect((el as any).pendingAddSheet).to.be.false;
    });
});
