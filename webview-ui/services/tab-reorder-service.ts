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

        // Compute new tab order for metadata necessity check
        const newTabs = computeNewTabOrder();
        const newTabOrder = newTabs
            .filter((t) => t.type === 'sheet' || t.type === 'document')
            .map((t) => ({
                type: t.type as 'sheet' | 'document',
                index: t.type === 'sheet' ? t.sheetIndex! : t.docIndex!
            }));
        const currentStructure = parseFileStructure(tabs);
        const needsMetadata = isMetadataRequired(newTabOrder, currentStructure);

        // S1, S2: Sheet → Sheet (Physical reorder within Workbook)
        // This includes:
        // - Moving to a sheet position (toTab?.type === 'sheet')
        // - Moving to just after last sheet (toIndex between firstSheetIdx and lastSheetIdx+1)
        //   but only if there's no doc at that position OR doc isn't between sheets
        const targetIsWithinSheetRange = toIndex >= firstSheetIdx && toIndex <= lastSheetIdx + 1;
        const isSheetToSheetMove =
            toTab?.type === 'sheet' ||
            (targetIsWithinSheetRange && toIndex === lastSheetIdx + 1 && firstSheetIdx === 0);

        if (isSheetToSheetMove) {
            // Compute the target sheet index for the swap
            const toSheetIndex = toTab?.type === 'sheet' ? toTab.sheetIndex! : sheetCount - 1;

            // Check if new order has docs before sheets (requires WB move)
            // Only if docs weren't already before WB in current order
            const oldFirstSheetIdx = firstSheetIdx;
            const newFirstSheetIdx = newTabs.findIndex((t) => t.type === 'sheet');

            // WB move needed only if: (1) there are now docs before sheets, AND
            // (2) there weren't docs before sheets in original order
            const docsWereBeforeWb = oldFirstSheetIdx > 0;
            const docsNowBeforeWb = newFirstSheetIdx > 0;

            if (docsNowBeforeWb && !docsWereBeforeWb) {
                // New: docs appeared before sheets - WB needs to move after those docs
                const docsBeforeSheet = newTabs.slice(0, newFirstSheetIdx).filter((t) => t.type === 'document');
                if (docsBeforeSheet.length > 0) {
                    const lastDocBeforeSheet = docsBeforeSheet[docsBeforeSheet.length - 1];
                    const wbNewStructure = parseFileStructure(newTabs);
                    const wbNeedsMetadata = isMetadataRequired(newTabOrder, wbNewStructure);
                    return {
                        actionType: 'physical+metadata',
                        physicalMove: {
                            type: 'move-workbook',
                            direction: 'after-doc',
                            targetDocIndex: lastDocBeforeSheet.docIndex!
                        },
                        newTabOrder,
                        metadataRequired: wbNeedsMetadata
                    };
                }
            }

            // For sheet-to-sheet swaps, only need metadata if doc positions relative to sheets change
            // In a simple sheet swap (all sheets still contiguous and before docs), no metadata needed
            const oldDocPositions = tabs.filter((t) => t.type === 'document').map((t) => t.docIndex);
            const newDocPositions = newTabs.filter((t) => t.type === 'document').map((t) => t.docIndex);
            const docOrderChanged = JSON.stringify(oldDocPositions) !== JSON.stringify(newDocPositions);

            // Check if any doc is between sheets (not just before first sheet)
            // Doc is "between" if: firstSheet < doc < lastSheet in tab order
            const newFirstSheetTabIdx = newTabs.findIndex((t) => t.type === 'sheet');
            const newLastSheetTabIdx = newTabs.reduce((acc, t, i) => (t.type === 'sheet' ? i : acc), -1);
            const docMovedBetweenSheets = newTabs.some(
                (t, i) => t.type === 'document' && i > newFirstSheetTabIdx && i < newLastSheetTabIdx
            );

            const sheetSwapNeedsMetadata =
                docOrderChanged || docMovedBetweenSheets || (needsMetadata && newFirstSheetIdx !== oldFirstSheetIdx);

            return {
                actionType: sheetSwapNeedsMetadata ? 'metadata' : 'physical',
                physicalMove: sheetSwapNeedsMetadata ? undefined : { type: 'move-sheet', fromSheetIndex, toSheetIndex },
                newTabOrder: sheetSwapNeedsMetadata ? newTabOrder : undefined,
                metadataRequired: sheetSwapNeedsMetadata
            };
        }

        // S3-S6: Sheet → Document Position
        // Per Fundamental Principle: Moving Sheet to Doc position moves entire Workbook
        if (toTab?.type === 'document' || toIndex <= firstSheetIdx || toIndex > lastSheetIdx) {
            const sheetDocTabs = computeNewTabOrder();
            const newFirstSheetIdx = sheetDocTabs.findIndex((t) => t.type === 'sheet');

            // Compute needsMetadata for move-workbook cases
            const wbNewTabOrder = sheetDocTabs
                .filter((t) => t.type === 'sheet' || t.type === 'document')
                .map((t) => ({
                    type: t.type as 'sheet' | 'document',
                    index: t.type === 'sheet' ? t.sheetIndex! : t.docIndex!
                }));
            const wbNewStructure = parseFileStructure(sheetDocTabs);
            const wbNeedsMetadata = isMetadataRequired(wbNewTabOrder, wbNewStructure);

            // C8 Case: Sheet moves to inside doc range (between docs or after a doc that's before other sheets)
            // Example: [S1, S2, D1, D2] → S1 to after D1 → [S2, D1, S1, D2]
            // In this case, S1 needs to be physically last in the workbook so display can show it after D1
            const movedSheetPosInNew = sheetDocTabs.findIndex(
                (t) => t.type === 'sheet' && t.sheetIndex === fromSheetIndex
            );
            const isMovedSheetInsideDocRange =
                movedSheetPosInNew > newFirstSheetIdx && movedSheetPosInNew < sheetDocTabs.length;

            // Check if there are docs between the moved sheet and the first sheet
            const hasDocsBetweenFirstAndMoved = sheetDocTabs
                .slice(newFirstSheetIdx, movedSheetPosInNew)
                .some((t) => t.type === 'document');

            // Only need physical move if the sheet is NOT already last in the workbook
            const isSheetAlreadyLast = fromSheetIndex === sheetCount - 1;

            if (isMovedSheetInsideDocRange && hasDocsBetweenFirstAndMoved && !isSheetAlreadyLast) {
                // This sheet is now displayed after some docs - need to physically move it last in WB
                return {
                    actionType: 'physical+metadata',
                    physicalMove: {
                        type: 'move-sheet',
                        fromSheetIndex,
                        toSheetIndex: sheetCount - 1 // Move to last position in workbook
                    },
                    newTabOrder: wbNewTabOrder,
                    metadataRequired: true
                };
            }

            // Check if Workbook needs to move
            if (newFirstSheetIdx === 0 && firstSheetIdx > 0) {
                // Sheet is now first in tab order, but there's a Doc before WB in file
                // → Move Workbook before that Doc
                const docBeforeWb = tabs.find((t, i) => t.type === 'document' && i < firstSheetIdx);
                if (docBeforeWb) {
                    // Single sheet WB doesn't need metadata (SPECS.md S3/S4)
                    const needsMeta = sheetCount > 1 && wbNeedsMetadata;
                    return {
                        actionType: needsMeta ? 'physical+metadata' : 'physical',
                        physicalMove: {
                            type: 'move-workbook',
                            direction: 'before-doc',
                            targetDocIndex: docBeforeWb.docIndex!
                        },
                        metadataRequired: needsMeta
                    };
                }
            }

            // Check if Workbook needs to move after a Doc
            if (newFirstSheetIdx > 0) {
                // There's a Doc before Sheet in new tab order
                // → Move Workbook to after the last Doc before the first Sheet in new order
                const docsBeforeSheet = sheetDocTabs.slice(0, newFirstSheetIdx).filter((t) => t.type === 'document');
                if (docsBeforeSheet.length > 0) {
                    const lastDocBeforeSheet = docsBeforeSheet[docsBeforeSheet.length - 1];
                    // Single sheet WB doesn't need metadata (SPECS.md S3/S4)
                    const needsMeta = sheetCount > 1 && wbNeedsMetadata;
                    return {
                        actionType: needsMeta ? 'physical+metadata' : 'physical',
                        physicalMove: {
                            type: 'move-workbook',
                            direction: 'after-doc',
                            targetDocIndex: lastDocBeforeSheet.docIndex!
                        },
                        metadataRequired: needsMeta
                    };
                }
            }

            // Sheet → end (add-sheet position)
            // But only if it changes physical position (sheet not already last)
            if (toTab?.type === 'add-sheet' || !toTab) {
                const isAlreadyLastSheet = fromSheetIndex === sheetCount - 1;
                if (!isAlreadyLastSheet) {
                    return {
                        actionType: 'physical',
                        physicalMove: { type: 'move-sheet', fromSheetIndex, toSheetIndex: sheetCount },
                        metadataRequired: false
                    };
                }
                // If already last sheet moving to end, check if metadata is needed
                // (e.g., if there are docs and sheet is moving to after them in display)
                if (wbNeedsMetadata) {
                    return {
                        actionType: 'metadata',
                        newTabOrder: wbNewTabOrder,
                        metadataRequired: true
                    };
                }
            }
        }

        // Fallback: metadata only (use already computed newTabOrder, newTabs)
        const fallbackStructure = parseFileStructure(newTabs);

        return {
            actionType: 'metadata',
            newTabOrder,
            metadataRequired: isMetadataRequired(newTabOrder, fallbackStructure)
        };
    }

    // ========================================================================
    // Document Movement
    // ========================================================================
    if (fromTab.type === 'document') {
        const fromDocIndex = fromTab.docIndex!;

        const isFromBeforeWb = fromIndex < firstSheetIdx;
        const isToBeforeWb = toIndex <= firstSheetIdx;
        const isToAfterWb = toIndex > lastSheetIdx;
        const isFromBetweenSheets = fromIndex > firstSheetIdx && fromIndex < lastSheetIdx;

        // Compute new tab order after move
        const newTabs = computeNewTabOrder();
        const newTabOrder = newTabs
            .filter((t) => t.type === 'sheet' || t.type === 'document')
            .map((t) => ({
                type: t.type as 'sheet' | 'document',
                index: t.type === 'sheet' ? t.sheetIndex! : t.docIndex!
            }));

        // For metadata-only moves (isFromBetweenSheets), physical structure doesn't change
        // So we compare new tab order with CURRENT physical structure
        const currentStructure = parseFileStructure(tabs);

        // Case 1: Doc is displayed between sheets (via metadata)
        if (isFromBetweenSheets) {
            // Sub-case 1a: Moving to before WB - needs physical move
            if (isToBeforeWb) {
                const newStructure = parseFileStructure(newTabs);
                const needsMetadata = isMetadataRequired(newTabOrder, newStructure);
                return {
                    actionType: needsMetadata ? 'physical+metadata' : 'physical+metadata',
                    physicalMove: {
                        type: 'move-document',
                        fromDocIndex,
                        toDocIndex: null,
                        toAfterWorkbook: false,
                        toBeforeWorkbook: true
                    },
                    newTabOrder,
                    metadataRequired: needsMetadata
                };
            }
            // Sub-case 1b: Moving within/after sheets - metadata-only
            const needsMetadata = isMetadataRequired(newTabOrder, currentStructure);
            return {
                actionType: 'metadata',
                newTabOrder,
                metadataRequired: needsMetadata
            };
        }

        // For physical moves, compute what the structure will be after the move
        const newStructure = parseFileStructure(newTabs);
        const needsMetadata = isMetadataRequired(newTabOrder, newStructure);

        // Case 2: Doc → Doc (both on same side of WB, not between sheets)
        const prevTab = toIndex > 0 ? tabs[toIndex - 1] : null;
        if (prevTab?.type === 'document' && prevTab !== fromTab) {
            const toDocIndex = prevTab.docIndex!;
            return {
                actionType: 'physical',
                physicalMove: {
                    type: 'move-document',
                    fromDocIndex,
                    toDocIndex,
                    toAfterWorkbook: false,
                    toBeforeWorkbook: false
                },
                metadataRequired: needsMetadata
            };
        }

        if (!hasWorkbook) {
            return { actionType: 'metadata', metadataRequired: needsMetadata };
        }

        // Case 3: Doc crosses WB boundary
        if (isFromBeforeWb && isToAfterWb) {
            // Doc before WB → after WB
            return {
                actionType: needsMetadata ? 'physical+metadata' : 'physical',
                physicalMove: {
                    type: 'move-document',
                    fromDocIndex,
                    toDocIndex: null,
                    toAfterWorkbook: true,
                    toBeforeWorkbook: false
                },
                metadataRequired: needsMetadata
            };
        }

        if (!isFromBeforeWb && isToBeforeWb) {
            // Doc after WB → before WB
            return {
                actionType: needsMetadata ? 'physical+metadata' : 'physical',
                physicalMove: {
                    type: 'move-document',
                    fromDocIndex,
                    toDocIndex: null,
                    toAfterWorkbook: false,
                    toBeforeWorkbook: true
                },
                metadataRequired: needsMetadata
            };
        }

        // Case 4: Doc → between sheets
        if (!isToBeforeWb && !isToAfterWb) {
            // D8 case: If moving doc that is after WB and it will now appear
            // before other docs (in tab order) that were physically before it,
            // we need to physically reorder the docs.
            if (!isFromBeforeWb) {
                // Check if this doc's display position among docs-after-WB changed
                // Find docs after WB in original order
                const docsAfterWbOriginal = tabs
                    .filter((t) => t.type === 'document')
                    .filter((_, i, arr) => {
                        // Check if this doc was after WB by comparing with firstSheetIdx
                        const docTab = tabs.find((t) => t.type === 'document' && t.docIndex === arr[i].docIndex);
                        if (!docTab) return false;
                        return tabs.indexOf(docTab) > firstSheetIdx;
                    })
                    .map((t) => t.docIndex!);

                // In new tab order, get the order of docs that will be after WB
                const newDocsOrder = newTabOrder.filter((t) => t.type === 'document').map((t) => t.index);

                // Find the first doc in new display order that's between sheets or after last sheet
                // This is the doc that should be first physically
                const firstDocInNewOrder = newDocsOrder[0];
                const firstDocInPhysicalOrder = docsAfterWbOriginal[0];

                if (firstDocInNewOrder !== firstDocInPhysicalOrder && firstDocInNewOrder === fromDocIndex) {
                    // This doc is now first in display, but wasn't first physically
                    // Need to physically move it to the start of docs-after-WB
                    // Use toAfterWorkbook=true to insert right after WB (= before all other docs)

                    // Remap docIndex values in newTabOrder:
                    // - fromDocIndex becomes 0 (first in file)
                    // - docs that were at index < fromDocIndex stay the same
                    // - docs that were at index >= firstDocInPhysicalOrder and < fromDocIndex get +1
                    const remappedTabOrder = newTabOrder.map((item) => {
                        if (item.type !== 'document') return item;
                        if (item.index === fromDocIndex) {
                            // Moving doc becomes first
                            return { ...item, index: firstDocInPhysicalOrder };
                        } else if (item.index >= firstDocInPhysicalOrder && item.index < fromDocIndex) {
                            // Docs between first and fromDoc shift down by 1
                            return { ...item, index: item.index + 1 };
                        }
                        return item;
                    });

                    return {
                        actionType: 'physical+metadata',
                        physicalMove: {
                            type: 'move-document' as const,
                            fromDocIndex,
                            toDocIndex: null,
                            toAfterWorkbook: true,
                            toBeforeWorkbook: false
                        },
                        newTabOrder: remappedTabOrder,
                        metadataRequired: needsMetadata
                    };
                }
            }

            return {
                actionType: isFromBeforeWb ? 'physical+metadata' : 'metadata',
                physicalMove: isFromBeforeWb
                    ? {
                          type: 'move-document' as const,
                          fromDocIndex,
                          toDocIndex: null,
                          toAfterWorkbook: true,
                          toBeforeWorkbook: false
                      }
                    : undefined,
                newTabOrder,
                metadataRequired: needsMetadata
            };
        }

        // Fallback: physical only to boundary
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
                metadataRequired: needsMetadata
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
                metadataRequired: needsMetadata
            };
        }
    }

    // Fallback
    return { actionType: 'no-op', metadataRequired: false };
}
