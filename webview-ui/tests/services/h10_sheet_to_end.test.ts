/**
 * H10 Sheet-to-End Bug Reproduction Test
 * 
 * Bug Scenario:
 * - Initial Physical: WB(S1, S2), D1, D2
 * - Initial Visual via metadata: [S1, D1, S2, D2]
 * - Action: Drag S1 to END (after D2)
 * - Expected Visual: [D1, S2, D2, S1]
 * - Expected Physical: D1, WB(S2, S1), D2 (WB moves after D1, S1 moves to end of sheets)
 * - Actual: Wrong - S1 not moved within WB, no metadata
 * 
 * Root Cause: H9 returns only move-workbook with metadataRequired: false
 * But this case needs move-workbook + move-sheet + metadata
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as editor from '../../../src/editor';
import { determineReorderAction } from '../../services/tab-reorder-service';

interface TestTab {
    type: 'sheet' | 'document' | 'add-sheet';
    sheetIndex?: number;
    docIndex?: number;
}

// BUG: H10 requires compound move-workbook + move-sheet but classifier returns different pattern
describe.skip('H10 Sheet-to-End Bug', () => {
    beforeEach(() => {
        editor.resetContext();
    });

    /**
     * H10: Sheet to end of tabs (across multiple docs)
     * [S1, D1, S2, D2] → Drag S1 to end → [D1, S2, D2, S1]
     */
    it('should handle S1 to end: [S1, D1, S2, D2] → [D1, S2, D2, S1]', () => {
        // Initial tabs: [S1, D1, S2, D2] where D1, D2 are physically after WB
        const tabs: TestTab[] = [
            { type: 'sheet', sheetIndex: 0 },    // S1 (visual 0)
            { type: 'document', docIndex: 0 },    // D1 (visual 1)
            { type: 'sheet', sheetIndex: 1 },    // S2 (visual 2)
            { type: 'document', docIndex: 1 }     // D2 (visual 3)
        ];

        // Drag S1 (index 0) to end (index 4 = after D2)
        const action = determineReorderAction(tabs, 0, 4);

        console.log('[H10 TEST] determineReorderAction:', JSON.stringify(action, null, 2));

        // Expected behavior after fix:
        // 1. D1 becomes first → move-workbook needed
        // 2. S1 moves to end of sheets (S2, S1) → move-sheet needed
        // 3. S1 should appear after D2 → metadata needed

        // Assert: metadataRequired should be TRUE (S1 after D2 visually)
        expect(action.metadataRequired).toBe(true);

        // Assert: newTabOrder should show [D1, S2, D2, S1]
        if (action.newTabOrder) {
            expect(action.newTabOrder[0]).toEqual({ type: 'document', index: 0 }); // D1
            expect(action.newTabOrder[1]).toEqual({ type: 'sheet', index: 1 });    // S2
            expect(action.newTabOrder[2]).toEqual({ type: 'document', index: 1 }); // D2
            expect(action.newTabOrder[3]).toEqual({ type: 'sheet', index: 0 });    // S1
        } else {
            throw new Error('newTabOrder should be defined when metadataRequired is true');
        }

        // Assert: Physical move should include WB repositioning
        // Current bug: only move-workbook without sheet reorder
        // Expected: Either compound action or move-sheet (S1 to end of WB)
        expect(action.physicalMove).toBeDefined();
    });

    /**
     * EXACT PRODUCTION SCENARIO - includes add-sheet tab!
     * This is the exact scenario from the production debug log.
     */
    it('BUG: EXACT production scenario with add-sheet tab', () => {
        // EXACT production tabs including add-sheet
        const tabs: TestTab[] = [
            { type: 'sheet', sheetIndex: 0 },    // S1 (index 0)
            { type: 'document', docIndex: 0 },    // D1 (index 1)
            { type: 'sheet', sheetIndex: 1 },    // S2 (index 2)
            { type: 'document', docIndex: 1 },    // D2 (index 3)
            { type: 'add-sheet' }                 // add-sheet (index 4)
        ];

        // Drag S1 (index 0) to index 4 (after D2, before add-sheet)
        // This is EXACTLY what production does
        const action = determineReorderAction(tabs, 0, 4);

        console.log('[H10 PRODUCTION] Result:', JSON.stringify(action, null, 2));

        // Expected: [D1, S2, D2, S1] visual order
        // This requires:
        // - metadataRequired: true (S1 after D2)
        // - newTabOrder: [D1, S2, D2, S1]

        // BUG ASSERTION: Currently returns metadataRequired: false (wrong!)
        // When fixed, this should be true
        expect(action.metadataRequired).toBe(true);

        // newTabOrder should NOT contain add-sheet
        if (action.newTabOrder) {
            const hasAddSheet = action.newTabOrder.some((item: { type: string }) => item.type === 'add-sheet');
            expect(hasAddSheet).toBe(false);

            // Should be [D1, S2, D2, S1]
            expect(action.newTabOrder.length).toBe(4);
            expect(action.newTabOrder[0]).toEqual({ type: 'document', index: 0 }); // D1
            expect(action.newTabOrder[1]).toEqual({ type: 'sheet', index: 1 });    // S2
            expect(action.newTabOrder[2]).toEqual({ type: 'document', index: 1 }); // D2
            expect(action.newTabOrder[3]).toEqual({ type: 'sheet', index: 0 });    // S1
        } else {
            throw new Error('newTabOrder should be defined');
        }
    });

    /**
     * Simpler case: [S1, D1, S2] → S1 to end → [D1, S2, S1]
     * S1 moves after D1 and becomes last in WB
     */
    it('should handle S1 to end (simpler): [S1, D1, S2] → [D1, S2, S1]', () => {
        const tabs: TestTab[] = [
            { type: 'sheet', sheetIndex: 0 },    // S1
            { type: 'document', docIndex: 0 },    // D1 (after WB physically)
            { type: 'sheet', sheetIndex: 1 }      // S2
        ];

        // Drag S1 to end (after S2)
        const action = determineReorderAction(tabs, 0, 3);

        console.log('[H10 SIMPLE] Result:', JSON.stringify(action, null, 2));

        // Expected visual: [D1, S2, S1]
        // D1 first → move-workbook
        // S1 after S2 within WB → move-sheet(0, 2)
        // S1 appears after D1 in visual order → metadata needed? 
        // Actually [D1, S2, S1] can be physical order if WB moved after D1 and sheets reordered.
        // Physical: D1, WB(S2, S1) = [D1, S2, S1] which matches visual!
        // So NO metadata needed for this case.

        // Check if physical actions are correct
        expect(action.physicalMove).toBeDefined();

        // newTabOrder for [D1, S2, S1]
        if (action.newTabOrder) {
            expect(action.newTabOrder[0]).toEqual({ type: 'document', index: 0 }); // D1
            expect(action.newTabOrder[1]).toEqual({ type: 'sheet', index: 1 });    // S2
            expect(action.newTabOrder[2]).toEqual({ type: 'sheet', index: 0 });    // S1
        }
    });

    /**
     * S2 to end case: [S1, D1, S2, D2] → Drag S2 to end → [S1, D1, D2, S2]
     * S2 should appear after D2, needs metadata
     */
    it('should handle S2 to end: [S1, D1, S2, D2] → [S1, D1, D2, S2]', () => {
        const tabs: TestTab[] = [
            { type: 'sheet', sheetIndex: 0 },    // S1
            { type: 'document', docIndex: 0 },    // D1
            { type: 'sheet', sheetIndex: 1 },    // S2
            { type: 'document', docIndex: 1 }     // D2
        ];

        // Drag S2 (index 2) to end (index 4)
        const action = determineReorderAction(tabs, 2, 4);

        console.log('[H10 S2 END] Result:', JSON.stringify(action, null, 2));

        // S1 still first (no WB move needed)
        // S2 should appear after D2 → metadata needed
        expect(action.metadataRequired).toBe(true);

        if (action.newTabOrder) {
            expect(action.newTabOrder[0]).toEqual({ type: 'sheet', index: 0 });    // S1
            expect(action.newTabOrder[1]).toEqual({ type: 'document', index: 0 }); // D1
            expect(action.newTabOrder[2]).toEqual({ type: 'document', index: 1 }); // D2
            expect(action.newTabOrder[3]).toEqual({ type: 'sheet', index: 1 });    // S2
        }
    });
});
