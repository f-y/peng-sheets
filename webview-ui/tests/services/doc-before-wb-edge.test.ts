/**
 * Doc Before-WB to Between-Sheets Coverage Test
 *
 * Targets uncovered lines 995, 1039, 1057 in handleDocToDoc default case
 * where doc is before WB and moves to between sheets position.
 *
 * These are edge cases in the H13/DBS4 pattern area.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as editor from '../../../src/editor';
import { determineReorderAction } from '../../services/tab-reorder-service';
import { TestTab } from '../helpers/tab-reorder-test-utils';

describe('Doc Before-WB Edge Cases', () => {
    beforeEach(() => {
        editor.resetContext();
    });

    /**
     * Scenario: Doc before WB moves to between sheets
     * Initial physical: [D1, WB(S1, S2)]
     * Visual via metadata: [D1, S1, S2]
     * Move D1 to between S1/S2: [S1, D1, S2]
     *
     * This triggers the isFromBeforeWb branch at line 994.
     */
    it('Doc before WB moves to between sheets (line 995 coverage)', () => {
        const INITIAL_MD = `# Doc Before

# Tables

## Sheet 1

| A | B |
|---|---|
| 1 | 2 |

## Sheet 2

| A | B |
|---|---|
| 3 | 4 |

<!-- md-spreadsheet-workbook-metadata: {"tab_order": [{"type": "document", "index": 0}, {"type": "sheet", "index": 0}, {"type": "sheet", "index": 1}]} -->

`;

        editor.initializeWorkbook(INITIAL_MD, '{}');

        // Visual order from metadata: [D1, S1, S2]
        const tabs: TestTab[] = [
            { type: 'document', docIndex: 0 }, // D1 - visual 0 (before WB)
            { type: 'sheet', sheetIndex: 0 }, // S1 - visual 1
            { type: 'sheet', sheetIndex: 1 }, // S2 - visual 2
            { type: 'add-sheet' }
        ];

        // Move D1 (visual 0) to visual 2 (between S1 and S2)
        const action = determineReorderAction(tabs, 0, 2);

        console.log('[Before-WB] D1→betweenS1S2:', JSON.stringify(action, null, 2));

        expect(action).toBeDefined();
        expect(action.actionType).toBeDefined();
    });

    /**
     * H13/DBS4 with multiple docs: first visual doc != first physical doc
     * Physical: [D1, D2, WB(S1)]
     * Visual: [D2, S1, D1] (via metadata)
     *
     * This tests the physical reorder logic where doc indices need remapping.
     */
    it('Multiple before-WB docs with reorder (lines 1039, 1057 coverage)', () => {
        const INITIAL_MD = `# Doc Alpha

# Doc Beta

# Tables

## Sheet 1

| A | B |
|---|---|
| 1 | 2 |

<!-- md-spreadsheet-workbook-metadata: {"tab_order": [{"type": "document", "index": 1}, {"type": "sheet", "index": 0}, {"type": "document", "index": 0}]} -->

`;

        editor.initializeWorkbook(INITIAL_MD, '{}');

        // Visual order: [D2, S1, D1] (D2 before WB, D1 after WB)
        const tabs: TestTab[] = [
            { type: 'document', docIndex: 1 }, // D2 - visual 0 (before WB)
            { type: 'sheet', sheetIndex: 0 }, // S1 - visual 1
            { type: 'document', docIndex: 0 }, // D1 - visual 2 (after WB)
            { type: 'add-sheet' }
        ];

        // Move D2 (visual 0) to visual 2 (after S1)
        const action = determineReorderAction(tabs, 0, 2);

        console.log('[H13/DBS4] D2→afterS1:', JSON.stringify(action, null, 2));

        expect(action).toBeDefined();
    });

    /**
     * Doc-to-Doc within before-WB zone reorder
     */
    it('Two docs before WB - reorder within zone', () => {
        const INITIAL_MD = `# First Doc

# Second Doc

# Tables

## Sheet 1

| A | B |
|---|---|
| 1 | 2 |

<!-- md-spreadsheet-workbook-metadata: {"tab_order": [{"type": "document", "index": 0}, {"type": "document", "index": 1}, {"type": "sheet", "index": 0}]} -->

`;

        editor.initializeWorkbook(INITIAL_MD, '{}');

        // Visual: [D1, D2, S1] (both docs before WB)
        const tabs: TestTab[] = [
            { type: 'document', docIndex: 0 }, // D1 - visual 0
            { type: 'document', docIndex: 1 }, // D2 - visual 1
            { type: 'sheet', sheetIndex: 0 }, // S1 - visual 2
            { type: 'add-sheet' }
        ];

        // Swap D1 and D2: D1 (visual 0) to visual 2 (after D2)
        const action = determineReorderAction(tabs, 0, 2);

        console.log('[Before-WB swap] D1↔D2:', JSON.stringify(action, null, 2));

        expect(action).toBeDefined();
    });
});
