/**
 * Compound Physical Move Test
 *
 * Tests that sheet moves in interleaved structures generate
 * secondary doc moves when needed.
 *
 * Bug: S1 → after S2 in [S1, D1, S2, D2, S3]
 * Expected: D1 should move to before-WB (compound move)
 * Actual: Only sheet move, D1 stays after-WB
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as editor from '../../../src/editor';
import { determineReorderAction, FileStructure } from '../../services/tab-reorder-service';

interface TestTab {
    type: 'sheet' | 'document' | 'add-sheet';
    sheetIndex?: number;
    docIndex?: number;
}

describe('Compound Physical Move for Interleaved Structures', () => {
    beforeEach(() => {
        editor.resetContext();
    });

    /**
     * Critical Bug Scenario:
     *
     * Physical: [WB(S1,S2,S3), D1, D2]
     * Visual (metadata): [S1, D1, S2, D2, S3]
     *
     * Move S1 to after S2:
     * Expected Visual: [D1, S2, S1, D2, S3]
     * Expected Physical: [D1, WB(S2,S1,S3), D2]
     *
     * This requires:
     * 1. move-sheet: S1 to position 1 (after S2)
     * 2. move-document: D1 to before-WB
     */
    it('S1→after S2 should generate move-sheet AND move-document for D1', () => {
        const INITIAL_MD = `# Tables

## Sheet 1

| Column 1 | Column 2 | Column 3 |
| --- | --- | --- |
|  |  |  |

## Sheet 2

| Column 1 | Column 2 | Column 3 |
| --- | --- | --- |
|  |  |  |

## Sheet 3

| Column 1 | Column 2 | Column 3 |
| --- | --- | --- |
|  |  |  |

<!-- md-spreadsheet-workbook-metadata: {"tab_order": [{"type": "sheet", "index": 0}, {"type": "document", "index": 0}, {"type": "sheet", "index": 1}, {"type": "document", "index": 1}, {"type": "sheet", "index": 2}]} -->

# Doc 1

# Doc 2

`;

        editor.initializeWorkbook(INITIAL_MD, '{}');

        // Visual tabs: [S1, D1, S2, D2, S3]
        const tabs: TestTab[] = [
            { type: 'sheet', sheetIndex: 0 }, // S1 (visual 0)
            { type: 'document', docIndex: 0 }, // D1 (visual 1)
            { type: 'sheet', sheetIndex: 1 }, // S2 (visual 2)
            { type: 'document', docIndex: 1 }, // D2 (visual 3)
            { type: 'sheet', sheetIndex: 2 }, // S3 (visual 4)
            { type: 'add-sheet' }
        ];

        // Physical structure from the actual file:
        // Physical order: [WB(S1, S2, S3), D1, D2]
        const physicalStructure: FileStructure = {
            docsBeforeWb: [], // No docs before workbook
            sheets: [0, 1, 2], // S1, S2, S3 in order
            docsAfterWb: [0, 1], // D1, D2 are after workbook
            hasWorkbook: true
        };

        // S1 (visual 0) → after S2 (toIndex = 3)
        const action = determineReorderAction(tabs, 0, 3, physicalStructure);

        // Primary validation: action type and primary sheet move
        expect(action.actionType).toBe('physical+metadata');
        expect(action.physicalMove?.type).toBe('move-sheet');
        expect(action.physicalMove).toMatchObject({
            type: 'move-sheet',
            fromSheetIndex: 0,
            toSheetIndex: 1 // After S2
        });

        // CRITICAL: Secondary move for D1 to before-WB
        // This is the fix we're implementing
        expect(action.secondaryPhysicalMoves).toBeDefined();
        expect(action.secondaryPhysicalMoves!.length).toBeGreaterThan(0);

        const docMove = action.secondaryPhysicalMoves!.find((m) => m.type === 'move-document');
        expect(docMove).toBeDefined();
        expect(docMove).toMatchObject({
            type: 'move-document',
            fromDocIndex: 0, // D1
            toBeforeWorkbook: true
        });

        // Metadata shows correct visual order
        expect(action.newTabOrder).toEqual([
            { type: 'document', index: 0 }, // D1 first (now before sheets)
            { type: 'sheet', index: 1 }, // S2
            { type: 'sheet', index: 0 }, // S1
            { type: 'document', index: 1 }, // D2
            { type: 'sheet', index: 2 } // S3
        ]);
    });

    /**
     * Control test: Simple sheet swap with no doc position change
     * Should NOT generate secondary moves.
     */
    it('S1↔S2 swap (no doc interleaving) should NOT generate secondary moves', () => {
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

`;

        editor.initializeWorkbook(INITIAL_MD, '{}');

        // Natural order: [S1, S2, D1] - no interleaving
        const tabs: TestTab[] = [
            { type: 'sheet', sheetIndex: 0 },
            { type: 'sheet', sheetIndex: 1 },
            { type: 'document', docIndex: 0 },
            { type: 'add-sheet' }
        ];

        // S1 → after S2
        const action = determineReorderAction(tabs, 0, 2);

        // Should be simple sheet move, no secondary moves needed
        expect(action.physicalMove?.type).toBe('move-sheet');
        expect(action.secondaryPhysicalMoves ?? []).toHaveLength(0);
    });
});
