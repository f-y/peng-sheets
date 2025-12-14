
import { describe, it, expect } from 'vitest';
import { fixture, html, oneEvent } from '@open-wc/testing';
import '../components/spreadsheet-table';
import { SpreadsheetTable } from '../components/spreadsheet-table';
import { TableJSON } from '../components/spreadsheet-table';

describe('SpreadsheetTable Selection', () => {
    const mockTable: TableJSON = {
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
    };

    it('handles single cell selection', async () => {
        const el = await fixture<SpreadsheetTable>(html`<spreadsheet-table .table="${mockTable}"></spreadsheet-table>`);
        await el.updateComplete;

        const cell = el.shadowRoot!.querySelector('.cell[data-row="0"][data-col="0"]') as HTMLElement;
        cell.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true, button: 0 }));

        expect(el.selectedRow).to.equal(0);
        expect(el.selectedCol).to.equal(0);
        expect(el.selectionAnchorRow).to.equal(0);
        expect(el.selectionAnchorCol).to.equal(0);
        expect(el.isSelecting).to.be.true;

        window.dispatchEvent(new MouseEvent('mouseup'));
        expect(el.isSelecting).to.be.false;
    });

    it('handles drag selection (range)', async () => {
        const el = await fixture<SpreadsheetTable>(html`<spreadsheet-table .table="${mockTable}"></spreadsheet-table>`);
        await el.updateComplete;

        // Start at 0,0
        const startCell = el.shadowRoot!.querySelector('.cell[data-row="0"][data-col="0"]') as HTMLElement;
        startCell.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true, button: 0 }));

        expect(el.selectionAnchorRow).to.equal(0);
        expect(el.selectionAnchorCol).to.equal(0);

        // Move to 1,1
        // We simulate global mousemove. Target needs to be a cell.
        const targetCell = el.shadowRoot!.querySelector('.cell[data-row="1"][data-col="1"]') as HTMLElement;

        // Dispatch mousemove on window, but with target as the cell (simulated via composedPath if possible, or just checking logic)
        // The handler uses `e.target` which is tricky to mock on window event dispatch in JSDOM if not trusted.
        // But our implementation checks `e.target` of the event.
        // Let's try dispatching on the cell and letting it bubble? 
        // No, the listener is on `window`.

        // We can manually call the private handler for testing logic if needed, but integration is better.
        // Let's create a custom event that bubbles to window?
        // Or better: dispatch mousemove on the *targetCell*, and since bubbles:true, it reaches window.
        targetCell.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, composed: true }));

        expect(el.selectedRow).to.equal(1);
        expect(el.selectedCol).to.equal(1);
        expect(el.selectionAnchorRow).to.equal(0); // Anchor should not change

        // Verify visual classes
        await el.updateComplete;
        const cell01 = el.shadowRoot!.querySelector('.cell[data-row="0"][data-col="1"]');
        expect(cell01?.classList.contains('selected-range')).to.be.true;
        expect(cell01?.classList.contains('range-top')).to.be.true; // Top row
        expect(cell01?.classList.contains('range-right')).to.be.true; // Right col

        const cell10 = el.shadowRoot!.querySelector('.cell[data-row="1"][data-col="0"]');
        expect(cell10?.classList.contains('selected-range')).to.be.true;
        expect(cell10?.classList.contains('range-bottom')).to.be.true; // Bottom row
        expect(cell10?.classList.contains('range-left')).to.be.true; // Left col

        const cell00 = el.shadowRoot!.querySelector('.cell[data-row="0"][data-col="0"]');
        expect(cell00?.classList.contains('range-top')).to.be.true;
        expect(cell00?.classList.contains('range-left')).to.be.true;

        const cell11 = el.shadowRoot!.querySelector('.cell[data-row="1"][data-col="1"]');
        expect(cell11?.classList.contains('active-cell-no-outline')).to.be.true; // Current Active (No outline in range)
        expect(cell11?.classList.contains('selected-range')).to.be.true;
        expect(cell11?.classList.contains('range-bottom')).to.be.true;
        expect(cell11?.classList.contains('range-right')).to.be.true;

        // Cell 2,2 (outside)
        const cell22 = el.shadowRoot!.querySelector('.cell[data-row="2"][data-col="2"]');
        expect(cell22?.classList.contains('selected-range')).to.be.false;

        // Finish
        window.dispatchEvent(new MouseEvent('mouseup'));
        expect(el.isSelecting).to.be.false;
    });

    it('handles row drag selection', async () => {
        const el = await fixture<SpreadsheetTable>(html`<spreadsheet-table .table="${mockTable}"></spreadsheet-table>`);
        await el.updateComplete;

        // MouseDown on Row Header 0
        const rowHeader0 = el.shadowRoot!.querySelector('.cell.header-row[data-row="0"]') as HTMLElement;
        rowHeader0.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true, button: 0 }));

        expect(el.selectionAnchorRow).to.equal(0);
        expect(el.selectionAnchorCol).to.equal(-2);

        // MouseMove to Row Header 1 (Simulated global move)
        const rowHeader1 = el.shadowRoot!.querySelector('.cell.header-row[data-row="1"]') as HTMLElement;
        rowHeader1.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, composed: true }));

        expect(el.selectedRow).to.equal(1);
        expect(el.selectedCol).to.equal(-2);

        // Verify bounds classes
        await el.updateComplete;

        // Row 0 cells should be selected
        const cell00 = el.shadowRoot!.querySelector('.cell[data-row="0"][data-col="0"]');
        expect(cell00?.classList.contains('selected-range')).to.be.true;

        // Row 1 cells should be selected
        const cell10 = el.shadowRoot!.querySelector('.cell[data-row="1"][data-col="0"]');
        expect(cell10?.classList.contains('selected-range')).to.be.true;

        // Headers should be selected-range
        const headerRange0 = el.shadowRoot!.querySelector('.cell.header-row[data-row="0"]') as HTMLElement;
        const headerRange1 = el.shadowRoot!.querySelector('.cell.header-row[data-row="1"]') as HTMLElement;
        expect(headerRange0.classList.contains('selected-range')).to.be.true;
        expect(headerRange1.classList.contains('selected-range')).to.be.true;

        window.dispatchEvent(new MouseEvent('mouseup'));
    });

    it('handles column drag selection', async () => {
        const el = await fixture<SpreadsheetTable>(html`<spreadsheet-table .table="${mockTable}"></spreadsheet-table>`);
        await el.updateComplete;

        // MouseDown on Col Header 0
        const colHeader0 = el.shadowRoot!.querySelector('.cell.header-col[data-col="0"]') as HTMLElement;
        colHeader0.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true, button: 0 }));

        expect(el.selectionAnchorRow).to.equal(-2);
        expect(el.selectionAnchorCol).to.equal(0);

        // MouseMove to Col Header 1
        const colHeader1 = el.shadowRoot!.querySelector('.cell.header-col[data-col="1"]') as HTMLElement;
        colHeader1.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, composed: true }));

        expect(el.selectedRow).to.equal(-2);
        expect(el.selectedCol).to.equal(1);

        // Verify bounds classes
        await el.updateComplete;

        // Col 0 cells should be selected
        const cell00 = el.shadowRoot!.querySelector('.cell[data-row="0"][data-col="0"]');
        expect(cell00?.classList.contains('selected-range')).to.be.true;

        // Col 1 cells should be selected
        const cell01 = el.shadowRoot!.querySelector('.cell[data-row="0"][data-col="1"]');
        expect(cell01?.classList.contains('selected-range')).to.be.true;

        // Headers should be selected-range
        const headerRange0 = el.shadowRoot!.querySelector('.cell.header-col[data-col="0"]') as HTMLElement;
        const headerRange1 = el.shadowRoot!.querySelector('.cell.header-col[data-col="1"]') as HTMLElement;
        expect(headerRange0.classList.contains('selected-range')).to.be.true;
        expect(headerRange1.classList.contains('selected-range')).to.be.true;

        window.dispatchEvent(new MouseEvent('mouseup'));
    });

    it('handles ghost row selection and paste event', async () => {
        const el = await fixture<SpreadsheetTable>(html`<spreadsheet-table .table="${mockTable}"></spreadsheet-table>`);
        await el.updateComplete;

        const ghostRowIndex = mockTable.rows.length; // 3
        const ghostHeader = el.shadowRoot!.querySelector(`.cell.header-row[data-row="${ghostRowIndex}"]`) as HTMLElement;

        // Click Ghost Row Header
        ghostHeader.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
        await el.updateComplete;

        expect(el.selectedRow).to.equal(ghostRowIndex);
        expect(el.selectedCol).to.equal(-2); // Full row selection

        // Verify Ghost Cells are visually selected (as a range)
        const ghostCell0 = el.shadowRoot!.querySelector(`.cell[data-row="${ghostRowIndex}"][data-col="0"]`);
        expect(ghostCell0?.classList.contains('selected-range')).to.be.true;
        expect(ghostCell0?.classList.contains('range-top')).to.be.true;
        expect(ghostCell0?.classList.contains('range-bottom')).to.be.true;
        expect(ghostCell0?.classList.contains('range-left')).to.be.true;

        // Verify Paste Event dispatch
        let pasteEvent: CustomEvent | undefined;
        el.addEventListener('paste-cells', (e) => { pasteEvent = e as CustomEvent; });

        // Mock Clipboard
        Object.defineProperty(navigator, 'clipboard', {
            value: {
                readText: () => Promise.resolve("New\tRow")
            },
            configurable: true
        });

        // Trigger Paste
        // Dispatch keydown ON THE HEADER (since it now has tabindex and focus)
        ghostHeader.focus();
        await ghostHeader.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', ctrlKey: true, bubbles: true, composed: true }));

        // Wait for async clipboard
        await new Promise(r => setTimeout(r, 20));

        expect(pasteEvent).to.exist;
        expect(pasteEvent?.detail.startRow).to.equal(ghostRowIndex);
        expect(pasteEvent?.detail.startCol).to.equal(0);
        expect(pasteEvent?.detail.data).to.deep.equal([["New", "Row"]]);
    });
});
