/**
 * Unit tests for ClipboardController
 *
 * Focuses on:
 * - TSV parsing (RFC 4180 compliance)
 * - TSV escaping/quoting
 * - Selection range extraction
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClipboardController } from '../../controllers/clipboard-controller';
import { SelectionController } from '../../controllers/selection-controller';
import { createMockHost } from './controller-test-helpers';
import type { ReactiveControllerHost } from 'lit';

// Extended mock host for clipboard tests
interface ClipboardMockHost extends ReactiveControllerHost {
    table: { headers: string[] | null; rows: string[][] } | null;
    sheetIndex: number;
    tableIndex: number;
    selectionCtrl: SelectionController;
    dispatchEvent: (event: Event) => boolean;
}

const createClipboardHost = (): ClipboardMockHost => {
    const mockSelection = {
        selectedRow: 0,
        selectedCol: 0,
        selectionAnchorRow: 0,
        selectionAnchorCol: 0,
        getSelectionRange: vi.fn(() => ({ minR: 0, maxR: 0, minC: 0, maxC: 0 }))
    } as unknown as SelectionController;

    return {
        ...createMockHost(),
        table: {
            headers: ['A', 'B'],
            rows: [
                ['1', '2'],
                ['3', '4']
            ]
        },
        sheetIndex: 0,
        tableIndex: 0,
        selectionCtrl: mockSelection,
        dispatchEvent: vi.fn(() => true)
    };
};

describe('ClipboardController', () => {
    let host: ClipboardMockHost;
    let clipboard: ClipboardController;

    beforeEach(() => {
        host = createClipboardHost();
        clipboard = new ClipboardController(host);
    });

    describe('parseTsv', () => {
        it('should parse simple TSV', () => {
            const tsv = 'A\tB\tC\n1\t2\t3';
            const result = clipboard.parseTsv(tsv);
            expect(result).toEqual([
                ['A', 'B', 'C'],
                ['1', '2', '3']
            ]);
        });

        it('should parse single cell', () => {
            const tsv = 'value';
            const result = clipboard.parseTsv(tsv);
            expect(result).toEqual([['value']]);
        });

        it('should handle empty string', () => {
            const result = clipboard.parseTsv('');
            expect(result).toEqual([]);
        });

        it('should parse quoted values with newlines', () => {
            const tsv = '"Line 1\nLine 2"\tB';
            const result = clipboard.parseTsv(tsv);
            expect(result).toEqual([['Line 1\nLine 2', 'B']]);
        });

        it('should parse quoted values with tabs', () => {
            const tsv = '"A\tB"\tC';
            const result = clipboard.parseTsv(tsv);
            expect(result).toEqual([['A\tB', 'C']]);
        });

        it('should handle escaped quotes (doubled quotes)', () => {
            const tsv = '"Say ""Hello"""';
            const result = clipboard.parseTsv(tsv);
            expect(result).toEqual([['Say "Hello"']]);
        });

        it('should parse mixed quoted and unquoted values', () => {
            const tsv = 'Plain\t"Quoted"\t"With ""Escape"""';
            const result = clipboard.parseTsv(tsv);
            expect(result).toEqual([['Plain', 'Quoted', 'With "Escape"']]);
        });

        it('should handle multiple rows with quoted values', () => {
            const tsv = '"A"\t"B"\n"C"\t"D"';
            const result = clipboard.parseTsv(tsv);
            expect(result).toEqual([
                ['A', 'B'],
                ['C', 'D']
            ]);
        });

        it('should handle empty cells', () => {
            const tsv = 'A\t\tC\n\tB\t';
            const result = clipboard.parseTsv(tsv);
            expect(result).toEqual([
                ['A', '', 'C'],
                ['', 'B', '']
            ]);
        });

        it('should handle trailing newline', () => {
            const tsv = 'A\tB\n';
            const result = clipboard.parseTsv(tsv);
            expect(result).toEqual([['A', 'B']]);
        });

        it('should handle complex RFC 4180 example', () => {
            // Value with newline, tab, and quote
            const tsv = '"Line 1\nLine 2"\t"Tab:\tHere"\t"Quote: ""Test"""';
            const result = clipboard.parseTsv(tsv);
            expect(result).toEqual([['Line 1\nLine 2', 'Tab:\tHere', 'Quote: "Test"']]);
        });
    });

    describe('_escapeTsvValue', () => {
        it('should not quote simple values', () => {
            const result = (clipboard as any)._escapeTsvValue('simple');
            expect(result).toBe('simple');
        });

        it('should quote values with tabs', () => {
            const result = (clipboard as any)._escapeTsvValue('A\tB');
            expect(result).toBe('"A\tB"');
        });

        it('should quote values with newlines', () => {
            const result = (clipboard as any)._escapeTsvValue('Line1\nLine2');
            expect(result).toBe('"Line1\nLine2"');
        });

        it('should quote and escape values with quotes', () => {
            const result = (clipboard as any)._escapeTsvValue('Say "Hello"');
            expect(result).toBe('"Say ""Hello"""');
        });

        it('should handle empty string', () => {
            const result = (clipboard as any)._escapeTsvValue('');
            expect(result).toBe('');
        });

        it('should handle value with all special chars', () => {
            const result = (clipboard as any)._escapeTsvValue('A\t"B"\nC');
            expect(result).toBe('"A\t""B""\nC"');
        });
    });

    describe('_getTsvForSelection', () => {
        it('should return null if no table', () => {
            host.table = null;
            const result = (clipboard as any)._getTsvForSelection();
            expect(result).toBeNull();
        });

        it('should extract single cell', () => {
            host.selectionCtrl.getSelectionRange = vi.fn(() => ({
                minR: 0,
                maxR: 0,
                minC: 0,
                maxC: 0
            }));
            const result = (clipboard as any)._getTsvForSelection();
            expect(result).toBe('1');
        });

        it('should extract row range', () => {
            host.selectionCtrl.selectionAnchorRow = 0;
            host.selectionCtrl.selectionAnchorCol = 0;
            host.selectionCtrl.selectedRow = 1;
            host.selectionCtrl.selectedCol = 1;

            host.selectionCtrl.getSelectionRange = vi.fn(() => ({
                minR: 0,
                maxR: 1,
                minC: 0,
                maxC: 1
            }));
            const result = (clipboard as any)._getTsvForSelection();
            expect(result).toBe('1\t2\n3\t4');
        });

        it('should extract column range', () => {
            host.selectionCtrl.selectionAnchorRow = 0;
            host.selectionCtrl.selectionAnchorCol = 0;
            host.selectionCtrl.selectedRow = 1;
            host.selectionCtrl.selectedCol = 0;

            host.selectionCtrl.getSelectionRange = vi.fn(() => ({
                minR: 0,
                maxR: 1,
                minC: 0,
                maxC: 0
            }));
            const result = (clipboard as any)._getTsvForSelection();
            expect(result).toBe('1\n3');
        });

        it('should not include headers for range selection starting at row 0', () => {
            // Normal range selection doesn't include headers
            host.selectionCtrl.selectionAnchorRow = 0;
            host.selectionCtrl.selectionAnchorCol = 0;
            host.selectionCtrl.selectedRow = 0;
            host.selectionCtrl.selectedCol = 1;

            host.selectionCtrl.getSelectionRange = vi.fn(() => ({
                minR: 0,
                maxR: 0,
                minC: 0,
                maxC: 1
            }));
            const result = (clipboard as any)._getTsvForSelection();
            expect(result).toBe('1\t2');
        });

        it('should handle full table selection with headers', () => {
            // Mock full table selection (corner cell click)
            host.selectionCtrl.selectedRow = -2;
            host.selectionCtrl.selectedCol = -2;
            host.selectionCtrl.selectionAnchorRow = -2;
            host.selectionCtrl.selectionAnchorCol = -2;

            host.selectionCtrl.getSelectionRange = vi.fn(() => ({
                minR: -1,
                maxR: 1,
                minC: 0,
                maxC: 1
            }));
            const result = (clipboard as any)._getTsvForSelection();
            expect(result).toBe('A\tB\n1\t2\n3\t4');
        });

        it('should escape special characters in cells', () => {
            host.table!.rows[0][0] = 'Line1\nLine2';
            host.selectionCtrl.getSelectionRange = vi.fn(() => ({
                minR: 0,
                maxR: 0,
                minC: 0,
                maxC: 0
            }));
            const result = (clipboard as any)._getTsvForSelection();
            expect(result).toBe('"Line1\nLine2"');
        });
    });

    describe('deleteSelection', () => {
        it('should clear selected range cells', () => {
            host.selectionCtrl.selectionAnchorRow = 0;
            host.selectionCtrl.selectionAnchorCol = 0;
            host.selectionCtrl.selectedRow = 0;
            host.selectionCtrl.selectedCol = 1;

            host.selectionCtrl.getSelectionRange = vi.fn(() => ({
                minR: 0,
                maxR: 0,
                minC: 0,
                maxC: 1
            }));

            clipboard.deleteSelection();

            expect(host.table!.rows[0]).toEqual(['', '']);
            expect(host.requestUpdate).toHaveBeenCalled();
        });

        it('should dispatch range-edit event', () => {
            host.selectionCtrl.selectionAnchorRow = 0;
            host.selectionCtrl.selectionAnchorCol = 0;
            host.selectionCtrl.selectedRow = 0;
            host.selectionCtrl.selectedCol = 0;

            host.selectionCtrl.getSelectionRange = vi.fn(() => ({
                minR: 0,
                maxR: 0,
                minC: 0,
                maxC: 0
            }));

            clipboard.deleteSelection();

            expect(host.dispatchEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'range-edit'
                })
            );
        });

        it('should handle rectangular range selection', () => {
            host.selectionCtrl.selectionAnchorRow = 0;
            host.selectionCtrl.selectionAnchorCol = 0;
            host.selectionCtrl.selectedRow = 1;
            host.selectionCtrl.selectedCol = 1;

            host.selectionCtrl.getSelectionRange = vi.fn(() => ({
                minR: 0,
                maxR: 1,
                minC: 0,
                maxC: 1
            }));

            clipboard.deleteSelection();

            // All cells in range should be cleared
            expect(host.table!.rows[0]).toEqual(['', '']);
            expect(host.table!.rows[1]).toEqual(['', '']);
        });
    });

    describe('parseTsv + _escapeTsvValue roundtrip', () => {
        it('should maintain data integrity through copy-paste cycle', () => {
            const original = [
                ['A\tB', 'C\nD', 'E "F"'],
                ['Plain', 'Value', 'Here']
            ];

            // Convert to TSV
            const tsv = original
                .map((row) => row.map((cell) => (clipboard as any)._escapeTsvValue(cell)).join('\t'))
                .join('\n');

            // Parse back
            const parsed = clipboard.parseTsv(tsv);

            expect(parsed).toEqual(original);
        });
    });
});
