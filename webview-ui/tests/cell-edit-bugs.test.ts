import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies
vi.mock('../utils/i18n', () => ({
    t: (key: string) => key
}));

describe('Cell Edit Bugs - User Reproduction Steps', () => {
    let element: HTMLElement;
    let container: HTMLElement;

    beforeEach(async () => {
        await import('../components/spreadsheet-table');
        container = document.createElement('div');
        document.body.appendChild(container);

        element = document.createElement('spreadsheet-table') as HTMLElement;
        (element as any).table = {
            name: 'test',
            rows: [['3', 'World'], ['Foo', 'Bar']],
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

    describe('Bug 1: Empty cell should not save <br>', () => {
        it('should save empty string when cell content is cleared and Enter is pressed', async () => {
            const table = element as any;
            await table.updateComplete;

            // Double-click cell with "3" to edit
            const cell00 = table.shadowRoot?.querySelector('.cell[data-row="0"][data-col="0"]') as HTMLElement;
            expect(cell00).toBeTruthy();
            cell00.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
            await table.updateComplete;

            expect(table.editCtrl.isEditing).toBe(true);

            // Get the editing cell and clear its content (simulating backspace)
            const editingCell = table.shadowRoot?.querySelector('.cell.editing') as HTMLElement;
            expect(editingCell).toBeTruthy();

            // Clear the content
            editingCell.innerHTML = '';
            editingCell.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
            await table.updateComplete;

            // Press Enter to commit
            editingCell.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));
            await table.updateComplete;

            // The value should be empty string, NOT <br>
            expect(table.table.rows[0][0]).toBe('');
        });
    });

    describe('Bug 2: Click-away after direct keyboard input should save', () => {
        it('should save "4" when "3" cell is selected, 4 is typed, and another cell is clicked', async () => {
            const table = element as any;
            await table.updateComplete;

            // Click cell with "3" to select it
            const cell00 = table.shadowRoot?.querySelector('.cell[data-row="0"][data-col="0"]') as HTMLElement;
            expect(cell00).toBeTruthy();
            cell00.click();
            await table.updateComplete;

            // Verify cell is selected
            expect(table.selectionCtrl.selectedRow).toBe(0);
            expect(table.selectionCtrl.selectedCol).toBe(0);
            expect(table.editCtrl.isEditing).toBe(false);

            // Type "4" directly (this should start editing in replacement mode)
            cell00.dispatchEvent(new KeyboardEvent('keydown', { key: '4', bubbles: true, composed: true }));
            await table.updateComplete;

            // Now it should be in editing mode with pendingEditValue = '4'
            expect(table.editCtrl.isEditing).toBe(true);
            expect(table.editCtrl.pendingEditValue).toBe('4');

            // Click another cell
            const cell01 = table.shadowRoot?.querySelector('.cell[data-row="0"][data-col="1"]') as HTMLElement;
            expect(cell01).toBeTruthy();
            cell01.click();
            await table.updateComplete;

            // The value should be "4", NOT "3"
            expect(table.table.rows[0][0]).toBe('4');
        });
    });
});
