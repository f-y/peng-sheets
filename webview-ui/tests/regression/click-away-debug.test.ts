import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { queryView, awaitView } from '../helpers/test-helpers';

// Mock dependencies
vi.mock('../utils/i18n', () => ({
    t: (key: string) => key
}));

describe('Deep Debug: Click-away save issue', () => {
    let element: HTMLElement;
    let container: HTMLElement;

    beforeEach(async () => {
        await import('../../components/spreadsheet-table');
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

    it('should trace the exact flow when typing "4" and clicking away', async () => {
        const table = element as any;
        await awaitView(table);

        // Step 1: Click cell to select
        const cell00 = queryView(table, '.cell[data-row="0"][data-col="0"]') as HTMLElement;
        expect(cell00).toBeTruthy();

        console.log('=== STEP 1: Before click ===');
        console.log('selectedRow:', table.selectionCtrl.selectedRow);
        console.log('isEditing:', table.editCtrl.isEditing);
        console.log('cell innerHTML:', cell00.innerHTML);

        cell00.click();
        await awaitView(table);

        console.log('=== STEP 1: After click ===');
        console.log('selectedRow:', table.selectionCtrl.selectedRow);
        console.log('isEditing:', table.editCtrl.isEditing);
        console.log('cell innerHTML:', cell00.innerHTML);

        expect(table.selectionCtrl.selectedRow).toBe(0);
        expect(table.selectionCtrl.selectedCol).toBe(0);

        // Step 2: Type "4" - dispatching keydown
        console.log('=== STEP 2: Before keydown ===');
        console.log('isEditing:', table.editCtrl.isEditing);
        console.log('pendingEditValue:', table.editCtrl.pendingEditValue);
        console.log('isReplacementMode:', table.editCtrl.isReplacementMode);

        cell00.dispatchEvent(new KeyboardEvent('keydown', { key: '4', bubbles: true, composed: true }));
        await awaitView(table);

        console.log('=== STEP 2: After keydown + updateComplete ===');
        console.log('isEditing:', table.editCtrl.isEditing);
        console.log('pendingEditValue:', table.editCtrl.pendingEditValue);
        console.log('isReplacementMode:', table.editCtrl.isReplacementMode);

        // Get the editing cell (may be different element after re-render)
        const editingCell = queryView(table, '.cell.editing') as HTMLElement;
        console.log('editingCell found:', !!editingCell);
        console.log('editingCell innerHTML:', editingCell?.innerHTML);
        console.log('editingCell textContent:', editingCell?.textContent);

        expect(table.editCtrl.isEditing).toBe(true);
        expect(table.editCtrl.isReplacementMode).toBe(true);

        // Step 3: Click another cell
        console.log('=== STEP 3: Before click cell01 ===');
        const cell01 = queryView(table, '.cell[data-row="0"][data-col="1"]') as HTMLElement;
        expect(cell01).toBeTruthy();

        console.log('table.rows[0][0] before click:', table.table.rows[0][0]);
        console.log('isEditing before click:', table.editCtrl.isEditing);
        console.log('pendingEditValue before click:', table.editCtrl.pendingEditValue);

        // Simulate click via mousedown - this triggers _onCellMousedown which commits
        cell01.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true, button: 0 }));
        window.dispatchEvent(new MouseEvent('mouseup'));
        await awaitView(table);

        console.log('=== STEP 3: After click cell01 ===');
        console.log('table.rows[0][0] after click:', table.table.rows[0][0]);
        console.log('isEditing after click:', table.editCtrl.isEditing);
        console.log('pendingEditValue after click:', table.editCtrl.pendingEditValue);

        // Verify
        expect(table.table.rows[0][0]).toBe('4');
    });
});
