import { describe, it, expect, beforeEach } from 'vitest';
import { fixture, html } from '@open-wc/testing';
import '../components/spreadsheet-table';
import type { SpreadsheetTable } from '../components/spreadsheet-table';

describe('Shift+Click Range Selection on Headers', () => {
    let table: SpreadsheetTable;

    beforeEach(async () => {
        table = await fixture<SpreadsheetTable>(html`
            <spreadsheet-table
                .table="${{
                    headers: ['A', 'B', 'C', 'D', 'E'],
                    rows: [
                        ['1', '2', '3', '4', '5'],
                        ['a', 'b', 'c', 'd', 'e'],
                        ['x', 'y', 'z', 'w', 'v'],
                        ['p', 'q', 'r', 's', 't'],
                        ['i', 'j', 'k', 'l', 'm']
                    ],
                    metadata: {}
                }}"
            ></spreadsheet-table>
        `);
        await table.updateComplete;
    });

    describe('Row Header Shift+Click with realistic event flow', () => {
        it('should extend row selection with Shift+mousedown (browser realistic)', async () => {
            // First click row 2 (index 1) - normal click without shift
            const rowHeaders = table.shadowRoot!.querySelectorAll('.header-row');
            const row2Header = rowHeaders[1] as HTMLElement;

            // Send mousedown then click for first selection
            row2Header.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true }));
            row2Header.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
            await table.updateComplete;

            console.log(
                'After first click: anchor=',
                table.selectionCtrl.selectionAnchorRow,
                'selected=',
                table.selectionCtrl.selectedRow
            );

            // Verify initial selection
            expect(table.selectionCtrl.selectedRow).to.equal(1);
            expect(table.selectionCtrl.selectionAnchorRow).to.equal(1);

            // Shift+Click row 5 (index 4) - REALISTIC browser flow: mousedown THEN click
            const row5Header = rowHeaders[4] as HTMLElement;

            // In browser, mousedown fires BEFORE click
            row5Header.dispatchEvent(
                new MouseEvent('mousedown', {
                    bubbles: true,
                    composed: true,
                    shiftKey: true
                })
            );
            row5Header.dispatchEvent(
                new MouseEvent('click', {
                    bubbles: true,
                    composed: true,
                    shiftKey: true
                })
            );
            await table.updateComplete;

            console.log(
                'After shift+click: anchor=',
                table.selectionCtrl.selectionAnchorRow,
                'selected=',
                table.selectionCtrl.selectedRow
            );

            // Now selectedRow should be 4 (row 5), anchor should REMAIN 1
            expect(table.selectionCtrl.selectedRow).to.equal(4);
            expect(table.selectionCtrl.selectionAnchorRow).to.equal(1); // THIS IS THE KEY
            expect(table.selectionCtrl.selectedCol).to.equal(-2);
        });
    });

    describe('Column Header Shift+Click with realistic event flow', () => {
        it('should extend column selection with Shift+mousedown (browser realistic)', async () => {
            // First click column B (index 1)
            const colHeaders = table.shadowRoot!.querySelectorAll('.header-col');
            const colBHeader = colHeaders[1] as HTMLElement;

            // Send mousedown then click for first selection
            colBHeader.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true }));
            colBHeader.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
            await table.updateComplete;

            console.log(
                'After first col click: anchorCol=',
                table.selectionCtrl.selectionAnchorCol,
                'selectedCol=',
                table.selectionCtrl.selectedCol
            );

            // Verify initial selection
            expect(table.selectionCtrl.selectedCol).to.equal(1);
            expect(table.selectionCtrl.selectionAnchorCol).to.equal(1);

            // Shift+Click column E (index 4)
            const colEHeader = colHeaders[4] as HTMLElement;

            colEHeader.dispatchEvent(
                new MouseEvent('mousedown', {
                    bubbles: true,
                    composed: true,
                    shiftKey: true
                })
            );
            colEHeader.dispatchEvent(
                new MouseEvent('click', {
                    bubbles: true,
                    composed: true,
                    shiftKey: true
                })
            );
            await table.updateComplete;

            console.log(
                'After shift+click col: anchorCol=',
                table.selectionCtrl.selectionAnchorCol,
                'selectedCol=',
                table.selectionCtrl.selectedCol
            );

            // Now selectedCol should be 4 (column E), anchor should REMAIN 1
            expect(table.selectionCtrl.selectedCol).to.equal(4);
            expect(table.selectionCtrl.selectionAnchorCol).to.equal(1);
            expect(table.selectionCtrl.selectedRow).to.equal(-2);
        });
    });
});
