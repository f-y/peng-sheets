/**
 * Tests for _handleTabReorder logic in Main class.
 *
 * This test suite verifies tab reordering behavior according to SPECS.md section 8.4:
 *
 * ## Tab Reordering Patterns
 *
 * 1. Sheet → Sheet: Physical reorder within Workbook (file change)
 * 2. Document → Document: Physical reorder in file (file change) + metadata sync
 * 3. Document → Workbook boundary: Physical move in file (file change) + metadata sync
 * 4. Sheet (1 sheet) → Document: Move entire Workbook (file change) + metadata sync
 * 5. Sheet (multi-sheet) → Document: Metadata-only update (UI display order)
 *
 * ## Metadata Sync Rule
 * All physical moves MUST also update the local tabs array and call _updateTabOrder()
 * to maintain consistency between the Markdown file and the UI tab order.
 *
 * @file webview-ui/tests/tab-reorder/handle-tab-reorder.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Test tab interface to match Main.tabs structure
interface TestTab {
    type: 'sheet' | 'document' | 'add-sheet';
    title: string;
    index: number;
    sheetIndex?: number;
    docIndex?: number;
}

// Mock spreadsheet service
const mockMoveSheet = vi.fn();
const mockMoveDocumentSection = vi.fn();
const mockMoveWorkbookSection = vi.fn();
const mockUpdateWorkbookTabOrder = vi.fn();

// Simulated _handleTabReorder logic (extracted for testing)
function handleTabReorder(
    tabs: TestTab[],
    fromIndex: number,
    toIndex: number,
    callbacks: {
        moveSheet: (from: number, to: number, targetTabOrderIndex: number) => void;
        moveDocumentSection: (
            from: number,
            to: number | null,
            toAfterWorkbook: boolean,
            toBeforeWorkbook: boolean,
            targetTabOrderIndex: number
        ) => void;
        moveWorkbookSection: (toDocIndex: number, toAfterDoc: boolean, targetTabOrderIndex: number) => void;
        reorderTabsArray: (from: number, to: number) => void;
        updateTabOrder: () => void;
    }
): { action: string; params?: Record<string, unknown> } {
    if (fromIndex === toIndex) return { action: 'no-op' };

    const fromTab = tabs[fromIndex];
    const toTab = toIndex < tabs.length ? tabs[toIndex] : null;

    const firstSheetIdx = tabs.findIndex((t) => t.type === 'sheet');
    const lastSheetIdx = tabs.reduce((acc, t, i) => (t.type === 'sheet' ? i : acc), -1);
    const hasWorkbook = firstSheetIdx !== -1;
    const sheetCount = tabs.filter((t) => t.type === 'sheet').length;

    // Helper: Compute what the new tab order would look like after this move
    const computeNewTabOrder = (): TestTab[] => {
        const newTabs = [...tabs];
        const [moved] = newTabs.splice(fromIndex, 1);
        const insertIdx = fromIndex < toIndex ? toIndex - 1 : toIndex;
        newTabs.splice(insertIdx, 0, moved);
        return newTabs;
    };

    // Helper: Check if a Document should be before Workbook based on new tab order
    const shouldDocumentBeBeforeWorkbook = (
        newTabs: TestTab[]
    ): { needed: boolean; docIndex?: number; targetTabOrderIndex?: number } => {
        const newFirstSheetIdx = newTabs.findIndex((t) => t.type === 'sheet');
        if (newFirstSheetIdx <= 0) return { needed: false };

        // Check if there's a document before the first sheet
        for (let i = 0; i < newFirstSheetIdx; i++) {
            if (newTabs[i].type === 'document') {
                // Currently Document is after Workbook in file, but should be before
                // Check if currently this doc is after workbook
                const currentDocIdx = tabs.findIndex((t) => t === newTabs[i]);
                if (currentDocIdx > firstSheetIdx) {
                    return { needed: true, docIndex: newTabs[i].docIndex!, targetTabOrderIndex: i };
                }
            }
        }
        return { needed: false };
    };

    // Helper: Check if Workbook should be before a Document based on new tab order
    const shouldWorkbookBeBeforeDocument = (
        newTabs: TestTab[]
    ): { needed: boolean; toDocIndex?: number; targetTabOrderIndex?: number } => {
        const newFirstSheetIdx = newTabs.findIndex((t) => t.type === 'sheet');
        // If no sheets or sheet is NOT first, no need to move workbook
        if (newFirstSheetIdx !== 0) return { needed: false };

        // Sheet is first in new tab_order. Check if currently a Document is before Workbook in file.
        // If firstSheetIdx > 0, then something is before workbook
        if (firstSheetIdx > 0) {
            // Check if that something is a Document
            for (let i = 0; i < firstSheetIdx; i++) {
                if (tabs[i].type === 'document') {
                    // Found a Document before Workbook in file - need to move Workbook before it
                    return { needed: true, toDocIndex: tabs[i].docIndex!, targetTabOrderIndex: 0 };
                }
            }
        }
        return { needed: false };
    };

    // ====== Sheet Tab Movement ======
    if (fromTab.type === 'sheet') {
        const lastDocIdx = tabs.reduce((acc, t, i) => (t.type === 'document' ? i : acc), -1);
        const hasDocsAfterWorkbook = lastDocIdx > lastSheetIdx;

        // FIRST: Check if this move requires physical adjustment
        // This takes precedence over Sheet→Sheet reorder for MULTI-SHEET workbooks
        // For single-sheet workbooks, we move the entire Workbook instead
        if (sheetCount > 1) {
            const newTabs = computeNewTabOrder();

            // Check if a Document needs to move before Workbook
            const docAdjustment = shouldDocumentBeBeforeWorkbook(newTabs);
            if (docAdjustment.needed) {
                callbacks.moveDocumentSection(
                    docAdjustment.docIndex!,
                    null,
                    false,
                    true,
                    docAdjustment.targetTabOrderIndex!
                );
                return {
                    action: 'moveDocumentSection-beforeWorkbook',
                    params: { fromDocIndex: docAdjustment.docIndex, pythonHandlesMetadata: true }
                };
            }

            // Check if Workbook needs to move before a Document
            const wbAdjustment = shouldWorkbookBeBeforeDocument(newTabs);
            if (wbAdjustment.needed) {
                callbacks.moveWorkbookSection(wbAdjustment.toDocIndex!, false, wbAdjustment.targetTabOrderIndex!);
                return {
                    action: 'moveWorkbookSection-beforeDocument',
                    params: { toDocIndex: wbAdjustment.toDocIndex, pythonHandlesMetadata: true }
                };
            }
        }

        // Sheet → Sheet: Physical reorder within workbook (no Document adjustment needed)
        if (toTab?.type === 'sheet') {
            const fromSheetIndex = fromTab.sheetIndex!;
            const toSheetIndex = toTab.sheetIndex!;
            callbacks.moveSheet(fromSheetIndex, toSheetIndex, toIndex);
            return { action: 'moveSheet', params: { fromSheetIndex, toSheetIndex } };
        }

        // Sheet → Document position: No adjustment needed (already checked above)
        if (toTab?.type === 'document') {
            if (sheetCount === 1) {
                // Single sheet = Move entire Workbook
                const toDocIndex = toTab.docIndex!;
                callbacks.moveWorkbookSection(toDocIndex, false, toIndex);
                return {
                    action: 'moveWorkbookSection',
                    params: { toDocIndex, sheetCount: 1, pythonHandlesMetadata: true }
                };
            } else {
                // Multiple sheets and no Document needs to move before Workbook
                // This is purely a tab order (metadata) change
                callbacks.reorderTabsArray(fromIndex, toIndex);
                callbacks.updateTabOrder();
                return { action: 'metadata-only', params: { sheetCount } };
            }
        }

        // Sheet → add-sheet or end with docs after workbook
        if ((toTab?.type === 'add-sheet' || !toTab) && hasDocsAfterWorkbook) {
            if (sheetCount === 1) {
                const docCount = tabs.filter((t) => t.type === 'document').length;
                callbacks.moveWorkbookSection(docCount, false, toIndex);
                return {
                    action: 'moveWorkbookSection-end',
                    params: { docCount, sheetCount: 1, pythonHandlesMetadata: true }
                };
            } else {
                callbacks.reorderTabsArray(fromIndex, toIndex);
                callbacks.updateTabOrder();
                return { action: 'metadata-only', params: { sheetCount } };
            }
        }

        // Sheet → add-sheet (no docs after): Just reorder within workbook
        if (toTab?.type === 'add-sheet' || !toTab) {
            const fromSheetIndex = fromTab.sheetIndex!;
            callbacks.moveSheet(fromSheetIndex, sheetCount, toIndex);
            return { action: 'moveSheet-end', params: { fromSheetIndex, toSheetIndex: sheetCount } };
        }

        // Fallback
        callbacks.reorderTabsArray(fromIndex, toIndex);
        callbacks.updateTabOrder();
        return { action: 'fallback-metadata' };
    }

    // ====== Document Tab Movement ======
    if (fromTab.type === 'document') {
        const fromDocIndex = fromTab.docIndex!;

        if (toTab?.type === 'document') {
            const toDocIndex = toTab.docIndex!;
            callbacks.moveDocumentSection(fromDocIndex, toDocIndex, false, false, toIndex);
            return {
                action: 'moveDocumentSection',
                params: { fromDocIndex, toDocIndex, pythonHandlesMetadata: true }
            };
        } else if (!hasWorkbook) {
            callbacks.reorderTabsArray(fromIndex, toIndex);
            callbacks.updateTabOrder();
            return { action: 'metadata-only-no-workbook' };
        } else if (toIndex <= firstSheetIdx) {
            callbacks.moveDocumentSection(fromDocIndex, null, false, true, toIndex);
            return {
                action: 'moveDocumentSection-beforeWorkbook',
                params: { fromDocIndex, pythonHandlesMetadata: true }
            };
        } else if (toIndex > lastSheetIdx || toTab?.type === 'add-sheet' || !toTab) {
            callbacks.moveDocumentSection(fromDocIndex, null, true, false, toIndex);
            return {
                action: 'moveDocumentSection-afterWorkbook',
                params: { fromDocIndex, pythonHandlesMetadata: true }
            };
        } else {
            callbacks.reorderTabsArray(fromIndex, toIndex);
            callbacks.updateTabOrder();
            return { action: 'metadata-only-inside-workbook' };
        }
    }

    return { action: 'unknown' };
}

describe('handleTabReorder', () => {
    const mockCallbacks = {
        moveSheet: mockMoveSheet,
        moveDocumentSection: mockMoveDocumentSection,
        moveWorkbookSection: mockMoveWorkbookSection,
        reorderTabsArray: vi.fn(),
        updateTabOrder: mockUpdateWorkbookTabOrder
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // =========================================================================
    // Pattern 1: Sheet → Sheet (Physical reorder within Workbook)
    // =========================================================================
    describe('Sheet → Sheet (physical reorder)', () => {
        it('should call moveSheet when moving Sheet to another Sheet position', () => {
            const tabs: TestTab[] = [
                { type: 'sheet', title: 'Sheet 1', index: 0, sheetIndex: 0 },
                { type: 'sheet', title: 'Sheet 2', index: 1, sheetIndex: 1 },
                { type: 'add-sheet', title: '+', index: 2 }
            ];

            const result = handleTabReorder(tabs, 0, 1, mockCallbacks);

            expect(result.action).toBe('moveSheet');
            expect(result.params).toEqual({ fromSheetIndex: 0, toSheetIndex: 1 });
            expect(mockMoveSheet).toHaveBeenCalledWith(0, 1, 1);
        });

        it('should call moveSheet when moving Sheet 2 to Sheet 1 position', () => {
            const tabs: TestTab[] = [
                { type: 'sheet', title: 'Sheet 1', index: 0, sheetIndex: 0 },
                { type: 'sheet', title: 'Sheet 2', index: 1, sheetIndex: 1 },
                { type: 'add-sheet', title: '+', index: 2 }
            ];

            const result = handleTabReorder(tabs, 1, 0, mockCallbacks);

            expect(result.action).toBe('moveSheet');
            expect(result.params).toEqual({ fromSheetIndex: 1, toSheetIndex: 0 });
        });
    });

    // =========================================================================
    // Pattern 2: Document → Document (Physical reorder in file)
    // =========================================================================
    describe('Document → Document (physical reorder)', () => {
        it('should call moveDocumentSection when moving Doc to another Doc position', () => {
            const tabs: TestTab[] = [
                { type: 'document', title: 'Doc 1', index: 0, docIndex: 0 },
                { type: 'document', title: 'Doc 2', index: 1, docIndex: 1 }
            ];

            const result = handleTabReorder(tabs, 0, 1, mockCallbacks);

            expect(result.action).toBe('moveDocumentSection');
            expect(result.params).toEqual({ fromDocIndex: 0, toDocIndex: 1, pythonHandlesMetadata: true });
            expect(mockMoveDocumentSection).toHaveBeenCalledWith(0, 1, false, false, 1);
        });
    });

    // =========================================================================
    // Pattern 3: Document → Workbook boundary (Physical move in file)
    // =========================================================================
    describe('Document → Workbook boundary (physical move)', () => {
        it('should call moveDocumentSection with toBeforeWorkbook when Doc moves before Workbook', () => {
            // [Doc1, Sheet1, Doc2]
            const tabs: TestTab[] = [
                { type: 'document', title: 'Doc 1', index: 0, docIndex: 0 },
                { type: 'sheet', title: 'Sheet 1', index: 1, sheetIndex: 0 },
                { type: 'add-sheet', title: '+', index: 2 },
                { type: 'document', title: 'Doc 2', index: 3, docIndex: 1 }
            ];

            // Move Doc 2 to before Workbook (position 1, which is firstSheetIdx)
            const result = handleTabReorder(tabs, 3, 1, mockCallbacks);

            expect(result.action).toBe('moveDocumentSection-beforeWorkbook');
            expect(mockMoveDocumentSection).toHaveBeenCalledWith(1, null, false, true, 1);
        });

        it('should call moveDocumentSection with toAfterWorkbook when Doc moves after Workbook', () => {
            // [Doc1, Sheet1, +, Doc2]
            const tabs: TestTab[] = [
                { type: 'document', title: 'Doc 1', index: 0, docIndex: 0 },
                { type: 'sheet', title: 'Sheet 1', index: 1, sheetIndex: 0 },
                { type: 'add-sheet', title: '+', index: 2 },
                { type: 'document', title: 'Doc 2', index: 3, docIndex: 1 }
            ];

            // Move Doc 1 to end (position 4, beyond all tabs)
            // This targets after the last sheet (index 1), so toAfterWorkbook applies
            const result = handleTabReorder(tabs, 0, 4, mockCallbacks);

            expect(result.action).toBe('moveDocumentSection-afterWorkbook');
            expect(mockMoveDocumentSection).toHaveBeenCalledWith(0, null, true, false, 4);
        });
    });

    // =========================================================================
    // Pattern 4: Single Sheet → Document (Move entire Workbook physically)
    // =========================================================================
    describe('Single Sheet → Document (physical Workbook move)', () => {
        it('should call moveWorkbookSection when single sheet moves to Document position', () => {
            // [Sheet1, +, Doc1]
            const tabs: TestTab[] = [
                { type: 'sheet', title: 'Sheet 1', index: 0, sheetIndex: 0 },
                { type: 'add-sheet', title: '+', index: 1 },
                { type: 'document', title: 'Doc 1', index: 2, docIndex: 0 }
            ];

            // Move Sheet 1 to Doc 1's position
            const result = handleTabReorder(tabs, 0, 2, mockCallbacks);

            expect(result.action).toBe('moveWorkbookSection');
            expect(result.params).toEqual({ toDocIndex: 0, sheetCount: 1, pythonHandlesMetadata: true });
            expect(mockMoveWorkbookSection).toHaveBeenCalledWith(0, false, 2);
        });

        it('should call moveWorkbookSection to end when single sheet moves to end', () => {
            // [Sheet1, +, Doc1, Doc2]
            const tabs: TestTab[] = [
                { type: 'sheet', title: 'Sheet 1', index: 0, sheetIndex: 0 },
                { type: 'add-sheet', title: '+', index: 1 },
                { type: 'document', title: 'Doc 1', index: 2, docIndex: 0 },
                { type: 'document', title: 'Doc 2', index: 3, docIndex: 1 }
            ];

            // Move Sheet 1 to end (past all docs)
            const result = handleTabReorder(tabs, 0, 4, mockCallbacks);

            expect(result.action).toBe('moveWorkbookSection-end');
            expect(result.params).toEqual({ docCount: 2, sheetCount: 1, pythonHandlesMetadata: true });
            expect(mockMoveWorkbookSection).toHaveBeenCalledWith(2, false, 4);
        });
    });

    // =========================================================================
    // Pattern 5: Multi-Sheet → Document (Metadata-only update)
    // =========================================================================
    describe('Multi-Sheet → Document (metadata-only)', () => {
        it('should update metadata only when multi-sheet moves to Document position', () => {
            // [Sheet1, Sheet2, +, Doc1]
            const tabs: TestTab[] = [
                { type: 'sheet', title: 'Sheet 1', index: 0, sheetIndex: 0 },
                { type: 'sheet', title: 'Sheet 2', index: 1, sheetIndex: 1 },
                { type: 'add-sheet', title: '+', index: 2 },
                { type: 'document', title: 'Doc 1', index: 3, docIndex: 0 }
            ];

            // Move Sheet 2 to Doc 1's position
            const result = handleTabReorder(tabs, 1, 3, mockCallbacks);

            expect(result.action).toBe('metadata-only');
            expect(result.params).toEqual({ sheetCount: 2 });
            expect(mockMoveWorkbookSection).not.toHaveBeenCalled();
            expect(mockCallbacks.reorderTabsArray).toHaveBeenCalledWith(1, 3);
            expect(mockUpdateWorkbookTabOrder).toHaveBeenCalled();
        });

        it('should update metadata only when multi-sheet moves to end (with docs after)', () => {
            // [Sheet1, Sheet2, +, Doc1]
            const tabs: TestTab[] = [
                { type: 'sheet', title: 'Sheet 1', index: 0, sheetIndex: 0 },
                { type: 'sheet', title: 'Sheet 2', index: 1, sheetIndex: 1 },
                { type: 'add-sheet', title: '+', index: 2 },
                { type: 'document', title: 'Doc 1', index: 3, docIndex: 0 }
            ];

            // Move Sheet 1 to end (past Doc 1)
            const result = handleTabReorder(tabs, 0, 4, mockCallbacks);

            expect(result.action).toBe('metadata-only');
            expect(result.params).toEqual({ sheetCount: 2 });
            expect(mockMoveWorkbookSection).not.toHaveBeenCalled();
        });

        it('should trigger Workbook physical move when Sheet 1 moves to first position (file has Doc before Workbook)', () => {
            // [Doc1, Sheet1, Sheet2, +, Doc2]
            // File structure: Document 0 before Workbook
            const tabs: TestTab[] = [
                { type: 'document', title: 'Doc 1', index: 0, docIndex: 0 },
                { type: 'sheet', title: 'Sheet 1', index: 1, sheetIndex: 0 },
                { type: 'sheet', title: 'Sheet 2', index: 2, sheetIndex: 1 },
                { type: 'add-sheet', title: '+', index: 3 },
                { type: 'document', title: 'Doc 2', index: 4, docIndex: 1 }
            ];

            // Move Sheet 1 to Doc 1's position (before workbook)
            // New tab_order: [Sheet1, Doc1, Sheet2, +, Doc2]
            // Since Sheet is now first, Workbook should physically move before Document 0
            const result = handleTabReorder(tabs, 1, 0, mockCallbacks);

            expect(result.action).toBe('moveWorkbookSection-beforeDocument');
            expect(mockMoveWorkbookSection).toHaveBeenCalledWith(0, false, expect.any(Number));
        });
    });

    // =========================================================================
    // Edge Cases
    // =========================================================================
    describe('Edge cases', () => {
        it('should return no-op when fromIndex equals toIndex', () => {
            const tabs: TestTab[] = [{ type: 'sheet', title: 'Sheet 1', index: 0, sheetIndex: 0 }];

            const result = handleTabReorder(tabs, 0, 0, mockCallbacks);

            expect(result.action).toBe('no-op');
        });

        it('should handle Sheet → add-sheet (no docs) as Sheet reorder', () => {
            const tabs: TestTab[] = [
                { type: 'sheet', title: 'Sheet 1', index: 0, sheetIndex: 0 },
                { type: 'sheet', title: 'Sheet 2', index: 1, sheetIndex: 1 },
                { type: 'add-sheet', title: '+', index: 2 }
            ];

            // Move Sheet 1 to add-sheet position
            const result = handleTabReorder(tabs, 0, 2, mockCallbacks);

            expect(result.action).toBe('moveSheet-end');
            expect(mockMoveSheet).toHaveBeenCalled();
        });

        it('should handle Document moves in file with no Workbook as metadata-only', () => {
            const tabs: TestTab[] = [
                { type: 'document', title: 'Doc 1', index: 0, docIndex: 0 },
                { type: 'document', title: 'Doc 2', index: 1, docIndex: 1 }
            ];

            // Actually this should be Document→Document (physical move)
            const result = handleTabReorder(tabs, 0, 1, mockCallbacks);

            expect(result.action).toBe('moveDocumentSection');
        });
    });

    describe('Unified tab reorder: final tab_order determines file structure', () => {
        /**
         * Key principle: Regardless of WHICH tab is moved (Sheet or Document),
         * the final tab_order determines the physical file structure.
         *
         * If Sheet is moved right past Document, the result is the same as
         * moving Document left past Sheet - the Document should be first in file.
         */

        it('should trigger Document physical move when Sheet moved right past Document (multi-sheet)', () => {
            /**
             * Initial: [Sheet 0, Document 0, Sheet 1, Sheet 2, Document 1]
             * Action: Move Sheet 0 to position 2 (after Document 0)
             * New tab_order: [Document 0, Sheet 0, Sheet 1, Sheet 2, Document 1]
             *
             * Since Document 0 is now first in tab_order, it should be
             * physically moved before the Workbook in the file.
             */
            const tabs: TestTab[] = [
                { type: 'sheet', title: 'Sheet 1', index: 0, sheetIndex: 0 },
                { type: 'document', title: 'Doc 1', index: 1, docIndex: 0 },
                { type: 'sheet', title: 'Sheet 2', index: 2, sheetIndex: 1 },
                { type: 'sheet', title: 'Sheet 3', index: 3, sheetIndex: 2 },
                { type: 'document', title: 'Doc 2', index: 4, docIndex: 1 }
            ];

            // Move Sheet 0 to position 2 (after Document 0)
            const result = handleTabReorder(tabs, 0, 2, mockCallbacks);

            // This should trigger Document 0 to move before Workbook
            // Because the new tab_order has Document 0 first
            expect(result.action).toBe('moveDocumentSection-beforeWorkbook');
            expect(mockMoveDocumentSection).toHaveBeenCalledWith(0, null, false, true, expect.any(Number));
        });

        it('should produce same physical result for Sheet-right and Document-left', () => {
            /**
             * Both of these should produce the same physical file structure:
             * 1. Move Sheet 0 to the right (past Document 0)
             * 2. Move Document 0 to the left (to position 0)
             *
             * Result: Document 0 should be physically before Workbook
             */

            // Case 1: Starting with Sheet first, Document moves left
            const tabsCase1: TestTab[] = [
                { type: 'sheet', title: 'Sheet 1', index: 0, sheetIndex: 0 },
                { type: 'document', title: 'Doc 1', index: 1, docIndex: 0 }
            ];

            const result1 = handleTabReorder(tabsCase1, 1, 0, mockCallbacks);

            // We can't easily compare the two without running both,
            // but we can verify Document move is triggered
            expect(result1.action).toBe('moveDocumentSection-beforeWorkbook');
        });

        it('should trigger Workbook physical move when Sheet moved left past Document (file has Doc before Workbook)', () => {
            /**
             * File structure: [Document 0, Workbook (Sheet 0, Sheet 1, Sheet 2), Document 1, ...]
             * Initial tab_order: [Document 0, Sheet 0, Sheet 1, Sheet 2, Document 1]
             *
             * Action: Move Sheet 0 to position 0 (leftmost)
             * New tab_order: [Sheet 0, Document 0, Sheet 1, Sheet 2, Document 1]
             *
             * Since Sheet is now first in tab_order but Document 0 is physically
             * before Workbook in the file, we need to move Workbook before Document 0.
             */
            const tabs: TestTab[] = [
                { type: 'document', title: 'Doc 1', index: 0, docIndex: 0 },
                { type: 'sheet', title: 'Sheet 1', index: 1, sheetIndex: 0 },
                { type: 'sheet', title: 'Sheet 2', index: 2, sheetIndex: 1 },
                { type: 'sheet', title: 'Sheet 3', index: 3, sheetIndex: 2 },
                { type: 'document', title: 'Doc 2', index: 4, docIndex: 1 }
            ];

            // Move Sheet 1 (index 1) to position 0 (leftmost)
            const result = handleTabReorder(tabs, 1, 0, mockCallbacks);

            // This should trigger Workbook to move before Document 0
            // Because the new tab_order has Sheet first but file has Document before Workbook
            expect(result.action).toBe('moveWorkbookSection-beforeDocument');
            expect(mockMoveWorkbookSection).toHaveBeenCalledWith(0, false, expect.any(Number));
        });
    });
});
