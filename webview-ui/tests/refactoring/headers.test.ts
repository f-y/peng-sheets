/**
 * Phase 0: Headers Verification Tests
 *
 * These tests verify column/row header behavior in SpreadsheetTable.
 * They must pass BEFORE refactoring begins and serve as regression tests.
 */
import { describe, it, expect, vi } from 'vitest';
import { fixture, html } from '@open-wc/testing';
import '../../components/spreadsheet-table';
import { SpreadsheetTable, TableJSON } from '../../components/spreadsheet-table';

describe('Headers Verification', () => {
    const createMockTable = (): TableJSON => ({
        name: 'Test Table',
        description: 'Test Description',
        headers: ['Column A', 'Column B', 'Column C'],
        rows: [
            ['1', '2', '3'],
            ['4', '5', '6'],
            ['7', '8', '9']
        ],
        metadata: {},
        start_line: 0,
        end_line: 5
    });

    describe('Column Header Edit', () => {
        it('enters edit mode on double-click', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await el.updateComplete;

            // Double-click on cell-content inside header
            const cellContent = el.shadowRoot!.querySelector(
                '.cell.header-col[data-col="0"] .cell-content'
            ) as HTMLElement;
            cellContent.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
            await el.updateComplete;

            expect(el.editCtrl.isEditing).to.be.true;
            expect(el.selectionCtrl.selectedRow).to.equal(-1); // Header row
            expect(el.selectionCtrl.selectedCol).to.equal(0);

            // Verify cell-content span is editable
            expect(cellContent.getAttribute('contenteditable')).to.equal('true');
        });

        it('commits header edit on Enter', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await el.updateComplete;

            const editSpy = vi.fn();
            el.addEventListener('cell-edit', editSpy);

            // Double-click to edit header
            const cellContent = el.shadowRoot!.querySelector(
                '.cell.header-col[data-col="0"] .cell-content'
            ) as HTMLElement;
            cellContent.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
            await el.updateComplete;

            // Press Enter without modifying - should commit with current value
            cellContent.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));
            await el.updateComplete;

            // Edit mode should be exited
            expect(el.editCtrl.isEditing).to.be.false;

            // Cell-edit event dispatched (with original value since no change)
            expect(editSpy).toHaveBeenCalled();

            const detail = editSpy.mock.calls[0][0].detail;
            expect(detail.rowIndex).to.equal(-1); // Header row
            expect(detail.colIndex).to.equal(0);
            // Value is the original since we didn't modify
            expect(detail.newValue).to.equal('Column A');
        });

        it('selects column on header click', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await el.updateComplete;

            // Click column header (not cell-content, should select column)
            const colHeader = el.shadowRoot!.querySelector('.cell.header-col[data-col="1"]') as HTMLElement;
            colHeader.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true, button: 0 }));
            colHeader.click();
            await el.updateComplete;

            // Should be in column selection mode (selectedRow = -2)
            expect(el.selectionCtrl.selectedRow).to.equal(-2);
            expect(el.selectionCtrl.selectedCol).to.equal(1);
        });
    });

    describe('Filter Icon', () => {
        it('toggles filter menu on icon click', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await el.updateComplete;

            const filterIcon = el.shadowRoot!.querySelector('.header-col[data-col="0"] .filter-icon') as HTMLElement;
            expect(filterIcon).to.exist;

            // Click filter icon
            filterIcon.click();
            await el.updateComplete;

            // Verify filter-menu appears
            const filterMenu = el.shadowRoot!.querySelector('filter-menu');
            expect(filterMenu).to.exist;
        });

        it('shows active state when filter applied', async () => {
            const table = createMockTable();
            table.metadata = {
                visual: {
                    filters: {
                        '0': ['1'] // Hide rows where column 0 = '1'
                    }
                }
            };

            const el = await fixture<SpreadsheetTable>(html`<spreadsheet-table .table="${table}"></spreadsheet-table>`);
            await el.updateComplete;

            const filterIcon = el.shadowRoot!.querySelector('.header-col[data-col="0"] .filter-icon') as HTMLElement;
            expect(filterIcon.classList.contains('active')).to.be.true;
        });
    });

    describe('Column Resize', () => {
        it('starts resize on handle mousedown', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await el.updateComplete;

            const resizeHandle = el.shadowRoot!.querySelector(
                '.header-col[data-col="0"] .col-resize-handle'
            ) as HTMLElement;
            expect(resizeHandle).to.exist;

            // Mousedown on resize handle
            resizeHandle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true, clientX: 100 }));

            expect(el.resizeCtrl.resizingCol).to.equal(0);
        });

        it('dispatches resize event on mouseup', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await el.updateComplete;

            const resizeSpy = vi.fn();
            el.addEventListener('column-resize', resizeSpy);

            const resizeHandle = el.shadowRoot!.querySelector(
                '.header-col[data-col="0"] .col-resize-handle'
            ) as HTMLElement;

            // Start resize
            resizeHandle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true, clientX: 100 }));

            // Move
            document.dispatchEvent(new MouseEvent('mousemove', { clientX: 150 }));
            await el.updateComplete;

            // End resize
            document.dispatchEvent(new MouseEvent('mouseup', { clientX: 150 }));
            await el.updateComplete;

            expect(resizeSpy).toHaveBeenCalled();
            const detail = resizeSpy.mock.calls[0][0].detail;
            expect(detail.col).to.equal(0);
            expect(detail.width).to.be.greaterThan(0);
        });
    });
});
