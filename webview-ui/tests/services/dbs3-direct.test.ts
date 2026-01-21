/**
 * DBS3 Handler Direct Test
 *
 * Test that specifically triggers the DBS3_after_wb_reorder pattern at lines 1106-1127.
 *
 * DBS3 requires:
 * 1. Doc is after WB (not in docsBeforeWb)
 * 2. isMetadataRequired returns false
 * 3. handleDocToSheet is called (targetZone !== 'outside-wb')
 *
 * Scenario: [S1, S2, D1] where D1 moves to between S1/S2 AND the result
 * visual order matches what physical file can represent without metadata.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as editor from '../../../src/editor';
import { determineReorderAction } from '../../services/tab-reorder-service';
import { TestTab } from '../helpers/tab-reorder-test-utils';

describe('DBS3 Direct Handler Test', () => {
    beforeEach(() => {
        editor.resetContext();
    });

    /**
     * Natural order (no metadata): [S1, S2, D1]
     * Move D1 between S1 and S2: [S1, D1, S2]
     *
     * toTab = S2 (sheet) at index 1, from = D1 at index 2
     * targetZone should be 'inside-wb' since toTab is sheet AND toIndex != firstSheetIdx
     *
     * For DBS3: doc must be from after WB (true) and !needsMeta
     * The result [S1, D1, S2] requires physical doc movement (toBeforeWorkbook)
     * so this might trigger DBS2 not DBS3.
     */
    it('D1 to between S1/S2 with existing structure', () => {
        const INITIAL_MD = `# Tables

## Sheet 1

| A | B |
|---|---|
| 1 | 2 |

## Sheet 2

| A | B |
|---|---|
| 3 | 4 |

# Doc One

`;

        editor.initializeWorkbook(INITIAL_MD, '{}');

        // Tabs: [S1(0), S2(1), D1(2), add-sheet(3)]
        const tabs: TestTab[] = [
            { type: 'sheet', sheetIndex: 0 }, // S1 - index 0
            { type: 'sheet', sheetIndex: 1 }, // S2 - index 1
            { type: 'document', docIndex: 0 }, // D1 - index 2
            { type: 'add-sheet' } // index 3
        ];

        // Move D1 (index 2) to index 1 (between S1 and S2)
        const action = determineReorderAction(tabs, 2, 1);

        console.log('[DBS3 Direct] D1→betweenS1S2:', JSON.stringify(action, null, 2));

        // Verify result
        expect(action).toBeDefined();
        expect(action.actionType).toBeDefined();
    });

    /**
     * Interleaved scenario with existing metadata:
     * Physical: [WB(S1, S2), D1]
     * Visual via metadata: [S1, D1, S2]  (interleaved)
     *
     * From this state, move D1 to after S2: [S1, S2, D1]
     * This REMOVES the interleaving and should just need metadata update
     */
    it('Interleaved to natural order (D1 after S2)', () => {
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

# Doc Alpha

`;

        editor.initializeWorkbook(INITIAL_MD, '{}');

        // Visual order from metadata: [S1, D1, S2]
        const tabs: TestTab[] = [
            { type: 'sheet', sheetIndex: 0 }, // S1 - visual 0
            { type: 'document', docIndex: 0 }, // D1 - visual 1
            { type: 'sheet', sheetIndex: 1 }, // S2 - visual 2
            { type: 'add-sheet' } // visual 3
        ];

        // Move D1 (visual 1) to visual 3 (end, after S2)
        const action = determineReorderAction(tabs, 1, 3);

        console.log('[DBS3 Direct] D1→afterS2:', JSON.stringify(action, null, 2));

        expect(action).toBeDefined();
    });
});
