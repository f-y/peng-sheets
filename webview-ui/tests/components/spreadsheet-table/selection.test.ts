/**
 * Phase 0: Selection Verification Tests
 *
 * These tests verify the current behavior of selection in SpreadsheetTable.
 * They must pass BEFORE refactoring begins and serve as regression tests.
 */
import { describe, it, expect } from 'vitest';
import { fixture, html } from '@open-wc/testing';
import '../../../components/spreadsheet-table';
import { SpreadsheetTable, TableJSON } from '../../../components/spreadsheet-table';
import { queryView, awaitView } from '../../helpers/test-helpers';

describe('Selection Verification', () => {
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

    describe('Single Cell Selection', () => {
        it('selects cell on mousedown', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await awaitView(el);

            const cell = queryView(el, '.cell[data-row="1"][data-col="2"]') as HTMLElement;
            cell.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true, button: 0 }));
            await awaitView(el);

            expect(el.selectionCtrl.selectedRow).to.equal(1);
            expect(el.selectionCtrl.selectedCol).to.equal(2);

            window.dispatchEvent(new MouseEvent('mouseup'));
        });

        it('deselects previous cell when new cell clicked', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await awaitView(el);

            // Click first cell
            const cell00 = queryView(el, '.cell[data-row="0"][data-col="0"]') as HTMLElement;
            cell00.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true, button: 0 }));
            window.dispatchEvent(new MouseEvent('mouseup'));
            await awaitView(el);

            expect(el.selectionCtrl.selectedRow).to.equal(0);
            expect(el.selectionCtrl.selectedCol).to.equal(0);

            // Click second cell
            const cell11 = queryView(el, '.cell[data-row="1"][data-col="1"]') as HTMLElement;
            cell11.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true, button: 0 }));
            window.dispatchEvent(new MouseEvent('mouseup'));
            await awaitView(el);

            // Verify selection moved
            expect(el.selectionCtrl.selectedRow).to.equal(1);
            expect(el.selectionCtrl.selectedCol).to.equal(1);
        });
    });

    describe('Range Selection', () => {
        it('extends selection with Shift+mousedown', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await awaitView(el);

            // Click cell [0, 0]
            const cell00 = queryView(el, '.cell[data-row="0"][data-col="0"]') as HTMLElement;
            cell00.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true, button: 0 }));
            window.dispatchEvent(new MouseEvent('mouseup'));
            await awaitView(el);

            // Shift+mousedown cell [2, 2]
            const cell22 = queryView(el, '.cell[data-row="2"][data-col="2"]') as HTMLElement;
            cell22.dispatchEvent(
                new MouseEvent('mousedown', { bubbles: true, composed: true, button: 0, shiftKey: true })
            );
            window.dispatchEvent(new MouseEvent('mouseup'));
            await awaitView(el);

            // Verify anchor is still at [0, 0]
            expect(el.selectionCtrl.selectionAnchorRow).to.equal(0);
            expect(el.selectionCtrl.selectionAnchorCol).to.equal(0);

            // Verify selected is now at [2, 2]
            expect(el.selectionCtrl.selectedRow).to.equal(2);
            expect(el.selectionCtrl.selectedCol).to.equal(2);

            // Verify cells in range have selected-range class
            const cell11 = queryView(el, '.cell[data-row="1"][data-col="1"]');
            expect(cell11?.classList.contains('selected-range')).to.be.true;
        });

        it('extends selection by mouse drag', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await awaitView(el);

            // Mousedown on [0, 0]
            const startCell = queryView(el, '.cell[data-row="0"][data-col="0"]') as HTMLElement;
            startCell.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true, button: 0 }));

            expect(el.selectionCtrl.isSelecting).to.be.true;

            // Mousemove to [2, 2]
            const targetCell = queryView(el, '.cell[data-row="2"][data-col="2"]') as HTMLElement;
            targetCell.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, composed: true }));

            expect(el.selectionCtrl.selectedRow).to.equal(2);
            expect(el.selectionCtrl.selectedCol).to.equal(2);

            // Mouseup
            window.dispatchEvent(new MouseEvent('mouseup'));
            expect(el.selectionCtrl.isSelecting).to.be.false;

            // Verify visual classes
            await awaitView(el);
            const cell11 = queryView(el, '.cell[data-row="1"][data-col="1"]');
            expect(cell11?.classList.contains('selected-range')).to.be.true;
        });
    });

    describe('Row Selection', () => {
        it('selects entire row when row header clicked', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await awaitView(el);

            const rowHeader = queryView(el, '.cell.header-row[data-row="1"]') as HTMLElement;
            rowHeader.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true, button: 0 }));
            rowHeader.click();
            await awaitView(el);

            expect(el.selectionCtrl.selectedRow).to.equal(1);
            expect(el.selectionCtrl.selectedCol).to.equal(-2); // Row selection mode

            // Verify all cells in row 1 have selection styling
            const cell10 = queryView(el, '.cell[data-row="1"][data-col="0"]');
            const cell11 = queryView(el, '.cell[data-row="1"][data-col="1"]');
            const cell12 = queryView(el, '.cell[data-row="1"][data-col="2"]');
            expect(cell10?.classList.contains('selected-range')).to.be.true;
            expect(cell11?.classList.contains('selected-range')).to.be.true;
            expect(cell12?.classList.contains('selected-range')).to.be.true;

            // Verify cells in other rows are NOT selected
            const cell00 = queryView(el, '.cell[data-row="0"][data-col="0"]');
            expect(cell00?.classList.contains('selected-range')).to.be.false;
        });

        it('extends row selection with Shift+click', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await awaitView(el);

            // Click row header 0
            const rowHeader0 = queryView(el, '.cell.header-row[data-row="0"]') as HTMLElement;
            rowHeader0.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true, button: 0 }));
            rowHeader0.click();
            await awaitView(el);

            // Shift+click row header 2
            const rowHeader2 = queryView(el, '.cell.header-row[data-row="2"]') as HTMLElement;
            rowHeader2.dispatchEvent(
                new MouseEvent('mousedown', { bubbles: true, composed: true, button: 0, shiftKey: true })
            );
            rowHeader2.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, shiftKey: true }));
            await awaitView(el);

            // Verify rows 0-2 are selected
            expect(el.selectionCtrl.selectionAnchorRow).to.equal(0);
            expect(el.selectionCtrl.selectedRow).to.equal(2);

            const cell00 = queryView(el, '.cell[data-row="0"][data-col="0"]');
            const cell10 = queryView(el, '.cell[data-row="1"][data-col="0"]');
            const cell20 = queryView(el, '.cell[data-row="2"][data-col="0"]');
            expect(cell00?.classList.contains('selected-range')).to.be.true;
            expect(cell10?.classList.contains('selected-range')).to.be.true;
            expect(cell20?.classList.contains('selected-range')).to.be.true;
        });
    });

    describe('Column Selection', () => {
        it('selects entire column when column header clicked', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await awaitView(el);

            const colHeader = queryView(el, '.cell.header-col[data-col="1"]') as HTMLElement;
            colHeader.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true, button: 0 }));
            colHeader.click();
            await awaitView(el);

            expect(el.selectionCtrl.selectedRow).to.equal(-2); // Column selection mode
            expect(el.selectionCtrl.selectedCol).to.equal(1);

            // Verify all cells in column 1 have selection styling
            const cell01 = queryView(el, '.cell[data-row="0"][data-col="1"]');
            const cell11 = queryView(el, '.cell[data-row="1"][data-col="1"]');
            const cell21 = queryView(el, '.cell[data-row="2"][data-col="1"]');
            expect(cell01?.classList.contains('selected-range')).to.be.true;
            expect(cell11?.classList.contains('selected-range')).to.be.true;
            expect(cell21?.classList.contains('selected-range')).to.be.true;
        });

        it('extends column selection with Shift+click', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await awaitView(el);

            // Click column header 0
            const colHeader0 = queryView(el, '.cell.header-col[data-col="0"]') as HTMLElement;
            colHeader0.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true, button: 0 }));
            colHeader0.click();
            await awaitView(el);

            // Shift+click column header 2
            const colHeader2 = queryView(el, '.cell.header-col[data-col="2"]') as HTMLElement;
            colHeader2.dispatchEvent(
                new MouseEvent('mousedown', { bubbles: true, composed: true, button: 0, shiftKey: true })
            );
            colHeader2.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, shiftKey: true }));
            await awaitView(el);

            // Verify columns 0-2 are selected
            expect(el.selectionCtrl.selectionAnchorCol).to.equal(0);
            expect(el.selectionCtrl.selectedCol).to.equal(2);

            const cell00 = queryView(el, '.cell[data-row="0"][data-col="0"]');
            const cell01 = queryView(el, '.cell[data-row="0"][data-col="1"]');
            const cell02 = queryView(el, '.cell[data-row="0"][data-col="2"]');
            expect(cell00?.classList.contains('selected-range')).to.be.true;
            expect(cell01?.classList.contains('selected-range')).to.be.true;
            expect(cell02?.classList.contains('selected-range')).to.be.true;
        });
    });

    describe('Full Table Selection', () => {
        it('selects all cells when corner clicked', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await awaitView(el);

            const corner = queryView(el, '.cell.header-corner') as HTMLElement;
            corner.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true, button: 0 }));
            corner.click();
            await awaitView(el);

            expect(el.selectionCtrl.selectedRow).to.equal(-2);
            expect(el.selectionCtrl.selectedCol).to.equal(-2);

            // Verify corner has selected class
            expect(corner.classList.contains('selected')).to.be.true;
        });
    });
});
