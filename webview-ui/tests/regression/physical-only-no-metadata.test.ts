/**
 * Regression Test: Physical-only moves should NOT write metadata
 *
 * BUG: After fixing D8, the code now always regenerates workbook section
 * even for physical-only moves, causing unnecessary metadata to be written.
 *
 * Per SPECS.md 8.6: When physical order matches natural order, NO metadata
 * should be written.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as editor from '../../../src/editor';

describe('Regression: Physical-only moves should not write metadata', () => {
    const WORKBOOK_MD = `# Tables

## Sheet 1

| Column 1 |
| --- |
|  |

## Sheet 2

| Column 1 |
| --- |
|  |

# Doc 1

Content of Doc 1

# Doc 2

Content of Doc 2

# Doc 3

Content of Doc 3
`;

    beforeEach(() => {
        editor.initializeWorkbook(WORKBOOK_MD, JSON.stringify({ rootMarker: '# Tables' }));
    });

    it('D2 to before D1 (physical-only) should NOT have tab_order in result', () => {
        // This is a physical-only case: D3 moves to between D1 and D2
        // Result: [D1, D3, D2] - which is physical order
        // Since display order matches physical order after move, NO metadata needed

        // Move D3 (index 2) to between D1 and D2 (insert at position 1)
        // New API: toDocIndex=1 means "insert at position 1" (before D2, after D1)
        const result = editor.moveDocumentSection(2, 1, false, false);

        expect(result.error).toBeUndefined();
        expect(result.content).toBeDefined();

        // The result should NOT contain tab_order
        // because after this move, display order = physical order
        const hasTabOrder = result.content!.includes('tab_order');

        // This assertion should FAIL if there's a regression
        expect(hasTabOrder).toBe(false);
    });

    it('consecutive doc move should NOT add metadata when result matches physical order', () => {
        // Initial: D1, D2, D3
        // Move D3 to position 1 (between D1 and D2)
        // Result: D1, D3, D2
        // Display: S1, S2, D1, D3, D2 (natural order = physical order)
        // No metadata needed

        // New API: toDocIndex=1 means "insert at position 1" (between D1 and D2)
        const result = editor.moveDocumentSection(2, 1, false, false);

        expect(result.error).toBeUndefined();

        // Verify document order
        const docHeaders = result.content!.match(/^# Doc \d+/gm);
        expect(docHeaders).toEqual(['# Doc 1', '# Doc 3', '# Doc 2']);

        // Should NOT have tab_order
        expect(result.content!.includes('tab_order')).toBe(false);
    });
});
