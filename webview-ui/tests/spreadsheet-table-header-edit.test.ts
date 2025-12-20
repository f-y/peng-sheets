import { describe, it, expect } from 'vitest';
import { fixture, html } from '@open-wc/testing';
import { SpreadsheetTable } from '../components/spreadsheet-table';
import '../components/spreadsheet-table';
import { queryView, awaitView } from './test-helpers';

describe('SpreadsheetTable Header Edit', () => {
    it('Enters edit mode on empty header double click', async () => {
        const el = (await fixture(html` <spreadsheet-table></spreadsheet-table> `)) as SpreadsheetTable;

        // Simulate Table with 1 existing col and 1 "added" empty col
        const tableData = {
            name: 'Test',
            description: null,
            headers: ['A', ''], // Second one is empty
            rows: [['1', '2']],
            metadata: {},
            start_line: 0,
            end_line: 5
        };

        el.table = tableData;
        await awaitView(el);

        // Find the empty header (index 1)
        const emptyHeaderSpan = queryView(el, '.cell.header-col[data-col="1"] .cell-content') as HTMLElement;
        expect(emptyHeaderSpan).toBeTruthy();

        // Double Click
        emptyHeaderSpan.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
        await awaitView(el);

        expect(el.editCtrl.isEditing).toBe(true);
        expect(el.selectionCtrl.selectedCol).toBe(1);
        expect(el.selectionCtrl.selectedRow).toBe(-1);

        // Check if contenteditable is set
        expect(emptyHeaderSpan.getAttribute('contenteditable')).toBe('true');
    });
});
