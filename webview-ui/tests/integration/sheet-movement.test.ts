/**
 * Integration Test: Sheet movement between docs
 *
 * BUG: When S1 is moved to after D1 in [S1, S2, D1, D2, D3],
 * the physical file order should change from [WB(S1,S2), D1, D2, D3]
 * to something that reflects S2, S1 order within the workbook.
 *
 * However, the sheet order within the workbook is NOT changing.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as editor from '../../../src/editor';

describe('Sheet movement: S1 to after D1', () => {
    const WORKBOOK_MD = `# Tables

## Sheet 1

| Column 1 |
| --- |
| A1 |

## Sheet 2

| Column 1 |
| --- |
| B1 |

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

    it('BUG REPRODUCTION: S1 to after D1 should physically reorder sheets', () => {
        // Initial state: [S1, S2, D1, D2, D3] in display order
        // User drags S1 to after D1 (between D1 and D2)
        //
        // Per SPECS.md 8.6 Case C8:
        // - This requires physical reorder of workbook sheets
        // - S1 should come after S2 in the physical workbook
        // - Metadata should place S1 after D1

        // Verify initial state
        const initialState = JSON.parse(editor.getState());
        expect(initialState.workbook.sheets[0].name).toBe('Sheet 1');
        expect(initialState.workbook.sheets[1].name).toBe('Sheet 2');

        // Move S1 (sheetIndex=0) to after D1
        // This should reorder sheets to [S2, S1] in workbook
        const result = editor.moveSheet(0, 1, 3); // fromIndex=0, toIndex=1, targetTabOrderIndex=3

        expect(result.error).toBeUndefined();
        expect(result.content).toBeDefined();

        // Verify sheet order in file content
        const s1Pos = result.content!.indexOf('## Sheet 1');
        const s2Pos = result.content!.indexOf('## Sheet 2');

        // S2 should come BEFORE S1 in the physical file
        expect(s2Pos).toBeLessThan(s1Pos);

        // Also verify via state
        const afterState = JSON.parse(editor.getState());
        expect(afterState.workbook.sheets[0].name).toBe('Sheet 2');
        expect(afterState.workbook.sheets[1].name).toBe('Sheet 1');
    });

    it('sheet order in state should match physical file order', () => {
        // Move S1 to position 1
        editor.moveSheet(0, 1, null);

        const state = JSON.parse(editor.getState());

        // Verify sheet order
        expect(state.workbook.sheets[0].name).toBe('Sheet 2');
        expect(state.workbook.sheets[1].name).toBe('Sheet 1');

        // Verify via markdown
        const md = editor.getFullMarkdown();
        const s1Pos = md.indexOf('## Sheet 1');
        const s2Pos = md.indexOf('## Sheet 2');

        expect(s2Pos).toBeLessThan(s1Pos);
    });

    /**
     * BUG REPRODUCTION: S1→S2 swap (toIndex=2) should NOT generate tab_order
     *
     * When moveSheet is called with targetTabOrderIndex=null,
     * the resulting markdown should NOT contain any tab_order metadata.
     *
     * This is the user's reported bug: S1 after S2 generates unwanted tab_order.
     */
    it('USER BUG: moveSheet with null targetTabOrderIndex must NOT generate tab_order', () => {
        // Move S1 to after S2 (simple sheet swap)
        // This is the exact call made by main.ts when action.metadataRequired=false
        const result = editor.moveSheet(0, 1, null);

        expect(result.error).toBeUndefined();
        expect(result.content).toBeDefined();

        // CRITICAL ASSERTION: No tab_order should be present
        expect(result.content!).not.toContain('tab_order');

        // Verify sheets are swapped in physical order
        const s1Pos = result.content!.indexOf('## Sheet 1');
        const s2Pos = result.content!.indexOf('## Sheet 2');
        expect(s2Pos).toBeLessThan(s1Pos);
    });
});
