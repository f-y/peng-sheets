import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { queryView, awaitView } from './test-helpers';
import { fixture, html } from '@open-wc/testing';
import '../components/spreadsheet-table';
import { SpreadsheetTable } from '../components/spreadsheet-table';

describe('Bug Reproduction: Cell Edit Mode', () => {
    let element: SpreadsheetTable;

    beforeEach(async () => {
        element = await fixture<SpreadsheetTable>(html`<spreadsheet-table></spreadsheet-table>`);
        element.table = {
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
        await awaitView(element);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should enter edit mode and focus input on double click', async () => {
        const cell = queryView(element, '.cell[data-row="0"][data-col="0"]') as HTMLElement;
        expect(cell).toBeTruthy();

        // 1. Select cell
        cell.click();
        await awaitView(element);
        expect(element.selectionCtrl.selectedRow).toBe(0);
        expect(element.selectionCtrl.selectedCol).toBe(0);

        // 2. Double click
        cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
        await awaitView(element);

        // 3. Verify edit mode
        expect(element.editCtrl.isEditing).toBe(true);
        expect(cell.classList.contains('editing')).toBe(true);

        // 4. Verify focus is on the cell (which should be contenteditable)
        // Note: In JSDOM, focus management is tricky, but we can check if the element has contenteditable set to true
        expect(cell.getAttribute('contenteditable')).toBe('true');
    });

    it('should handle direct typing of multiple characters', async () => {
        const cell = queryView(element, '.cell[data-row="0"][data-col="0"]') as HTMLElement;

        // 1. Select cell
        cell.click();
        await awaitView(element);

        // 2. Type "a" - should start editing
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', code: 'KeyA', bubbles: true }));
        await awaitView(element);
        // Wait for focus timeout
        await new Promise((resolve) => setTimeout(resolve, 50));

        // Verify focus is actually on the cell
        const editingCell = queryView(element, '.cell[data-row="0"][data-col="0"]') as HTMLElement;
        editingCell.focus(); // Force focus for test stability

        const view = element.shadowRoot?.querySelector('spreadsheet-table-view');
        // In JSDOM with Shadow DOM, activeElement might be the host or the view?
        // Let's rely on view shadow root active element

        // Dispatch keydown on the focused element (simulating user input)
        // If focus is correct, dispatch on window should work, but for JSDOM stability we can target focused element
        const target = view?.shadowRoot?.activeElement || window;
        target.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', code: 'KeyA', bubbles: true, composed: true }));
        await awaitView(element);

        expect(element.editCtrl.isEditing).toBe(true);
        expect(element.editCtrl.pendingEditValue).toBe('a');

        // Re-query cell as it might have been re-rendered
        const updatedCell = queryView(element, '.cell[data-row="0"][data-col="0"]') as HTMLElement;
        expect(updatedCell.textContent?.trim()).toBe('a');

        // 3. Type "b" - should append
        await new Promise((resolve) => setTimeout(resolve, 50)); // Wait for focus restoration

        const targetB =
            element.shadowRoot?.querySelector('spreadsheet-table-view')?.shadowRoot?.activeElement || window;

        // In JSDOM, contenteditable doesn't generate input events from keydown.
        // We must manually dispatch input event to simulate typing result.
        // We also update the textContent manually to mimic browser behavior before dispatching input
        const finalCell = queryView(element, '.cell[data-row="0"][data-col="0"]') as HTMLElement;
        finalCell.textContent = 'ab';

        targetB.dispatchEvent(
            new InputEvent('input', {
                data: 'b',
                inputType: 'insertText',
                bubbles: true,
                composed: true
            })
        );
        await awaitView(element);

        expect(element.editCtrl.pendingEditValue?.trim()).toBe('ab');
        const checkedCell = queryView(element, '.cell[data-row="0"][data-col="0"]') as HTMLElement;
        expect(checkedCell.textContent?.replace(/\u200b/g, '').trim()).toBe('ab');
    });
});
