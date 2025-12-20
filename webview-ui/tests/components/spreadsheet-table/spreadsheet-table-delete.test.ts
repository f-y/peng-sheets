import { describe, it, expect } from 'vitest';
import { queryView, awaitView } from '../../helpers/test-helpers';
import { SpreadsheetTable } from '../../../components/spreadsheet-table';
import { fixture, html } from '@open-wc/testing';

describe('SpreadsheetTable Delete Operations', () => {
    it('deletes row when Delete key is pressed on Row Header', async () => {
        const el = await fixture<SpreadsheetTable>(html`<spreadsheet-table></spreadsheet-table>`);
        el.table = {
            name: 'Test',
            description: '',
            headers: ['A', 'B'],
            rows: [
                ['1', '2'],
                ['3', '4']
            ],
            metadata: {},
            start_line: 0,
            end_line: 0
        };
        await awaitView(el);

        let deleteEventFired = false;
        el.addEventListener('row-delete', () => {
            deleteEventFired = true;
        });

        // 1. Click Row Header (Row 0) - use queryView to access View's shadow DOM
        let rowHeader = queryView(el, '.cell.header-row[data-row="0"]') as HTMLElement;
        expect(rowHeader).to.exist;

        rowHeader.click();
        rowHeader.focus();
        await awaitView(el);

        expect(el.selectionCtrl.selectedRow).to.equal(0);
        expect(el.selectionCtrl.selectedCol).to.equal(-2);

        // Re-query after potential re-render
        rowHeader = queryView(el, '.cell.header-row[data-row="0"]') as HTMLElement;

        // 2. Press Delete on Row Header
        rowHeader.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, composed: true }));
        await awaitView(el);

        // Expectation: Row Delete event fired
        expect(deleteEventFired, 'Row Delete event should fire').to.be.true;
    });

    it('handles column delete/clear when Delete key is pressed on Column Header', async () => {
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
        await awaitView(el);

        let colClearFired = false;
        el.addEventListener('column-clear', () => {
            colClearFired = true;
        });

        // 1. Click Column Header (Col 0) - use queryView to access View's shadow DOM
        const colHeader = queryView(el, '.cell.header-col[data-col="0"]') as HTMLElement;
        expect(colHeader).to.exist;

        colHeader.click();
        colHeader.focus();
        await awaitView(el);

        // Verify selection
        expect(el.selectionCtrl.selectedRow).to.equal(-2);
        expect(el.selectionCtrl.selectedCol).to.equal(0);

        // 2. Press Delete on Column Header
        colHeader.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, composed: true }));
        await awaitView(el);

        // Expectation: Column Clear event should fire
        expect(colClearFired, 'column-clear should fire').to.be.true;

        // Expectation: Data in the column is cleared
        expect(el.table.rows[0][0], 'Row 0 Col 0 should be empty').to.equal('');
        expect(el.table.rows[0][1], 'Row 0 Col 1 should remain "2"').to.equal('2');
    });
});
