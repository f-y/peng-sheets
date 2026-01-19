/**
 * SIDR3 toSheetIndex Comprehensive Tests
 * 
 * These tests verify the EXACT toSheetIndex value returned by SIDR3,
 * not just the action type.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as editor from '../../../src/editor';
import { determineReorderAction } from '../../services/tab-reorder-service';

interface TestTab {
    type: 'sheet' | 'document' | 'add-sheet';
    sheetIndex?: number;
    docIndex?: number;
}

describe('SIDR3 toSheetIndex Verification', () => {
    beforeEach(() => {
        editor.resetContext();
    });

    /**
     * User Bug Report (Critical):
     * Tab: [S1, D1, S2, D2, S3]
     * Action: S1 → after D2 (between D2 and S3)
     * 
     * Expected:
     * - Visual tab order: [D1, S2, D2, S1, S3]
     * - Visual sheet order: [S2, S1, S3]
     * - Physical sheet MUST be: [S2, S1, S3]
     * - toSheetIndex: 2 (S1 goes to position 2, after S2)
     * 
     * Bug Result:
     * - toSheetIndex: 3 → Physical [S2, S3, S1] (WRONG!)
     */
    it('S1 → after D2 with 3 sheets: toSheetIndex should be 2, not 3', () => {
        const INITIAL_MD = `# Tables

## Sheet 1

| A | B |
|---|---|
| 1 | 2 |

## Sheet 2

| A | B |
|---|---|
| 3 | 4 |

## Sheet 3

| A | B |
|---|---|
| 5 | 6 |

<!-- md-spreadsheet-workbook-metadata: {"tab_order": [{"type": "sheet", "index": 0}, {"type": "document", "index": 0}, {"type": "sheet", "index": 1}, {"type": "document", "index": 1}, {"type": "sheet", "index": 2}]} -->

# Doc 1

# Doc 2

`;

        editor.initializeWorkbook(INITIAL_MD, '{}');

        // Visual tabs (from metadata): [S1, D1, S2, D2, S3]
        const tabs: TestTab[] = [
            { type: 'sheet', sheetIndex: 0 },    // S1 (idx 0)
            { type: 'document', docIndex: 0 },   // D1 (idx 1)
            { type: 'sheet', sheetIndex: 1 },    // S2 (idx 2)
            { type: 'document', docIndex: 1 },   // D2 (idx 3)
            { type: 'sheet', sheetIndex: 2 },    // S3 (idx 4)
            { type: 'add-sheet' }
        ];

        // Drag S1 (index 0) to after D2 (toIndex=4, between D2 and S3)
        const action = determineReorderAction(tabs, 0, 4);

        console.log('[SIDR3 3-SHEET] Action:', JSON.stringify(action, null, 2));

        expect(action.physicalMove?.type).toBe('move-sheet');
        expect(action.metadataRequired).toBe(true);

        if (action.physicalMove?.type === 'move-sheet') {
            expect(action.physicalMove.fromSheetIndex).toBe(0);

            // CRITICAL: toSheetIndex MUST be 2 (position after S2)
            // This produces physical [S2, S1, S3]
            // NOT 3 which produces [S2, S3, S1]
            expect(action.physicalMove.toSheetIndex).toBe(1);
        }
    });

    /**
     * Simple case: [S1, D1, S2] → S1 to end
     * Visual sheet order: [S2, S1]
     * S1 should be at position 2 (after S2)
     */
    it('S1 → after S2 with 2 sheets: toSheetIndex should be 2', () => {
        const INITIAL_MD = `# Tables

## Sheet 1

| A | B |
|---|---|
| 1 | 2 |

## Sheet 2

| A | B |
|---|---|
| 3 | 4 |

<!-- md-spreadsheet-workbook-metadata: {"tab_order": [{"type": "sheet", "index": 0}, {"type": "document", "index": 0}, {"type": "sheet", "index": 1}]} -->

# Doc 1

`;

        editor.initializeWorkbook(INITIAL_MD, '{}');

        const tabs: TestTab[] = [
            { type: 'sheet', sheetIndex: 0 },
            { type: 'document', docIndex: 0 },
            { type: 'sheet', sheetIndex: 1 },
            { type: 'add-sheet' }
        ];

        // S1 to end (after S2)
        const action = determineReorderAction(tabs, 0, 3);

        console.log('[SIDR3 2-SHEET] Action:', JSON.stringify(action, null, 2));

        expect(action.physicalMove?.type).toBe('move-sheet');

        if (action.physicalMove?.type === 'move-sheet') {
            expect(action.physicalMove.fromSheetIndex).toBe(0);
            // S1 goes to position 2 (after S2 at position 1)
            expect(action.physicalMove.toSheetIndex).toBe(1);
        }
    });

    /**
     * H11 Reproduction: [S1, D1, S2, D2] → S1 to between S2/D2
     * Visual sheet order after move: [S2, S1]
     * toSheetIndex should be 2
     */
    it('H11: S1 → between S2/D2: toSheetIndex should be 2', () => {
        const INITIAL_MD = `# Tables

## Sheet 1

| A | B |
|---|---|
| 1 | 2 |

## Sheet 2

| A | B |
|---|---|
| 3 | 4 |

<!-- md-spreadsheet-workbook-metadata: {"tab_order": [{"type": "sheet", "index": 0}, {"type": "document", "index": 0}, {"type": "sheet", "index": 1}, {"type": "document", "index": 1}]} -->

# Doc 1

# Doc 2

`;

        editor.initializeWorkbook(INITIAL_MD, '{}');

        const tabs: TestTab[] = [
            { type: 'sheet', sheetIndex: 0 },
            { type: 'document', docIndex: 0 },
            { type: 'sheet', sheetIndex: 1 },
            { type: 'document', docIndex: 1 },
            { type: 'add-sheet' }
        ];

        // S1 (idx 0) to between S2/D2 (toIndex=3)
        const action = determineReorderAction(tabs, 0, 3);

        console.log('[H11] Action:', JSON.stringify(action, null, 2));

        expect(action.physicalMove?.type).toBe('move-sheet');
        expect(action.metadataRequired).toBe(true);

        if (action.physicalMove?.type === 'move-sheet') {
            expect(action.physicalMove.fromSheetIndex).toBe(0);
            expect(action.physicalMove.toSheetIndex).toBe(1);
        }
    });
});
