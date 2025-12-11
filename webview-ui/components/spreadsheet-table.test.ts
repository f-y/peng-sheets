
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SpreadsheetTable } from './spreadsheet-table';

// Since we are checking logic, we can instantiate the class directly if we mock DOM bits,
// or use the CustomElementRegistry if running in JSDOM.
// JSDOM is active.

describe('SpreadsheetTable Deletion Logic', () => {
    let el: SpreadsheetTable;

    beforeEach(() => {
        // We can manually register if not already?
        if (!customElements.get('spreadsheet-table')) {
            customElements.define('spreadsheet-table', SpreadsheetTable);
        }
        el = new SpreadsheetTable();
        el.table = { rows: [['A1', 'B1'], ['A2', 'B2']], headers: ['H1', 'H2'] };
        document.body.appendChild(el);
    });

    afterEach(() => {
        document.body.removeChild(el);
    });

    it('Last Row Deletion: Dispatches range-edit with MAX_INT columns', async () => {
        // Setup: Table has 2 rows. Last row index is 1.
        // User selects Last Row (index 1) via Header Click (col = -2)
        el.selectedRow = 1;
        el.selectedCol = -2;

        let eventDetail: any = null;
        el.addEventListener('range-edit', (e: any) => {
            eventDetail = e.detail;
        });

        // Invoke delete selection
        // Private method access hack for testing
        (el as any)._deleteSelection();

        expect(eventDetail).not.toBeNull();
        // StartRow: 1, EndRow: 1
        expect(eventDetail.startRow).toBe(1);
        expect(eventDetail.endRow).toBe(1);

        // StartCol: 0
        expect(eventDetail.startCol).toBe(0);

        // EndCol: Should be MAX_SAFE_INTEGER to trigger "Full Row" logic in Python
        expect(eventDetail.endCol).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('Standard Row Deletion: Dispatches range-edit with MAX_INT columns', async () => {
        // Setup: Table has 2 rows. Select First Row (index 0).
        el.selectedRow = 0;
        el.selectedCol = -2;

        let eventDetail: any = null;
        el.addEventListener('range-edit', (e: any) => {
            eventDetail = e.detail;
        });

        (el as any)._deleteSelection();

        expect(eventDetail.endCol).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('Column Deletion: Dispatches range-edit with MAX_INT rows', async () => {
        // Select Column 0
        el.selectedRow = -2;
        el.selectedCol = 0;

        let eventDetail: any = null;
        el.addEventListener('range-edit', (e: any) => {
            eventDetail = e.detail;
        });

        (el as any)._deleteSelection();

        // Should select ALL rows
        expect(eventDetail.startRow).toBe(0);
        // EndRow should be at least row length - 1, or MAX?
        // Current implementation uses table.rows.length;
        // Let's check impl.
        // this._updateRange(0, rowCount - 1, ...)
        expect(eventDetail.endRow).toBe(1); // 2 rows -> index 1
    });

    it('Select All Deletion: Dispatches range-edit covering all', async () => {
        el.selectedRow = -2;
        el.selectedCol = -2;

        let eventDetail: any = null;
        el.addEventListener('range-edit', (e: any) => {
            eventDetail = e.detail;
        });

        (el as any)._deleteSelection();

        expect(eventDetail.startRow).toBe(0);
        expect(eventDetail.endRow).toBe(1);
        expect(eventDetail.startCol).toBe(0);
        // Current impl uses colCount - 1
        expect(eventDetail.endCol).toBe(1); // 2 cols -> index 1
    });

    it('Key Binding: Delete Key triggers Deletion on Cell', async () => {
        // 1. Select a cell
        el.selectedRow = 0;
        el.selectedCol = 0;
        await el.updateComplete;

        // 2. Mock range-edit listener
        let eventDetail: any = null;
        el.addEventListener('cell-edit', (e: any) => {
            eventDetail = e.detail;
        });

        // 3. Find the cell element and dispatch KeyDown
        // Need to query shadowRoot
        const cell = el.shadowRoot?.querySelector('div[data-row="0"][data-col="0"]');
        expect(cell).not.toBeNull();

        cell?.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Delete',
            bubbles: true,
            composed: true
        }));

        // 4. Assert
        expect(eventDetail).not.toBeNull();
        expect(eventDetail.newValue).toBe("");
    });

    it('Key Binding: Backspace Key triggers Deletion on Row Selection', async () => {
        // 1. Select Row 0
        el.selectedRow = 0;
        el.selectedCol = -2; // Row Header
        await el.updateComplete;

        let eventDetail: any = null;
        el.addEventListener('range-edit', (e: any) => {
            eventDetail = e.detail;
        });

        // Find Row Header or any cell in row?
        // Logic says: if selectedRow >= 0, Delete calls _deleteSelection.
        // The event listener is on the elements.
        // Ideally user clicks Row Header.
        const rowHeader = el.shadowRoot?.querySelector('div[class*="header-row"][data-row="0"]');
        expect(rowHeader).not.toBeNull();

        rowHeader?.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Backspace',
            bubbles: true,
            composed: true
        }));

        expect(eventDetail).not.toBeNull();
        expect(eventDetail.endCol).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('Navigation: Shift+Enter moves selection UP', async () => {
        // Start at Row 1, Col 0
        el.selectedRow = 1;
        el.selectedCol = 0;
        await el.updateComplete;

        (el as any)._handleNavigationKey(new KeyboardEvent('keydown', {
            key: 'Enter',
            shiftKey: true
        }));
        await el.updateComplete;

        expect(el.selectedRow).toBe(0);
        expect(el.selectedCol).toBe(0);
    });

    it('Navigation: Edit Mode Shift+Enter commits and moves UP', async () => {
        // Start at Row 1, Col 0
        el.selectedRow = 1;
        el.selectedCol = 0;
        await el.updateComplete;

        // Enter Edit Mode
        (el as any)._startEditing('Old Value');
        await el.updateComplete;

        // Verify editing state physically
        const editingCell = el.shadowRoot?.querySelector('.cell.editing');
        expect(editingCell).not.toBeNull();

        // Dispatch Shift+Enter on the input element inside the cell?
        // _handleEditModeKey is attached to window/document or cell?
        // In render: @keydown=${(e) => this._handleKeyDown(e)} on the cell div.
        // So we should dispatch on the editing cell.

        editingCell?.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Enter',
            shiftKey: true,
            bubbles: true,
            composed: true
        }));
        await el.updateComplete;

        expect(el.selectedRow).toBe(0);
        expect(el.selectedCol).toBe(0);
        expect((el as any).isEditing).toBe(false);
    });

    it('Navigation: Shift+Tab moves selection LEFT', async () => {
        // Start at Row 0, Col 1
        el.selectedRow = 0;
        el.selectedCol = 1;
        await el.updateComplete;

        (el as any)._handleKeyDown(new KeyboardEvent('keydown', {
            key: 'Tab',
            shiftKey: true
        }));
        await el.updateComplete;
        expect(el.selectedRow).toBe(0);
        expect(el.selectedCol).toBe(0);
    });



    it('Regression: Ghost Row Edit - Click Away Interaction (Commit & Selection)', async () => {
        // Setup: 2 rows. Ghost Row index = 2.
        el.table = {
            rows: [['A1', 'B1'], ['A2', 'B2']],
            headers: ['H1', 'H2'],
            name: 'Test',
            description: '',
            metadata: {},
            start_line: 0,
            end_line: 0
        };
        await el.updateComplete;

        // 1. Enter Edit Mode on Ghost Row
        el.selectedRow = 2;
        el.selectedCol = 0;
        await el.updateComplete;
        (el as any)._startEditing('Old');
        await el.updateComplete;

        const editingCell = el.shadowRoot?.querySelector('.cell.editing') as HTMLElement;
        expect(editingCell).not.toBeNull();

        // 2. User Types 'New'
        // Crucial: We must update innerText AND fire input (like real user)
        editingCell.innerText = 'New Content';
        editingCell.dispatchEvent(new Event('input', { bubbles: true, composed: true }));

        // 3. User clicks away (Mousedown on Row 0)
        // THIS IS THE MOMENT.
        // The mousedown handler runs. It updates selectedRow = 0.
        // This triggers requestUpdate().
        const cell00 = el.shadowRoot?.querySelector('div[data-row="0"][data-col="0"]');
        cell00?.dispatchEvent(new MouseEvent('mousedown', {
            bubbles: true,
            composed: true,
            buttons: 1
        }));

        // 4. Force Update (Simulate Render BEFORE Blur)
        // In the buggy scenario, Lit updates the DOM, wiping the Ghost Row (because selectedRow != 2 anymore).
        // The Ghost Row becomes empty text.
        await el.updateComplete;

        // 5. Blur happens LATE (after Render)
        editingCell.dispatchEvent(new FocusEvent('blur', {
            bubbles: false,
            composed: false
        }));

        await el.updateComplete;

        // 6. Verify Data Safely Saved
        expect(el.table?.rows.length).toBe(3);
        if (el.table?.rows.length === 3) {
            expect(el.table.rows[2][0]).toBe('New Content');
        }

        // 7. Verify Selection Moved
        expect(el.selectedRow).toBe(0);
        expect(el.selectedCol).toBe(0);
    });
});
