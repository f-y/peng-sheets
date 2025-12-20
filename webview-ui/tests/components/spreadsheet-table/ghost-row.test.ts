/**
 * Phase 0: Ghost Row Verification Tests
 *
 * These tests verify the ghost row behavior in SpreadsheetTable.
 * Updated to use View component helpers after Container-View refactoring.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { queryView, awaitView } from '../../helpers/test-helpers';
import { SpreadsheetTable } from '../../../components/spreadsheet-table';

// Mock i18n like the existing tests
vi.mock('../../utils/i18n', () => ({
    t: (key: string) => key
}));

describe('Ghost Row Verification', () => {
    let element: SpreadsheetTable;
    let container: HTMLElement;

    beforeEach(async () => {
        await import('../../../components/spreadsheet-table');
        container = document.createElement('div');
        document.body.appendChild(container);

        element = document.createElement('spreadsheet-table') as SpreadsheetTable;
        element.table = {
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
        // Wait for both Container and View to render
        await awaitView(element);
    });

    afterEach(() => {
        container.remove();
        vi.restoreAllMocks();
    });

    it('displays ghost row after last data row', async () => {
        const ghostRowIndex = element.table!.rows.length; // 2

        // Verify ghost row cells exist - query through View's shadow DOM
        const ghostCell0 = queryView(element, `.cell[data-row="${ghostRowIndex}"][data-col="0"]`);
        expect(ghostCell0).toBeTruthy();

        // Ghost cells should be empty
        expect(ghostCell0?.textContent?.trim()).toBe('');
    });

    it('creates new row on ghost cell edit', async () => {
        const initialRowCount = element.table!.rows.length; // 2
        const ghostRowIndex = initialRowCount;

        const editSpy = vi.fn();
        element.addEventListener('cell-edit', editSpy);

        // Double-click ghost cell to edit
        const ghostCell = queryView(element, `.cell[data-row="${ghostRowIndex}"][data-col="0"]`) as HTMLElement;
        expect(ghostCell).toBeTruthy();
        ghostCell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
        await awaitView(element);

        expect(element.editCtrl.isEditing).toBe(true);

        // Find editing cell and update content
        const editingCell = queryView(element, '.cell.editing') as HTMLElement;
        expect(editingCell).toBeTruthy();
        editingCell.textContent = 'New Value';
        editingCell.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));

        // Commit edit
        editingCell.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));
        await awaitView(element);

        // Verify cell-edit event was dispatched for ghost row
        expect(editSpy).toHaveBeenCalled();
        const detail = editSpy.mock.calls[0][0].detail;
        expect(detail.rowIndex).toBe(ghostRowIndex);
        expect(detail.newValue).toBe('New Value');
    });

    it('does not create row on empty edit', async () => {
        const ghostRowIndex = element.table!.rows.length;

        const editSpy = vi.fn();
        element.addEventListener('cell-edit', editSpy);

        // Enter edit mode on ghost cell
        const ghostCell = queryView(element, `.cell[data-row="${ghostRowIndex}"][data-col="0"]`) as HTMLElement;
        expect(ghostCell).toBeTruthy();
        ghostCell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
        await awaitView(element);

        // Find editing cell and leave it empty
        const editingCell = queryView(element, '.cell.editing') as HTMLElement;
        expect(editingCell).toBeTruthy();
        editingCell.textContent = '';

        // Commit empty edit
        editingCell.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));
        await awaitView(element);

        // Verify no cell-edit event for empty ghost cell
        expect(editSpy).not.toHaveBeenCalled();
    });

    it('allows selection of ghost row', async () => {
        const ghostRowIndex = element.table!.rows.length;

        // Click ghost cell
        const ghostCell = queryView(element, `.cell[data-row="${ghostRowIndex}"][data-col="0"]`) as HTMLElement;
        expect(ghostCell).toBeTruthy();
        ghostCell.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true, button: 0 }));
        window.dispatchEvent(new MouseEvent('mouseup'));
        await awaitView(element);

        expect(element.selectionCtrl.selectedRow).toBe(ghostRowIndex);
        expect(element.selectionCtrl.selectedCol).toBe(0);
    });

    it('allows navigation to ghost row', async () => {
        const lastDataRow = element.table!.rows.length - 1; // Row 1
        const ghostRowIndex = element.table!.rows.length; // Row 2

        // Select last data row cell
        element.selectionCtrl.selectCell(lastDataRow, 0, false);
        await awaitView(element);

        // Navigate down to ghost row
        const activeCell = queryView(element, `.cell[data-row="${lastDataRow}"][data-col="0"]`) as HTMLElement;
        expect(activeCell).toBeTruthy();
        activeCell.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }));
        await awaitView(element);

        expect(element.selectionCtrl.selectedRow).toBe(ghostRowIndex);
    });

    it('allows paste into ghost row cells', async () => {
        const ghostRowIndex = element.table!.rows.length;

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
        element.selectionCtrl.selectCell(ghostRowIndex, 0, false);
        await awaitView(element);

        // Focus and paste (Ctrl+V)
        const ghostCell = queryView(element, `.cell[data-row="${ghostRowIndex}"][data-col="0"]`) as HTMLElement;
        expect(ghostCell).toBeTruthy();
        ghostCell.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'v', ctrlKey: true, bubbles: true, composed: true })
        );

        await new Promise((r) => setTimeout(r, 50));

        expect(pasteSpy).toHaveBeenCalled();
        const detail = pasteSpy.mock.calls[0][0].detail;
        expect(detail.startRow).toBe(ghostRowIndex);
    });
});
