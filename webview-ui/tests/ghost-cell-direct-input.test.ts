import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
        await table.updateComplete;

        const initialRowCount = table.table.rows.length;
        expect(initialRowCount).toBe(1);

        // Click ghost cell to select it (not edit mode yet)
        const ghostCell = table.shadowRoot?.querySelector('.cell[data-row="1"][data-col="0"]') as HTMLElement;
        expect(ghostCell).toBeTruthy();
        ghostCell.click();
        await table.updateComplete;

        // Verify ghost cell is selected but NOT editing
        expect(table.selectionCtrl.selectedRow).toBe(1);
        expect(table.selectionCtrl.selectedCol).toBe(0);
        expect(table.editCtrl.isEditing).toBe(false);

        // Type "X" directly (this should start replacement mode with pendingEditValue = 'X')
        ghostCell.dispatchEvent(new KeyboardEvent('keydown', { key: 'X', bubbles: true, composed: true }));
        await table.updateComplete;

        // Now it should be in editing mode with pendingEditValue = 'X'
        expect(table.editCtrl.isEditing).toBe(true);
        expect(table.editCtrl.pendingEditValue).toBe('X');

        // Click another cell (row 0, col 1)
        const otherCell = table.shadowRoot?.querySelector('.cell[data-row="0"][data-col="1"]') as HTMLElement;
        expect(otherCell).toBeTruthy();
        otherCell.click();
        await table.updateComplete;

        // The row count should now be 2 (new row added from ghost cell)
        expect(table.table.rows.length).toBe(initialRowCount + 1);
        expect(table.table.rows[1][0]).toBe('X');
    });
});
