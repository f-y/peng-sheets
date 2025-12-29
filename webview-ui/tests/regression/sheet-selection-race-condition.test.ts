
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fixture, html } from '@open-wc/testing-helpers';
import '../../main';
import { MdSpreadsheetEditor } from '../../main';
import { TabDefinition } from '../../types';

describe('Regression: Sheet Selection Race Condition', () => {
    let el: MdSpreadsheetEditor;

    beforeEach(async () => {
        el = await fixture<MdSpreadsheetEditor>(html`<md-spreadsheet-editor></md-spreadsheet-editor>`);
        // Mock spreadsheetService
        (el as any).spreadsheetService = {
            addSheet: vi.fn(),
            addDocument: vi.fn(),
            deleteSheet: vi.fn(),
            deleteDocument: vi.fn(),
            renameSheet: vi.fn(),
            renameDocument: vi.fn(),
            moveDocumentSection: vi.fn(),
            moveWorkbookSection: vi.fn(),
            updateWorkbookTabOrder: vi.fn(),
        };

        // Mock postMessage
        (el as any)._postUpdateMessage = vi.fn();
    });

    it('should correctly handle premature/stale updates during sheet addition', async () => {
        // Setup initial tabs: [Sheet1, Doc1, Sheet2, +]
        const initialTabs: TabDefinition[] = [
            { type: 'sheet', index: 0, title: 'Sheet 1' },
            { type: 'document', index: 0, title: 'Doc 1' },
            { type: 'sheet', index: 1, title: 'Sheet 2' },
            { type: 'add-sheet', index: 0, title: '+' }
        ];

        // Initialize state
        // Previous sheet count = 2
        (el as any)._previousSheetCount = 2;
        el.tabs = initialTabs;
        el.activeTabIndex = 0;
        await el.updateComplete;

        // Simulate Right Click on Doc 1 (index 1) -> Add Sheet
        // Target index = 2
        const contextMenuIndex = 1;
        const targetIndex = contextMenuIndex + 1; // 2

        // Manually trigger the "Add Sheet" logic which sets pending state
        // (el as any)._addSheetAtPosition(targetIndex); 
        // We can just set the state manually to simulate call
        el.pendingAddSheet = true;
        (el as any)._pendingNewTabIndex = targetIndex;
        // Verify state is set
        expect(el.pendingAddSheet).toBe(true);
        expect((el as any)._pendingNewTabIndex).toBe(targetIndex);

        // --- SIMULATE RACE CONDITION ---
        // Force an update with OLD tabs (Stale Update)
        // This mimics a situation where an unrelated update or echo arrives before the new sheet
        el.tabs = [...initialTabs];
        await el.updateComplete;

        // BUG VERIFICATION:
        // If the bug exists, willUpdate will see pendingAddSheet=true, ignore that sheetWasAdded=false,
        // and consume _pendingNewTabIndex prematurely.

        // If the fix works, state should be PRESERVED because sheet count didn't increase.
        expect(el.pendingAddSheet).toBe(true);
        expect((el as any)._pendingNewTabIndex).toBe(targetIndex);

        // --- SIMULATE REAL UPDATE ---
        // Now simulate the real update with the new sheet
        const newTabs: TabDefinition[] = [
            { type: 'sheet', index: 0, title: 'Sheet 1' },
            { type: 'document', index: 0, title: 'Doc 1' },
            { type: 'sheet', index: 1, title: 'New Sheet' }, // Inserted at 2
            { type: 'sheet', index: 2, title: 'Sheet 2' },
            { type: 'add-sheet', index: 0, title: '+' }
        ];

        el.tabs = newTabs;
        await el.updateComplete;

        // Expect activeTabIndex to be 2 (New Sheet)
        expect(el.activeTabIndex).toBe(2);

        // Expect flags to be cleared now
        expect(el.pendingAddSheet).toBe(false);
        expect((el as any)._pendingNewTabIndex).toBe(null);
    });
});
