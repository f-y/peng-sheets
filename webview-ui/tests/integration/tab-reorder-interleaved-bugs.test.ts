/**
 * Bug Reproduction Tests: Interleaved Metadata Physical Move
 *
 * File: [WB(S1,S2), D1, D2]
 * Tab order (via metadata): [S1, D1, S2, D2]
 *
 * Bug 1: S1 -> after D1: Sheet order should change but doesn't
 * Bug 2: D2 -> after S1: Doc order should change but doesn't
 */

import { describe, it, expect } from 'vitest';
import * as editor from '../../../src/editor';
import { executeTabReorderLikeMainTs } from '../helpers/tab-reorder-test-utils';
import type { TestTab } from '../helpers/tab-reorder-test-utils';

const CONFIG = JSON.stringify({ rootMarker: '# Tables' });

describe('Bug Reproduction: Interleaved Metadata Physical Move', () => {
    // File structure with metadata
    const MD_WITH_METADATA = `# Tables

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

    /**
     * Bug 1: S1 -> after S2
     *
     * Initial:
     * - File: [WB(S1,S2), D1, D2]
     * - Tab: [S1, D1, S2, D2] (from metadata)
     *
     * Action: Drag S1 (tabIndex 0) to after S2 (tabIndex 3)
     *
     * Expected Result:
     * - File: [WB(S2,S1), D1, D2] - Sheet order changes
     * - Tab: [D1, S2, S1, D2]
     */
    it('Bug 1: S1 -> after S2 should reorder sheets physically', () => {
        editor.initializeWorkbook(MD_WITH_METADATA, CONFIG);

        // Tab order from metadata: [S1(0), D1(1), S2(2), D2(3)]
        const tabs: TestTab[] = [
            { type: 'sheet', sheetIndex: 0 }, // S1 at tab 0
            { type: 'document', docIndex: 0 }, // D1 at tab 1
            { type: 'sheet', sheetIndex: 1 }, // S2 at tab 2
            { type: 'document', docIndex: 1 } // D2 at tab 3
        ];

        // Drag S1 (tabIndex 0) to after S2 (tabIndex 3)
        const result = executeTabReorderLikeMainTs(tabs, 0, 3);

        const state = JSON.parse(editor.getState());

        // Expected: Physical sheet order changes to [S2, S1]
        expect(state.workbook.sheets[0].name).toBe('Sheet 2');
        expect(state.workbook.sheets[1].name).toBe('Sheet 1');
    });

    /**
     * Bug 2: D2 -> after S1
     *
     * Initial:
     * - File: [WB(S1,S2), D1, D2]
     * - Tab: [S1, D1, S2, D2] (from metadata)
     *
     * Action: Drag D2 (tabIndex 3) to after S1 (tabIndex 1)
     *
     * Expected Result:
     * - File: [WB(S1,S2), D2, D1] - Doc order changes
     * - Tab: [S1, D2, D1, S2]
     */
    it('Bug 2: D2 -> after S1 should reorder docs physically', () => {
        editor.initializeWorkbook(MD_WITH_METADATA, CONFIG);

        // Tab order from metadata: [S1(0), D1(1), S2(2), D2(3)]
        const tabs: TestTab[] = [
            { type: 'sheet', sheetIndex: 0 }, // S1 at tab 0
            { type: 'document', docIndex: 0 }, // D1 at tab 1
            { type: 'sheet', sheetIndex: 1 }, // S2 at tab 2
            { type: 'document', docIndex: 1 } // D2 at tab 3
        ];

        // Drag D2 (tabIndex 3) to after S1 (tabIndex 1)
        const result = executeTabReorderLikeMainTs(tabs, 3, 1);

        const state = JSON.parse(editor.getState());

        // Expected: Physical doc order changes to [D2, D1]
        expect(state.structure[1].title).toBe('Doc 2');
        expect(state.structure[2].title).toBe('Doc 1');
    });
});
