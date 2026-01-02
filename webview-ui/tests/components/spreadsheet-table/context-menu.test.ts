/**
 * Phase 0: Context Menu Verification Tests
 *
 * These tests verify the context menu behavior in SpreadsheetTable.
 * They must pass BEFORE refactoring begins and serve as regression tests.
 *
 * Note: With component-based architecture, the context menu is now an
 * ss-context-menu element with its own ShadowRoot.
 * Note: Light DOM components (ss-row-header, ss-column-header) render their
 * content as inner divs with .cell.header-row / .cell.header-col classes.
 */
import { describe, it, expect, vi } from 'vitest';
import { fixture, html } from '@open-wc/testing';
import '../../../components/spreadsheet-table';
import { queryView, awaitView } from '../../helpers/test-helpers';
import { SpreadsheetTable, TableJSON } from '../../../components/spreadsheet-table';

/**
 * Helper to get the context menu component and its internal elements
 */
function getContextMenu(el: SpreadsheetTable) {
    const contextMenuEl = queryView(el, 'ss-context-menu');
    if (!contextMenuEl) return null;
    const menuContent = contextMenuEl.shadowRoot!.querySelector('.context-menu');
    const menuItems = contextMenuEl.shadowRoot!.querySelectorAll('.context-menu-item');
    return { element: contextMenuEl, content: menuContent, items: menuItems };
}

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
            await awaitView(el);

            // Light DOM: query the inner div, not the custom element
            const rowHeader = queryView(el, '.cell.header-row[data-row="1"]') as HTMLElement;
            rowHeader.dispatchEvent(
                new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                    composed: true,
                    clientX: 50,
                    clientY: 100
                })
            );
            await awaitView(el);

            const menu = getContextMenu(el);
            expect(menu).to.exist;
            expect(menu?.content).to.exist;
        });

        it('contains Insert Above item', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await awaitView(el);

            const rowHeader = queryView(el, '.cell.header-row[data-row="1"]') as HTMLElement;
            rowHeader.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, composed: true }));
            await awaitView(el);

            const menu = getContextMenu(el);
            expect(menu?.content?.textContent).to.include('Insert Row Above');
        });

        it('contains Insert Below item', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await awaitView(el);

            const rowHeader = queryView(el, '.cell.header-row[data-row="1"]') as HTMLElement;
            rowHeader.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, composed: true }));
            await awaitView(el);

            const menu = getContextMenu(el);
            expect(menu?.content?.textContent).to.include('Insert Row Below');
        });

        it('contains Delete Row item', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await awaitView(el);

            const rowHeader = queryView(el, '.cell.header-row[data-row="1"]') as HTMLElement;
            rowHeader.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, composed: true }));
            await awaitView(el);

            const menu = getContextMenu(el);
            expect(menu?.content?.textContent).to.include('Delete Row');
        });

        it('dispatches row-insert event on Insert Above click', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await awaitView(el);

            const insertSpy = vi.fn();
            el.addEventListener('row-insert', insertSpy);

            // Open context menu on row 1
            const rowHeader = queryView(el, '.cell.header-row[data-row="1"]') as HTMLElement;
            rowHeader.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, composed: true }));
            await awaitView(el);

            // Click Insert Above
            const menu = getContextMenu(el);
            const insertAbove = Array.from(menu?.items || []).find((item) =>
                item.textContent?.includes('Insert Row Above')
            ) as HTMLElement;
            insertAbove.click();
            await awaitView(el);

            expect(insertSpy).toHaveBeenCalled();
            const detail = insertSpy.mock.calls[0][0].detail;
            expect(detail.rowIndex).to.equal(1); // Insert at current row index
        });

        it('dispatches row-delete event on Delete Row click', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await awaitView(el);

            const deleteSpy = vi.fn();
            el.addEventListener('row-delete', deleteSpy);

            // Open context menu on row 1
            const rowHeader = queryView(el, '.cell.header-row[data-row="1"]') as HTMLElement;
            rowHeader.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, composed: true }));
            await awaitView(el);

            // Click Delete Row
            const menu = getContextMenu(el);
            const deleteRow = Array.from(menu?.items || []).find((item) =>
                item.textContent?.includes('Delete Row')
            ) as HTMLElement;
            deleteRow.click();
            await awaitView(el);

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
            await awaitView(el);

            // Light DOM: query the inner div, not the custom element
            const colHeader = queryView(el, '.cell.header-col[data-col="1"]') as HTMLElement;
            colHeader.dispatchEvent(
                new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                    composed: true,
                    clientX: 100,
                    clientY: 50
                })
            );
            await awaitView(el);

            const menu = getContextMenu(el);
            expect(menu).to.exist;
            expect(menu?.content).to.exist;
        });

        it('contains Insert Left item', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await awaitView(el);

            const colHeader = queryView(el, '.cell.header-col[data-col="1"]') as HTMLElement;
            colHeader.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, composed: true }));
            await awaitView(el);

            const menu = getContextMenu(el);
            expect(menu?.content?.textContent).to.include('Insert Column Left');
        });

        it('contains Insert Right item', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await awaitView(el);

            const colHeader = queryView(el, '.cell.header-col[data-col="1"]') as HTMLElement;
            colHeader.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, composed: true }));
            await awaitView(el);

            const menu = getContextMenu(el);
            expect(menu?.content?.textContent).to.include('Insert Column Right');
        });

        it('contains Delete Column item', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await awaitView(el);

            const colHeader = queryView(el, '.cell.header-col[data-col="1"]') as HTMLElement;
            colHeader.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, composed: true }));
            await awaitView(el);

            const menu = getContextMenu(el);
            expect(menu?.content?.textContent).to.include('Delete Column');
        });

        it('dispatches column-insert event', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await awaitView(el);

            const insertSpy = vi.fn();
            el.addEventListener('column-insert', insertSpy);

            // Open context menu on column 1
            const colHeader = queryView(el, '.cell.header-col[data-col="1"]') as HTMLElement;
            colHeader.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, composed: true }));
            await awaitView(el);

            // Click Insert Left
            const menu = getContextMenu(el);
            const insertLeft = Array.from(menu?.items || []).find((item) =>
                item.textContent?.includes('Insert Column Left')
            ) as HTMLElement;
            insertLeft.click();
            await awaitView(el);

            expect(insertSpy).toHaveBeenCalled();
            const detail = insertSpy.mock.calls[0][0].detail;
            expect(detail.colIndex).to.equal(1);
        });

        it('dispatches column-delete event', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await awaitView(el);

            const deleteSpy = vi.fn();
            el.addEventListener('column-delete', deleteSpy);

            // Open context menu on column 1
            const colHeader = queryView(el, '.cell.header-col[data-col="1"]') as HTMLElement;
            colHeader.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, composed: true }));
            await awaitView(el);

            // Click Delete Column
            const menu = getContextMenu(el);
            const deleteCol = Array.from(menu?.items || []).find((item) =>
                item.textContent?.includes('Delete Column')
            ) as HTMLElement;
            deleteCol.click();
            await awaitView(el);

            expect(deleteSpy).toHaveBeenCalled();
            const detail = deleteSpy.mock.calls[0][0].detail;
            expect(detail.colIndex).to.equal(1);
        });
    });

    describe('Corner Context Menu', () => {
        it('shows on corner header right-click', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await awaitView(el);

            const cornerCell = queryView(el, '.cell.header-corner') as HTMLElement;
            cornerCell.dispatchEvent(
                new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                    composed: true,
                    clientX: 50,
                    clientY: 50
                })
            );
            await awaitView(el);

            const menu = getContextMenu(el);
            expect(menu).to.exist;
            expect(menu?.content).to.exist;
        });

        it('contains Copy/Cut/Paste items', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await awaitView(el);

            const cornerCell = queryView(el, '.cell.header-corner') as HTMLElement;
            cornerCell.dispatchEvent(
                new MouseEvent('contextmenu', { bubbles: true, cancelable: true, composed: true })
            );
            await awaitView(el);

            const menu = getContextMenu(el);
            expect(menu?.content?.textContent).to.include('Copy');
            expect(menu?.content?.textContent).to.include('Cut');
            expect(menu?.content?.textContent).to.include('Paste');
        });

        it('selects all cells on right-click', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await awaitView(el);

            const cornerCell = queryView(el, '.cell.header-corner') as HTMLElement;
            cornerCell.dispatchEvent(
                new MouseEvent('contextmenu', { bubbles: true, cancelable: true, composed: true })
            );
            await awaitView(el);

            // Check selection state
            expect(el.selectionCtrl.selectedRow).to.equal(-2);
            expect(el.selectionCtrl.selectedCol).to.equal(-2);
        });
    });

    describe('Menu Dismissal', () => {
        it('closes on outside click', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await awaitView(el);

            // Open context menu
            const rowHeader = queryView(el, '.cell.header-row[data-row="1"]') as HTMLElement;
            rowHeader.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, composed: true }));
            await awaitView(el);

            let menu = getContextMenu(el);
            expect(menu).to.exist;

            // Click outside (on window to simulate global click)
            window.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            await awaitView(el);

            menu = getContextMenu(el);
            expect(menu).to.be.null;
        });
    });
});
