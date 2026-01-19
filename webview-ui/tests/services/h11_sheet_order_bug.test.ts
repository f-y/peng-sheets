/**
 * H11 Sheet Order Bug Reproduction
 * 
 * User Bug Report:
 * [S1, D1, S2, D2] → S1 to between S2/D2
 * 
 * Actual Bug Result:
 * Physical: [D1, WB(S2, S1), D2] - sheets reversed!
 * 
 * Expected Correct Result:
 * - Visual: [D1, S2, S1, D2]
 * - Physical: [D1, WB(S1, S2), D2] - original sheet order preserved
 * - Metadata: REQUIRED (because visual S2 before S1, but physical S1 before S2)
 * 
 * Root Cause Analysis:
 * The H11 fix checks if sheets are "contiguous" in newTabOrder and returns
 * metadataRequired: false. But it doesn't verify that the SHEET ORDER in
 * visual matches the physical sheet order.
 * 
 * In [D1, S2, S1, D2]:
 * - Sheets ARE contiguous (S2, S1 are adjacent)
 * - But visual order (S2, S1) ≠ physical order (S1, S2)
 * - Therefore metadata IS required!
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as editor from '../../../src/editor';
import { determineReorderAction } from '../../services/tab-reorder-service';

interface TestTab {
    type: 'sheet' | 'document' | 'add-sheet';
    sheetIndex?: number;
    docIndex?: number;
}

describe('H11 Sheet Order Bug Reproduction', () => {
    beforeEach(() => {
        editor.resetContext();
    });

    /**
     * REPRODUCTION TEST: [S1, D1, S2, D2] → S1 to between S2/D2
     * 
     * Expected:
     * - Physical: [D1, WB(S1, S2), D2] - move WB after D1, keep sheet order
     * - Visual: [D1, S2, S1, D2] - S2 before S1 in display
     * - Metadata: REQUIRED (visual sheet order differs from physical)
     */
    it('REPRODUCTION: S1 to S2/D2 gap should require metadata (sheet order differs)', () => {
        // Physical structure: [WB(S1, S2), D1, D2]
        // Visual via metadata: [S1, D1, S2, D2]
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

        // Visual tabs (from metadata): [S1, D1, S2, D2]
        const tabs: TestTab[] = [
            { type: 'sheet', sheetIndex: 0 },    // S1 (index 0)
            { type: 'document', docIndex: 0 },    // D1 (index 1)  
            { type: 'sheet', sheetIndex: 1 },    // S2 (index 2)
            { type: 'document', docIndex: 1 },    // D2 (index 3)
            { type: 'add-sheet' }
        ];

        // Drag S1 (index 0) to index 3 (between S2 and D2)
        // After removal: [D1, S2, D2, add-sheet]
        // Insert at 2: [D1, S2, S1, D2, add-sheet]
        const action = determineReorderAction(tabs, 0, 3);

        console.log('[H11 REPRO] Action Result:', JSON.stringify(action, null, 2));

        // EXPECTED SIDR3/H12 BEHAVIOR:
        // - move-sheet to reorder sheets (visual S2,S1 from physical S1,S2)
        // - metadataRequired: TRUE (because visual sheet order S2,S1 ≠ physical S1,S2)
        // - newTabOrder: [D1, S2, S1, D2]

        // The physical file should change sheet order to match visual

        expect(action.physicalMove?.type).toBe('move-sheet');
        expect(action.metadataRequired).toBe(true); // CRITICAL: Sheet order differs!

        // Deep Parameter Verification: Ensure correct physical reorder parameters
        if (action.physicalMove?.type === 'move-sheet') {
            expect(action.physicalMove.fromSheetIndex).toBe(0); // S1
            expect(action.physicalMove.toSheetIndex).toBe(1);   // Visual pos 1 in [S2, S1]
        }

        expect(action.newTabOrder).toBeDefined();

        if (action.newTabOrder) {
            expect(action.newTabOrder).toEqual([
                { type: 'document', index: 0 }, // D1
                { type: 'sheet', index: 1 },    // S2 (visual position 2)
                { type: 'sheet', index: 0 },    // S1 (visual position 3)
                { type: 'document', index: 1 }  // D2
            ]);
        }
    });

    /**
     * CONTROL TEST: [S1, D1, S2] → S1 to end
     * In this case, visual S2,S1 still differs from physical S1,S2
     * So metadata should ALSO be required!
     */
    it('CONTROL: S1 to end with sheets reversed also needs metadata', () => {
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
            { type: 'sheet', sheetIndex: 0 },    // S1
            { type: 'document', docIndex: 0 },    // D1
            { type: 'sheet', sheetIndex: 1 },    // S2
            { type: 'add-sheet' }
        ];

        // S1 to end (index 3)
        // After removal: [D1, S2, add-sheet]
        // Insert at 2: [D1, S2, S1, add-sheet]
        const action = determineReorderAction(tabs, 0, 3);

        console.log('[H11 CONTROL] Result:', JSON.stringify(action, null, 2));

        // Visual: [D1, S2, S1]
        // Physical after move-sheet: [D1, WB(S2, S1)]
        // SIDR3/H12: move-sheet to reorder sheets + metadata REQUIRED

        expect(action.physicalMove?.type).toBe('move-sheet');
        expect(action.metadataRequired).toBe(true);
    });
});
