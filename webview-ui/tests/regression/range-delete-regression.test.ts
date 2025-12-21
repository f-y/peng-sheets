import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { queryView, awaitView } from '../helpers/test-helpers';

// Mock dependencies
vi.mock('../utils/i18n', () => ({
    t: (key: string) => key
}));

describe('Range Delete Regression', () => {
    let element: HTMLElement;
    let container: HTMLElement;

    beforeEach(async () => {
        await import('../../components/spreadsheet-table');
        container = document.createElement('div');
        document.body.appendChild(container);

        element = document.createElement('spreadsheet-table') as HTMLElement;
        (element as any).table = {
            name: 'test',
            rows: [
                ['A1', 'B1', 'C1'],
                ['A2', 'B2', 'C2'],
                ['A3', 'B3', 'C3']
            ],
            headers: ['A', 'B', 'C'],
            metadata: {}
        };
        container.appendChild(element);
        await (element as any).updateComplete;
    });

    afterEach(() => {
        container.remove();
        vi.restoreAllMocks();
    });

    it('should NOT restore deleted values when clicking another cell after deleting a range', async () => {
        const table = element as any;
        await awaitView(table);

        // 1. Select Range A1:B2 (Rows 0-1, Cols 0-1)
        // Select A1
        const cellA1 = queryView(table, '.cell[data-row="0"][data-col="0"]') as HTMLElement;
        expect(cellA1).toBeTruthy();
        // Mousedown on A1
        cellA1.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true, buttons: 1 }));
        await awaitView(table);

        // Select B2 with Shift (making it a range)
        const cellB2 = queryView(table, '.cell[data-row="1"][data-col="1"]') as HTMLElement;
        expect(cellB2).toBeTruthy();
        cellB2.dispatchEvent(
            new MouseEvent('mousedown', { bubbles: true, composed: true, buttons: 1, shiftKey: true })
        );
        await awaitView(table);

        expect(table.selectionCtrl.selectedRow).toBe(1);
        expect(table.selectionCtrl.selectedCol).toBe(1);
        // Verify range selection logic implicitly or assume it works if UI feedback aligns
        // Range should vary based on anchor. Anchor is presumably 0,0 (A1) and current 1,1 (B2)

        // 2. Press Delete Key
        // Dispatch on the active/focused cell (A1 or B2).
        // Since we selected B2 last, it might have focus, but A1 is also selected.
        // Let's dispatch on A1 as it's part of the selection.
        cellA1.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, composed: true }));
        await awaitView(table);

        // 3. Verify values are cleared in the model
        // Optimistic update should have happened
        expect(table.table.rows[0][0]).toBe(''); // A1
        expect(table.table.rows[0][1]).toBe(''); // B1
        expect(table.table.rows[1][0]).toBe(''); // A2
        expect(table.table.rows[1][1]).toBe(''); // B2
        expect(table.table.rows[0][2]).toBe('C1'); // C1 should remain

        // Assert state before clicking away
        expect(table.editCtrl.isEditing, 'isEditing should be false').toBe(false);
        expect(table.editCtrl.isReplacementMode, 'isReplacementMode should be false').toBe(false);

        // Spy on commitEdit to see if it gets called
        const commitSpy = vi.spyOn(table, 'commitEdit');

        // Force a commit to simulate the bug (proving that IF commit runs, values revert)
        // This validates the hypothesis that "commitEdit running unexpectedly" causes the issue.
        // We use the active cell (B2) which was the last selected cell.
        // If commitEdit runs, it reads B2's value from DOM (which might be "B2" if not updated, or "B2" if we didn't wait enough)
        // Actually, we waited for view update so DOM should be empty?
        // Unless "getDOMText" has an issue.
        // Let's reset the table rows to prove the revert logic.
        // Wait, if DOM is empty, commitEdit writes empty.
        // So for the bug to happen, DOM must be STALE.

        // Let's simulate STALE DOM by setting innerHTML back to B2 before commit
        const staleCellB2 = queryView(table, '.cell[data-row="1"][data-col="1"]') as HTMLElement;
        staleCellB2.innerHTML = '<div class="cell-content">B2</div>';

        await table.commitEdit({ target: staleCellB2 } as any);

        // Assert that commitEdit was called (but should return early due to guard)
        expect(commitSpy).toHaveBeenCalledTimes(1);

        // Assert that values DID NOT REVERT (Fix verified)
        expect(table.table.rows[0][0], 'A1 should match model').toBe('');
        expect(table.table.rows[0][1], 'B1 should match model').toBe('');
        expect(table.table.rows[1][0], 'A2 should match model').toBe('');
        // This is the key assertion: B2 should NOT be "B2" even though we forced a commit with stale DOM
        // The guard in commitEdit should prevent the stale value from being written.
        expect(table.table.rows[1][1], 'B2 should match model (empty)').toBe('');

        // 4. Critical Step: Click another cell (e.g., C3)
        // This triggers handleCellClick -> commitEdit() (THE BUG SITE)
        const cellC3 = queryView(table, '.cell[data-row="2"][data-col="2"]') as HTMLElement;
        expect(cellC3).toBeTruthy();
        cellC3.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true, buttons: 1 }));
        cellC3.click();
        await awaitView(table);

        // 5. Verify values remain cleared
        // If bug exists, A1 and B2 might revert or weird things happen
        // The bug report says: "消したはずの範囲の値がRange Startのセルを除いて復活する"
        // Range Start is A1. So A1 might be empty, but others might return?

        expect(table.table.rows[0][0], 'A1 should remain empty').toBe('');
        expect(table.table.rows[0][1], 'B1 should remain empty').toBe('');
        expect(table.table.rows[1][0], 'A2 should remain empty').toBe('');
        expect(table.table.rows[1][1], 'B2 should remain empty').toBe('');
    });
});
