/**
 * Phase 0: Navigation Verification Tests
 *
 * These tests verify the current keyboard navigation behavior in SpreadsheetTable.
 * They must pass BEFORE refactoring begins and serve as regression tests.
 */
import { describe, it, expect } from 'vitest';
import { fixture, html } from '@open-wc/testing';
import '../../components/spreadsheet-table';
import { queryView, awaitView } from '../test-helpers';
import { SpreadsheetTable, TableJSON } from '../../components/spreadsheet-table';

describe('Navigation Verification', () => {
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

    describe('Arrow Keys', () => {
        it('moves up on ArrowUp', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await awaitView(el);

            // Select cell [2, 1]
            const cell = queryView(el, '.cell[data-row="2"][data-col="1"]') as HTMLElement;
            cell.click();
            await awaitView(el);

            // Press ArrowUp
            cell.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, composed: true }));
            await awaitView(el);

            expect(el.selectionCtrl.selectedRow).to.equal(1);
            expect(el.selectionCtrl.selectedCol).to.equal(1);
        });

        it('moves down on ArrowDown', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await awaitView(el);

            // Select cell [0, 1]
            const cell = queryView(el, '.cell[data-row="0"][data-col="1"]') as HTMLElement;
            cell.click();
            await awaitView(el);

            // Press ArrowDown
            cell.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }));
            await awaitView(el);

            expect(el.selectionCtrl.selectedRow).to.equal(1);
            expect(el.selectionCtrl.selectedCol).to.equal(1);
        });

        it('moves left on ArrowLeft', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await awaitView(el);

            // Select cell [1, 2]
            const cell = queryView(el, '.cell[data-row="1"][data-col="2"]') as HTMLElement;
            cell.click();
            await awaitView(el);

            // Press ArrowLeft
            cell.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, composed: true }));
            await awaitView(el);

            expect(el.selectionCtrl.selectedRow).to.equal(1);
            expect(el.selectionCtrl.selectedCol).to.equal(1);
        });

        it('moves right on ArrowRight', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await awaitView(el);

            // Select cell [1, 0]
            const cell = queryView(el, '.cell[data-row="1"][data-col="0"]') as HTMLElement;
            cell.click();
            await awaitView(el);

            // Press ArrowRight
            cell.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true }));
            await awaitView(el);

            expect(el.selectionCtrl.selectedRow).to.equal(1);
            expect(el.selectionCtrl.selectedCol).to.equal(1);
        });

        it('stops at top boundary', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await awaitView(el);

            // Select cell [0, 1]
            const cell = queryView(el, '.cell[data-row="0"][data-col="1"]') as HTMLElement;
            cell.click();
            await awaitView(el);

            // Press ArrowUp (should stay at row 0)
            cell.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, composed: true }));
            await awaitView(el);

            expect(el.selectionCtrl.selectedRow).to.equal(0);
        });

        it('stops at left boundary', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await awaitView(el);

            // Select cell [1, 0]
            const cell = queryView(el, '.cell[data-row="1"][data-col="0"]') as HTMLElement;
            cell.click();
            await awaitView(el);

            // Press ArrowLeft (should stay at col 0)
            cell.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, composed: true }));
            await awaitView(el);

            expect(el.selectionCtrl.selectedCol).to.equal(0);
        });

        it('stops at right boundary', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await awaitView(el);

            // Select cell [1, 2] (last column)
            const cell = queryView(el, '.cell[data-row="1"][data-col="2"]') as HTMLElement;
            cell.click();
            await awaitView(el);

            // Press ArrowRight (should stay at col 2)
            cell.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true }));
            await awaitView(el);

            expect(el.selectionCtrl.selectedCol).to.equal(2);
        });
    });

    describe('Shift+Arrow Selection', () => {
        it('extends selection up with Shift+ArrowUp', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await awaitView(el);

            // Select cell [2, 1]
            const cell = queryView(el, '.cell[data-row="2"][data-col="1"]') as HTMLElement;
            cell.click();
            await awaitView(el);

            // Shift+ArrowUp
            cell.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'ArrowUp', shiftKey: true, bubbles: true, composed: true })
            );
            await awaitView(el);

            // Anchor should stay at [2, 1]
            expect(el.selectionCtrl.selectionAnchorRow).to.equal(2);
            // Selected should move to [1, 1]
            expect(el.selectionCtrl.selectedRow).to.equal(1);

            // Verify range selection
            const cell21 = queryView(el, '.cell[data-row="2"][data-col="1"]');
            const cell11 = queryView(el, '.cell[data-row="1"][data-col="1"]');
            expect(cell21?.classList.contains('selected-range')).to.be.true;
            expect(cell11?.classList.contains('selected-range')).to.be.true;
        });

        it('extends selection right with Shift+ArrowRight', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await awaitView(el);

            // Select cell [1, 0]
            const cell = queryView(el, '.cell[data-row="1"][data-col="0"]') as HTMLElement;
            cell.click();
            await awaitView(el);

            // Shift+ArrowRight
            cell.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true, bubbles: true, composed: true })
            );
            await awaitView(el);

            expect(el.selectionCtrl.selectionAnchorCol).to.equal(0);
            expect(el.selectionCtrl.selectedCol).to.equal(1);
        });
    });

    describe('Tab Navigation', () => {
        it('moves right on Tab (not in edit mode)', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await awaitView(el);

            // Select cell [1, 1]
            const cell = queryView(el, '.cell[data-row="1"][data-col="1"]') as HTMLElement;
            cell.click();
            await awaitView(el);

            // Enter edit mode first, then Tab
            cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
            await awaitView(el);

            const editingCell = queryView(el, '.cell.editing') as HTMLElement;
            editingCell.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, composed: true }));
            await awaitView(el);

            expect(el.selectionCtrl.selectedRow).to.equal(1);
            expect(el.selectionCtrl.selectedCol).to.equal(2);
        });

        it('wraps to next row at end of row', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await awaitView(el);

            // Select, edit, and Tab from last column
            const cell = queryView(el, '.cell[data-row="1"][data-col="2"]') as HTMLElement;
            cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
            await awaitView(el);

            const editingCell = queryView(el, '.cell.editing') as HTMLElement;
            editingCell.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, composed: true }));
            await awaitView(el);

            // Should wrap to next row, first column
            expect(el.selectionCtrl.selectedRow).to.equal(2);
            expect(el.selectionCtrl.selectedCol).to.equal(0);
        });

        it('moves left on Shift+Tab', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await awaitView(el);

            // Select, edit, and Shift+Tab
            const cell = queryView(el, '.cell[data-row="1"][data-col="2"]') as HTMLElement;
            cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
            await awaitView(el);

            const editingCell = queryView(el, '.cell.editing') as HTMLElement;
            editingCell.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, composed: true })
            );
            await awaitView(el);

            expect(el.selectionCtrl.selectedRow).to.equal(1);
            expect(el.selectionCtrl.selectedCol).to.equal(1);
        });

        it('wraps to previous row at start of row', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await awaitView(el);

            // Select, edit, and Shift+Tab from first column
            const cell = queryView(el, '.cell[data-row="1"][data-col="0"]') as HTMLElement;
            cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
            await awaitView(el);

            const editingCell = queryView(el, '.cell.editing') as HTMLElement;
            editingCell.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, composed: true })
            );
            await awaitView(el);

            // Should wrap to previous row, last column
            expect(el.selectionCtrl.selectedRow).to.equal(0);
            expect(el.selectionCtrl.selectedCol).to.equal(2);
        });
    });

    describe('Enter Navigation', () => {
        it('moves down on Enter (after edit)', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await awaitView(el);

            // Edit cell [1, 1]
            const cell = queryView(el, '.cell[data-row="1"][data-col="1"]') as HTMLElement;
            cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
            await awaitView(el);

            const editingCell = queryView(el, '.cell.editing') as HTMLElement;
            editingCell.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));
            await awaitView(el);

            // Should move to [2, 1]
            expect(el.selectionCtrl.selectedRow).to.equal(2);
            expect(el.selectionCtrl.selectedCol).to.equal(1);
        });

        it('moves up on Shift+Enter (after edit)', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await awaitView(el);

            // Edit cell [2, 1]
            const cell = queryView(el, '.cell[data-row="2"][data-col="1"]') as HTMLElement;
            cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
            await awaitView(el);

            const editingCell = queryView(el, '.cell.editing') as HTMLElement;
            editingCell.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true, composed: true })
            );
            await awaitView(el);

            // Should move to [1, 1]
            expect(el.selectionCtrl.selectedRow).to.equal(1);
            expect(el.selectionCtrl.selectedCol).to.equal(1);
        });
    });

    describe('Filter-Aware Navigation', () => {
        it('skips hidden rows when navigating down', async () => {
            const table = createMockTable();
            // Set up filter to hide row 1 (value "4" in column 0)
            table.metadata = {
                visual: {
                    filters: {
                        '0': ['4'] // Hide rows where column 0 = '4' (row 1)
                    }
                }
            };

            const el = await fixture<SpreadsheetTable>(html`<spreadsheet-table .table="${table}"></spreadsheet-table>`);
            await awaitView(el);

            // Verify row 1 is hidden
            const visibleIndices = el.visibleRowIndices;
            expect(visibleIndices).to.deep.equal([0, 2]); // Row 1 should be hidden

            // Select cell [0, 1]
            const cell = queryView(el, '.cell[data-row="0"][data-col="1"]') as HTMLElement;
            cell.click();
            await awaitView(el);

            // Press ArrowDown
            cell.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }));
            await awaitView(el);

            // Should skip hidden row 1 and land on row 2
            expect(el.selectionCtrl.selectedRow).to.equal(2);
        });
    });
});
