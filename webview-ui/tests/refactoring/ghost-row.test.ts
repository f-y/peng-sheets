/**
 * Phase 0: Ghost Row Verification Tests
 *
 * These tests verify the ghost row behavior in SpreadsheetTable.
 * They must pass BEFORE refactoring begins and serve as regression tests.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock i18n like the existing tests
vi.mock('../../utils/i18n', () => ({
    t: (key: string) => key
}));

describe('Ghost Row Verification', () => {
    let element: HTMLElement;
    let container: HTMLElement;

    beforeEach(async () => {
        await import('../../components/spreadsheet-table');
        container = document.createElement('div');
        document.body.appendChild(container);

        element = document.createElement('spreadsheet-table') as HTMLElement;
        (element as any).table = {
            name: 'Test Table',
            description: 'Test Description',
            headers: ['A', 'B', 'C'],
            rows: [
                ['1', '2', '3'],
                ['4', '5', '6']
            ],
            metadata: {},
            start_line: 0,
            end_line: 5
        };
        container.appendChild(element);
        await (element as any).updateComplete;
    });

    afterEach(() => {
        container.remove();
        vi.restoreAllMocks();
    });

    it('displays ghost row after last data row', async () => {
        const table = element as any;
        const ghostRowIndex = table.table.rows.length; // 2

        // Verify ghost row cells exist
        const ghostCell0 = table.shadowRoot?.querySelector(`.cell[data-row="${ghostRowIndex}"][data-col="0"]`);
        expect(ghostCell0).toBeTruthy();

        // Ghost cells should be empty
        expect(ghostCell0?.textContent?.trim()).toBe('');
    });

    it('creates new row on ghost cell edit', async () => {
        const table = element as any;
        await table.updateComplete;

        const initialRowCount = table.table.rows.length; // 2
        const ghostRowIndex = initialRowCount;

        const editSpy = vi.fn();
        element.addEventListener('cell-edit', editSpy);

        // Double-click ghost cell to edit
        const ghostCell = table.shadowRoot?.querySelector(
            `.cell[data-row="${ghostRowIndex}"][data-col="0"]`
        ) as HTMLElement;
        ghostCell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
        await table.updateComplete;

        expect(table.editCtrl.isEditing).toBe(true);

        // Find editing cell and update content
        const editingCell = table.shadowRoot?.querySelector('.cell.editing') as HTMLElement;
        editingCell.textContent = 'New Value';
        editingCell.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));

        // Commit edit
        editingCell.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));
        await table.updateComplete;

        // Verify cell-edit event was dispatched for ghost row
        expect(editSpy).toHaveBeenCalled();
        const detail = editSpy.mock.calls[0][0].detail;
        expect(detail.rowIndex).toBe(ghostRowIndex);
        expect(detail.newValue).toBe('New Value');
    });

    it('does not create row on empty edit', async () => {
        const table = element as any;
        await table.updateComplete;

        const ghostRowIndex = table.table.rows.length;

        const editSpy = vi.fn();
        element.addEventListener('cell-edit', editSpy);

        // Enter edit mode on ghost cell
        const ghostCell = table.shadowRoot?.querySelector(
            `.cell[data-row="${ghostRowIndex}"][data-col="0"]`
        ) as HTMLElement;
        ghostCell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
        await table.updateComplete;

        // Find editing cell and leave it empty
        const editingCell = table.shadowRoot?.querySelector('.cell.editing') as HTMLElement;
        editingCell.textContent = '';

        // Commit empty edit
        editingCell.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));
        await table.updateComplete;

        // Verify no cell-edit event for empty ghost cell
        // (implementation should cancel edit on empty ghost cell)
        expect(editSpy).not.toHaveBeenCalled();
    });

    it('allows selection of ghost row', async () => {
        const table = element as any;
        const ghostRowIndex = table.table.rows.length;

        // Click ghost cell
        const ghostCell = table.shadowRoot?.querySelector(
            `.cell[data-row="${ghostRowIndex}"][data-col="0"]`
        ) as HTMLElement;
        ghostCell.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true, button: 0 }));
        window.dispatchEvent(new MouseEvent('mouseup'));
        await table.updateComplete;

        expect(table.selectionCtrl.selectedRow).toBe(ghostRowIndex);
        expect(table.selectionCtrl.selectedCol).toBe(0);
    });

    it('allows navigation to ghost row', async () => {
        const table = element as any;
        const lastDataRow = table.table.rows.length - 1; // Row 1
        const ghostRowIndex = table.table.rows.length; // Row 2

        // Select last data row cell
        table.selectionCtrl.selectCell(lastDataRow, 0, false);
        await table.updateComplete;

        // Navigate down to ghost row
        const activeCell = table.shadowRoot?.querySelector(
            `.cell[data-row="${lastDataRow}"][data-col="0"]`
        ) as HTMLElement;
        activeCell.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }));
        await table.updateComplete;

        expect(table.selectionCtrl.selectedRow).toBe(ghostRowIndex);
    });

    it('allows paste into ghost row cells', async () => {
        const table = element as any;
        const ghostRowIndex = table.table.rows.length;

        const pasteSpy = vi.fn();
        element.addEventListener('paste-cells', pasteSpy);

        // Mock clipboard
        Object.defineProperty(navigator, 'clipboard', {
            value: {
                readText: () => Promise.resolve('pasted\tvalue')
            },
            configurable: true
        });

        // Select ghost cell
        table.selectionCtrl.selectCell(ghostRowIndex, 0, false);
        await table.updateComplete;

        // Focus and paste (Ctrl+V)
        const ghostCell = table.shadowRoot?.querySelector(
            `.cell[data-row="${ghostRowIndex}"][data-col="0"]`
        ) as HTMLElement;
        ghostCell.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'v', ctrlKey: true, bubbles: true, composed: true })
        );

        await new Promise((r) => setTimeout(r, 50));

        expect(pasteSpy).toHaveBeenCalled();
        const detail = pasteSpy.mock.calls[0][0].detail;
        expect(detail.startRow).toBe(ghostRowIndex);
    });
});
