import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { queryView, awaitView } from './test-helpers';

// Mock dependencies
vi.mock('../utils/i18n', () => ({
    t: (key: string) => key
}));

describe('Ghost Cell Direct Input + Click-Away Bug', () => {
    let element: HTMLElement;
    let container: HTMLElement;

    beforeEach(async () => {
        await import('../components/spreadsheet-table');
        container = document.createElement('div');
        document.body.appendChild(container);

        element = document.createElement('spreadsheet-table') as HTMLElement;
        (element as any).table = {
            name: 'test',
            rows: [['A1', 'B1']],
            headers: ['A', 'B'],
            metadata: {}
        };
        container.appendChild(element);
        await (element as any).updateComplete;
    });

    afterEach(() => {
        container.remove();
        vi.restoreAllMocks();
    });

    it('should add a new row when ghost cell is selected, value typed directly, and another cell is clicked', async () => {
        const table = element as any;
        await awaitView(table);

        const initialRowCount = table.table.rows.length;
        expect(initialRowCount).toBe(1);

        // Click ghost cell to select it (not edit mode yet)
        const ghostCell = queryView(table, '.cell[data-row="1"][data-col="0"]') as HTMLElement;
        expect(ghostCell).toBeTruthy();
        ghostCell.click();
        await awaitView(table);

        // Verify ghost cell is selected but NOT editing
        expect(table.selectionCtrl.selectedRow).toBe(1);
        expect(table.selectionCtrl.selectedCol).toBe(0);
        expect(table.editCtrl.isEditing).toBe(false);

        // Type "X" directly (this should start replacement mode with pendingEditValue = 'X')
        ghostCell.dispatchEvent(new KeyboardEvent('keydown', { key: 'X', bubbles: true, composed: true }));
        await awaitView(table);

        // Now it should be in editing mode with pendingEditValue = 'X'
        expect(table.editCtrl.isEditing).toBe(true);
        expect(table.editCtrl.pendingEditValue).toBe('X');

        // Click another cell (row 0, col 1)
        const otherCell = queryView(table, '.cell[data-row="0"][data-col="1"]') as HTMLElement;
        expect(otherCell).toBeTruthy();
        otherCell.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true, button: 0 }));
        window.dispatchEvent(new MouseEvent('mouseup'));
        await awaitView(table);

        // The row count should now be 2 (new row added from ghost cell)
        expect(table.table.rows.length).toBe(initialRowCount + 1);
        expect(table.table.rows[1][0]).toBe('X');
    });

    it('should render new row in UI after ghost cell direct input and click-away', async () => {
        const table = element as any;
        await awaitView(table);

        const initialRowCount = table.table.rows.length;
        expect(initialRowCount).toBe(1);

        // Click ghost cell (row 1, col 0) to select it
        const ghostCell = queryView(table, '.cell[data-row="1"][data-col="0"]') as HTMLElement;
        expect(ghostCell).toBeTruthy();
        ghostCell.click();
        await awaitView(table);

        // Type "Y" directly
        ghostCell.dispatchEvent(new KeyboardEvent('keydown', { key: 'Y', bubbles: true, composed: true }));
        await awaitView(table);

        expect(table.editCtrl.isEditing).toBe(true);
        expect(table.editCtrl.pendingEditValue).toBe('Y');

        // Click another cell to commit
        const dataCell = queryView(table, '.cell[data-row="0"][data-col="0"]') as HTMLElement;
        expect(dataCell).toBeTruthy();
        dataCell.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true, button: 0 }));
        window.dispatchEvent(new MouseEvent('mouseup'));
        await awaitView(table);

        // Data should be updated
        expect(table.table.rows.length).toBe(initialRowCount + 1);
        expect(table.table.rows[1][0]).toBe('Y');

        // UI should also be updated - the new row should be visible in DOM
        // After commit, the old ghost row (row 1) should now be a data row with "Y"
        const newDataCell = queryView(table, '.cell[data-row="1"][data-col="0"]') as HTMLElement;
        expect(newDataCell).toBeTruthy();
        // The cell should contain "Y" (not be empty like a ghost cell)
        expect(newDataCell.textContent?.trim()).toBe('Y');
    });

    it('should NOT show pendingEditValue in other ghost cells while editing', async () => {
        const table = element as any;
        await awaitView(table);

        // Click first ghost cell (row 1, col 0) to select it
        const ghostCell0 = queryView(table, '.cell[data-row="1"][data-col="0"]') as HTMLElement;
        expect(ghostCell0).toBeTruthy();
        ghostCell0.click();
        await awaitView(table);

        // Type "X" directly to enter replacement mode
        ghostCell0.dispatchEvent(new KeyboardEvent('keydown', { key: 'X', bubbles: true, composed: true }));
        await awaitView(table);

        // Verify editing state
        expect(table.editCtrl.isEditing).toBe(true);
        expect(table.editCtrl.pendingEditValue).toBe('X');

        // Check the OTHER ghost cell (row 1, col 1) - should NOT contain "X"
        const ghostCell1 = queryView(table, '.cell[data-row="1"][data-col="1"]') as HTMLElement;
        expect(ghostCell1).toBeTruthy();
        // The bug was that pendingEditValue was showing in all empty/ghost cells
        // The textContent of the non-editing ghost cell should be empty, not "X"
        expect(ghostCell1.textContent?.trim()).toBe('');
        expect(ghostCell1.textContent).not.toContain('X');
    });

    it('should NOT show pendingEditValue in empty data cells while editing ghost cell', async () => {
        // Create table with an empty cell
        const table = element as any;
        table.table = {
            name: 'test',
            rows: [['A1', '']], // Second cell is empty
            headers: ['A', 'B'],
            metadata: {}
        };
        await awaitView(table);

        // Click ghost cell (row 1, col 0) to select it
        const ghostCell = queryView(table, '.cell[data-row="1"][data-col="0"]') as HTMLElement;
        expect(ghostCell).toBeTruthy();
        ghostCell.click();
        await awaitView(table);

        // Type "Y" directly
        ghostCell.dispatchEvent(new KeyboardEvent('keydown', { key: 'Y', bubbles: true, composed: true }));
        await awaitView(table);

        // Verify editing state
        expect(table.editCtrl.isEditing).toBe(true);
        expect(table.editCtrl.pendingEditValue).toBe('Y');

        // Check the EMPTY data cell (row 0, col 1) - should NOT contain "Y"
        const emptyDataCell = queryView(table, '.cell[data-row="0"][data-col="1"]') as HTMLElement;
        expect(emptyDataCell).toBeTruthy();
        // Bug: empty cells were showing pendingEditValue
        expect(emptyDataCell.textContent?.trim()).toBe('');
        expect(emptyDataCell.textContent).not.toContain('Y');
    });
});
