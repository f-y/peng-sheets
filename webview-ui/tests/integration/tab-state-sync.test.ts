/**
 * Test for state synchronization between tabs and file content
 *
 * This test verifies that after any operation, the docIndex in tabs
 * correctly corresponds to the actual document at that physical position.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as editor from '../../../src/editor';

describe('State Sync: tabs docIndex vs file content', () => {
    const WORKBOOK_MD = `# Tables

## Sheet 1

| Column 1 |
| --- |
|  |

## Sheet 2

| Column 1 |
| --- |
|  |

# Doc 1

Content of Doc 1

# Doc 2

Content of Doc 2

# Doc 3

Content of Doc 3
`;

    beforeEach(() => {
        editor.initializeWorkbook(WORKBOOK_MD, JSON.stringify({ rootMarker: '# Tables' }));
    });

    /**
     * Helper: get document titles in physical order from file
     */
    function getDocTitlesFromFile(): string[] {
        const state = JSON.parse(editor.getState());
        return state.structure
            .filter((s: { type: string }) => s.type === 'document')
            .map((d: { title: string }) => d.title);
    }

    /**
     * Simulates what happens in UI: build tabs array from structure
     */
    function buildTabsFromStructure(): Array<{ type: string; docIndex?: number; sheetIndex?: number }> {
        const state = JSON.parse(editor.getState());
        const workbook = state.workbook;
        const structure = state.structure;
        const tabs: Array<{ type: string; docIndex?: number; sheetIndex?: number }> = [];

        // Add sheets from workbook
        if (workbook?.sheets) {
            for (let i = 0; i < workbook.sheets.length; i++) {
                tabs.push({ type: 'sheet', sheetIndex: i });
            }
        }

        // Add documents
        let docIdx = 0;
        for (const section of structure) {
            if (section.type === 'document') {
                tabs.push({ type: 'document', docIndex: docIdx++ });
            }
        }

        return tabs;
    }

    it('after D2 move, tabs rebuilt from file should have correct docIndex-to-title mapping', () => {
        // Initial state
        expect(getDocTitlesFromFile()).toEqual(['Doc 1', 'Doc 2', 'Doc 3']);

        // Move D2 (index 1) to after workbook
        editor.moveDocumentSection(1, null, true, false);

        // Verify file order changed
        const titlesAfterMove = getDocTitlesFromFile();
        expect(titlesAfterMove).toEqual(['Doc 2', 'Doc 1', 'Doc 3']);

        // Now simulate UI rebuilding tabs from the new structure
        const newTabs = buildTabsFromStructure();

        // Extract document tabs and verify their docIndex
        const docTabs = newTabs.filter((t) => t.type === 'document');

        // docIndex 0 should now be Doc 2 (it moved to first position)
        // docIndex 1 should now be Doc 1
        // docIndex 2 should still be Doc 3
        expect(docTabs.length).toBe(3);

        // Verify that docTabs[0].docIndex corresponds to Doc 2
        const state = JSON.parse(editor.getState());
        const docSections = state.structure.filter((s: { type: string }) => s.type === 'document');

        expect(docSections[docTabs[0].docIndex!].title).toBe('Doc 2');
        expect(docSections[docTabs[1].docIndex!].title).toBe('Doc 1');
        expect(docSections[docTabs[2].docIndex!].title).toBe('Doc 3');
    });

    it('CRITICAL: dragging tab with stale docIndex moves wrong document', () => {
        // This test reproduces the bug where:
        // 1. After D2 moves to first position, file is [D2, D1, D3]
        // 2. But if tabs aren't refreshed, they still have:
        //    - Tab with old docIndex=1 pointing to what WAS D2, but now is D1
        // 3. If user drags this tab again, the wrong doc moves

        // Step 1: Move D2 to first position
        editor.moveDocumentSection(1, null, true, false);
        expect(getDocTitlesFromFile()).toEqual(['Doc 2', 'Doc 1', 'Doc 3']);

        // Step 2: Simulate STALE tabs (not refreshed after move)
        // These tabs still think docIndex=1 is "D2" but it's actually "D1" now
        const staleTabs = [
            { type: 'sheet', sheetIndex: 0 },
            { type: 'sheet', sheetIndex: 1 },
            { type: 'document', docIndex: 0 }, // Was D1, NOW D2
            { type: 'document', docIndex: 1 }, // Was D2, NOW D1 (!)
            { type: 'document', docIndex: 2 } // D3
        ];

        // Step 3: User thinks they're dragging "D2" (tab at position 3)
        // But tab 3 has docIndex=1, which now maps to D1 in the file!
        const tabUserThinkIsD2 = staleTabs[3]; // { type: 'document', docIndex: 1 }

        // In the current file [D2, D1, D3]:
        // - docIndex 0 = D2
        // - docIndex 1 = D1 (!!!)
        // - docIndex 2 = D3

        const actualDocAtIndex1 = getDocTitlesFromFile()[tabUserThinkIsD2.docIndex!];

        // BUG DETECTED: User thinks they're moving D2, but docIndex 1 = D1 now!
        expect(actualDocAtIndex1).not.toBe('Doc 2'); // This proves the bug
        expect(actualDocAtIndex1).toBe('Doc 1'); // docIndex 1 = D1, not D2!
    });

    it('SOLUTION: tabs must be refreshed after physical move', () => {
        // Move D2
        editor.moveDocumentSection(1, null, true, false);

        // Immediately rebuild tabs from current structure
        const freshTabs = buildTabsFromStructure();
        const docTabs = freshTabs.filter((t) => t.type === 'document');

        // Now docIndex correctly maps to documents
        const titles = getDocTitlesFromFile();

        // Tab with docIndex 0 correctly points to D2 (first in file)
        expect(titles[docTabs[0].docIndex!]).toBe('Doc 2');

        // Tab with docIndex 1 correctly points to D1 (second in file)
        expect(titles[docTabs[1].docIndex!]).toBe('Doc 1');

        // If user drags docIndex 1, they'll move D1 - which is correct
        // because after the previous operation, D1 IS at index 1
    });
});
