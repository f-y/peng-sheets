/**
 * H9/H10 Physical Normalization Tests (Consolidated)
 *
 * H9: When a sheet move causes a Document to become visually first,
 *     and that Document is physically after WB, return move-workbook.
 *
 * H10: Sheet to end of tabs requiring compound move-workbook + move-sheet.
 *
 * BUG: Classifier returns move-sheet instead of move-workbook for these patterns.
 * All tests skipped until classifier logic is fixed.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as editor from '../../../src/editor';
import { determineReorderAction } from '../../services/tab-reorder-service';
import { executeTabReorderLikeMainTs, TestTab } from '../helpers/tab-reorder-test-utils';

const CONFIG = JSON.stringify({ rootMarker: '# Tables' });

// =============================================================================
// H9: Physical Normalization (move-workbook when Doc becomes first)
// =============================================================================

// TEMP: Running to debug classifier issue
describe('H9 Physical Normalization', () => {
    beforeEach(() => {
        editor.resetContext();
    });

    /**
     * Core H9 scenario: D1 becomes visually first → move-workbook required
     * [S1, D1, S2, D2] → Drag S1 to index 2 → [D1, S1, S2, D2]
     */
    it('should return move-workbook when D1 becomes visually first', () => {
        const tabs: TestTab[] = [
            { type: 'sheet', sheetIndex: 0 },    // S1 (visual 0)
            { type: 'document', docIndex: 0 },    // D1 (visual 1) - physically AFTER WB
            { type: 'sheet', sheetIndex: 1 },    // S2 (visual 2)
            { type: 'document', docIndex: 1 }     // D2 (visual 3)
        ];

        const action = determineReorderAction(tabs, 0, 2);

        // Accept physical+metadata since metadata update ensures consistency after WB move
        expect(action.actionType).toMatch(/physical/);
        expect(action.physicalMove?.type).toBe('move-workbook');
        if (action.physicalMove?.type === 'move-workbook') {
            expect(action.physicalMove.direction).toBe('after-doc');
            expect(action.physicalMove.targetDocIndex).toBe(0);
        }
    });

    /**
     * Simpler case: [S1, D1, S2] → drag S1 to end → [D1, S2, S1]
     * Note: Sheet order changes from [S1,S2] to [S2,S1], so metadata IS needed
     */
    it('should handle simpler case: [S1, D1, S2] → drag S1 to end', () => {
        const tabs: TestTab[] = [
            { type: 'sheet', sheetIndex: 0 },
            { type: 'document', docIndex: 0 },
            { type: 'sheet', sheetIndex: 1 }
        ];

        const action = determineReorderAction(tabs, 0, 3);

        // Sheet order changes: [S1,S2] → [S2,S1]
        // D1 becomes first, SIDR3/H12 triggers move-sheet to reorder sheets
        // Metadata is also required
        expect(action.physicalMove?.type).toBe('move-sheet');
        expect(action.metadataRequired).toBe(true);
    });

    /**
     * Negative case: D1 already before WB → no move-workbook needed
     */
    it('should NOT return move-workbook when D1 is already before WB', () => {
        const tabs: TestTab[] = [
            { type: 'document', docIndex: 0 },    // D1 (before WB physically)
            { type: 'sheet', sheetIndex: 0 },
            { type: 'sheet', sheetIndex: 1 }
        ];

        const action = determineReorderAction(tabs, 1, 3);

        expect(action.physicalMove?.type).toBe('move-sheet');
    });

    /**
     * Full flow with actual markdown initialization
     */
    it('full flow: S1 across D1 with metadata initialization', () => {
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

        const tabs: TestTab[] = [
            { type: 'sheet', sheetIndex: 0 },
            { type: 'document', docIndex: 0 },
            { type: 'sheet', sheetIndex: 1 },
            { type: 'document', docIndex: 1 },
            { type: 'add-sheet' }
        ];

        const action = determineReorderAction(tabs, 0, 2);

        expect(action.actionType).toMatch(/physical/);
        expect(action.physicalMove?.type).toBe('move-workbook');
    });

    /**
     * User-reported S_H4 scenario with 5 docs
     */
    it('S_H4 user report: [S1, D1, S2, D2, D3] → S1 between D1/S2', () => {
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
            { type: 'sheet', sheetIndex: 0 },
            { type: 'document', docIndex: 0 },
            { type: 'sheet', sheetIndex: 1 },
            { type: 'document', docIndex: 1 },
            { type: 'document', docIndex: 2 }
        ];

        const result = executeTabReorderLikeMainTs(tabs, 0, 2);

        expect(result.actionType).toMatch(/physical/);
        expect(result.physicalMove?.type).toBe('move-workbook');
    });
});

// =============================================================================
// H10: Sheet to End (compound move-workbook + move-sheet + metadata)
// =============================================================================

// TEMP: Running to verify after H9 fix
describe('H10 Sheet-to-End', () => {
    beforeEach(() => {
        editor.resetContext();
    });

    /**
     * H10: [S1, D1, S2, D2] → S1 to end → [D1, S2, D2, S1]
     * Requires: move-workbook + move-sheet + metadata
     */
    it('S1 to end: [S1, D1, S2, D2] → [D1, S2, D2, S1]', () => {
        const tabs: TestTab[] = [
            { type: 'sheet', sheetIndex: 0 },
            { type: 'document', docIndex: 0 },
            { type: 'sheet', sheetIndex: 1 },
            { type: 'document', docIndex: 1 }
        ];

        const action = determineReorderAction(tabs, 0, 4);

        expect(action.metadataRequired).toBe(true);
        expect(action.newTabOrder).toBeDefined();
        if (action.newTabOrder) {
            expect(action.newTabOrder[0]).toEqual({ type: 'document', index: 0 });
            expect(action.newTabOrder[1]).toEqual({ type: 'sheet', index: 1 });
            expect(action.newTabOrder[2]).toEqual({ type: 'document', index: 1 });
            expect(action.newTabOrder[3]).toEqual({ type: 'sheet', index: 0 });
        }
    });

    /**
     * Production scenario with add-sheet tab
     * 
     * BUG: Dispatcher routes this to handleSheetToSheet because toTab is add-sheet.
     * But S1 ends up after D2 visually, which should be handled by handleSheetToDoc.
     * Complex fix needed in determineReorderAction - marking as known bug.
     */
    it('production scenario with add-sheet tab', () => {
        const tabs: TestTab[] = [
            { type: 'sheet', sheetIndex: 0 },
            { type: 'document', docIndex: 0 },
            { type: 'sheet', sheetIndex: 1 },
            { type: 'document', docIndex: 1 },
            { type: 'add-sheet' }
        ];

        const action = determineReorderAction(tabs, 0, 4);

        expect(action.metadataRequired).toBe(true);
        if (action.newTabOrder) {
            const hasAddSheet = action.newTabOrder.some((item: { type: string }) => item.type === 'add-sheet');
            expect(hasAddSheet).toBe(false);
            expect(action.newTabOrder.length).toBe(4);
        }
    });

    /**
     * Simpler: [S1, D1, S2] → S1 to end → [D1, S2, S1]
     */
    it('simpler: [S1, D1, S2] → [D1, S2, S1]', () => {
        const tabs: TestTab[] = [
            { type: 'sheet', sheetIndex: 0 },
            { type: 'document', docIndex: 0 },
            { type: 'sheet', sheetIndex: 1 }
        ];

        const action = determineReorderAction(tabs, 0, 3);

        expect(action.physicalMove).toBeDefined();
    });

    /**
     * S2 to end: [S1, D1, S2, D2] → [S1, D1, D2, S2]
     */
    it('S2 to end: [S1, D1, S2, D2] → [S1, D1, D2, S2]', () => {
        const tabs: TestTab[] = [
            { type: 'sheet', sheetIndex: 0 },
            { type: 'document', docIndex: 0 },
            { type: 'sheet', sheetIndex: 1 },
            { type: 'document', docIndex: 1 }
        ];

        const action = determineReorderAction(tabs, 2, 4);

        expect(action.metadataRequired).toBe(true);
        if (action.newTabOrder) {
            expect(action.newTabOrder[0]).toEqual({ type: 'sheet', index: 0 });
            expect(action.newTabOrder[1]).toEqual({ type: 'document', index: 0 });
            expect(action.newTabOrder[2]).toEqual({ type: 'document', index: 1 });
            expect(action.newTabOrder[3]).toEqual({ type: 'sheet', index: 1 });
        }
    });
});

// =============================================================================
// Utility: add-sheet filtering
// =============================================================================

describe('add-sheet Filtering', () => {
    it('should filter out add-sheet from newTabOrder', () => {
        const tabs: TestTab[] = [
            { type: 'sheet', sheetIndex: 0 },
            { type: 'sheet', sheetIndex: 1 },
            { type: 'add-sheet' }
        ];

        const action = determineReorderAction(tabs, 0, 2);

        if (action.newTabOrder) {
            const hasAddSheet = action.newTabOrder.some((item: { type: string }) => item.type === 'add-sheet');
            expect(hasAddSheet).toBe(false);
        }
    });
});
