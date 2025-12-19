import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies
vi.mock('../utils/i18n', () => ({
    t: (key: string) => key
}));

describe('Ghost Cell Empty Edit Bug', () => {
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

    it('should NOT add a new row when ghost cell is edited and left empty', async () => {
        const table = element as any;
        await table.updateComplete;

        const initialRowCount = table.table.rows.length;
        expect(initialRowCount).toBe(1);

        // Ghost row is at index 1 (rows has 1 item)
        const ghostCell = table.shadowRoot?.querySelector('.cell[data-row="1"][data-col="0"]') as HTMLElement;
        expect(ghostCell).toBeTruthy();

        // Dispatch dblclick to start editing
        ghostCell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
        await table.updateComplete;

        const editingCell = table.shadowRoot?.querySelector('.cell[data-row="1"][data-col="0"]') as HTMLElement;
        expect(editingCell.classList.contains('editing')).toBe(true);

        // Leave cell empty and blur (do NOT type anything)
        editingCell.dispatchEvent(new FocusEvent('blur', { bubbles: true, composed: true }));
        await table.updateComplete;

        // The row count should still be 1 (no new row added)
        expect(table.table.rows.length).toBe(initialRowCount);
    });

    it('should add a new row when ghost cell is edited with a value', async () => {
        const table = element as any;
        await table.updateComplete;

        const initialRowCount = table.table.rows.length;
        expect(initialRowCount).toBe(1);

        // Ghost row is at index 1
        const ghostCell = table.shadowRoot?.querySelector('.cell[data-row="1"][data-col="0"]') as HTMLElement;
        expect(ghostCell).toBeTruthy();

        // Dispatch dblclick to start editing
        ghostCell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
        await table.updateComplete;

        const editingCell = table.shadowRoot?.querySelector('.cell[data-row="1"][data-col="0"]') as HTMLElement;
        expect(editingCell.classList.contains('editing')).toBe(true);

        // Type a value into the cell
        const content = editingCell.querySelector('.cell-content') || editingCell;
        (content as HTMLElement).textContent = 'New Value';
        editingCell.dispatchEvent(new FocusEvent('blur', { bubbles: true, composed: true }));
        await table.updateComplete;

        // The row count should now be 2 (new row added)
        expect(table.table.rows.length).toBe(initialRowCount + 1);
        expect(table.table.rows[1][0]).toBe('New Value');
    });
});
