import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { queryView, queryAllView, awaitView } from '../../helpers/test-helpers';
import { fixture, html } from '@open-wc/testing';
import '../../../components/spreadsheet-table';
import { SpreadsheetTable } from '../../../components/spreadsheet-table';

describe('SpreadsheetTable Paste TSV with Newlines', () => {
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

    it('correctly parses TSV with quoted values containing newlines', async () => {
        // TSV format: quoted values with embedded newlines
        // "Line1\nLine2"\tB
        // C\tD
        const tsvWithNewlines = '"Line1\nLine2"\tB\nC\tD';
        readTextSpy.mockResolvedValue(tsvWithNewlines);

        const pasteSpy = vi.fn();
        element.addEventListener('paste-cells', (e: Event) => {
            pasteSpy((e as CustomEvent).detail);
        });

        element.selectionCtrl.selectedRow = 0;
        element.selectionCtrl.selectedCol = 0;
        element.selectionCtrl.selectionAnchorRow = -1;
        element.selectionCtrl.selectionAnchorCol = -1;

        await awaitView(element);

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
        await awaitView(element);

        expect(pasteSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                startRow: 0,
                startCol: 0,
                data: [
                    ['Line1\nLine2', 'B'],
                    ['C', 'D']
                ]
            })
        );
    });

    it('correctly parses TSV with escaped quotes inside quoted values', async () => {
        // TSV format: "He said ""Hello"""\tB
        const tsvWithQuotes = '"He said ""Hello"""\tB';
        readTextSpy.mockResolvedValue(tsvWithQuotes);

        const pasteSpy = vi.fn();
        element.addEventListener('paste-cells', (e: Event) => {
            pasteSpy((e as CustomEvent).detail);
        });

        element.selectionCtrl.selectedRow = 0;
        element.selectionCtrl.selectedCol = 0;

        await awaitView(element);

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
        await awaitView(element);

        expect(pasteSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                data: [['He said "Hello"', 'B']]
            })
        );
    });

    it('correctly parses TSV with tabs inside quoted values', async () => {
        // TSV format: "A\tB"\tC
        const tsvWithTabs = '"A\tB"\tC';
        readTextSpy.mockResolvedValue(tsvWithTabs);

        const pasteSpy = vi.fn();
        element.addEventListener('paste-cells', (e: Event) => {
            pasteSpy((e as CustomEvent).detail);
        });

        element.selectionCtrl.selectedRow = 0;
        element.selectionCtrl.selectedCol = 0;

        await awaitView(element);

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
        await awaitView(element);

        expect(pasteSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                data: [['A\tB', 'C']]
            })
        );
    });
});
