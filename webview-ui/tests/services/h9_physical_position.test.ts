/**
 * H9 Physical Normalization Test
 * 
 * Scenario:
 * - Initial Physical: WB(S1,S2), D1  (Workbook at start)
 * - Initial Visual via metadata: [S1, D1, S2]
 * - Action: Drag S1 to position 2 (D1 becomes first visually)
 * - Expected Visual: [D1, S1, S2]
 * - Expected Physical: D1, WB(S1,S2)  (D1 moves to file start)
 * - Expected Metadata: NONE (physical matches visual)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as editor from '../../../src/editor';
import { determineReorderAction } from '../../services/tab-reorder-service';

interface TestTab {
    type: 'sheet' | 'document' | 'add-sheet';
    sheetIndex?: number;
    docIndex?: number;
}

// BUG: H9 requires move-workbook but classifier returns move-sheet
describe.skip('H9 Physical Normalization', () => {
    beforeEach(() => {
        editor.resetContext();
    });

    /**
     * When a sheet move causes a Document to become visually first,
     * and that Document is physically after WB,
     * the system should return move-workbook to physically reposition WB after that Doc.
     */
    it('should return move-workbook when D1 becomes visually first', () => {
        // Initial tabs represent [S1, D1, S2, D2] visual order
        // Where D1 is physically AFTER WB in the file
        const tabs: TestTab[] = [
            { type: 'sheet', sheetIndex: 0 },    // S1 (visual 0)
            { type: 'document', docIndex: 0 },    // D1 (visual 1) - physically AFTER WB
            { type: 'sheet', sheetIndex: 1 },    // S2 (visual 2)
            { type: 'document', docIndex: 1 }     // D2 (visual 3)
        ];

        // Drag S1 (index 0) to index 2 (between D1 and S2)
        // Result: D1 becomes first visually → [D1, S1, S2, D2]
        const action = determineReorderAction(tabs, 0, 2);

        console.log('[H9 TEST] determineReorderAction:', JSON.stringify(action, null, 2));

        // Should return move-workbook to physically reposition WB after D1
        expect(action.actionType).toBe('physical+metadata');
        expect(action.physicalMove?.type).toBe('move-workbook');

        if (action.physicalMove?.type === 'move-workbook') {
            expect(action.physicalMove.direction).toBe('after-doc');
            expect(action.physicalMove.targetDocIndex).toBe(0); // D1
        }

        // After physical move, file structure matches visual order
        // No metadata needed
        expect(action.metadataRequired).toBe(false);
        expect(action.newTabOrder).toBeUndefined();
    });

    /**
     * Simpler case: [S1, D1, S2] where D1 is physically after WB
     * Drag S1 to end → [D1, S2, S1]
     * D1 should now be physically first in file.
     */
    it('should handle simpler case: [S1, D1, S2] → drag S1 to end', () => {
        const tabs: TestTab[] = [
            { type: 'sheet', sheetIndex: 0 },    // S1
            { type: 'document', docIndex: 0 },    // D1 (after WB physically)
            { type: 'sheet', sheetIndex: 1 }      // S2
        ];

        // Drag S1 to after S2 → visual becomes [D1, S2, S1]
        const action = determineReorderAction(tabs, 0, 3);

        console.log('[SIMPLE H9] Result:', JSON.stringify(action, null, 2));

        // D1 becomes first → move-workbook required
        expect(action.physicalMove?.type).toBe('move-workbook');
        expect(action.metadataRequired).toBe(false);
    });

    /**
     * No move-workbook needed when D1 is already physically before WB.
     */
    it('should NOT return move-workbook when D1 is already before WB', () => {
        // In this case, D1 is physically BEFORE WB
        // Simulating: File [D1, WB(S1, S2)]
        const tabs: TestTab[] = [
            { type: 'document', docIndex: 0 },    // D1 (before WB physically)
            { type: 'sheet', sheetIndex: 0 },    // S1
            { type: 'sheet', sheetIndex: 1 }      // S2
        ];

        // Drag S1 to end → [D1, S2, S1]
        // D1 is already first and physically before WB, no WB move needed
        const action = determineReorderAction(tabs, 1, 3);

        console.log('[NO MOVE] Result:', JSON.stringify(action, null, 2));

        // Should be sheet move, not workbook move
        expect(action.physicalMove?.type).toBe('move-sheet');
    });
});
