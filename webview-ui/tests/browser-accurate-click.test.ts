import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { queryView, awaitView } from './test-helpers';

// Mock dependencies
vi.mock('../utils/i18n', () => ({
    t: (key: string) => key
}));

describe('Browser-accurate click-away test', () => {
    let element: HTMLElement;
    let container: HTMLElement;

    beforeEach(async () => {
        await import('../components/spreadsheet-table');
        container = document.createElement('div');
        document.body.appendChild(container);

        element = document.createElement('spreadsheet-table') as HTMLElement;
        (element as any).table = {
            name: 'test',
            rows: [
                ['3', 'World'],
                ['Foo', 'Bar']
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

    it('should save "4" with realistic mousedown → click sequence', async () => {
        const table = element as any;
        await awaitView(table);

        // Step 1: Click cell to select
        const cell00 = queryView(table, '.cell[data-row="0"][data-col="0"]') as HTMLElement;
        expect(cell00).toBeTruthy();
        cell00.click();
        await awaitView(table);

        expect(table.selectionCtrl.selectedRow).toBe(0);
        expect(table.selectionCtrl.selectedCol).toBe(0);

        // Step 2: Type "4" directly
        cell00.dispatchEvent(new KeyboardEvent('keydown', { key: '4', bubbles: true, composed: true }));
        await awaitView(table);

        expect(table.editCtrl.isEditing).toBe(true);
        expect(table.editCtrl.isReplacementMode).toBe(true);
        expect(table.editCtrl.pendingEditValue).toBe('4');

        // Step 3: Simulate realistic click on another cell with mousedown FIRST
        const cell01 = queryView(table, '.cell[data-row="0"][data-col="1"]') as HTMLElement;
        expect(cell01).toBeTruthy();

        // This is the realistic browser sequence:
        // 1. mousedown fires first (changes selection in current code)
        // 2. mouseup fires
        // 3. click fires (commits edit in current code)
        cell01.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true }));
        await awaitView(table);

        // After mousedown, selection may have changed but edit should still be pending
        console.log(
            'After mousedown: isEditing=',
            table.editCtrl.isEditing,
            'pendingEditValue=',
            table.editCtrl.pendingEditValue
        );

        cell01.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, composed: true }));
        await awaitView(table);

        cell01.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
        await awaitView(table);

        console.log('After click: table.rows[0][0] =', table.table.rows[0][0]);

        // The value should be "4", NOT "3"
        expect(table.table.rows[0][0]).toBe('4');
    });

    it('should save empty string when dblclick + backspace + Enter', async () => {
        const table = element as any;
        await awaitView(table);

        // Double-click cell with "3" to edit
        const cell00 = queryView(table, '.cell[data-row="0"][data-col="0"]') as HTMLElement;
        expect(cell00).toBeTruthy();
        cell00.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
        await awaitView(table);

        expect(table.editCtrl.isEditing).toBe(true);
        expect(table.editCtrl.isReplacementMode).toBe(false); // NOT replacement mode

        // Get the editing cell and clear its content (simulating backspace)
        const editingCell = queryView(table, '.cell.editing') as HTMLElement;
        expect(editingCell).toBeTruthy();

        console.log(
            'Before clear: innerHTML=',
            editingCell.innerHTML,
            'pendingEditValue=',
            table.editCtrl.pendingEditValue
        );

        // Clear the content
        editingCell.innerHTML = '';
        editingCell.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
        await awaitView(table);

        console.log(
            'After clear: innerHTML=',
            editingCell.innerHTML,
            'pendingEditValue=',
            table.editCtrl.pendingEditValue
        );

        // Press Enter to commit
        editingCell.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));
        await awaitView(table);

        console.log('After Enter: table.rows[0][0] =', table.table.rows[0][0], 'isEditing=', table.editCtrl.isEditing);

        // The value should be empty string
        expect(table.table.rows[0][0]).toBe('');
    });
});
