import { describe, it, expect } from 'vitest';
import { executeTabReorderLikeMainTs, TestTab } from '../helpers/tab-reorder-test-utils';

import * as editor from '../../../src/editor';

const CONFIG = JSON.stringify({ rootMarker: '# Tables' });

// BUG: H9 requires move-workbook but classifier returns different pattern
describe.skip('H9 Bug Reproduction', () => {
    /**
     * S_H4: [S1, D1, S2, D2, D3] → Drag S1 to index 2 → [D1, S1, S2, D2, D3]
     * 
     * H9 Physical Normalization:
     * - D1 becomes first visually
     * - D1 is physically after WB → move WB after D1
     * - Result: [D1, WB(S1,S2), D2, D3]
     * - Visual = Physical → NO metadata needed
     */
    it('S_H4_UserReport: S1 -> Between D1 and S2 (H9 Physical Normalization)', () => {
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

        const tabs: TestTab[] = [
            { type: 'sheet', sheetIndex: 0 },   // S1 (0)
            { type: 'document', docIndex: 0 },  // D1 (1)
            { type: 'sheet', sheetIndex: 1 },   // S2 (2)
            { type: 'document', docIndex: 1 },  // D2 (3)
            { type: 'document', docIndex: 2 }   // D3 (4)
        ];

        // Action: Drag S1 (Index 0) to Index 2 (Before S2).
        const result = executeTabReorderLikeMainTs(tabs, 0, 2);

        console.log('[DEBUG] H9 Reproduction Result:', JSON.stringify(result, null, 2));

        // H9 Result: move-workbook with NO metadata needed
        // Visual: [D1, S1, S2, D2, D3]
        // Physical after WB move: [D1, WB(S1,S2), D2, D3]
        // These MATCH → metadataRequired: false
        expect(result.actionType).toBe('physical+metadata');
        expect(result.physicalMove?.type).toBe('move-workbook');
        expect(result.metadataRequired).toBe(false);
    });
});
