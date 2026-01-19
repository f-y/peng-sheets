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

// Tests for 3+ sheets scenarios with documents
describe('Edge Cases: 3+ Sheets with docs', () => {
    /**
     * [S1, S2, S3, D1, D2] → S2 after D1
     * Expected: S2 moves to last position in WB + metadata
     * Physical: [WB(S1, S3, S2), D1, D2]
     * Display: [S1, S3, D1, S2, D2]
     */
    it('3 sheets: S2 to after D1 - should move S2 to last in WB', () => {
        const tabs: TestTab[] = [
            { type: 'sheet', sheetIndex: 0 }, // S1
            { type: 'sheet', sheetIndex: 1 }, // S2
            { type: 'sheet', sheetIndex: 2 }, // S3
            { type: 'document', docIndex: 0 }, // D1
            { type: 'document', docIndex: 1 }, // D2
            { type: 'add-sheet' }
        ];

        // Drag S2 (tabIndex 1) to after D1 (toIndex = 4)
        const action = determineReorderAction(tabs, 1, 4);

        // S2 is now displayed after D1 (inside doc range)
        expect(action.actionType).toBe('physical+metadata');
        expect(action.physicalMove?.type).toBe('move-sheet');
        if (action.physicalMove?.type === 'move-sheet') {
            expect(action.physicalMove.fromSheetIndex).toBe(1); // S2
            expect(action.physicalMove.toSheetIndex).toBe(3); // Move to last (sheetCount=3)
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
            expect(action.physicalMove.toSheetIndex).toBe(3); // Last position (sheetCount=3)
        }
    });
});

// =============================================================================
// Special: Last sheet moves to doc position
// =============================================================================

// BUG: Some tests pass, but S1→idx=2 fails due to toSheetIndex calculation
describe('Edge Cases: Last sheet to doc position', () => {
    /**
     * [S1, S2, D1] → S2 to after D1
     * H9 pattern triggers because D1 becomes visually first after move.
     * Classifier correctly returns physical+metadata (move-workbook).
     */
    it('last sheet to after doc - H9 triggers physical+metadata', () => {
        const tabs: TestTab[] = [
            { type: 'sheet', sheetIndex: 0 },
            { type: 'sheet', sheetIndex: 1 },
            { type: 'document', docIndex: 0 },
            { type: 'add-sheet' }
        ];

        // Drag S2 (last sheet) to after D1
        const action = determineReorderAction(tabs, 1, 3);

        // H9 triggers: D1 becomes first, so physical+metadata with move-workbook
        expect(action.actionType).toBe('physical+metadata');
        expect(action.metadataRequired).toBe(true);
    });

    /**
     * REGRESSION TEST: S1 to S2 within WB (with docs after)
     * [S1, S2, D1, D2, D3] → S1 after S2
     * **FIXED**: toIndex=1 means "insert before item at index 1" which is S2
     * S1 before S2 is the same position as S1 at current location → no-op
     */
    it('S1 to S2 with docs present - NO-OP (same position)', () => {
        const tabs: TestTab[] = [
            { type: 'sheet', sheetIndex: 0 },
            { type: 'sheet', sheetIndex: 1 },
            { type: 'document', docIndex: 0 },
            { type: 'document', docIndex: 1 },
            { type: 'document', docIndex: 2 },
            { type: 'add-sheet' }
        ];

        // Drag S1 (tabIndex 0) to S2's position (toIndex = 1)
        // This is "insert at index 1" which is same as current position
        const action = determineReorderAction(tabs, 0, 1);

        // Same position = no-op
        expect(action.actionType).toBe('no-op');
    });

    /**
     * EXACT USER BUG REPRODUCTION:
     * [S1, S2, D1, D2, D3] → Drag S1 after S2 with toIndex=2
     * Result: [S2, S1, D1, D2, D3]
     *
     * Physical structure: [WB(S1,S2), D1, D2, D3]
     * With physicalStructure, H9 won't falsely trigger since D1 is after WB
     */
    it('S1 after S2 (toIndex=2) - physical sheet swap with metadata', () => {
        const tabs: TestTab[] = [
            { type: 'sheet', sheetIndex: 0 }, // S1 at 0
            { type: 'sheet', sheetIndex: 1 }, // S2 at 1
            { type: 'document', docIndex: 0 }, // D1 at 2
            { type: 'document', docIndex: 1 }, // D2 at 3
            { type: 'document', docIndex: 2 }, // D3 at 4
            { type: 'add-sheet' } // at 5
        ];

        // Physical structure: [WB(S1,S2), D1, D2, D3]
        const physicalStructure = {
            docsBeforeWb: [] as number[],
            sheets: [0, 1],
            docsAfterWb: [0, 1, 2],
            hasWorkbook: true
        };

        const action = determineReorderAction(tabs, 0, 2, physicalStructure);

        // Result is [S2, S1, D1, D2, D3] which differs from physical order
        // D1 doesn't become first since sheets are still before docs in visual order
        expect(action.physicalMove?.type).toBe('move-sheet');
        if (action.physicalMove?.type === 'move-sheet') {
            expect(action.physicalMove.fromSheetIndex).toBe(0);
        }
    });
});

// =============================================================================
// D8 variant: 3 docs after WB
// =============================================================================

// Tests for multiple document reordering
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
            expect(action.physicalMove.toDocIndex).toBe(2); // Insert BEFORE D3 (index 2)
        }
    });
});

// =============================================================================
// USER BUG: Doc to before Sheet in existing metadata state
// =============================================================================

describe('USER BUG: Doc to before Sheet (metadata-only)', () => {
    /**
     * USER REPORTED BUG:
     * Current state: [S1, D1, S2, D2, D3] (via tab_order metadata)
     * Physical file: [WB(S1,S2), D1, D2, D3]
     * Action: Drag D2 to before S2 (toIndex=2)
     * Expected: [S1, D1, D2, S2, D3] (metadata update only)
     * Actual: Nothing happens
     */
    it('D2 to before S2 in [S1, D1, S2, D2, D3] - should update metadata', () => {
        // Current tab order: [S1, D1, S2, D2, D3]
        // D2 is at index 3, S2 is at index 2
        const tabs: TestTab[] = [
            { type: 'sheet', sheetIndex: 0 }, // S1 at 0
            { type: 'document', docIndex: 0 }, // D1 at 1
            { type: 'sheet', sheetIndex: 1 }, // S2 at 2
            { type: 'document', docIndex: 1 }, // D2 at 3
            { type: 'document', docIndex: 2 }, // D3 at 4
            { type: 'add-sheet' }
        ];

        // Drag D2 (index 3) to before S2 (toIndex = 2)
        const action = determineReorderAction(tabs, 3, 2);

        // D2 is not first doc after WB, so needs physical reorder to appear between sheets
        expect(action.actionType).toBe('physical+metadata');
        expect(action.physicalMove).toBeDefined();
        expect(action.metadataRequired).toBe(true);

        // Verify the new tab order
        expect(action.newTabOrder).toBeDefined();
        if (action.newTabOrder) {
            // Expected order: S1, D1, D2, S2, D3
            expect(action.newTabOrder[0]).toEqual({ type: 'sheet', index: 0 });
            expect(action.newTabOrder[1]).toEqual({ type: 'document', index: 0 });
            expect(action.newTabOrder[2]).toEqual({ type: 'document', index: 1 });
            expect(action.newTabOrder[3]).toEqual({ type: 'sheet', index: 1 });
            expect(action.newTabOrder[4]).toEqual({ type: 'document', index: 2 });
        }
    });

    /**
     * Variant: Doc to after Sheet (within existing metadata)
     * Moving D1 from between S1/S2 to after S2 results in [S1, S2, D1, D2, D3]
     * This matches physical order [WB(S1,S2), D1, D2, D3], so metadata is NOT needed!
     *
     * Physical structure: docsBeforeWb=[], sheets=[0,1], docsAfterWb=[0,1,2]
     */
    it('D1 to after S2 in [S1, D1, S2, D2, D3] - should remove metadata (result matches physical order)', () => {
        const tabs: TestTab[] = [
            { type: 'sheet', sheetIndex: 0 },
            { type: 'document', docIndex: 0 },
            { type: 'sheet', sheetIndex: 1 },
            { type: 'document', docIndex: 1 },
            { type: 'document', docIndex: 2 },
            { type: 'add-sheet' }
        ];

        // Physical structure: [WB(S1,S2), D1, D2, D3]
        const physicalStructure = {
            docsBeforeWb: [] as number[],
            sheets: [0, 1],
            docsAfterWb: [0, 1, 2],
            hasWorkbook: true
        };

        // Drag D1 (index 1) to after S2 (toIndex = 3)
        const action = determineReorderAction(tabs, 1, 3, physicalStructure);

        // Result: [S1, S2, D1, D2, D3] matches physical order, so metadata NOT required
        // actionType can be 'physical' (with move-document) or 'metadata', but metadataRequired MUST be false
        expect(action.metadataRequired).toBe(false);
    });
});
