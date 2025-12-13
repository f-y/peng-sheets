
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpreadsheetTable } from './spreadsheet-table';

describe('SpreadsheetTable', () => {
    let element: SpreadsheetTable;

    beforeEach(() => {
        element = new SpreadsheetTable();
        // Mock table data
        element.table = {
            name: "Test Table",
            description: "",
            headers: ["A", "B"],
            rows: [["1", "2"], ["3", "4"]],
            metadata: {},
            start_line: 0,
            end_line: 10
        };
        element.sheetIndex = 0;
        element.tableIndex = 0;
    });

    it('should match snapshot', () => {
        // Basic instantiation check
        expect(element).toBeDefined();
    });

    it('should emit cell-edit event', () => {
        const spy = vi.fn();
        element.addEventListener('cell-edit', spy);

        // Simulate cell update
        // calling private method via `any` cast for unit testing logic
        (element as any)._updateCell(0, 0, "New Val");

        expect(spy).toHaveBeenCalled();
        const detail = spy.mock.calls[0][0].detail;
        expect(detail.newValue).toBe("New Val");
        expect(detail.rowIndex).toBe(0);
        expect(detail.colIndex).toBe(0);
    });

    it('should emit row-delete event when deleting a selected row', () => {
        const spy = vi.fn();
        element.addEventListener('row-delete', spy);

        // Select Row 0
        element.selectedRow = 0;
        element.selectedCol = -2; // Sentinel for Row Selection

        // Trigger delete
        (element as any)._deleteSelection();

        expect(spy).toHaveBeenCalled();
        const detail = spy.mock.calls[0][0].detail;
        expect(detail.rowIndex).toBe(0);
    });

    it('should emit column-clear event when deleting a selected column', () => {
        const spy = vi.fn();
        element.addEventListener('column-clear', spy);

        // Select Col 1
        element.selectedRow = -2; // Sentinel for Col Selection
        element.selectedCol = 1;

        // Trigger delete
        (element as any)._deleteSelection();

        expect(spy).toHaveBeenCalled();
        const detail = spy.mock.calls[0][0].detail;
        expect(detail.colIndex).toBe(1);
    });

    it('should emit range-edit (clear) when deleting single cell', () => {
        const spy = vi.fn();
        const rowSpy = vi.fn(); // Should NOT call row delete
        element.addEventListener('cell-edit', spy);
        element.addEventListener('row-delete', rowSpy);

        element.selectedRow = 0;
        element.selectedCol = 0;

        (element as any)._deleteSelection();

        expect(rowSpy).not.toHaveBeenCalled();
        expect(spy).toHaveBeenCalled();
        expect(spy.mock.calls[0][0].detail.newValue).toBe("");
    });
});
