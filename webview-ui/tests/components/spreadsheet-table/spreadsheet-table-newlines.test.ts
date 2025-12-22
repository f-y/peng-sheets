import { describe, it, expect } from 'vitest';
import { queryView, awaitView } from '../../helpers/test-helpers';
import { SpreadsheetTable } from '../../../components/spreadsheet-table';
import '../../../components/spreadsheet-table';

describe('SpreadsheetTable Edit Rendering', () => {
    it('renders single trailing newline correctly in edit mode', async () => {
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

        // Enter edit mode
        element.editCtrl.startEditing(element.table.rows[0][0]);
        await awaitView(element);

        const editingCell = queryView(element, '.cell.editing') as HTMLElement;
        expect(editingCell).to.exist;

        // Check HTML - now uses <br> instead of \n for better contenteditable behavior
        console.log('Editing InnerHTML:', editingCell.innerHTML);

        // We expect "Bob<br>" + optional ZWS for caret positioning
        expect(editingCell.innerHTML).toContain('Bob<br>');

        document.body.removeChild(element);
    });
});
