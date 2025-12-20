import { describe, it, expect, vi } from 'vitest';
import { fixture, html } from '@open-wc/testing';
import { SpreadsheetTable } from '../../../components/spreadsheet-table';
import '../../../components/spreadsheet-table';
import { getDOMText } from '../../../utils/spreadsheet-helpers';
import { queryView, awaitView } from '../../helpers/test-helpers';

describe('SpreadsheetTable Backspace at Trailing Newline', () => {
    it('should delete newline when pressing Backspace at end of cell with trailing newline', async () => {
        // Setup: Create a spreadsheet table with a cell containing "Bob\n"
        const el = await fixture<SpreadsheetTable>(html`<spreadsheet-table></spreadsheet-table>`);
        el.table = {
            name: 'Test',
            description: '',
            headers: ['A'],
            rows: [['Bob\n']],
            metadata: {},
            start_line: 0,
            end_line: 0
        };
        await awaitView(el);

        // Start editing
        el.selectionCtrl.selectedRow = 0;
        el.selectionCtrl.selectedCol = 0;
        el.editCtrl.startEditing('Bob\n');
        await awaitView(el);

        const cell = queryView(el, '.cell.editing') as HTMLElement;
        expect(cell).to.exist;

        // Log initial state
        console.log('Before Backspace - innerHTML:', cell.innerHTML);
        console.log('Before Backspace - textContent:', JSON.stringify(cell.textContent));

        // Simulate placing caret at the end and pressing Backspace
        // First, we need to set up the selection at the end
        cell.focus();

        // Mock Selection API to position caret at end
        const lastChild = cell.lastChild;
        const range = document.createRange();

        if (lastChild) {
            if (lastChild.nodeType === Node.TEXT_NODE) {
                // Position at end of text node
                range.setStart(lastChild, (lastChild.textContent || '').length);
                range.setEnd(lastChild, (lastChild.textContent || '').length);
            } else {
                // Position after last element
                range.setStartAfter(lastChild);
                range.setEndAfter(lastChild);
            }
        }
        range.collapse(true);

        const mockSelection = {
            rangeCount: 1,
            getRangeAt: () => range,
            removeAllRanges: vi.fn(),
            addRange: vi.fn(),
            deleteFromDocument: vi.fn()
        };

        // Mock getSelection on shadowRoot
        (el.shadowRoot as any).getSelection = () => mockSelection;
        vi.spyOn(window, 'getSelection').mockReturnValue(mockSelection as unknown as Selection);

        // Dispatch Backspace keydown event
        const backspaceEvent = new KeyboardEvent('keydown', {
            key: 'Backspace',
            code: 'Backspace',
            bubbles: true,
            composed: true,
            cancelable: true
        });

        cell.dispatchEvent(backspaceEvent);
        await awaitView(el);

        // Log state after Backspace
        console.log('After Backspace - innerHTML:', cell.innerHTML);
        console.log('After Backspace - textContent:', JSON.stringify(cell.textContent));

        // Extract text using the helper
        const extractedText = getDOMText(cell, true);
        console.log('Extracted text:', JSON.stringify(extractedText));

        // Expected: The trailing newline should be deleted, resulting in "Bob"
        // Bug: Currently results in "Bob\n\n" (newline increases)

        // Count BR elements
        const brCount = cell.querySelectorAll('br').length;
        console.log('BR count after Backspace:', brCount);

        // EXPECTED BEHAVIOR: After Backspace at end of "Bob\n", result should be "Bob"
        // This means 0 BR elements (or at most extracted text = "Bob")
        expect(extractedText).to.equal('Bob');
    });
});
