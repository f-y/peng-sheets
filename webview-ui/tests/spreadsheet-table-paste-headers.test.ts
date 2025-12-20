import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { queryView, queryAllView, awaitView } from './test-helpers';
import { fixture, html } from '@open-wc/testing';
import '../components/spreadsheet-table';
import { SpreadsheetTable } from '../components/spreadsheet-table';

describe('SpreadsheetTable Paste with Headers', () => {
    let element: SpreadsheetTable;
    let readTextSpy: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
        element = await fixture<SpreadsheetTable>(html`<spreadsheet-table></spreadsheet-table>`);

        // Mock Clipboard API
        readTextSpy = vi.fn();
        Object.defineProperty(navigator, 'clipboard', {
            value: {
                writeText: vi.fn(),
                readText: readTextSpy
            },
            configurable: true,
            writable: true
        });

        element.table = {
            name: 'Test',
            description: '',
            headers: ['A', 'B'],
            rows: [
                ['1', '2'],
                ['3', '4']
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

    it('includes headers flag when pasting with full table selection (corner)', async () => {
        readTextSpy.mockResolvedValue('Name\tAge\nAlice\t30\nBob\t25');

        const pasteSpy = vi.fn();
        element.addEventListener('paste-cells', (e: any) => {
            pasteSpy(e.detail);
        });

        // Simulate corner click selection (-2, -2)
        element.selectionCtrl.selectionAnchorRow = -2;
        element.selectionCtrl.selectionAnchorCol = -2;
        element.selectionCtrl.selectedRow = -2;
        element.selectionCtrl.selectedCol = -2;

        await awaitView(element);

        // Call internal _handleKeyDown directly (Container doesn't have raw @keydown listener)
        // Create mock event
        const event = {
            ctrlKey: true,
            metaKey: true,
            key: 'v',
            preventDefault: () => {}
        } as unknown as KeyboardEvent;

        // Call handleKeyDown on the keyboard controller
        await (element as any).keyboardCtrl.handleKeyDown(event);
        await new Promise((r) => setTimeout(r, 0));
        await awaitView(element);

        expect(pasteSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                startRow: 0,
                startCol: 0,
                includeHeaders: true,
                data: [
                    ['Name', 'Age'],
                    ['Alice', '30'],
                    ['Bob', '25']
                ]
            })
        );
    });

    it('includes headers flag when pasting with column selection at row 0', async () => {
        readTextSpy.mockResolvedValue('X\tY\n10\t20');

        const pasteSpy = vi.fn();
        element.addEventListener('paste-cells', (e: CustomEvent) => {
            pasteSpy(e.detail);
        });

        // Simulate column header selection (row -2) starting from col 0
        element.selectionCtrl.selectionAnchorRow = -2;
        element.selectionCtrl.selectionAnchorCol = 0;
        element.selectionCtrl.selectedRow = -2;
        element.selectionCtrl.selectedCol = 0;

        await awaitView(element);

        const colHeader = queryView(element, '.cell.header-col[data-col="0"]');
        if (!colHeader) throw new Error('Column header not found');

        colHeader.dispatchEvent(
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
                includeHeaders: true,
                data: [
                    ['X', 'Y'],
                    ['10', '20']
                ]
            })
        );
    });

    it('does NOT include headers flag when pasting at row 1', async () => {
        readTextSpy.mockResolvedValue('A\tB');

        const pasteSpy = vi.fn();
        element.addEventListener('paste-cells', (e: any) => {
            pasteSpy(e.detail);
        });

        // Select cell at row 1, col 0
        element.selectionCtrl.selectedRow = 1;
        element.selectionCtrl.selectedCol = 0;
        element.selectionCtrl.selectionAnchorRow = -1;
        element.selectionCtrl.selectionAnchorCol = -1;

        await awaitView(element);

        const cell = queryView(element, '.cell[data-row="1"][data-col="0"]');
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
                startRow: 1,
                startCol: 0,
                includeHeaders: false,
                data: [['A', 'B']]
            })
        );
    });
});
