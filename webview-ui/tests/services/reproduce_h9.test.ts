import { describe, it, expect } from 'vitest';
import { executeTabReorderLikeMainTs, TestTab, verifyFinalState } from '../helpers/tab-reorder-test-utils';
import { TabOrderItem } from '../../../src/editor/types';

import * as editor from '../../../src/editor';

const CONFIG = JSON.stringify({ rootMarker: '# Tables' });

describe('H9 Bug Reproduction', () => {
    it('S_H4_UserReport: S1 -> Between D1 and S2 (Interleaved)', () => {
        // User Provided Markdown
        const USER_MARKDOWN = `# Tables

## Sheet 1

| Column 1 | Column 2 | Column 3 |
| --- | --- | --- |
|  |  |  |

## Sheet 2

| Column 1 | Column 2 | Column 3 |
| --- | --- | --- |
|  |  |  |

<!-- md-spreadsheet-workbook-metadata: {"tab_order": [{"type": "sheet", "index": 0}, {"type": "document", "index": 0}, {"type": "sheet", "index": 1}, {"type": "document", "index": 1}, {"type": "document", "index": 2}]} -->

# Doc 1

# Doc 2
`;

        editor.initializeWorkbook(USER_MARKDOWN, CONFIG);

        // User Markdown implies:
        // Sheets: S1 (0), S2 (1)
        // Docs: D1 (0), D2 (1), D3 (2)? (Metadata has index 2)
        // Tabs Order: S1(0), D1(0), S2(1), D2(1), D3(2) if strictly following metadata.
        // User says "S1 between D1 and S2".
        // Current: S1, D1, S2, D2...
        // Drag S1 (0) -> After D1 (1).
        // Target Index: 2 (Before S2).

        const tabs: TestTab[] = [
            { type: 'sheet', sheetIndex: 0 },   // S1 (0)
            { type: 'document', docIndex: 0 },  // D1 (1)
            { type: 'sheet', sheetIndex: 1 },   // S2 (2)
            { type: 'document', docIndex: 1 },  // D2 (3) (Assuming exists)
            { type: 'document', docIndex: 2 }   // D3 (4) (Assuming exists based on metadata)
        ];

        // Action: Drag S1 (Index 0) to Index 2 (Before S2).
        const result = executeTabReorderLikeMainTs(tabs, 0, 2);

        console.log('[DEBUG] H9 Reproduction Result:', JSON.stringify(result, null, 2));

        // Result Expectation:
        // Visual: D1, S1, S2, D2, D3.
        // Physical: S1, S2, D1, D2, D3.
        // Mismatch: D1 is at 0 (Vis) vs 2 (Phys).
        // Action: Metadata Required.

        expect(result.metadataRequired).toBe(true);
        expect(result.actionType).toMatch(/physical\+metadata|metadata/);

        // Verify Tab Order
        if (result.newTabOrder) {
            expect(result.newTabOrder[0].type).toBe('document');
            expect(result.newTabOrder[0].index).toBe(0); // D1

            expect(result.newTabOrder[1].type).toBe('sheet');
            expect(result.newTabOrder[1].index).toBe(0); // S1

            expect(result.newTabOrder[2].type).toBe('sheet');
            expect(result.newTabOrder[2].index).toBe(1); // S2
        } else {
            // Failure case: null order implies removal
            throw new Error('Tab Order was Null (Metadata Removed) - Bug Reproduced');
        }
    });
});
