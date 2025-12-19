import { describe, it, expect } from 'vitest';
import { SpreadsheetTable } from '../components/spreadsheet-table';

describe('SpreadsheetTable Navigation', () => {
    it('Shift+Tab moves selection to previous cell without extending selection', async () => {
        const element = new SpreadsheetTable();
        document.body.appendChild(element);
        element.table = {
            name: 'Test Table',
            description: '',
            headers: ['A', 'B', 'C'],
            rows: [
                ['0-0', '0-1', '0-2'],
                ['1-0', '1-1', '1-2']
            ],
            metadata: {},
            start_line: 0,
            end_line: 10
        };
        element.sheetIndex = 0;
        element.tableIndex = 0;
        await element.updateComplete;

        // Start at (1, 1)
        element.selectionCtrl.selectCell(1, 1, false);
        await element.updateComplete;

        const cell = element.shadowRoot?.querySelector('.cell.selected') as HTMLElement;
        expect(cell).to.exist;

        expect(element.selectionCtrl.selectedRow).to.equal(1);
        expect(element.selectionCtrl.selectedCol).to.equal(1);
        expect(element.selectionCtrl.selectionAnchorRow).to.equal(1);
        expect(element.selectionCtrl.selectionAnchorCol).to.equal(1);

        // Simulate Shift+Tab
        const event = new KeyboardEvent('keydown', {
            key: 'Tab',
            code: 'Tab',
            shiftKey: true,
            bubbles: true,
            composed: true,
            cancelable: true
        });

        cell.dispatchEvent(event);
        await element.updateComplete;

        // Expect move to (1, 0)
        expect(element.selectionCtrl.selectedRow).to.equal(1, 'Row should remain 1');
        expect(element.selectionCtrl.selectedCol).to.equal(0, 'Col should move to 0');

        // Check Anchor - should move with selection (not extend)
        expect(element.selectionCtrl.selectionAnchorRow).to.equal(1, 'Anchor Row should move to 1');
        expect(element.selectionCtrl.selectionAnchorCol).to.equal(0, 'Anchor Col should move to 0');

        document.body.removeChild(element);
    });

    it('Tab moves selection to next cell without extending selection', async () => {
        const element = new SpreadsheetTable();
        document.body.appendChild(element);
        element.table = {
            name: 'Test Table',
            description: '',
            headers: ['A', 'B', 'C'],
            rows: [
                ['0-0', '0-1', '0-2'],
                ['1-0', '1-1', '1-2']
            ],
            metadata: {},
            start_line: 0,
            end_line: 10
        };
        element.sheetIndex = 0;
        element.tableIndex = 0;
        await element.updateComplete;

        // Start at (0, 0)
        element.selectionCtrl.selectCell(0, 0, false);
        await element.updateComplete;

        const cell = element.shadowRoot?.querySelector('.cell.selected') as HTMLElement;
        expect(cell).to.exist;

        // Simulate Tab
        const event = new KeyboardEvent('keydown', {
            key: 'Tab',
            code: 'Tab',
            shiftKey: false,
            bubbles: true,
            composed: true,
            cancelable: true
        });

        cell.dispatchEvent(event);
        await element.updateComplete;

        // Expect move to (0, 1)
        expect(element.selectionCtrl.selectedRow).to.equal(0);
        expect(element.selectionCtrl.selectedCol).to.equal(1);

        // Verify not extended
        expect(element.selectionCtrl.selectionAnchorCol).to.equal(1);

        document.body.removeChild(element);
    });
});
