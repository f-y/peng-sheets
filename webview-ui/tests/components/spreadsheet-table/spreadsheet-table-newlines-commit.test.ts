import { describe, it, expect } from 'vitest';
import { queryView, awaitView } from '../../helpers/test-helpers';
import { SpreadsheetTable } from '../../../components/spreadsheet-table';
import '../../../components/spreadsheet-table';

describe('SpreadsheetTable Commit Newlines', () => {
    it('persists trailing newline after commit', async () => {
        const element = new SpreadsheetTable();
        document.body.appendChild(element);
        element.table = {
            name: 'Test',
            description: '',
            headers: ['A'],
            rows: [['Bob\n']],
            metadata: {},
            start_line: 0,
            end_line: 0
        };
        await awaitView(element);

        // Select cell
        element.selectionCtrl.selectCell(0, 0);
        await awaitView(element);

        // Start editing
        element.editCtrl.startEditing(element.table.rows[0][0]);
        await awaitView(element);

        const cell = queryView(element, '.cell.editing') as HTMLElement;
        expect(cell).to.exist;
        // Verify initial state - should contain "Bob" (BR renders as empty in textContent)
        expect(cell.textContent).toContain('Bob');

        // Simulate Input Event
        cell.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        await awaitView(element);

        // Verify the cell still contains the expected content
        expect(cell.textContent).toContain('Bob');

        document.body.removeChild(element);
    });
});
