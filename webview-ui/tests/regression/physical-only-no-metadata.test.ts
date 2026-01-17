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
        // This is a physical-only case: D2 moves to before D1
        // Result: [D2, D1, D3] - which is physical order
        // Since display order matches physical order after move, NO metadata needed

        // Move D2 (index 1) to before D1 (index 0) means insert at position 0
        // Using toDocIndex = -1 or similar to insert before first doc
        // Actually, moveDocumentSection(1, 0, false, false) would move D2 after D1
        // We need to use toBeforeWorkbook or different approach

        // Let's check determineReorderAction for this case
        // Actually, the simplest physical-only case is:
        // D1, D2, D3 -> D2, D1, D3 (move D2 to first position)
        // This is what toAfterWorkbook=true does

        // But that's D8 which DOES need metadata for display order

        // The physical-only case that needs no metadata would be:
        // Initial: WB, D1, D2, D3
        // Move D2 to before D3 (swap D2 and D3 places)
        // Result: WB, D1, D3, D2
        // Display using natural order: S1, S2, D1, D3, D2
        // This matches physical order, so no metadata needed

        // For this test, let's verify that if we just move D3 before D2 (physical only),
        // the result should not contain tab_order

        // Move D3 (index 2) to between D1 and D2 (insert at index 1)
        const result = editor.moveDocumentSection(2, 0, false, false);

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

        const result = editor.moveDocumentSection(2, 0, false, false);

        expect(result.error).toBeUndefined();

        // Verify document order
        const docHeaders = result.content!.match(/^# Doc \d+/gm);
        expect(docHeaders).toEqual(['# Doc 1', '# Doc 3', '# Doc 2']);

        // Should NOT have tab_order
        expect(result.content!.includes('tab_order')).toBe(false);
    });
});
