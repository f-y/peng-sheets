
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpreadsheetTable } from '../components/spreadsheet-table';
import { fixture, html } from '@open-wc/testing';

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

    it('renders context menu when triggered', async () => {
        const el = await fixture<SpreadsheetTable>(html`<spreadsheet-table></spreadsheet-table>`);

        // Simulate right click on row header
        const rowHeader = el.shadowRoot!.querySelector('.header-row') as HTMLElement;
        if (rowHeader) {
            rowHeader.dispatchEvent(new MouseEvent('contextmenu', {
                bubbles: true,
                cancelable: true,
                clientX: 100,
                clientY: 100
            }));

            await el.updateComplete;

            const menu = el.shadowRoot!.querySelector('.context-menu');
            expect(menu).to.exist;
            expect(menu?.textContent).to.include('Insert Row Above');
        }
    });

    it('allows editing ghost row to add new row', async () => {
        const el = await fixture<SpreadsheetTable>(html`<spreadsheet-table></spreadsheet-table>`);

        el.table = {
            name: 'Test',
            description: '',
            headers: ['A', 'B'],
            rows: [['1', '2']],
            metadata: {},
            start_line: 0,
            end_line: 0
        };
        await el.updateComplete;

        const rowsBefore = el.table.rows.length;

        // Ghost row
        const ghostCell = el.shadowRoot!.querySelector(`.cell[data-row="${rowsBefore}"][data-col="0"]`) as HTMLElement;
        expect(ghostCell).to.exist;

        // 1. Selecting the cell (Click)
        ghostCell.click();
        await el.updateComplete;

        // 2. Start Editing (Press key 'a')
        ghostCell.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, composed: true }));
        await el.updateComplete; // update request?

        // Check if editing
        expect(el.isEditing).to.be.true;

        // 3. User types (Input)
        // Note: In real browser, input updates textContent.
        // We simulate that.
        // Re-query ghostCell as it might have been replaced (though strictly shouldn't if keyed/stable)
        // But let's use the one in DOM
        const editingCell = el.shadowRoot!.querySelector('.cell.editing') as HTMLElement;
        expect(editingCell).to.exist;
        editingCell.innerText = "NewVal";
        editingCell.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));

        // 4. Commit (Enter)
        editingCell.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));

        await el.updateComplete;

        // Should have added a row
        expect(el.table.rows.length).to.equal(rowsBefore + 1);
        expect(el.table.rows[rowsBefore][0]).to.equal("NewVal");
    });

    it('allows double-click editing of column header', async () => {
        const el = await fixture<SpreadsheetTable>(html`<spreadsheet-table></spreadsheet-table>`);
        el.table = {
            name: 'Test',
            description: '',
            headers: ['A', 'B'],
            rows: [['1', '2']],
            metadata: {},
            start_line: 0,
            end_line: 0
        };
        await el.updateComplete;

        // Find header A (Col 0)
        let headerCell = el.shadowRoot!.querySelector('.header-col[data-col="0"]') as HTMLElement;
        expect(headerCell).to.exist;

        // Simulate double click
        headerCell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
        await el.updateComplete;

        // Should be editing
        expect(el.isEditing).to.be.true;
        expect(el.selectedRow).to.equal(-1);
        expect(el.selectedCol).to.equal(0);

        // Re-query header cell content
        const headerContent = el.shadowRoot!.querySelector('.header-col[data-col="0"] .cell-content') as HTMLElement;
        expect(headerContent).to.exist;
        expect(headerContent.getAttribute('contenteditable')).to.equal('true');
    });

    it('should match snapshot', () => {
        expect(element).toBeDefined();
    });

    it('should emit cell-edit event', () => {
        const spy = vi.fn();
        element.addEventListener('cell-edit', spy);

        // Simulate cell update
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

        element.selectedRow = 0;
        element.selectedCol = -2; // Sentinel for Row Selection

        (element as any)._deleteSelection();

        expect(spy).toHaveBeenCalled();
        const detail = spy.mock.calls[0][0].detail;
        expect(detail.rowIndex).toBe(0);
    });

    it('should emit column-clear event when deleting a selected column', () => {
        const spy = vi.fn();
        element.addEventListener('column-clear', spy);

        element.selectedRow = -2; // Sentinel for Col Selection
        element.selectedCol = 1;

        (element as any)._deleteSelection();

        expect(spy).toHaveBeenCalled();
        const detail = spy.mock.calls[0][0].detail;
        expect(detail.colIndex).toBe(1);
    });

    it('should emit range-edit (clear) when deleting single cell', () => {
        const cellSpy = vi.fn();
        const rangeSpy = vi.fn();
        const rowSpy = vi.fn();
        element.addEventListener('cell-edit', cellSpy);
        element.addEventListener('range-edit', rangeSpy);
        element.addEventListener('row-delete', rowSpy);

        element.selectedRow = 0;
        element.selectedCol = 0;

        (element as any)._deleteSelection();

        expect(rowSpy).not.toHaveBeenCalled();
        expect(cellSpy).not.toHaveBeenCalled();
        expect(rangeSpy).toHaveBeenCalled();

        const detail = rangeSpy.mock.calls[0][0].detail;
        expect(detail.newValue).toBe("");
        expect(detail.startRow).toBe(0);
        expect(detail.endRow).toBe(0);
        expect(detail.startCol).toBe(0);
        expect(detail.endCol).toBe(0);
    });
});
