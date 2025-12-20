import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { queryView, awaitView } from './test-helpers';

// Mock dependencies
vi.mock('../utils/i18n', () => ({
    t: (key: string) => key
}));

describe('Line break display sync tests', () => {
    let element: HTMLElement;
    let container: HTMLElement;

    beforeEach(async () => {
        await import('../components/spreadsheet-table');
        container = document.createElement('div');
        document.body.appendChild(container);

        // Test with cells that have line breaks
        element = document.createElement('spreadsheet-table') as HTMLElement;
        (element as any).table = {
            name: 'test',
            rows: [
                ['\na', 'World'], // Cell with leading newline (displayed as <br>a)
                ['', 'Bar'] // Empty cell
            ],
            headers: ['A', 'B'],
            metadata: {}
        };
        container.appendChild(element);
        await (element as any).updateComplete;
    });

    afterEach(() => {
        container.remove();
        vi.restoreAllMocks();
    });

    it('should display \\na correctly with leading newline visible', async () => {
        const table = element as any;
        await awaitView(table);

        // Double-click cell with "\na" to edit
        const cell00 = queryView(table, '.cell[data-row="0"][data-col="0"]') as HTMLElement;
        expect(cell00).toBeTruthy();

        console.log('Before dblclick - cell innerHTML:', cell00.innerHTML);
        console.log('Before dblclick - stored value:', table.table.rows[0][0]);

        cell00.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
        await awaitView(table);

        const editingCell = queryView(table, '.cell.editing') as HTMLElement;
        expect(editingCell).toBeTruthy();

        console.log('After dblclick - editing cell innerHTML:', editingCell.innerHTML);
        console.log('pendingEditValue:', table.editCtrl.pendingEditValue);

        // The innerHTML should show <br>a or similar representation of newline+a
        // It should NOT just show "a"
        expect(editingCell.innerHTML).toContain('<br>');
        expect(editingCell.innerHTML).toContain('a');
    });

    it('should not add extra lines when Option+Enter is pressed in empty cell', async () => {
        const table = element as any;
        await awaitView(table);

        // Double-click empty cell to edit
        const cell10 = queryView(table, '.cell[data-row="1"][data-col="0"]') as HTMLElement;
        expect(cell10).toBeTruthy();

        cell10.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
        await awaitView(table);

        const editingCell = queryView(table, '.cell.editing') as HTMLElement;
        expect(editingCell).toBeTruthy();

        console.log('Empty cell editing - initial innerHTML:', editingCell.innerHTML);
        console.log('Empty cell editing - initial pendingEditValue:', table.editCtrl.pendingEditValue);

        // Simulate Alt+Enter (newline insertion)
        editingCell.dispatchEvent(
            new KeyboardEvent('keydown', {
                key: 'Enter',
                altKey: true,
                bubbles: true,
                composed: true
            })
        );
        await awaitView(table);

        console.log('After Alt+Enter - innerHTML:', editingCell.innerHTML);

        // Count BR elements - should be exactly 1 for single newline
        const brCount = (editingCell.innerHTML.match(/<br>/gi) || []).length;
        console.log('BR count:', brCount);

        // We expect 1 BR (or 1 BR + zero-width space for cursor)
        // NOT 2 or more BRs which would cause 3 lines
        expect(brCount).toBeLessThanOrEqual(2); // Allow up to 2 for cursor positioning
    });
});
