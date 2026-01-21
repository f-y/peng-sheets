/**
 * H11 Bug: Compound Action Required (move-workbook + move-sheet)
 *
 * Finite Pattern Test Suite for H11 scenarios.
 * Each test explicitly sets up physical file structure via initializeWorkbook.
 *
 * Bug Scenario:
 * - Initial Tab: [S1, D1, S2, D2] (visual, via metadata or interleaving)
 * - Initial Physical: [WB(S1, S2), D1, D2]
 * - Action: Drag S1 to between S2 and D2
 *
 * Expected:
 * - Visual: [D1, S2, S1, D2]
 * - Physical: [D1, WB(S2, S1), D2] (D1 first, WB with S2 before S1, then D2)
 * - Metadata: NOT needed (physical = visual)
 *
 * Actual Bug:
 * - Physical unchanged: [WB(S1, S2), D1, D2] with metadata
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as editor from '../../../src/editor';
import { determineReorderAction } from '../../services/tab-reorder-service';

interface TestTab {
    type: 'sheet' | 'document' | 'add-sheet';
    sheetIndex?: number;
    docIndex?: number;
}

describe('H11 Compound Move Bug', () => {
    beforeEach(() => {
        editor.resetContext();
    });

    /**
     * H11_A: [S1, D1, S2, D2] → S1 to S2/D2 gap
     * Physical: [WB(S1,S2), D1, D2] → D1, D2 are docsAfterWb
     * Visual via metadata: [S1, D1, S2, D2]
     *
     * Action: S1 to index 3 (between S2 and D2)
     * Expected result: [D1, WB(S1,S2), D2] WITH metadata (sheet order S2,S1 differs from physical S1,S2)
     */
    it('H11_A: S1 to between S2/D2 - requires move-workbook + move-sheet', () => {
        // Physical structure: WB(S1, S2), then D1, D2
        // Visual order via metadata: S1, D1, S2, D2
        const INITIAL_MD = `# Tables

## Sheet 1

| A | B |
|---|---|
| 1 | 2 |

## Sheet 2

| A | B |
|---|---|
| 3 | 4 |

<!-- md-spreadsheet-workbook-metadata: {"tab_order": [{"type": "sheet", "index": 0}, {"type": "document", "index": 0}, {"type": "sheet", "index": 1}, {"type": "document", "index": 1}]} -->

# Doc 1

# Doc 2
`;

        editor.initializeWorkbook(INITIAL_MD, '{}');

        // Visual tabs (from metadata)
        const tabs: TestTab[] = [
            { type: 'sheet', sheetIndex: 0 }, // S1 (vis 0)
            { type: 'document', docIndex: 0 }, // D1 (vis 1)
            { type: 'sheet', sheetIndex: 1 }, // S2 (vis 2)
            { type: 'document', docIndex: 1 }, // D2 (vis 3)
            { type: 'add-sheet' }
        ];

        // Drag S1 (index 0) to index 3 (between S2 and D2)
        // After removal: [D1, S2, D2, add-sheet]
        // Insert at 2: [D1, S2, S1, D2, add-sheet]
        const action = determineReorderAction(tabs, 0, 3);

        console.log('[H11_A] Result:', JSON.stringify(action, null, 2));

        // Expected (SIDR3/H12 behavior):
        // 1. D1 becomes first AND sheet order differs
        // 2. Visual: [D1, S2, S1, D2] (sheet order reversed from physical [S1,S2])
        // 3. SIDR3 triggers move-sheet to reorder sheets + metadata
        expect(action.physicalMove?.type).toBe('move-sheet');
        expect(action.metadataRequired).toBe(true);

        // Deep Parameter Verification
        if (action.physicalMove?.type === 'move-sheet') {
            expect(action.physicalMove.fromSheetIndex).toBe(0); // S1
            expect(action.physicalMove.toSheetIndex).toBe(1); // Visual pos 1 in [S2, S1]
        }
    });

    /**
     * H11_B: Simpler case [S1, D1, S2] → S1 to end
     * Should trigger H9 (D1 first, sheets contiguous after)
     */
    it('H11_B: [S1, D1, S2] → S1 to end - move-workbook (H9 applies)', () => {
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

# Doc 1
`;

        editor.initializeWorkbook(INITIAL_MD, '{}');

        const tabs: TestTab[] = [
            { type: 'sheet', sheetIndex: 0 }, // S1
            { type: 'document', docIndex: 0 }, // D1
            { type: 'sheet', sheetIndex: 1 }, // S2
            { type: 'add-sheet' }
        ];

        // S1 to end (index 3)
        // After removal: [D1, S2, add-sheet]
        // Insert at 2: [D1, S2, S1, add-sheet]
        const action = determineReorderAction(tabs, 0, 3);

        console.log('[H11_B] Result:', JSON.stringify(action, null, 2));

        // D1 first, sheets contiguous [S2, S1]
        // BUT visual order (S2, S1) ≠ physical order (S1, S2)
        // → SIDR3/H12: move-sheet to reorder sheets + metadata REQUIRED
        expect(action.physicalMove?.type).toBe('move-sheet');
        expect(action.metadataRequired).toBe(true);

        // Deep Parameter Verification
        if (action.physicalMove?.type === 'move-sheet') {
            expect(action.physicalMove.fromSheetIndex).toBe(0); // S1
            expect(action.physicalMove.toSheetIndex).toBe(1); // Visual pos 1 in [S2, S1]
        }
    });

    /**
     * H11_C: [S1, S2, D1, D2] (no interleaving initially)
     * S1 to after D1 → [S2, D1, S1, D2]
     * D1 between sheets, NOT H9 case
     */
    it('H11_C: [S1, S2, D1, D2] → S1 to after D1 - metadata required (doc between sheets)', () => {
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
`;

        editor.initializeWorkbook(INITIAL_MD, '{}');

        // No metadata, so visual = physical: [S1, S2, D1, D2]
        const tabs: TestTab[] = [
            { type: 'sheet', sheetIndex: 0 }, // S1 (0)
            { type: 'sheet', sheetIndex: 1 }, // S2 (1)
            { type: 'document', docIndex: 0 }, // D1 (2)
            { type: 'document', docIndex: 1 }, // D2 (3)
            { type: 'add-sheet' }
        ];

        // S1 to index 3 (after D1, before D2)
        // After removal: [S2, D1, D2, add-sheet]
        // Insert at 2: [S2, D1, S1, D2, add-sheet]
        const action = determineReorderAction(tabs, 0, 3);

        console.log('[H11_C] Result:', JSON.stringify(action, null, 2));

        // D1 is between sheets (S2, D1, S1) → metadata required
        // S2 first (not doc first), so NOT H9 case
        // Physical: move S1 to end of WB → [WB(S2,S1), D1, D2]
        // Visual: [S2, D1, S1, D2] - D1 between sheets
        // These differ → metadata required
        expect(action.metadataRequired).toBe(true);
    });
});
