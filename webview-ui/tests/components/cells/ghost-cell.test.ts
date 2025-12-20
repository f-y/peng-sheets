import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SpreadsheetTable } from '../../../components/spreadsheet-table';
import '../../../components/spreadsheet-table';
import { queryView, awaitView } from '../../helpers/test-helpers';

// Mock dependencies
vi.mock('../utils/i18n', () => ({
    t: (key: string) => key
}));

describe('SpreadsheetTable Ghost Cell Bugs', () => {
    let element: SpreadsheetTable;
    let container: HTMLElement;

    beforeEach(async () => {
        await import('../../../components/spreadsheet-table');
        container = document.createElement('div');
        document.body.appendChild(container);

        element = document.createElement('spreadsheet-table') as SpreadsheetTable;
        element.table = {
            name: 'test',
            description: null,
            rows: [
                ['A1', 'B1'],
                ['A2', 'B2']
            ],
            headers: ['A', 'B'],
            metadata: {},
            start_line: null,
            end_line: null
        };
        container.appendChild(element);
        await awaitView(element);
    });

    afterEach(() => {
        container.remove();
        vi.restoreAllMocks();
    });

    it('should NOT show "undefined" when editing a ghost cell', async () => {
        // Ghost row is at index 2 (after 2 data rows)
        const ghostCell = queryView(element, '.cell[data-row="2"][data-col="0"]') as HTMLElement;
        expect(ghostCell).toBeTruthy();

        // Dispatch dblclick to start editing
        ghostCell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
        await awaitView(element);

        // Check content
        const editingCell = queryView(element, '.cell[data-row="2"][data-col="0"]') as HTMLElement;
        expect(editingCell.classList.contains('editing')).toBe(true);
        expect(editingCell.textContent?.trim()).toBe('');
        expect(editingCell.textContent).not.toContain('undefined');
        expect(editingCell.textContent).toBe('');
    });

    it('should navigate to ghost row when pressing ArrowDown from last row', async () => {
        // Select last row (index 1)
        element.selectionCtrl.selectCell(1, 0, false);
        await awaitView(element);

        // Simulate ArrowDown on the active cell
        const activeCell = queryView(element, '.cell[data-row="1"][data-col="0"]') as HTMLElement;
        expect(activeCell).toBeTruthy();
        const event = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true });
        activeCell.dispatchEvent(event);
        await awaitView(element);

        // Verify selection moved to Row 2 (Ghost Row)
        expect(element.selectionCtrl.selectedRow).toBe(2);
    });

    it('should navigate to ghost row when pressing Enter from last row', async () => {
        // Select last row (index 1)
        element.selectionCtrl.selectCell(1, 0, false);
        await awaitView(element);

        // Simulate Enter on the active cell
        const activeCell = queryView(element, '.cell[data-row="1"][data-col="0"]') as HTMLElement;
        expect(activeCell).toBeTruthy();
        const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true });
        activeCell.dispatchEvent(event);
        await awaitView(element);

        // Verify selection moved to Row 2 (Ghost Row)
        expect(element.selectionCtrl.selectedRow).toBe(2);
    });
});
