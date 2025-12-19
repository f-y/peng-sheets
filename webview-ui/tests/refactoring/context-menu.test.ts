/**
 * Phase 0: Context Menu Verification Tests
 *
 * These tests verify the context menu behavior in SpreadsheetTable.
 * They must pass BEFORE refactoring begins and serve as regression tests.
 */
import { describe, it, expect, vi } from 'vitest';
import { fixture, html } from '@open-wc/testing';
import '../../components/spreadsheet-table';
import { SpreadsheetTable, TableJSON } from '../../components/spreadsheet-table';

describe('Context Menu Verification', () => {
    const createMockTable = (): TableJSON => ({
        name: 'Test Table',
        description: 'Test Description',
        headers: ['A', 'B', 'C'],
        rows: [
            ['1', '2', '3'],
            ['4', '5', '6'],
            ['7', '8', '9']
        ],
        metadata: {},
        start_line: 0,
        end_line: 5
    });

    describe('Row Context Menu', () => {
        it('shows on row header right-click', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await el.updateComplete;

            const rowHeader = el.shadowRoot!.querySelector('.cell.header-row[data-row="1"]') as HTMLElement;
            rowHeader.dispatchEvent(
                new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                    composed: true,
                    clientX: 50,
                    clientY: 100
                })
            );
            await el.updateComplete;

            const contextMenu = el.shadowRoot!.querySelector('.context-menu');
            expect(contextMenu).to.exist;
        });

        it('contains Insert Above item', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await el.updateComplete;

            const rowHeader = el.shadowRoot!.querySelector('.cell.header-row[data-row="1"]') as HTMLElement;
            rowHeader.dispatchEvent(
                new MouseEvent('contextmenu', { bubbles: true, cancelable: true, composed: true })
            );
            await el.updateComplete;

            const contextMenu = el.shadowRoot!.querySelector('.context-menu');
            expect(contextMenu?.textContent).to.include('Insert Row Above');
        });

        it('contains Insert Below item', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await el.updateComplete;

            const rowHeader = el.shadowRoot!.querySelector('.cell.header-row[data-row="1"]') as HTMLElement;
            rowHeader.dispatchEvent(
                new MouseEvent('contextmenu', { bubbles: true, cancelable: true, composed: true })
            );
            await el.updateComplete;

            const contextMenu = el.shadowRoot!.querySelector('.context-menu');
            expect(contextMenu?.textContent).to.include('Insert Row Below');
        });

        it('contains Delete Row item', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await el.updateComplete;

            const rowHeader = el.shadowRoot!.querySelector('.cell.header-row[data-row="1"]') as HTMLElement;
            rowHeader.dispatchEvent(
                new MouseEvent('contextmenu', { bubbles: true, cancelable: true, composed: true })
            );
            await el.updateComplete;

            const contextMenu = el.shadowRoot!.querySelector('.context-menu');
            expect(contextMenu?.textContent).to.include('Delete Row');
        });

        it('dispatches insert-row event on Insert Above click', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await el.updateComplete;

            const insertSpy = vi.fn();
            el.addEventListener('insert-row', insertSpy);

            // Open context menu on row 1
            const rowHeader = el.shadowRoot!.querySelector('.cell.header-row[data-row="1"]') as HTMLElement;
            rowHeader.dispatchEvent(
                new MouseEvent('contextmenu', { bubbles: true, cancelable: true, composed: true })
            );
            await el.updateComplete;

            // Click Insert Above
            const menuItems = el.shadowRoot!.querySelectorAll('.context-menu-item');
            const insertAbove = Array.from(menuItems).find((item) =>
                item.textContent?.includes('Insert Row Above')
            ) as HTMLElement;
            insertAbove.click();
            await el.updateComplete;

            expect(insertSpy).toHaveBeenCalled();
            const detail = insertSpy.mock.calls[0][0].detail;
            expect(detail.rowIndex).to.equal(1); // Insert at current row index
        });

        it('dispatches row-delete event on Delete Row click', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await el.updateComplete;

            const deleteSpy = vi.fn();
            el.addEventListener('row-delete', deleteSpy);

            // Open context menu on row 1
            const rowHeader = el.shadowRoot!.querySelector('.cell.header-row[data-row="1"]') as HTMLElement;
            rowHeader.dispatchEvent(
                new MouseEvent('contextmenu', { bubbles: true, cancelable: true, composed: true })
            );
            await el.updateComplete;

            // Click Delete Row
            const menuItems = el.shadowRoot!.querySelectorAll('.context-menu-item');
            const deleteRow = Array.from(menuItems).find((item) =>
                item.textContent?.includes('Delete Row')
            ) as HTMLElement;
            deleteRow.click();
            await el.updateComplete;

            expect(deleteSpy).toHaveBeenCalled();
            const detail = deleteSpy.mock.calls[0][0].detail;
            expect(detail.rowIndex).to.equal(1);
        });
    });

    describe('Column Context Menu', () => {
        it('shows on column header right-click', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await el.updateComplete;

            const colHeader = el.shadowRoot!.querySelector('.cell.header-col[data-col="1"]') as HTMLElement;
            colHeader.dispatchEvent(
                new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                    composed: true,
                    clientX: 100,
                    clientY: 50
                })
            );
            await el.updateComplete;

            const contextMenu = el.shadowRoot!.querySelector('.context-menu');
            expect(contextMenu).to.exist;
        });

        it('contains Insert Left item', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await el.updateComplete;

            const colHeader = el.shadowRoot!.querySelector('.cell.header-col[data-col="1"]') as HTMLElement;
            colHeader.dispatchEvent(
                new MouseEvent('contextmenu', { bubbles: true, cancelable: true, composed: true })
            );
            await el.updateComplete;

            const contextMenu = el.shadowRoot!.querySelector('.context-menu');
            expect(contextMenu?.textContent).to.include('Insert Column Left');
        });

        it('contains Insert Right item', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await el.updateComplete;

            const colHeader = el.shadowRoot!.querySelector('.cell.header-col[data-col="1"]') as HTMLElement;
            colHeader.dispatchEvent(
                new MouseEvent('contextmenu', { bubbles: true, cancelable: true, composed: true })
            );
            await el.updateComplete;

            const contextMenu = el.shadowRoot!.querySelector('.context-menu');
            expect(contextMenu?.textContent).to.include('Insert Column Right');
        });

        it('contains Delete Column item', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await el.updateComplete;

            const colHeader = el.shadowRoot!.querySelector('.cell.header-col[data-col="1"]') as HTMLElement;
            colHeader.dispatchEvent(
                new MouseEvent('contextmenu', { bubbles: true, cancelable: true, composed: true })
            );
            await el.updateComplete;

            const contextMenu = el.shadowRoot!.querySelector('.context-menu');
            expect(contextMenu?.textContent).to.include('Delete Column');
        });

        it('dispatches column-insert event', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await el.updateComplete;

            const insertSpy = vi.fn();
            el.addEventListener('column-insert', insertSpy);

            // Open context menu on column 1
            const colHeader = el.shadowRoot!.querySelector('.cell.header-col[data-col="1"]') as HTMLElement;
            colHeader.dispatchEvent(
                new MouseEvent('contextmenu', { bubbles: true, cancelable: true, composed: true })
            );
            await el.updateComplete;

            // Click Insert Left
            const menuItems = el.shadowRoot!.querySelectorAll('.context-menu-item');
            const insertLeft = Array.from(menuItems).find((item) =>
                item.textContent?.includes('Insert Column Left')
            ) as HTMLElement;
            insertLeft.click();
            await el.updateComplete;

            expect(insertSpy).toHaveBeenCalled();
            const detail = insertSpy.mock.calls[0][0].detail;
            expect(detail.colIndex).to.equal(1);
        });

        it('dispatches column-delete event', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await el.updateComplete;

            const deleteSpy = vi.fn();
            el.addEventListener('column-delete', deleteSpy);

            // Open context menu on column 1
            const colHeader = el.shadowRoot!.querySelector('.cell.header-col[data-col="1"]') as HTMLElement;
            colHeader.dispatchEvent(
                new MouseEvent('contextmenu', { bubbles: true, cancelable: true, composed: true })
            );
            await el.updateComplete;

            // Click Delete Column
            const menuItems = el.shadowRoot!.querySelectorAll('.context-menu-item');
            const deleteCol = Array.from(menuItems).find((item) =>
                item.textContent?.includes('Delete Column')
            ) as HTMLElement;
            deleteCol.click();
            await el.updateComplete;

            expect(deleteSpy).toHaveBeenCalled();
            const detail = deleteSpy.mock.calls[0][0].detail;
            expect(detail.colIndex).to.equal(1);
        });
    });

    describe('Menu Dismissal', () => {
        it('closes on outside click', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await el.updateComplete;

            // Open context menu
            const rowHeader = el.shadowRoot!.querySelector('.cell.header-row[data-row="1"]') as HTMLElement;
            rowHeader.dispatchEvent(
                new MouseEvent('contextmenu', { bubbles: true, cancelable: true, composed: true })
            );
            await el.updateComplete;

            let contextMenu = el.shadowRoot!.querySelector('.context-menu');
            expect(contextMenu).to.exist;

            // Click outside (on a cell)
            const cell = el.shadowRoot!.querySelector('.cell[data-row="0"][data-col="0"]') as HTMLElement;
            // Dispatch on window to simulate global click
            window.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            await el.updateComplete;

            contextMenu = el.shadowRoot!.querySelector('.context-menu');
            expect(contextMenu).to.not.exist;
        });
    });
});
