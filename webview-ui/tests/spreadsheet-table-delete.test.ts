import { describe, it, expect } from 'vitest';
import { SpreadsheetTable } from '../components/spreadsheet-table';
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
        await el.updateComplete;

        console.log('Element:', el);
        console.log('ShadowRoot:', el.shadowRoot);
        console.log('RenderRoot:', el.renderRoot);

        let deleteEventFired = false;
        el.addEventListener('row-delete', () => {
            deleteEventFired = true;
        });

        // 1. Click Row Header (Row 0)
        let root = el.renderRoot || el.shadowRoot;
        if (!root) throw new Error('No render root');

        let rowHeader = root.querySelector('.cell.header-row[data-row="0"]') as HTMLElement;
        console.log('RowHeader:', rowHeader);
        expect(rowHeader).to.exist;

        rowHeader.click();
        rowHeader.focus(); // Explicit focus for test
        await el.updateComplete;

        expect(el.selectionCtrl.selectedRow).to.equal(0);
        expect(el.selectionCtrl.selectedCol).to.equal(-2);

        // Re-query in case of re-render
        root = el.renderRoot || el.shadowRoot;
        rowHeader = root.querySelector('.cell.header-row[data-row="0"]') as HTMLElement;

        // 2. Press Delete on Row Header
        // Note: dispatching on element simulates bubbling if listener is attached to element or parent.
        rowHeader.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, composed: true }));
        await el.updateComplete;

        // Expectation: Row Delete event fired
        expect(deleteEventFired, 'Row Delete event should fire').to.be.true;
    });

    it('handles column delete/clear when Delete key is pressed on Column Header', async () => {
        // Manual setup for JSDOM compatibility
        const el = new SpreadsheetTable();
        document.body.appendChild(el);

        el.table = {
            name: 'Test',
            description: '',
            headers: ['A', 'B'],
            rows: [['1', '2']],
            metadata: {},
            start_line: 0,
            end_line: 0
        };
        await el.updateComplete;

        let colDeleteFired = false;
        let colClearFired = false;
        el.addEventListener('column-delete', () => {
            colDeleteFired = true;
            console.log('Fired: column-delete');
        });
        el.addEventListener('column-clear', () => {
            colClearFired = true;
            console.log('Fired: column-clear');
        });

        // 1. Click Column Header (Col 0)
        // Ensure shadowRoot exists (Lit creates it on connectedCallback)
        const root = el.shadowRoot;
        if (!root) throw new Error('No shadowRoot found');

        const colHeader = root.querySelector('.cell.header-col[data-col="0"]') as HTMLElement;
        expect(colHeader).to.exist;

        // Dispatch click
        colHeader.click();
        await el.updateComplete;

        // Verify selection
        expect(el.selectionCtrl.selectedRow).to.equal(-2);
        expect(el.selectionCtrl.selectedCol).to.equal(0);

        // 2. Press Delete on Column Header
        // IMPORTANT: In the bug scenario, the column header does NOT receive focus.
        // We simulate this by checking activeElement and dispatching there.

        let activeEl = el.shadowRoot!.activeElement;
        // If focus failed (bug), activeEl might be null or body (in light dom, here it's inside shadow).
        // If it's null, we dispatch on the 'root' or body if activeEl is missing?
        // In a shadow DOM context, activeElement within the shadow root is what we care about.
        // If nothing in the shadow root is focused, activeElement will be null.
        // If the host element itself is focused, activeElement will be null within the shadow root.
        // For this test, we expect the click to have set focus on the colHeader.
        // If it didn't, we'll dispatch on the document.body as a fallback to simulate a global keydown.
        if (!activeEl) activeEl = document.body;

        console.log('Active Element after click:', activeEl.tagName, activeEl.className);

        // Dispatch keydown on the ACTIVE ELEMENT to simulate real user behavior
        activeEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, composed: true }));
        await el.updateComplete;

        // Expectation: Column Clear event should fire
        expect(colClearFired, 'column-clear should fire').to.be.true;

        // Expectation: Data in the column is cleared
        // Check Row 0, Col 0 (which was "1")
        expect(el.table.rows[0][0], 'Row 0 Col 0 should be empty').to.equal('');
        // Check Row 0, Col 1 (which was "2", should be unchanged as we selected Col 0)
        expect(el.table.rows[0][1], 'Row 0 Col 1 should remain "2"').to.equal('2');

        // Cleanup
        document.body.removeChild(el);
    });
});
