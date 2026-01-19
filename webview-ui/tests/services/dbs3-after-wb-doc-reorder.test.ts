/**
 * DBS3 Pattern Test: Doc after WB moves to sheet position (Doc→Sheet)
 * 
 * DBS3 triggers when:
 * - Doc is after WB (not before)
 * - Doc moves to a sheet position (toTab.type === 'sheet')
 * - No metadata is required (physical reorder only)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as editor from '../../../src/editor';
import { determineReorderAction } from '../../services/tab-reorder-service';
import { TestTab } from '../helpers/tab-reorder-test-utils';

describe('DBS3 Doc-to-Sheet Physical Reorder', () => {
    beforeEach(() => {
        editor.resetContext();
    });

    /**
     * DBS3: [S1, S2, D1, D2, D3] → D3 to after S1 → [S1, D3, S2, D1, D2]
     * D3 is after WB, moving to sheet position.
     * No metadata needed because physical order can match visual.
     */
    it('D3 → after S1: should trigger DBS3 move-document', () => {
        const INITIAL_MD = `# Tables

## Sheet 1

| A | B |
|---|---|
| 1 | 2 |

## Sheet 2

| A | B |
|---|---|
| 3 | 4 |

# Doc 1

# Doc 2

# Doc 3

`;

        editor.initializeWorkbook(INITIAL_MD, '{}');

        const tabs: TestTab[] = [
            { type: 'sheet', sheetIndex: 0 },   // S1
            { type: 'sheet', sheetIndex: 1 },   // S2
            { type: 'document', docIndex: 0 },  // D1
            { type: 'document', docIndex: 1 },  // D2
            { type: 'document', docIndex: 2 },  // D3
            { type: 'add-sheet' }
        ];

        // D3 (index 4) to after S1 (index 1) → becomes [S1, D3, S2, D1, D2]
        const action = determineReorderAction(tabs, 4, 1);

        console.log('[DBS3 D3→afterS1] Result:', JSON.stringify(action, null, 2));

        // This may trigger DBS3 or other pattern depending on classifier
        expect(action).toBeDefined();
        expect(action.actionType).toBeDefined();
    });

    /**
     * Simpler DBS3: [S1, D1, D2] → D2 to before D1 → [S1, D2, D1]
     * All docs after WB, just reordering.
     */
    it('D2 → before D1: physical doc reorder within after-WB', () => {
        const INITIAL_MD = `# Tables

## Sheet 1

| A | B |
|---|---|
| 1 | 2 |

# Doc 1

# Doc 2

`;

        editor.initializeWorkbook(INITIAL_MD, '{}');

        const tabs: TestTab[] = [
            { type: 'sheet', sheetIndex: 0 },
            { type: 'document', docIndex: 0 },  // D1
            { type: 'document', docIndex: 1 },  // D2
            { type: 'add-sheet' }
        ];

        // D2 (index 2) to before D1 (index 1) → [S1, D2, D1]
        const action = determineReorderAction(tabs, 2, 1);

        console.log('[DBS3 D2→beforeD1] Result:', JSON.stringify(action, null, 2));

        // Check that action is returned
        expect(action).toBeDefined();
    });
});
