/**
 * Phase 0: Editing Verification Tests
 *
 * These tests verify the current behavior of editing in SpreadsheetTable.
 * They must pass BEFORE refactoring begins and serve as regression tests.
 */
import { describe, it, expect, vi } from 'vitest';
import { fixture, html } from '@open-wc/testing';
import '../../components/spreadsheet-table';
import { queryView, awaitView } from '../test-helpers';
import { SpreadsheetTable, TableJSON } from '../../components/spreadsheet-table';

describe('Editing Verification', () => {
    const createMockTable = (): TableJSON => ({
        name: 'Test Table',
        description: 'Test Description',
        headers: ['A', 'B', 'C'],
        rows: [
            ['value1', 'value2', 'value3'],
            ['data4', 'data5', 'data6'],
            ['item7', 'item8', 'item9']
        ],
        metadata: {},
        start_line: 0,
        end_line: 5
    });

    describe('Enter Edit Mode', () => {
        it('enters edit mode on double-click', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await awaitView(el);

            const cell = queryView(el, '.cell[data-row="1"][data-col="1"]') as HTMLElement;
            cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
            await awaitView(el);

            expect(el.editCtrl.isEditing).to.be.true;
            expect(el.selectionCtrl.selectedRow).to.equal(1);
            expect(el.selectionCtrl.selectedCol).to.equal(1);

            // Verify cell has editing class
            const editingCell = queryView(el, '.cell.editing');
            expect(editingCell).to.exist;
            expect(editingCell?.getAttribute('contenteditable')).to.equal('true');
        });

        it('enters edit mode on F2 key', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await awaitView(el);

            // First select a cell
            const cell = queryView(el, '.cell[data-row="0"][data-col="0"]') as HTMLElement;
            cell.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true, button: 0 }));
            window.dispatchEvent(new MouseEvent('mouseup'));
            await awaitView(el);

            // Press F2
            cell.dispatchEvent(new KeyboardEvent('keydown', { key: 'F2', bubbles: true, composed: true }));
            await awaitView(el);

            expect(el.editCtrl.isEditing).to.be.true;
            // F2 enters edit mode - not replacement mode
            expect(el.editCtrl.isReplacementMode).to.be.false;
        });

        it('enters replacement mode on direct typing', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await awaitView(el);

            // Select cell with value
            const cell = queryView(el, '.cell[data-row="0"][data-col="0"]') as HTMLElement;
            cell.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true, button: 0 }));
            window.dispatchEvent(new MouseEvent('mouseup'));
            await awaitView(el);

            // Type a character (not F2)
            cell.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', bubbles: true, composed: true }));
            await awaitView(el);

            expect(el.editCtrl.isEditing).to.be.true;
            expect(el.editCtrl.isReplacementMode).to.be.true;
            // In replacement mode, the typed character becomes the initial value
            expect(el.editCtrl.pendingEditValue).to.equal('n');
        });
    });

    describe('Commit Edit', () => {
        it('commits edit on Enter', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await awaitView(el);

            const editSpy = vi.fn();
            el.addEventListener('cell-edit', editSpy);

            // Double-click to edit
            const cell = queryView(el, '.cell[data-row="0"][data-col="0"]') as HTMLElement;
            cell.focus();
            cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
            await awaitView(el);

            // Modify content
            const editingCell = queryView(el, '.cell.editing') as HTMLElement;
            editingCell.textContent = 'new value';
            editingCell.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));

            // Press Enter
            editingCell.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));
            await awaitView(el);

            // Verify edit mode exited
            expect(el.editCtrl.isEditing).to.be.false;

            // Verify cell-edit event dispatched
            expect(editSpy).toHaveBeenCalled();
            const detail = editSpy.mock.calls[0][0].detail;
            expect(detail.rowIndex).to.equal(0);
            expect(detail.colIndex).to.equal(0);
        });

        it('commits and moves right on Tab', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await awaitView(el);

            // Enter edit mode on [1, 1]
            const cell = queryView(el, '.cell[data-row="1"][data-col="1"]') as HTMLElement;
            cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
            await awaitView(el);

            const editingCell = queryView(el, '.cell.editing') as HTMLElement;

            // Press Tab
            editingCell.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, composed: true }));
            await awaitView(el);

            // Verify selection moved to [1, 2]
            expect(el.selectionCtrl.selectedRow).to.equal(1);
            expect(el.selectionCtrl.selectedCol).to.equal(2);
            expect(el.editCtrl.isEditing).to.be.false;
        });

        it('commits and moves left on Shift+Tab', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await awaitView(el);

            // Enter edit mode on [1, 2]
            const cell = queryView(el, '.cell[data-row="1"][data-col="2"]') as HTMLElement;
            cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
            await awaitView(el);

            const editingCell = queryView(el, '.cell.editing') as HTMLElement;

            // Press Shift+Tab
            editingCell.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, composed: true })
            );
            await awaitView(el);

            // Verify selection moved to [1, 1]
            expect(el.selectionCtrl.selectedRow).to.equal(1);
            expect(el.selectionCtrl.selectedCol).to.equal(1);
        });

        it('commits edit on click away', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await awaitView(el);

            const editSpy = vi.fn();
            el.addEventListener('cell-edit', editSpy);

            // Edit cell [1, 1]
            const cell11 = queryView(el, '.cell[data-row="1"][data-col="1"]') as HTMLElement;
            cell11.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
            await awaitView(el);

            const editingCell = queryView(el, '.cell.editing') as HTMLElement;
            editingCell.textContent = 'changed';
            editingCell.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));

            // Click different cell [2, 2] - use mousedown which triggers commit
            const cell22 = queryView(el, '.cell[data-row="2"][data-col="2"]') as HTMLElement;
            cell22.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true, button: 0 }));
            window.dispatchEvent(new MouseEvent('mouseup'));
            await awaitView(el);

            // Verify [1, 1] edit was committed
            expect(editSpy).toHaveBeenCalled();

            // Verify [2, 2] is now selected
            expect(el.selectionCtrl.selectedRow).to.equal(2);
            expect(el.selectionCtrl.selectedCol).to.equal(2);
        });
    });

    describe('Cancel Edit', () => {
        it('cancels edit on Escape', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await awaitView(el);

            const editSpy = vi.fn();
            el.addEventListener('cell-edit', editSpy);

            // Edit cell [0, 0]
            const cell = queryView(el, '.cell[data-row="0"][data-col="0"]') as HTMLElement;
            cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
            await awaitView(el);

            const editingCell = queryView(el, '.cell.editing') as HTMLElement;
            editingCell.textContent = 'should not save';

            // Press Escape
            editingCell.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
            await awaitView(el);

            // Verify edit mode exited
            expect(el.editCtrl.isEditing).to.be.false;

            // Verify NO cell-edit event was dispatched (edit was cancelled)
            expect(editSpy).not.toHaveBeenCalled();

            // Verify original value is preserved
            expect(el.table!.rows[0][0]).to.equal('value1');
        });
    });

    describe('Multiline Edit', () => {
        it('inserts newline on Alt+Enter', async () => {
            const el = await fixture<SpreadsheetTable>(
                html`<spreadsheet-table .table="${createMockTable()}"></spreadsheet-table>`
            );
            await awaitView(el);

            // Enter edit mode
            const cell = queryView(el, '.cell[data-row="0"][data-col="0"]') as HTMLElement;
            cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
            await awaitView(el);

            const editingCell = queryView(el, '.cell.editing') as HTMLElement;

            // Mock selection API for Alt+Enter
            const range = document.createRange();
            range.setStart(editingCell, 0);
            range.collapse(true);
            const mockSelection = {
                rangeCount: 1,
                getRangeAt: () => range,
                removeAllRanges: vi.fn(),
                addRange: vi.fn()
            };
            vi.spyOn(window, 'getSelection').mockReturnValue(mockSelection as unknown as Selection);

            // Press Alt+Enter
            editingCell.dispatchEvent(
                new KeyboardEvent('keydown', {
                    key: 'Enter',
                    altKey: true,
                    bubbles: true,
                    composed: true,
                    cancelable: true
                })
            );
            await awaitView(el);

            // Should still be in edit mode (Alt+Enter inserts newline, doesn't commit)
            expect(el.editCtrl.isEditing).to.be.true;

            // Verify BR was inserted
            const brElements = editingCell.querySelectorAll('br');
            expect(brElements.length).to.be.greaterThan(0);
        });

        it('preserves existing newlines on edit', async () => {
            const table = createMockTable();
            table.rows[0][0] = 'line1\nline2';

            const el = await fixture<SpreadsheetTable>(html`<spreadsheet-table .table="${table}"></spreadsheet-table>`);
            await awaitView(el);

            // Verify cell displays with newline (as <br>)
            const cell = queryView(el, '.cell[data-row="0"][data-col="0"]') as HTMLElement;
            expect(cell.innerHTML).to.include('<br>');

            // Enter edit mode
            cell.focus();
            cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
            await awaitView(el);

            const editingCell = queryView(el, '.cell.editing') as HTMLElement;

            // Commit without changes
            editingCell.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));
            await awaitView(el);

            // Verify newline is preserved
            expect(el.table!.rows[0][0]).to.include('\n');
        });
    });
});
