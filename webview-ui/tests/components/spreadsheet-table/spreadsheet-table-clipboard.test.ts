import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { queryView, awaitView } from '../../helpers/test-helpers';
import { fixture, html } from '@open-wc/testing';
import '../../../components/spreadsheet-table';
import { SpreadsheetTable } from '../../../components/spreadsheet-table';

describe('SpreadsheetTable Clipboard', () => {
    let element: SpreadsheetTable;
    let writeTextSpy: any;

    beforeEach(async () => {
        element = await fixture<SpreadsheetTable>(html`<spreadsheet-table></spreadsheet-table>`);

        // Mock Clipboard API
        writeTextSpy = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', {
            value: {
                writeText: writeTextSpy,
                readText: vi.fn()
            },
            configurable: true,
            writable: true
        });

        // Setup Data
        element.table = {
            name: 'Test',
            description: '',
            headers: ['A', 'B', 'C'],
            rows: [
                ['1', '2', '3'],
                ['4', '5', '6'],
                ['7', '8', '9']
            ],
            metadata: {},
            start_line: 0,
            end_line: 0
        };
        await awaitView(element);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('copies single cell', async () => {
        // Select (0,0) -> "1"
        element.selectionCtrl.selectedRow = 0;
        element.selectionCtrl.selectedCol = 0;

        const cell = queryView(element, '.cell[data-row="0"][data-col="0"]');
        if (!cell) throw new Error('Cell not found');

        cell.dispatchEvent(
            new KeyboardEvent('keydown', {
                key: 'c',
                code: 'KeyC',
                ctrlKey: true,
                bubbles: true,
                composed: true
            })
        );
        await new Promise((r) => setTimeout(r, 0));
        await awaitView(element);

        expect(writeTextSpy).toHaveBeenCalledWith('1');
    });

    it('copies range (partial row)', async () => {
        // Select Row 0: Col 0-1 -> "1", "2"
        element.selectionCtrl.selectedRow = 0;
        element.selectionCtrl.selectedCol = 1;
        element.selectionCtrl.selectionAnchorRow = 0;
        element.selectionCtrl.selectionAnchorCol = 0;

        const cell = queryView(element, '.cell[data-row="0"][data-col="0"]');
        if (!cell) throw new Error('Cell not found');

        cell.dispatchEvent(
            new KeyboardEvent('keydown', {
                key: 'c',
                ctrlKey: true,
                bubbles: true,
                composed: true
            })
        );
        await new Promise((r) => setTimeout(r, 0));
        await awaitView(element);

        expect(writeTextSpy).toHaveBeenCalledWith('1\t2');
    });

    it('copies range (multi row)', async () => {
        // Select R0C0 to R1C1
        // 1 2
        // 4 5
        element.selectionCtrl.selectedRow = 1;
        element.selectionCtrl.selectedCol = 1;
        element.selectionCtrl.selectionAnchorRow = 0;
        element.selectionCtrl.selectionAnchorCol = 0;

        const cell = queryView(element, '.cell[data-row="0"][data-col="0"]');
        if (!cell) throw new Error('Cell not found');

        cell.dispatchEvent(
            new KeyboardEvent('keydown', {
                key: 'c',
                ctrlKey: true,
                bubbles: true,
                composed: true
            })
        );
        await new Promise((r) => setTimeout(r, 0));
        await awaitView(element);

        expect(writeTextSpy).toHaveBeenCalledWith('1\t2\n4\t5');
    });

    it('copies full row selection', async () => {
        // Select Row 1 (via header)
        element.selectionCtrl.selectionAnchorRow = 1;
        element.selectionCtrl.selectionAnchorCol = -2; // Row Header Sentinel
        element.selectionCtrl.selectedRow = 1;
        element.selectionCtrl.selectedCol = -2;

        await awaitView(element); // Wait for selection classes to update DOM?

        const rowHeader = queryView(element, '.cell.header-row[data-row="1"]');
        if (!rowHeader) throw new Error('Row Header not found');

        rowHeader.dispatchEvent(
            new KeyboardEvent('keydown', {
                key: 'c',
                ctrlKey: true,
                bubbles: true,
                composed: true
            })
        );
        await new Promise((r) => setTimeout(r, 0));
        await awaitView(element);

        // Row 1 is "4", "5", "6"
        expect(writeTextSpy).toHaveBeenCalledWith('4\t5\t6');
    });

    it('copies full column selection', async () => {
        // Select Col 1 (Header 'B')
        element.selectionCtrl.selectionAnchorRow = -2; // Col Header Sentinel
        element.selectionCtrl.selectionAnchorCol = 1;
        element.selectionCtrl.selectedRow = -2;
        element.selectionCtrl.selectedCol = 1;

        await awaitView(element);

        const colHeader = queryView(element, '.cell.header-col[data-col="1"]');
        if (!colHeader) throw new Error('Col Header not found');

        colHeader.dispatchEvent(
            new KeyboardEvent('keydown', {
                key: 'c',
                ctrlKey: true,
                bubbles: true,
                composed: true
            })
        );
        await new Promise((r) => setTimeout(r, 0));
        await awaitView(element);

        // Col 1 is header "B" + data "2", "5", "8"
        expect(writeTextSpy).toHaveBeenCalledWith('B\n2\n5\n8');
    });

    it('pastes single cell', async () => {
        const readTextSpy = vi.fn().mockResolvedValue('PASTED');
        Object.defineProperty(navigator.clipboard, 'readText', {
            value: readTextSpy,
            writable: true
        });

        // Listen for paste-cells event
        const pasteSpy = vi.fn();
        element.addEventListener('paste-cells', (e: any) => {
            pasteSpy(e.detail);
        });

        // Select (0,0)
        element.selectionCtrl.selectedRow = 0;
        element.selectionCtrl.selectedCol = 0;

        const cell = queryView(element, '.cell[data-row="0"][data-col="0"]');
        if (!cell) throw new Error('Cell not found');

        cell.dispatchEvent(
            new KeyboardEvent('keydown', {
                key: 'v',
                ctrlKey: true,
                bubbles: true,
                composed: true
            })
        );
        await new Promise((r) => setTimeout(r, 0));
        await awaitView(element);

        expect(pasteSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                startRow: 0,
                startCol: 0,
                data: [['PASTED']]
            })
        );
    });

    it('pastes multi row data', async () => {
        const readTextSpy = vi.fn().mockResolvedValue('A\tB\nC\tD');
        Object.defineProperty(navigator.clipboard, 'readText', {
            value: readTextSpy,
            writable: true
        });

        const pasteSpy = vi.fn();
        element.addEventListener('paste-cells', (e: any) => {
            pasteSpy(e.detail);
        });

        element.selectionCtrl.selectedRow = 1;
        element.selectionCtrl.selectedCol = 1;

        const cell = queryView(element, '.cell[data-row="0"][data-col="0"]');
        cell!.dispatchEvent(
            new KeyboardEvent('keydown', {
                key: 'v',
                ctrlKey: true,
                bubbles: true,
                composed: true
            })
        );
        await new Promise((r) => setTimeout(r, 0));

        expect(pasteSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                startRow: 1,
                startCol: 1,
                data: [
                    ['A', 'B'],
                    ['C', 'D']
                ]
            })
        );
    });

    it('pastes into row header', async () => {
        const readTextSpy = vi.fn().mockResolvedValue('X\tY');
        Object.defineProperty(navigator.clipboard, 'readText', {
            value: readTextSpy,
            writable: true
        });

        const pasteSpy = vi.fn();
        element.addEventListener('paste-cells', (e: any) => {
            pasteSpy(e.detail);
        });

        // Select Row 1
        element.selectionCtrl.selectedRow = 1;
        element.selectionCtrl.selectedCol = -2;

        await awaitView(element);

        const rowHeader = queryView(element, '.cell.header-row[data-row="1"]');
        if (!rowHeader) throw new Error('Row Header not found');

        rowHeader.dispatchEvent(
            new KeyboardEvent('keydown', {
                key: 'v',
                ctrlKey: true,
                bubbles: true,
                composed: true
            })
        );
        await new Promise((r) => setTimeout(r, 0));

        expect(pasteSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                startRow: 1,
                startCol: 0,
                data: [['X', 'Y']]
            })
        );
    });

    it('pastes into column header', async () => {
        const readTextSpy = vi.fn().mockResolvedValue('P\nQ');
        Object.defineProperty(navigator.clipboard, 'readText', {
            value: readTextSpy,
            writable: true
        });

        const pasteSpy = vi.fn();
        element.addEventListener('paste-cells', (e: any) => {
            pasteSpy(e.detail);
        });

        // Select Col 1
        element.selectionCtrl.selectedRow = -2;
        element.selectionCtrl.selectedCol = 1;

        await awaitView(element);

        const colHeader = queryView(element, '.cell.header-col[data-col="1"]');
        if (!colHeader) throw new Error('Col Header not found');

        colHeader.dispatchEvent(
            new KeyboardEvent('keydown', {
                key: 'v',
                ctrlKey: true,
                bubbles: true,
                composed: true
            })
        );
        await new Promise((r) => setTimeout(r, 0));

        expect(pasteSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                startRow: 0,
                startCol: 1,
                data: [['P'], ['Q']]
            })
        );
    });

    it('does nothing if no selection', async () => {
        element.selectionCtrl.selectedRow = -1;
        element.selectionCtrl.selectedCol = -1;

        element.dispatchEvent(
            new KeyboardEvent('keydown', {
                key: 'c',
                ctrlKey: true,
                bubbles: true,
                composed: true
            })
        );
        await awaitView(element);

        expect(writeTextSpy).not.toHaveBeenCalled();
    });
});
