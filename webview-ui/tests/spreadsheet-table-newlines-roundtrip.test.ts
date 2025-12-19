import { describe, it, expect, vi } from 'vitest';
import { SpreadsheetTable } from '../components/spreadsheet-table';

describe('SpreadsheetTable Roundtrip Newlines', () => {
    it('captures newlines from BR tags correctly on commit', async () => {
        const element = new SpreadsheetTable();
        document.body.appendChild(element);
        element.table = {
            name: 'Test',
            description: '',
            headers: ['A'],
            rows: [['Original']],
            metadata: {},
            start_line: 0,
            end_line: 0
        };
        element.sheetIndex = 0;
        element.tableIndex = 0;
        await element.updateComplete;

        // Select cell and enter edit mode
        element.selectionCtrl.selectCell(0, 0);
        await element.updateComplete;

        element.editCtrl.startEditing('Original');
        await element.updateComplete;

        const cell = element.shadowRoot?.querySelector('.cell.editing') as HTMLElement;
        expect(cell).to.exist;

        // Listen for cell-edit event
        const spy = vi.fn();
        element.addEventListener('cell-edit', spy);

        // Simulate what happens when user types multiple lines in contenteditable
        // Browsers insert <br> for line breaks
        cell.innerHTML = 'Line1<br>Line2';

        // Commit with Enter key
        cell.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));
        await element.updateComplete;

        // Verify the committed value has newlines correctly extracted
        expect(spy).toHaveBeenCalled();
        const detail = spy.mock.calls[0][0].detail;
        expect(detail.newValue).toBe('Line1\nLine2');

        document.body.removeChild(element);
    });

    it('captures newlines from DIV elements correctly on commit', async () => {
        const element = new SpreadsheetTable();
        document.body.appendChild(element);
        element.table = {
            name: 'Test',
            description: '',
            headers: ['A'],
            rows: [['Original']],
            metadata: {},
            start_line: 0,
            end_line: 0
        };
        element.sheetIndex = 0;
        element.tableIndex = 0;
        await element.updateComplete;

        element.selectionCtrl.selectCell(0, 0);
        await element.updateComplete;

        element.editCtrl.startEditing('Original');
        await element.updateComplete;

        const cell = element.shadowRoot?.querySelector('.cell.editing') as HTMLElement;
        expect(cell).to.exist;

        const spy = vi.fn();
        element.addEventListener('cell-edit', spy);

        // Chrome often wraps lines in <div> elements
        cell.innerHTML = '<div>LineA</div><div>LineB</div>';

        // Commit
        cell.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));
        await element.updateComplete;

        expect(spy).toHaveBeenCalled();
        const detail = spy.mock.calls[0][0].detail;
        expect(detail.newValue).toBe('LineA\nLineB');

        document.body.removeChild(element);
    });
});
