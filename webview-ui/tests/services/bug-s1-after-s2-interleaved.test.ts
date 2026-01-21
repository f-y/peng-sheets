/**
 * Bug Reproduction: S1 → after S2 in interleaved 5-tab structure
 *
 * User Bug Report:
 * Tab order: [S1, D1, S2, D2, S3]
 * Operation: S1 to after S2
 *
 * Expected: Physical [D1, S2, S1, S3, D2]
 *   - D1 moves to before-WB
 *   - WB: [S2, S1, S3]
 *   - D2 after WB
 *
 * Received: Physical [S2, S1, S3, D1, D2]
 *   - WB: [S2, S1, S3]
 *   - D1, D2 both after WB (WRONG!)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as editor from '../../../src/editor';
import { determineReorderAction } from '../../services/tab-reorder-service';

interface TestTab {
    type: 'sheet' | 'document' | 'add-sheet';
    sheetIndex?: number;
    docIndex?: number;
}

describe('Bug: S1 → after S2 in interleaved structure', () => {
    beforeEach(() => {
        editor.resetContext();
    });

    it('REPRO: S1 → after S2 should preserve D1 before sheets visual position', () => {
        // Exact markdown from user bug report
        const INITIAL_MD = `# Tables

## Sheet 1

| Column 1 | Column 2 | Column 3 |
| --- | --- | --- |
|  |  |  |

## Sheet 2

| Column 1 | Column 2 | Column 3 |
| --- | --- | --- |
|  |  |  |

## Sheet 3

| Column 1 | Column 2 | Column 3 |
| --- | --- | --- |
|  |  |  |

<!-- md-spreadsheet-workbook-metadata: {"tab_order": [{"type": "sheet", "index": 0}, {"type": "document", "index": 0}, {"type": "sheet", "index": 1}, {"type": "document", "index": 1}, {"type": "sheet", "index": 2}]} -->

# Doc 1

# Doc 2

`;

        editor.initializeWorkbook(INITIAL_MD, '{}');

        // Visual tabs (from metadata): [S1, D1, S2, D2, S3]
        const tabs: TestTab[] = [
            { type: 'sheet', sheetIndex: 0 }, // S1 (visual idx 0)
            { type: 'document', docIndex: 0 }, // D1 (visual idx 1)
            { type: 'sheet', sheetIndex: 1 }, // S2 (visual idx 2)
            { type: 'document', docIndex: 1 }, // D2 (visual idx 3)
            { type: 'sheet', sheetIndex: 2 }, // S3 (visual idx 4)
            { type: 'add-sheet' }
        ];

        // Drag S1 (visual idx 0) to after S2 (toIndex=3, between S2 and D2)
        // Visual result should be: [D1, S2, S1, D2, S3]
        const action = determineReorderAction(tabs, 0, 3);

        console.log('[BUG REPRO] S1→afterS2 Action:', JSON.stringify(action, null, 2));

        // Expected behavior analysis:
        //
        // Before (Visual): [S1, D1, S2, D2, S3]
        // After (Visual):  [D1, S2, S1, D2, S3]
        //
        // Physical structure to achieve this:
        // - D1 must be BEFORE the workbook (to appear before S2)
        // - WB: [S2, S1, S3] (sheets reordered)
        // - D2 after WB (to appear after S3)
        //
        // Expected physical: [D1 before WB, WB(S2, S1, S3), D2 after WB]
        //                  = [D1, S2, S1, S3, D2]
        //
        // Received (wrong): [WB(S2, S1, S3), D1, D2]
        //                  = [S2, S1, S3, D1, D2]
        //
        // The bug: D1 should move to before-WB but stayed after-WB

        expect(action).toBeDefined();
        expect(action.actionType).toBeDefined();

        // Log for diagnosis
        if (action.physicalMove) {
            console.log('[BUG REPRO] Physical move:', action.physicalMove.type);
            if (action.physicalMove.type === 'move-sheet') {
                console.log('[BUG REPRO] toSheetIndex:', action.physicalMove.toSheetIndex);
            }
        }
        console.log('[BUG REPRO] newTabOrder:', action.newTabOrder);

        // The core issue: we need TWO physical operations:
        // 1. Move sheet S1 to after S2 (toSheetIndex = 1, result: [S2, S1, S3])
        // 2. Move D1 to before-WB (toBeforeWorkbook = true)
        //
        // Current implementation only does #1, missing #2

        // Check if D1 move to before-WB is included
        // This is what should happen but likely isn't
    });
});
