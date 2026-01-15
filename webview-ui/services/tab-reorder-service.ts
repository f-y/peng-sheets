/**
 * Tab Reorder Service
 *
 * Pure functions for determining tab reorder actions.
 * Implements SPECS.md 8.6 Tab Reorder Test Matrix.
 *
 * Fundamental Principles (SPECS.md 8.6):
 * 1. Sheets are inseparable from Workbook
 * 2. Docs between Sheets in tab_order are always physically after Workbook
 * 3. Tab order ≠ Physical order (metadata may be required)
 */

// =============================================================================
// Types
// =============================================================================

export interface TabOrderItem {
    type: 'sheet' | 'document';
    index: number;
}

/**
 * Represents the physical structure of the Markdown file.
 * All arrays contain indices in their physical order.
 */
export interface FileStructure {
    docsBeforeWb: number[]; // docIndex array (physical order)
    sheets: number[]; // sheetIndex array (physical order in Workbook)
    docsAfterWb: number[]; // docIndex array (physical order)
    hasWorkbook: boolean;
}

/**
 * Physical move to execute on the Markdown file.
 */
export type PhysicalMove =
    | { type: 'move-sheet'; fromSheetIndex: number; toSheetIndex: number }
    | { type: 'move-workbook'; direction: 'before-doc' | 'after-doc'; targetDocIndex: number }
    | {
        type: 'move-document';
        fromDocIndex: number;
        toDocIndex: number | null;
        toAfterWorkbook: boolean;
        toBeforeWorkbook: boolean;
    };

/**
 * Result of determining what action to take for a tab reorder.
 */
export interface ReorderAction {
    actionType: 'no-op' | 'physical' | 'metadata' | 'physical+metadata';
    physicalMove?: PhysicalMove;
    newFileStructure?: FileStructure;
    newTabOrder?: TabOrderItem[];
    metadataRequired: boolean;
}

/**
 * Tab information for reorder calculation.
 */
export interface TabInfo {
    type: 'sheet' | 'document';
    index: number; // sheetIndex or docIndex
    tabPosition: number; // position in tab bar (0-indexed)
}

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Derive default tab order from file structure.
 * This is the order when no metadata is needed.
 *
 * Order: [Docs before WB] → [Sheets in physical order] → [Docs after WB]
 */
export function deriveTabOrderFromFile(structure: FileStructure): TabOrderItem[] {
    const tabOrder: TabOrderItem[] = [];

    // Docs physically before Workbook
    for (const docIndex of structure.docsBeforeWb) {
        tabOrder.push({ type: 'document', index: docIndex });
    }

    // Sheets in physical order
    for (const sheetIndex of structure.sheets) {
        tabOrder.push({ type: 'sheet', index: sheetIndex });
    }

    // Docs physically after Workbook
    for (const docIndex of structure.docsAfterWb) {
        tabOrder.push({ type: 'document', index: docIndex });
    }

    return tabOrder;
}

/**
 * Check if metadata is required for the given display order.
 * Metadata is required when display order differs from the order derivable from file.
 */
export function isMetadataRequired(displayOrder: TabOrderItem[], fileStructure: FileStructure): boolean {
    const derivedOrder = deriveTabOrderFromFile(fileStructure);

    if (displayOrder.length !== derivedOrder.length) {
        return true;
    }

    for (let i = 0; i < displayOrder.length; i++) {
        if (displayOrder[i].type !== derivedOrder[i].type || displayOrder[i].index !== derivedOrder[i].index) {
            return true;
        }
    }

    return false;
}

/**
 * Parse tabs array into FileStructure.
 * Determines which docs are before/after Workbook based on tab positions.
 */
export function parseFileStructure(
    tabs: Array<{ type: 'sheet' | 'document' | 'add-sheet'; sheetIndex?: number; docIndex?: number }>
): FileStructure {
    const sheets: number[] = [];
    const docsBeforeWb: number[] = [];
    const docsAfterWb: number[] = [];

    const firstSheetPos = tabs.findIndex((t) => t.type === 'sheet');
    const lastSheetPos = tabs.reduce((acc, t, i) => (t.type === 'sheet' ? i : acc), -1);
    const hasWorkbook = firstSheetPos !== -1;

    for (let i = 0; i < tabs.length; i++) {
        const tab = tabs[i];
        if (tab.type === 'sheet' && tab.sheetIndex !== undefined) {
            sheets.push(tab.sheetIndex);
        } else if (tab.type === 'document' && tab.docIndex !== undefined) {
            if (!hasWorkbook || i < firstSheetPos) {
                docsBeforeWb.push(tab.docIndex);
            } else if (i > lastSheetPos) {
                docsAfterWb.push(tab.docIndex);
            } else {
                // Doc is between sheets in tab order - physically after WB
                docsAfterWb.push(tab.docIndex);
            }
        }
    }

    return { docsBeforeWb, sheets, docsAfterWb, hasWorkbook };
}

/**
 * Determine the reorder action for moving a tab.
 *
 * Implements SPECS.md 8.6 Tab Reorder Test Matrix.
 */
export function determineReorderAction(
    tabs: Array<{ type: 'sheet' | 'document' | 'add-sheet'; sheetIndex?: number; docIndex?: number }>,
    fromIndex: number,
    toIndex: number
): ReorderAction {
    if (fromIndex === toIndex) {
        return { actionType: 'no-op', metadataRequired: false };
    }

    const fromTab = tabs[fromIndex];
    const toTab = toIndex < tabs.length ? tabs[toIndex] : null;

    const firstSheetIdx = tabs.findIndex((t) => t.type === 'sheet');
    const lastSheetIdx = tabs.reduce((acc, t, i) => (t.type === 'sheet' ? i : acc), -1);
    const hasWorkbook = firstSheetIdx !== -1;
    const sheetCount = tabs.filter((t) => t.type === 'sheet').length;

    // Helper: simulate new tab order after move
    const computeNewTabOrder = (): typeof tabs => {
        const newTabs = [...tabs];
        const [moved] = newTabs.splice(fromIndex, 1);
        const insertIdx = fromIndex < toIndex ? toIndex - 1 : toIndex;
        newTabs.splice(insertIdx, 0, moved);
        return newTabs;
    };

    // ========================================================================
    // Sheet Movement
    // ========================================================================
    if (fromTab.type === 'sheet') {
        const fromSheetIndex = fromTab.sheetIndex!;

        // S1, S2: Sheet → Sheet (Physical reorder within Workbook)
        if (toTab?.type === 'sheet') {
            const toSheetIndex = toTab.sheetIndex!;
            return {
                actionType: 'physical',
                physicalMove: { type: 'move-sheet', fromSheetIndex, toSheetIndex },
                metadataRequired: false
            };
        }

        // S3-S6: Sheet → Document Position
        // Per Fundamental Principle: Moving Sheet to Doc position moves entire Workbook
        if (toTab?.type === 'document' || toIndex <= firstSheetIdx || toIndex > lastSheetIdx) {
            const newTabs = computeNewTabOrder();
            const newFirstSheetIdx = newTabs.findIndex((t) => t.type === 'sheet');

            // Check if Workbook needs to move
            if (newFirstSheetIdx === 0 && firstSheetIdx > 0) {
                // Sheet is now first in tab order, but there's a Doc before WB in file
                // → Move Workbook before that Doc
                const docBeforeWb = tabs.find((t, i) => t.type === 'document' && i < firstSheetIdx);
                if (docBeforeWb) {
                    return {
                        actionType: 'physical+metadata',
                        physicalMove: {
                            type: 'move-workbook',
                            direction: 'before-doc',
                            targetDocIndex: docBeforeWb.docIndex!
                        },
                        metadataRequired: true
                    };
                }
            }

            // Check if Workbook needs to move after a Doc
            if (newFirstSheetIdx > 0) {
                // There's a Doc before Sheet in new tab order
                // → Move Workbook to after the last Doc before the first Sheet in new order
                const docsBeforeSheet = newTabs.slice(0, newFirstSheetIdx).filter((t) => t.type === 'document');
                if (docsBeforeSheet.length > 0) {
                    const lastDocBeforeSheet = docsBeforeSheet[docsBeforeSheet.length - 1];
                    return {
                        actionType: 'physical+metadata',
                        physicalMove: {
                            type: 'move-workbook',
                            direction: 'after-doc',
                            targetDocIndex: lastDocBeforeSheet.docIndex!
                        },
                        metadataRequired: true
                    };
                }
            }

            // Sheet → end (add-sheet position)
            if (toTab?.type === 'add-sheet' || !toTab) {
                return {
                    actionType: 'physical',
                    physicalMove: { type: 'move-sheet', fromSheetIndex, toSheetIndex: sheetCount },
                    metadataRequired: false
                };
            }
        }

        // Fallback: metadata only
        const newTabs = computeNewTabOrder();
        const newStructure = parseFileStructure(newTabs);
        const newTabOrder = newTabs
            .filter((t) => t.type === 'sheet' || t.type === 'document')
            .map((t) => ({
                type: t.type as 'sheet' | 'document',
                index: t.type === 'sheet' ? t.sheetIndex! : t.docIndex!
            }));

        return {
            actionType: 'metadata',
            newTabOrder,
            metadataRequired: isMetadataRequired(newTabOrder, newStructure)
        };
    }

    // ========================================================================
    // Document Movement
    // ========================================================================
    if (fromTab.type === 'document') {
        const fromDocIndex = fromTab.docIndex!;

        // D1-D3: Document → Document (Physical move)
        if (toTab?.type === 'document') {
            const toDocIndex = toTab.docIndex!;
            return {
                actionType: 'physical',
                physicalMove: {
                    type: 'move-document',
                    fromDocIndex,
                    toDocIndex,
                    toAfterWorkbook: false,
                    toBeforeWorkbook: false
                },
                metadataRequired: false
            };
        }

        if (!hasWorkbook) {
            // No workbook - just metadata
            return { actionType: 'metadata', metadataRequired: false };
        }

        // D4: Doc before WB to after WB (to end position)
        // D5: Doc after WB to before WB (to start position)
        // If moving to natural boundary position: Physical only (tab order = file order)
        // If moving to position with other content: Physical + Metadata

        const isFromBeforeWb = fromIndex < firstSheetIdx;
        const isToBeforeWb = toIndex <= firstSheetIdx;
        const isToAfterWb = toIndex > lastSheetIdx;

        if (isFromBeforeWb && isToAfterWb) {
            // D4: Doc before WB → after WB
            // Check if moving to last position (natural file order)
            const docsAfterWb = tabs.filter((t, i) => t.type === 'document' && i > lastSheetIdx);
            const isToNaturalEnd = toIndex >= tabs.length - 1 || (docsAfterWb.length === 0 && isToAfterWb);

            return {
                actionType: isToNaturalEnd ? 'physical' : 'physical+metadata',
                physicalMove: {
                    type: 'move-document',
                    fromDocIndex,
                    toDocIndex: null,
                    toAfterWorkbook: true,
                    toBeforeWorkbook: false
                },
                metadataRequired: !isToNaturalEnd
            };
        }

        if (!isFromBeforeWb && isToBeforeWb) {
            // D5: Doc after WB → before WB
            // Check if moving to first position (natural file order)
            const docsBeforeWb = tabs.filter((t, i) => t.type === 'document' && i < firstSheetIdx);
            const isToNaturalStart = toIndex === 0 || (docsBeforeWb.length === 0 && isToBeforeWb);

            return {
                actionType: isToNaturalStart ? 'physical' : 'physical+metadata',
                physicalMove: {
                    type: 'move-document',
                    fromDocIndex,
                    toDocIndex: null,
                    toAfterWorkbook: false,
                    toBeforeWorkbook: true
                },
                metadataRequired: !isToNaturalStart
            };
        }

        // D6: Doc before WB → between Sheets (Physical move + metadata)
        if (isFromBeforeWb && !isToBeforeWb && !isToAfterWb) {
            return {
                actionType: 'physical+metadata',
                physicalMove: {
                    type: 'move-document',
                    fromDocIndex,
                    toDocIndex: null,
                    toAfterWorkbook: true,
                    toBeforeWorkbook: false
                },
                metadataRequired: true
            };
        }

        // D7: Doc after WB → between Sheets (Metadata only, already after WB)
        if (!isFromBeforeWb && !isToBeforeWb && !isToAfterWb) {
            const newTabs = computeNewTabOrder();
            const newTabOrder = newTabs
                .filter((t) => t.type === 'sheet' || t.type === 'document')
                .map((t) => ({
                    type: t.type as 'sheet' | 'document',
                    index: t.type === 'sheet' ? t.sheetIndex! : t.docIndex!
                }));

            return {
                actionType: 'metadata',
                newTabOrder,
                metadataRequired: true
            };
        }

        // D4/D5: Doc → Workbook boundary
        if (isToBeforeWb) {
            return {
                actionType: 'physical',
                physicalMove: {
                    type: 'move-document',
                    fromDocIndex,
                    toDocIndex: null,
                    toAfterWorkbook: false,
                    toBeforeWorkbook: true
                },
                metadataRequired: false
            };
        }

        if (isToAfterWb) {
            return {
                actionType: 'physical',
                physicalMove: {
                    type: 'move-document',
                    fromDocIndex,
                    toDocIndex: null,
                    toAfterWorkbook: true,
                    toBeforeWorkbook: false
                },
                metadataRequired: false
            };
        }
    }

    // Fallback
    return { actionType: 'no-op', metadataRequired: false };
}
