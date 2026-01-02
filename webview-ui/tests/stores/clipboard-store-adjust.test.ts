/**
 * Tests for ClipboardStore adjustment methods.
 * Tests that copied range is correctly adjusted when rows/columns are inserted or deleted.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ClipboardStore } from '../../stores/clipboard-store';

describe('ClipboardStore adjustment methods', () => {
    beforeEach(() => {
        ClipboardStore.clear();
    });

    describe('adjustForRowInsert', () => {
        it('should shift range down when rows inserted before range', () => {
            ClipboardStore.setCopiedData([['A']], 'cells', {
                sheetIndex: 0,
                tableIndex: 0,
                minR: 2,
                maxR: 4,
                minC: 0,
                maxC: 1
            });

            ClipboardStore.adjustForRowInsert(0, 0, 1, 2);

            expect(ClipboardStore.copiedRange).toEqual({
                sheetIndex: 0,
                tableIndex: 0,
                minR: 4,
                maxR: 6,
                minC: 0,
                maxC: 1
            });
        });

        it('should clear range when rows inserted within range', () => {
            ClipboardStore.setCopiedData([['A']], 'cells', {
                sheetIndex: 0,
                tableIndex: 0,
                minR: 2,
                maxR: 4,
                minC: 0,
                maxC: 1
            });

            ClipboardStore.adjustForRowInsert(0, 0, 3, 1);

            expect(ClipboardStore.copiedRange).toBeNull();
        });

        it('should not adjust when rows inserted after range', () => {
            ClipboardStore.setCopiedData([['A']], 'cells', {
                sheetIndex: 0,
                tableIndex: 0,
                minR: 2,
                maxR: 4,
                minC: 0,
                maxC: 1
            });

            ClipboardStore.adjustForRowInsert(0, 0, 5, 2);

            expect(ClipboardStore.copiedRange?.minR).toBe(2);
            expect(ClipboardStore.copiedRange?.maxR).toBe(4);
        });

        it('should not adjust for different table', () => {
            ClipboardStore.setCopiedData([['A']], 'cells', {
                sheetIndex: 0,
                tableIndex: 0,
                minR: 2,
                maxR: 4,
                minC: 0,
                maxC: 1
            });

            ClipboardStore.adjustForRowInsert(0, 1, 1, 2);

            expect(ClipboardStore.copiedRange?.minR).toBe(2);
            expect(ClipboardStore.copiedRange?.maxR).toBe(4);
        });
    });

    describe('adjustForRowDelete', () => {
        it('should shift range up when rows deleted before range', () => {
            ClipboardStore.setCopiedData([['A']], 'cells', {
                sheetIndex: 0,
                tableIndex: 0,
                minR: 4,
                maxR: 6,
                minC: 0,
                maxC: 1
            });

            ClipboardStore.adjustForRowDelete(0, 0, 1, 2);

            expect(ClipboardStore.copiedRange).toEqual({
                sheetIndex: 0,
                tableIndex: 0,
                minR: 2,
                maxR: 4,
                minC: 0,
                maxC: 1
            });
        });

        it('should clear range when deleted rows overlap with range', () => {
            ClipboardStore.setCopiedData([['A']], 'cells', {
                sheetIndex: 0,
                tableIndex: 0,
                minR: 2,
                maxR: 4,
                minC: 0,
                maxC: 1
            });

            ClipboardStore.adjustForRowDelete(0, 0, 3, 1);

            expect(ClipboardStore.copiedRange).toBeNull();
        });

        it('should not adjust when rows deleted after range', () => {
            ClipboardStore.setCopiedData([['A']], 'cells', {
                sheetIndex: 0,
                tableIndex: 0,
                minR: 2,
                maxR: 4,
                minC: 0,
                maxC: 1
            });

            ClipboardStore.adjustForRowDelete(0, 0, 5, 2);

            expect(ClipboardStore.copiedRange?.minR).toBe(2);
            expect(ClipboardStore.copiedRange?.maxR).toBe(4);
        });
    });

    describe('adjustForColumnInsert', () => {
        it('should shift range right when columns inserted before range', () => {
            ClipboardStore.setCopiedData([['A']], 'cells', {
                sheetIndex: 0,
                tableIndex: 0,
                minR: 0,
                maxR: 2,
                minC: 2,
                maxC: 4
            });

            ClipboardStore.adjustForColumnInsert(0, 0, 1, 2);

            expect(ClipboardStore.copiedRange).toEqual({
                sheetIndex: 0,
                tableIndex: 0,
                minR: 0,
                maxR: 2,
                minC: 4,
                maxC: 6
            });
        });

        it('should clear range when columns inserted within range', () => {
            ClipboardStore.setCopiedData([['A']], 'cells', {
                sheetIndex: 0,
                tableIndex: 0,
                minR: 0,
                maxR: 2,
                minC: 2,
                maxC: 4
            });

            ClipboardStore.adjustForColumnInsert(0, 0, 3, 1);

            expect(ClipboardStore.copiedRange).toBeNull();
        });

        it('should not adjust when columns inserted after range', () => {
            ClipboardStore.setCopiedData([['A']], 'cells', {
                sheetIndex: 0,
                tableIndex: 0,
                minR: 0,
                maxR: 2,
                minC: 2,
                maxC: 4
            });

            ClipboardStore.adjustForColumnInsert(0, 0, 5, 2);

            expect(ClipboardStore.copiedRange?.minC).toBe(2);
            expect(ClipboardStore.copiedRange?.maxC).toBe(4);
        });

        it('should shift range right when columns inserted at position 0 with range also at 0', () => {
            // Bug report: copy column 0, then insert copied column left at column 0
            // Expected: range should shift from minC=0 to minC=1
            ClipboardStore.setCopiedData([['A']], 'columns', {
                sheetIndex: 0,
                tableIndex: 0,
                minR: 0,
                maxR: 2,
                minC: 0,
                maxC: 0
            });

            ClipboardStore.adjustForColumnInsert(0, 0, 0, 1);

            // Should shift, NOT clear
            expect(ClipboardStore.copiedRange).not.toBeNull();
            expect(ClipboardStore.copiedRange?.minC).toBe(1);
            expect(ClipboardStore.copiedRange?.maxC).toBe(1);
        });
    });

    describe('adjustForColumnDelete', () => {
        it('should shift range left when columns deleted before range', () => {
            ClipboardStore.setCopiedData([['A']], 'cells', {
                sheetIndex: 0,
                tableIndex: 0,
                minR: 0,
                maxR: 2,
                minC: 4,
                maxC: 6
            });

            ClipboardStore.adjustForColumnDelete(0, 0, 1, 2);

            expect(ClipboardStore.copiedRange).toEqual({
                sheetIndex: 0,
                tableIndex: 0,
                minR: 0,
                maxR: 2,
                minC: 2,
                maxC: 4
            });
        });

        it('should clear range when deleted columns overlap with range', () => {
            ClipboardStore.setCopiedData([['A']], 'cells', {
                sheetIndex: 0,
                tableIndex: 0,
                minR: 0,
                maxR: 2,
                minC: 2,
                maxC: 4
            });

            ClipboardStore.adjustForColumnDelete(0, 0, 3, 1);

            expect(ClipboardStore.copiedRange).toBeNull();
        });

        it('should not adjust when columns deleted after range', () => {
            ClipboardStore.setCopiedData([['A']], 'cells', {
                sheetIndex: 0,
                tableIndex: 0,
                minR: 0,
                maxR: 2,
                minC: 2,
                maxC: 4
            });

            ClipboardStore.adjustForColumnDelete(0, 0, 5, 2);

            expect(ClipboardStore.copiedRange?.minC).toBe(2);
            expect(ClipboardStore.copiedRange?.maxC).toBe(4);
        });
    });
});
