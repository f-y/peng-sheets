import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies
vi.mock('../utils/i18n', () => ({
    t: (key: string) => key
}));

describe('SpreadsheetTable Ghost Cell Bugs', () => {
    let element: HTMLElement;
    let container: HTMLElement;

    beforeEach(async () => {
        await import('../components/spreadsheet-table');
        container = document.createElement('div');
        document.body.appendChild(container);

        element = document.createElement('spreadsheet-table') as HTMLElement;
        // Correctly set table property
        (element as any).table = {
            name: 'test',
            rows: [['A1', 'B1'], ['A2', 'B2']],
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

    it('should NOT show "undefined" when editing a ghost cell', async () => {
        const table = element as any;
        await table.updateComplete;

        // Ghost row is at index 2.
        // We find the cell in shadow DOM
        const ghostCell = table.shadowRoot?.querySelector('.cell[data-row="2"][data-col="0"]') as HTMLElement;
        expect(ghostCell).toBeTruthy();

        // Dispatch dblclick to start editing
        ghostCell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
        await table.updateComplete;

        // Check content
        const editingCell = table.shadowRoot?.querySelector('.cell[data-row="2"][data-col="0"]') as HTMLElement;
        expect(editingCell.classList.contains('editing')).toBe(true);
        expect(editingCell.textContent?.trim()).toBe('');
        expect(editingCell.textContent).not.toContain('undefined');
        // Ensure absolutely no whitespace
        expect(editingCell.textContent).toBe('');
    });


    it('should navigate to ghost row when pressing ArrowDown from last row', async () => {
        const table = element as any;

        // Select last row (index 1)
        table.selectionCtrl.selectCell(1, 0, false);
        await table.updateComplete;

        // Simulate ArrowDown on the active cell
        const activeCell = table.shadowRoot?.querySelector('.cell[data-row="1"][data-col="0"]') as HTMLElement;
        const event = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true });
        activeCell.dispatchEvent(event);
        await table.updateComplete;

        // Verify selection moved to Row 2 (Ghost Row)
        expect(table.selectionCtrl.selectedRow).toBe(2);
    });

    it('should navigate to ghost row when pressing Enter from last row', async () => {
        const table = element as any;

        // Select last row (index 1)
        table.selectionCtrl.selectCell(1, 0, false);
        await table.updateComplete;

        // Simulate Enter on the active cell
        const activeCell = table.shadowRoot?.querySelector('.cell[data-row="1"][data-col="0"]') as HTMLElement;
        const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true });
        activeCell.dispatchEvent(event);
        await table.updateComplete;

        // Verify selection moved to Row 2 (Ghost Row)
        expect(table.selectionCtrl.selectedRow).toBe(2);
    });
});
