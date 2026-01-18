/**
 * H9 Full Flow Reproduction Test
 * 
 * This test reproduces the exact scenario from production debug logs:
 * - Initial: [S1, D1, S2, D2] (4 tabs + add-sheet)
 * - Action: Drag S1 (index 0) to index 2 (between D1 and S2)
 * - Expected: [D1, S1, S2, D2]
 * - Bug: D1 still appears after WB physically
 * 
 * Key observation from logs:
 * - newTabOrder includes 'add-sheet' type which should NOT be in metadata
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as editor from '../../../src/editor';
import { determineReorderAction } from '../../services/tab-reorder-service';

interface TestTab {
    type: 'sheet' | 'document' | 'add-sheet';
    sheetIndex?: number;
    docIndex?: number;
}

describe('H9 Full Flow Reproduction', () => {
    beforeEach(() => {
        editor.resetContext();
    });

    it('should correctly set tab_order when dragging S1 across D1 (exact production scenario)', () => {
        // This is the EXACT scenario from production logs
        // Physical file: WB(Sheet1, Sheet2), Doc1, Doc2
        // Visual order via metadata: [S1, D1, S2, D2] (Sheet1, Doc1, Sheet2, Doc2)
        const INITIAL_MD = `# Tables

## Sheet 1

| Column 1 | Column 2 | Column 3 |
| --- | --- | --- |
|  |  |  |

## Sheet 2

| Column 1 | Column 2 | Column 3 |
| --- | --- | --- |
|  |  |  |

<!-- md-spreadsheet-workbook-metadata: {"tab_order": [{"type": "sheet", "index": 0}, {"type": "document", "index": 0}, {"type": "sheet", "index": 1}, {"type": "document", "index": 1}]} -->

# Doc 1

# Doc 2
`;

        // Initialize editor with the exact production content
        editor.initializeWorkbook(INITIAL_MD, '{}');

        // Current visual tabs (from metadata) - matches production logs
        const tabs: TestTab[] = [
            { type: 'sheet', sheetIndex: 0 },    // S1 (visual index 0)
            { type: 'document', docIndex: 0 },    // D1 (visual index 1)
            { type: 'sheet', sheetIndex: 1 },    // S2 (visual index 2)
            { type: 'document', docIndex: 1 },    // D2 (visual index 3)
            { type: 'add-sheet' }                 // add-sheet button (visual index 4)
        ];

        // Drag S1 (index 0) to index 2 (between D1 and S2)
        const action = determineReorderAction(tabs, 0, 2);

        console.log('[TEST] determineReorderAction result:', JSON.stringify(action, null, 2));

        // ===== CRITICAL ASSERTIONS =====

        // 1. Action should require metadata
        expect(action.metadataRequired).toBe(true);

        // 2. CRITICAL: newTabOrder should NOT contain 'add-sheet'!
        // This is a bug in handleSheetToSheet or determineReorderAction
        if (action.newTabOrder) {
            const hasAddSheet = action.newTabOrder.some((item: any) => item.type === 'add-sheet');
            expect(hasAddSheet).toBe(false); // add-sheet should be filtered out!

            // 3. newTabOrder should have exactly 4 items (2 sheets + 2 docs)
            expect(action.newTabOrder.length).toBe(4);

            // 4. Expected order: [D1, S1, S2, D2]
            // D1 should be first
            expect(action.newTabOrder[0]).toEqual({ type: 'document', index: 0 });
            expect(action.newTabOrder[1]).toEqual({ type: 'sheet', index: 0 });
            expect(action.newTabOrder[2]).toEqual({ type: 'sheet', index: 1 });
            expect(action.newTabOrder[3]).toEqual({ type: 'document', index: 1 });
        } else {
            throw new Error('newTabOrder should be defined when metadataRequired is true');
        }

        // 5. Now simulate the actual update flow from main.ts
        if (action.metadataRequired && action.physicalMove) {
            // Update metadata first
            const metaResult = editor.updateWorkbookTabOrder(action.newTabOrder);
            console.log('[TEST] updateWorkbookTabOrder result:', JSON.stringify(metaResult));

            // Then execute physical move
            if (action.physicalMove.type === 'move-sheet') {
                const { fromSheetIndex, toSheetIndex } = action.physicalMove;
                const targetTabOrderIndex = 2; // toIndex from drag
                const moveResult = editor.moveSheet(fromSheetIndex, toSheetIndex, targetTabOrderIndex);
                console.log('[TEST] moveSheet result:', JSON.stringify(moveResult));

                // 6. Verify the final content includes metadata WITH correct tab_order
                if (moveResult && moveResult.content) {
                    // Check that metadata comment exists and is correct
                    expect(moveResult.content).toContain('md-spreadsheet-workbook-metadata');
                    expect(moveResult.content).toContain('"type": "document"');
                    expect(moveResult.content).toContain('"index": 0');

                    // CRITICAL: Content should NOT have 'add-sheet' in metadata
                    expect(moveResult.content).not.toContain('"type": "add-sheet"');
                }
            }
        }

        // 7. Final state verification
        const finalState = JSON.parse(editor.getState());
        const finalTabOrder = finalState.workbook?.metadata?.tab_order;

        console.log('[TEST] Final state tab_order:', JSON.stringify(finalTabOrder, null, 2));

        expect(finalTabOrder).toBeDefined();
        expect(finalTabOrder.length).toBe(4); // No add-sheet

        // D1 should be first in the final tab_order
        expect(finalTabOrder[0]).toEqual({ type: 'document', index: 0 });
    });

    it('should filter out add-sheet from newTabOrder in handleSheetToSheet', () => {
        // Simpler test to verify add-sheet filtering
        const tabs: TestTab[] = [
            { type: 'sheet', sheetIndex: 0 },
            { type: 'sheet', sheetIndex: 1 },
            { type: 'add-sheet' }
        ];

        // Any sheet reorder
        const action = determineReorderAction(tabs, 0, 2);

        if (action.newTabOrder) {
            const hasAddSheet = action.newTabOrder.some((item: any) => item.type === 'add-sheet');
            expect(hasAddSheet).toBe(false);
        }
    });
});
