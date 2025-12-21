import { describe, it, expect } from 'vitest';
import { fixture, html } from '@open-wc/testing';
import { SpreadsheetTable } from '../../components/spreadsheet-table';
import '../../components/spreadsheet-table';
import { queryView, awaitView } from '../helpers/test-helpers';

describe('SpreadsheetTable Alt+Enter', () => {
    it('inserts <br> and moves caret after it on Alt+Enter', async () => {
        const el = await fixture<SpreadsheetTable>(html`<spreadsheet-table></spreadsheet-table>`);
        el.table = {
            name: 'Test',
            headers: ['A'],
            rows: [['']],
            metadata: {},
            start_line: 0,
            end_line: 0
        };
        await awaitView(el);

        // 1. Start Editing
        // Force editing to ensure we test the specific logic
        el.selectionCtrl.selectedRow = 0;
        el.selectionCtrl.selectedCol = 0;
        el.editCtrl.startEditing('Alice');
        await awaitView(el);

        const cell = queryView(el, '.cell[data-row="0"][data-col="0"]') as HTMLElement;
        expect(cell).to.exist;

        // 2. Set initial text "Ali|ce" (Cursor at 3)
        // We need to manipulate Selection in Shadow DOM
        cell.innerText = 'Alice';
        const textNode = cell.firstChild as Text;

        // Focus and set selection
        cell.focus();

        // Mock getSelection on ShadowRoot for JSDOM
        const range = document.createRange();
        range.setStart(textNode, 3);
        range.setEnd(textNode, 3);

        const mockSelection = {
            rangeCount: 1,
            getRangeAt: (_index: number) => range,
            removeAllRanges: () => {},
            addRange: (_r: Range) => {}
        };

        // Mock on the VIEW's shadow root to verify Controller uses the correct root
        const view = el.shadowRoot!.querySelector('spreadsheet-table-view');
        (view!.shadowRoot as any).getSelection = () => mockSelection;

        // Also ensure window.getSelection doesn't interfere/is fallback
        // The component prefers root.getSelection, so this mock should win.

        // 3. Dispatch Alt+Enter
        const event = new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            altKey: true,
            bubbles: true,
            composed: true,
            cancelable: true
        });

        cell.focus();

        cell.dispatchEvent(event);
        await awaitView(el);

        // 4. Verify DOM
        // Should be "Ali<br>ce"
        expect(cell.innerHTML).to.contain('<br>');
        expect(cell.innerText.replace(/\n/g, '')).to.equal('Alice'); // Text content preserved

        // 5. Verify Caret Position
        // The range object itself should have been modified by the component

        // We expect the range to be collapsed
        expect(range.collapsed).to.be.true;

        // With "setStartAfter(br)", the container should be the parent (span/div) and offset should be index after BR.

        let brIndex = -1;
        // Re-query children as they changed
        const childNodes = Array.from(cell.childNodes);
        childNodes.forEach((node, i) => {
            if (node.nodeName === 'BR') brIndex = i;
        });
        expect(brIndex).to.not.equal(-1);

        // Expectation: Start container is parent (cell), offset is brIndex + 1 (after BR)
        // OR start container is the text node after BR, offset 0.
        // Our logs showed Container: DIV (which is cell), Offset: 2 (which is 1+1).

        const isAfterBr =
            (range.startContainer === cell && range.startOffset === brIndex + 1) ||
            (range.startContainer === cell.childNodes[brIndex + 1] && range.startOffset === 0);

        expect(isAfterBr).to.be.true;
    });

    it('Alt+Enter at end of text adds a persistent newline', async () => {
        const el = await fixture<SpreadsheetTable>(html`<spreadsheet-table></spreadsheet-table>`);
        el.table = {
            name: 'Test',
            headers: ['A'],
            rows: [['Alice']],
            metadata: {},
            start_line: 0,
            end_line: 0
        };
        await awaitView(el);

        // 1. Start Editing
        el.selectionCtrl.selectedRow = 0;
        el.selectionCtrl.selectedCol = 0;
        el.editCtrl.startEditing('Alice');
        await awaitView(el);

        const cell = queryView(el, '.cell[data-row="0"][data-col="0"]') as HTMLElement;
        const textNode = cell.firstChild as Text;

        // Focus and set selection to END ("Alice|")
        cell.focus();

        // Mock getSelection
        const range = document.createRange();
        range.setStart(textNode, 5);
        range.setEnd(textNode, 5);

        const mockSelection = {
            rangeCount: 1,
            getRangeAt: () => range,
            removeAllRanges: () => {},
            addRange: () => {}
        };
        // Mock on the VIEW's shadow root to verify Controller uses the correct root
        const view = el.shadowRoot!.querySelector('spreadsheet-table-view');
        (view!.shadowRoot as any).getSelection = () => mockSelection;

        // 3. Dispatch Alt+Enter
        const event = new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            altKey: true,
            bubbles: true,
            composed: true,
            cancelable: true
        });

        cell.dispatchEvent(event);
        await awaitView(el);

        // 4. Verify DOM
        // We expect Alice<br> followed by zero-width space for caret positioning
        console.log('End-Test DOM:', cell.innerHTML);

        const childNodes = Array.from(cell.childNodes);
        const brCount = childNodes.filter((n) => n.nodeName === 'BR').length;
        const hasZWS = cell.textContent?.includes('\u200B') === true;

        // With zero-width space approach, we expect 1 BR and a zero-width space
        expect(brCount).to.be.greaterThanOrEqual(1);
        expect(hasZWS).to.be.true;

        // Verify text extraction simulation (what _getDOMText does)
        // Helper to simulate _getDOMText logic locally - strips zero-width space
        const getDOMText = (node: Node): string => {
            if (node.nodeName === 'BR') return '\n';
            if (node.nodeType === Node.TEXT_NODE) {
                return (node.textContent || '').replace(/\u200B/g, '');
            }
            let t = '';
            node.childNodes.forEach((c) => (t += getDOMText(c)));
            return t;
        };

        let extracted = getDOMText(cell);
        if (extracted.endsWith('\n')) extracted = extracted.slice(0, -1);

        expect(extracted).to.equal('Alice');
    });
});
