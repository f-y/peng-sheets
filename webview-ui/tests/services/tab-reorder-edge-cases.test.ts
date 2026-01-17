/**
 * Additional Edge Case Tests for Tab Reordering
 *
 * These tests cover edge cases that were identified as potential gaps
 * during the test coverage audit.
 */

import { describe, it, expect } from 'vitest';
import { determineReorderAction } from '../../services/tab-reorder-service';

type TestTab = {
    type: 'sheet' | 'document' | 'add-sheet';
    sheetIndex?: number;
    docIndex?: number;
};

// =============================================================================
// 3+ Sheets with docs
// =============================================================================

describe('Edge Cases: 3+ Sheets with docs', () => {
    /**
     * [S1, S2, S3, D1, D2] → S2 after D1
     * Expected: S2 moves to last position in WB + metadata
     * Physical: [WB(S1, S3, S2), D1, D2]
     * Display: [S1, S3, D1, S2, D2]
     */
    it('3 sheets: S2 to after D1 - should move S2 to last in WB', () => {
        const tabs: TestTab[] = [
            { type: 'sheet', sheetIndex: 0 },    // S1
            { type: 'sheet', sheetIndex: 1 },    // S2
            { type: 'sheet', sheetIndex: 2 },    // S3
            { type: 'document', docIndex: 0 },   // D1
            { type: 'document', docIndex: 1 },   // D2
            { type: 'add-sheet' }
        ];

        // Drag S2 (tabIndex 1) to after D1 (toIndex = 4)
        const action = determineReorderAction(tabs, 1, 4);

        // S2 is now displayed after D1 (inside doc range)
        expect(action.actionType).toBe('physical+metadata');
        expect(action.physicalMove?.type).toBe('move-sheet');
        if (action.physicalMove?.type === 'move-sheet') {
            expect(action.physicalMove.fromSheetIndex).toBe(1); // S2
            expect(action.physicalMove.toSheetIndex).toBe(2);   // Move to last
        }
        expect(action.metadataRequired).toBe(true);
    });

    /**
     * [S1, S2, S3, D1] → S1 and S2 both after D1 (two operations)
     * First: S1 after D1 → [S2, S3, D1, S1]
     * After first move, S3 becomes physically last, S1 is moved to WB last
     */
    it('3 sheets: S1 to after D1 - should move S1 to last in WB', () => {
        const tabs: TestTab[] = [
            { type: 'sheet', sheetIndex: 0 },
            { type: 'sheet', sheetIndex: 1 },
            { type: 'sheet', sheetIndex: 2 },
            { type: 'document', docIndex: 0 },
            { type: 'add-sheet' }
        ];

        // Drag S1 (tabIndex 0) to after D1 (toIndex = 4)
        const action = determineReorderAction(tabs, 0, 4);

        expect(action.actionType).toBe('physical+metadata');
        expect(action.physicalMove?.type).toBe('move-sheet');
        if (action.physicalMove?.type === 'move-sheet') {
            expect(action.physicalMove.fromSheetIndex).toBe(0);
            expect(action.physicalMove.toSheetIndex).toBe(2); // Last position
        }
    });
});

// =============================================================================
// Special: Last sheet moves to doc position
// =============================================================================

describe('Edge Cases: Last sheet to doc position', () => {
    /**
     * [S1, S2, D1] → S2 to after D1
     * S2 is already last, so no physical sheet move needed
     * Just metadata for display order
     */
    it('last sheet to after doc - metadata only', () => {
        const tabs: TestTab[] = [
            { type: 'sheet', sheetIndex: 0 },
            { type: 'sheet', sheetIndex: 1 },
            { type: 'document', docIndex: 0 },
            { type: 'add-sheet' }
        ];

        // Drag S2 (last sheet) to after D1
        const action = determineReorderAction(tabs, 1, 3);

        // S2 is already last in WB, no physical move needed
        expect(action.actionType).toBe('metadata');
        expect(action.metadataRequired).toBe(true);
    });

    /**
     * REGRESSION TEST: S1 to S2 within WB (with docs after)
     * [S1, S2, D1, D2, D3] → S1 after S2
     * This is a simple sheet swap within WB, should be physical only
     */
    it('S1 to S2 with docs present - should be physical sheet swap', () => {
        const tabs: TestTab[] = [
            { type: 'sheet', sheetIndex: 0 },
            { type: 'sheet', sheetIndex: 1 },
            { type: 'document', docIndex: 0 },
            { type: 'document', docIndex: 1 },
            { type: 'document', docIndex: 2 },
            { type: 'add-sheet' }
        ];

        // Drag S1 (tabIndex 0) to S2's position (toIndex = 1)
        const action = determineReorderAction(tabs, 0, 1);

        // Simple sheet swap within WB, no metadata needed
        expect(action.actionType).toBe('physical');
        expect(action.physicalMove?.type).toBe('move-sheet');
        if (action.physicalMove?.type === 'move-sheet') {
            expect(action.physicalMove.fromSheetIndex).toBe(0);
            expect(action.physicalMove.toSheetIndex).toBe(1);
        }
        expect(action.metadataRequired).toBe(false);
    });

    /**
     * EXACT USER BUG REPRODUCTION:
     * [S1, S2, D1, D2, D3] → Drag S1 after S2 with toIndex=2
     * UI reports: fromIndex=0, toIndex=2 (D1's position)
     * Expected: Physical sheet swap (S2, S1 in WB), no metadata needed
     * Actual bug: Returns metadata-only with metadataRequired=false
     */
    it('S1 after S2 (toIndex=2) - USER BUG - should be physical sheet swap', () => {
        const tabs: TestTab[] = [
            { type: 'sheet', sheetIndex: 0 },    // S1 at 0
            { type: 'sheet', sheetIndex: 1 },    // S2 at 1
            { type: 'document', docIndex: 0 },   // D1 at 2
            { type: 'document', docIndex: 1 },   // D2 at 3
            { type: 'document', docIndex: 2 },   // D3 at 4
            { type: 'add-sheet' }                // at 5
        ];

        // USER's actual input: Drag S1 (tabIndex 0) and drop results in toIndex=2
        // This means "insert S1 at position 2" which is between S2 and D1
        // Result should be: [S2, S1, D1, D2, D3]
        const action = determineReorderAction(tabs, 0, 2);

        // S1 moves to after S2, both sheets still before docs
        // This is a physical sheet swap within WB
        expect(action.actionType).toBe('physical');
        expect(action.physicalMove?.type).toBe('move-sheet');
        if (action.physicalMove?.type === 'move-sheet') {
            expect(action.physicalMove.fromSheetIndex).toBe(0);
            expect(action.physicalMove.toSheetIndex).toBe(1);
        }
        expect(action.metadataRequired).toBe(false);
    });
});

// =============================================================================
// D8 variant: 3 docs after WB
// =============================================================================

describe('Edge Cases: Multiple docs reorder', () => {
    /**
     * [S1, S2, D1, D2, D3] → D3 to between S1 and S2
     * D3 becomes first displayed doc, so physical move needed
     */
    it('D3 to between sheets - should physically reorder docs', () => {
        const tabs: TestTab[] = [
            { type: 'sheet', sheetIndex: 0 },
            { type: 'sheet', sheetIndex: 1 },
            { type: 'document', docIndex: 0 },
            { type: 'document', docIndex: 1 },
            { type: 'document', docIndex: 2 },
            { type: 'add-sheet' }
        ];

        // Drag D3 to between S1 and S2 (toIndex = 1)
        const action = determineReorderAction(tabs, 4, 1);

        expect(action.actionType).toBe('physical+metadata');
        expect(action.physicalMove?.type).toBe('move-document');
        expect(action.metadataRequired).toBe(true);
    });

    /**
     * [S1, S2, D1, D2, D3] → D2 to between D1 and D3
     * This is a doc→doc move within docs-after-WB, should be physical
     */
    it('D1 to after D2 - physical doc reorder', () => {
        const tabs: TestTab[] = [
            { type: 'sheet', sheetIndex: 0 },
            { type: 'sheet', sheetIndex: 1 },
            { type: 'document', docIndex: 0 },
            { type: 'document', docIndex: 1 },
            { type: 'document', docIndex: 2 },
            { type: 'add-sheet' }
        ];

        // Drag D1 (tabIndex 2) to after D2 (toIndex = 4, before D3)
        const action = determineReorderAction(tabs, 2, 4);

        expect(action.actionType).toBe('physical');
        expect(action.physicalMove?.type).toBe('move-document');
        if (action.physicalMove?.type === 'move-document') {
            expect(action.physicalMove.fromDocIndex).toBe(0);
            expect(action.physicalMove.toDocIndex).toBe(1);
        }
    });
});
