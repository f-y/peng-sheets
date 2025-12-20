import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { queryView, queryAllView, awaitView } from './test-helpers';
import { fixture, html } from '@open-wc/testing';
import '../components/spreadsheet-table';
import { SpreadsheetTable } from '../components/spreadsheet-table';

describe('SpreadsheetTable Copy with Full Table and Newlines', () => {
    let element: SpreadsheetTable;
    let writeTextSpy: ReturnType<typeof vi.fn>;

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
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Full Table Selection Copy', () => {
        beforeEach(async () => {
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

        it('copies full table with headers when corner is clicked', async () => {
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
                key: 'c',
                preventDefault: () => {}
            } as unknown as KeyboardEvent;

            // Call handleKeyDown on the keyboard controller
            await (element as any).keyboardCtrl.handleKeyDown(event);
            await new Promise((r) => setTimeout(r, 0));
            await awaitView(element);

            // Should include headers + all data rows
            // Expected: "A\tB\n1\t2\n3\t4"
            expect(writeTextSpy).toHaveBeenCalledWith('A\tB\n1\t2\n3\t4');
        });
    });

    describe('TSV Copy with Newlines in Cells', () => {
        beforeEach(async () => {
            element.table = {
                name: 'Test',
                description: '',
                headers: ['Name', 'Notes'],
                rows: [
                    ['Alice', 'Line1\nLine2'],
                    ['Bob', 'Simple']
                ],
                metadata: {},
                start_line: 0,
                end_line: 0
            };
            await awaitView(element);
        });

        it('quotes cell values containing newlines in TSV output', async () => {
            // Select all cells (2x2 range)
            element.selectionCtrl.selectionAnchorRow = 0;
            element.selectionCtrl.selectionAnchorCol = 0;
            element.selectionCtrl.selectedRow = 1;
            element.selectionCtrl.selectedCol = 1;

            await awaitView(element);

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

            // Values with newlines should be quoted
            // Expected: 'Alice\t"Line1\nLine2"\nBob\tSimple'
            expect(writeTextSpy).toHaveBeenCalledWith('Alice\t"Line1\nLine2"\nBob\tSimple');
        });

        it('quotes cell values containing tabs in TSV output', async () => {
            element.table = {
                name: 'Test',
                description: '',
                headers: ['A', 'B'],
                rows: [['Has\tTab', 'Normal']],
                metadata: {},
                start_line: 0,
                end_line: 0
            };
            await awaitView(element);

            element.selectionCtrl.selectionAnchorRow = 0;
            element.selectionCtrl.selectionAnchorCol = 0;
            element.selectionCtrl.selectedRow = 0;
            element.selectionCtrl.selectedCol = 1;

            await awaitView(element);

            const cell = queryView(element, '.cell[data-row="0"][data-col="0"]');
            cell!.dispatchEvent(
                new KeyboardEvent('keydown', {
                    key: 'c',
                    ctrlKey: true,
                    bubbles: true,
                    composed: true
                })
            );
            await new Promise((r) => setTimeout(r, 0));

            // Values with tabs should be quoted
            expect(writeTextSpy).toHaveBeenCalledWith('"Has\tTab"\tNormal');
        });

        it('escapes quotes in cell values', async () => {
            element.table = {
                name: 'Test',
                description: '',
                headers: ['A'],
                rows: [['Say "Hello"']],
                metadata: {},
                start_line: 0,
                end_line: 0
            };
            await awaitView(element);

            element.selectionCtrl.selectedRow = 0;
            element.selectionCtrl.selectedCol = 0;

            const cell = queryView(element, '.cell[data-row="0"][data-col="0"]');
            cell!.dispatchEvent(
                new KeyboardEvent('keydown', {
                    key: 'c',
                    ctrlKey: true,
                    bubbles: true,
                    composed: true
                })
            );
            await new Promise((r) => setTimeout(r, 0));

            // Quotes should be escaped as ""
            expect(writeTextSpy).toHaveBeenCalledWith('"Say ""Hello"""');
        });
    });
});
