/**
 * H9 Full Flow Reproduction Test
 * 
 * This test reproduces the exact scenario from production debug logs:
 * - Initial: [S1, D1, S2, D2] (4 tabs)
 * - Action: Drag S1 (index 0) to index 2 (between D1 and S2)
 * - Expected: [D1, S1, S2, D2]
 * 
 * After H9 fix:
 * - Returns move-workbook to physically reposition WB after D1
 * - metadataRequired: false (physical = visual, no metadata needed)
 * - add-sheet should never be in newTabOrder
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

    it('should return move-workbook when dragging S1 across D1 (H9 Physical Normalization)', () => {
        // Physical file: WB(Sheet1, Sheet2), Doc1, Doc2
        // Visual order via metadata: [S1, D1, S2, D2]
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

        editor.initializeWorkbook(INITIAL_MD, '{}');

        // Current visual tabs (from metadata) - matches production logs
        const tabs: TestTab[] = [
            { type: 'sheet', sheetIndex: 0 },    // S1 (visual index 0)
            { type: 'document', docIndex: 0 },    // D1 (visual index 1)
            { type: 'sheet', sheetIndex: 1 },    // S2 (visual index 2)
            { type: 'document', docIndex: 1 },    // D2 (visual index 3)
            { type: 'add-sheet' }                 // add-sheet button
        ];

        // Drag S1 (index 0) to index 2 (between D1 and S2)
        const action = determineReorderAction(tabs, 0, 2);

        console.log('[TEST] determineReorderAction result:', JSON.stringify(action, null, 2));

        // ===== H9 PHYSICAL NORMALIZATION BEHAVIOR =====
        // D1 becomes visually first → move WB physically after D1
        expect(action.actionType).toBe('physical+metadata');
        expect(action.physicalMove?.type).toBe('move-workbook');

        if (action.physicalMove?.type === 'move-workbook') {
            expect(action.physicalMove.direction).toBe('after-doc');
            expect(action.physicalMove.targetDocIndex).toBe(0); // D1
        }

        // No metadata needed after physical move (physical = visual)
        expect(action.metadataRequired).toBe(false);
        expect(action.newTabOrder).toBeUndefined();
    });

    it('should filter out add-sheet from any newTabOrder generated', () => {
        // Simpler test: pure sheet reorder (no H9 triggered)
        // This verifies add-sheet filtering still works
        const tabs: TestTab[] = [
            { type: 'sheet', sheetIndex: 0 },
            { type: 'sheet', sheetIndex: 1 },
            { type: 'add-sheet' }
        ];

        // Simple sheet reorder
        const action = determineReorderAction(tabs, 0, 2);

        // If newTabOrder is returned, it should not contain add-sheet
        if (action.newTabOrder) {
            const hasAddSheet = action.newTabOrder.some((item: { type: string }) => item.type === 'add-sheet');
            expect(hasAddSheet).toBe(false);
        }
    });
});
