/**
 * Tab Reorder Service
 *
 * Pure functions for determining tab reorder actions.
 * Implements SPECS.md 8.6 Tab Reorder Test Matrix via Finite Pattern Architecture.
 *
 * Architecture:
 * - determineReorderAction (Dispatcher)
 *   - handleSheetToSheet
 *   - handleSheetToDoc
 *   - handleDocToDoc
 *   - handleDocToSheet
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

export interface TabInfo {
    type: 'sheet' | 'document' | 'add-sheet';
    sheetIndex?: number;
    docIndex?: number;
}

// =============================================================================
// Finite Pattern Types (SPECS.md 8.6.8)
// =============================================================================

/**
 * Sheet → Sheet patterns (within Workbook)
 * @see SPECS.md 8.6.8 Sheet → Sheet (In-Workbook)
 */
export type SheetToSheetPattern =
    | 'SS1_adjacent_no_docs'           // Adjacent swap, no docs present
    | 'SS2_adjacent_with_docs'          // Adjacent swap, docs exist
    | 'SS3_non_adjacent';               // Non-adjacent swap

/**
 * Sheet → Document patterns (Workbook moves or metadata)
 * @see SPECS.md 8.6.8 Sheet → Before/After Document
 */
export type SheetToDocPattern =
    // Before Document
    | 'SBD1_single_before_doc'          // Single sheet before doc
    | 'SBD2_multi_before_doc'           // Multi-sheet, one before doc
    // After Document  
    | 'SAD1_single_after_doc'           // Single sheet after doc
    | 'SAD2_multi_after_no_reorder'     // Multi-sheet after doc, no sheet reorder
    | 'SAD3_doc_first_order_same'       // Doc first, sheets contiguous, order same (H9)
    | 'SAD4_doc_first_order_differs'    // Doc first, sheets contiguous, order differs (H11)
    | 'SAD5_sheet_past_docs'            // Sheet to end across docs (H10)
    // Inside Doc Range (C8)
    | 'SIDR1_inside_not_last'           // Non-last sheet to doc range
    | 'SIDR2_inside_already_last';      // Last sheet to doc range

/**
 * Document → Document patterns
 * @see SPECS.md 8.6.8 Document → Document
 */
export type DocToDocPattern =
    | 'DD1_both_before_wb'              // Both before WB
    | 'DD2_both_after_wb'               // Both after WB
    | 'DD3_cross_before_to_after'       // Cross WB: before→after
    | 'DD4_cross_after_to_before'       // Cross WB: after→before
    | 'DD5_interleaved_reorder';        // Interleaved docs reorder

/**
 * Document → Between Sheets patterns
 * @see SPECS.md 8.6.8 Document → Between Sheets
 */
export type DocToSheetPattern =
    | 'DBS1_before_wb_to_between'       // Doc before WB → between sheets
    | 'DBS2_after_wb_no_move'           // Doc after WB, already in position
    | 'DBS3_after_wb_reorder';          // Doc after WB needs reorder

/**
 * Context for pattern classification
 */
export interface PatternContext {
    tabs: TabInfo[];
    fromIndex: number;
    toIndex: number;
    fromTab: TabInfo;
    toTab: TabInfo | undefined;
    newTabs: TabInfo[];
    newTabOrder: TabOrderItem[];
    currentFileStructure: FileStructure;
    sheetCount: number;
}


// =============================================================================
// Core Functions
// =============================================================================

export function deriveTabOrderFromFile(structure: FileStructure): TabOrderItem[] {
    const tabOrder: TabOrderItem[] = [];
    for (const docIndex of structure.docsBeforeWb) {
        tabOrder.push({ type: 'document', index: docIndex });
    }
    for (const sheetIndex of structure.sheets) {
        tabOrder.push({ type: 'sheet', index: sheetIndex });
    }
    for (const docIndex of structure.docsAfterWb) {
        tabOrder.push({ type: 'document', index: docIndex });
    }
    return tabOrder;
}

export function isMetadataRequired(displayOrder: TabOrderItem[], fileStructure: FileStructure): boolean {
    const derivedOrder = deriveTabOrderFromFile(fileStructure);
    if (displayOrder.length !== derivedOrder.length) return true;
    for (let i = 0; i < displayOrder.length; i++) {
        if (displayOrder[i].type !== derivedOrder[i].type || displayOrder[i].index !== derivedOrder[i].index) {
            return true;
        }
    }
    return false;
}

export function parseFileStructure(tabs: Array<TabInfo>): FileStructure {
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
                docsAfterWb.push(tab.docIndex);
            }
        }
    }

    return { docsBeforeWb, sheets, docsAfterWb, hasWorkbook };
}

// =============================================================================
// Pattern Classifiers (SPECS.md 8.6.8)
// =============================================================================

/**
 * Build PatternContext for classification
 */
function buildPatternContext(
    tabs: TabInfo[],
    fromIndex: number,
    toIndex: number
): PatternContext {
    const fromTab = tabs[fromIndex];
    const toTab = toIndex < tabs.length ? tabs[toIndex] : undefined;
    const sheetCount = tabs.filter((t) => t.type === 'sheet').length;

    // Simulate new order
    const newTabs = [...tabs];
    const [movedTab] = newTabs.splice(fromIndex, 1);
    const insertionIndex = fromIndex < toIndex ? toIndex - 1 : toIndex;
    newTabs.splice(insertionIndex, 0, movedTab);

    // Build newTabOrder
    const newTabOrder = newTabs
        .filter((t) => t.type === 'sheet' || t.type === 'document')
        .map((t) => ({
            type: t.type as 'sheet' | 'document',
            index: t.type === 'sheet' ? t.sheetIndex! : t.docIndex!
        }));

    const currentFileStructure = parseFileStructure(tabs);

    return {
        tabs,
        fromIndex,
        toIndex,
        fromTab,
        toTab,
        newTabs,
        newTabOrder,
        currentFileStructure,
        sheetCount
    };
}

/**
 * Classify Sheet → Document patterns
 * @see SPECS.md 8.6.8
 */
function classifySheetToDocPattern(ctx: PatternContext): SheetToDocPattern {
    const { newTabOrder, currentFileStructure, sheetCount, fromTab } = ctx;

    // Check if this is "inside doc range" (C8 family)
    // Find where the sheet landed relative to other sheets
    const movedSheetIdx = fromTab.sheetIndex!;
    const sheetPositions = newTabOrder
        .map((item, idx) => (item.type === 'sheet' ? idx : -1))
        .filter((idx) => idx !== -1);

    const movedSheetNewPos = newTabOrder.findIndex(
        (item) => item.type === 'sheet' && item.index === movedSheetIdx
    );

    // Check for doc-between-sheets scenario (sheet after a doc)
    const firstSheetPos = sheetPositions.length > 0 ? sheetPositions[0] : -1;
    const lastSheetPos = sheetPositions.length > 0 ? sheetPositions[sheetPositions.length - 1] : -1;

    // Is sheet isolated (after first sheet but surrounded by docs)?
    const isAfterFirstSheet = movedSheetNewPos > firstSheetPos;
    const hasDocBefore = movedSheetNewPos > 0 && newTabOrder[movedSheetNewPos - 1].type === 'document';

    if (isAfterFirstSheet && hasDocBefore && sheetCount > 1) {
        // C8 family: sheet inside doc range
        const isLastPhysicalSheet = movedSheetIdx === sheetCount - 1;
        return isLastPhysicalSheet ? 'SIDR2_inside_already_last' : 'SIDR1_inside_not_last';
    }

    // Check if doc becomes first (H9/H11 family)
    if (newTabOrder.length > 0 && newTabOrder[0].type === 'document') {
        const firstDocIdx = newTabOrder[0].index;
        const isPhysicallyAfterWb = currentFileStructure.docsAfterWb.includes(firstDocIdx);

        if (isPhysicallyAfterWb) {
            // Check sheet contiguity and order
            const sheetIndices = newTabOrder
                .filter((item) => item.type === 'sheet')
                .map((item) => item.index);

            const physicalSheetOrder = currentFileStructure.sheets.slice().sort((a, b) => a - b);

            // Are sheets contiguous in newTabOrder?
            let sheetsContiguous = true;
            let prevWasSheet = false;
            for (const item of newTabOrder.slice(1)) { // skip first (doc)
                if (item.type === 'sheet') {
                    if (!prevWasSheet && newTabOrder.indexOf(item) > 1) {
                        // Check if there's a doc gap
                        const prevItem = newTabOrder[newTabOrder.indexOf(item) - 1];
                        if (prevItem.type === 'document') {
                            // This sheet comes after a doc that comes after a sheet
                            const itemsBeforeThis = newTabOrder.slice(1, newTabOrder.indexOf(item));
                            const hasSheetBeforeDoc = itemsBeforeThis.some((i) => i.type === 'sheet');
                            if (hasSheetBeforeDoc) {
                                sheetsContiguous = false;
                                break;
                            }
                        }
                    }
                    prevWasSheet = true;
                } else {
                    prevWasSheet = false;
                }
            }

            if (sheetsContiguous) {
                // Check if sheet order matches physical
                const visualSheetOrder = sheetIndices;
                const orderMatches =
                    visualSheetOrder.length === physicalSheetOrder.length &&
                    visualSheetOrder.every((v, i) => v === physicalSheetOrder[i]);

                return orderMatches ? 'SAD3_doc_first_order_same' : 'SAD4_doc_first_order_differs';
            }

            // Sheets not contiguous (H10-like)
            return 'SAD5_sheet_past_docs';
        }
    }

    // Single vs Multi-sheet workbook
    if (sheetCount === 1) {
        // Check direction: before or after doc?
        const newWbPos = ctx.newTabs.findIndex((t) => t.type === 'sheet');
        const firstDocPos = ctx.newTabs.findIndex((t) => t.type === 'document');

        if (newWbPos < firstDocPos || firstDocPos === -1) {
            return 'SBD1_single_before_doc';
        }
        return 'SAD1_single_after_doc';
    }

    // Multi-sheet: before or after doc
    const movingSheetPos = ctx.newTabs.findIndex(
        (t) => t.type === 'sheet' && t.sheetIndex === fromTab.sheetIndex
    );
    const firstDoc = ctx.newTabs.find((t) => t.type === 'document');
    const firstDocPos = firstDoc ? ctx.newTabs.indexOf(firstDoc) : -1;

    if (movingSheetPos < firstDocPos || firstDocPos === -1) {
        return 'SBD2_multi_before_doc';
    }

    return 'SAD2_multi_after_no_reorder';
}

// =============================================================================
// Finite Pattern Handlers
// =============================================================================

/**
 * Handle Sheet -> Sheet (Within Workbook)
 */
function handleSheetToSheet(
    fromIndex: number,
    toIndex: number,
    tabs: TabInfo[]
): ReorderAction {
    const fromTab = tabs[fromIndex];
    const toTab = tabs[toIndex]; // May be undefined if append
    const sheetCount = tabs.filter(t => t.type === 'sheet').length;

    // Determine Target Sheet Index
    let toSheetIndex: number;

    // Optimization: Check for Physical No-Op / Natural Order Restoration
    const newTabs = [...tabs];
    const [movedTab] = newTabs.splice(fromIndex, 1);

    // Adjust insertion index if we moved from left to right (because removal shifted indices)
    const insertionIndex = fromIndex < toIndex ? toIndex - 1 : toIndex;
    newTabs.splice(insertionIndex, 0, movedTab);

    // Filter out 'add-sheet' which is a UI-only tab and should not be in metadata
    const newTabOrder = newTabs
        .filter(t => t.type !== 'add-sheet')
        .map(t => ({
            type: t.type as 'sheet' | 'document',
            index: t.type === 'sheet' ? t.sheetIndex! : t.docIndex!
        }));

    const currentFileStructure = parseFileStructure(tabs);
    // Sort sheets to represent True Physical Order
    currentFileStructure.sheets.sort((a, b) => a - b);

    // If the Desired Order (newTabs) matches the CURRENT Physical Structure,
    // we don't need a physical move. We just need to remove metadata (restoring natural order).
    if (!isMetadataRequired(newTabOrder, currentFileStructure)) {
        return {
            actionType: 'metadata',
            newTabOrder: null,
            metadataRequired: false
        };
    }

    if (toTab && toTab.type === 'sheet') {
        toSheetIndex = toTab.sheetIndex!;
    } else {
        // Appending to end of sheets (or moved past last sheet)
        // If it's an append, index is count. 
        // Logic: if moving generally to 'end', we execute physical move to last index
        toSheetIndex = sheetCount;

        // Refinement: If insert into specific sheet slot (even if not 'append' to full list)
        // But here we rely on 'Is Inside Workbook' check from dispatcher
    }

    // Safety check: Don't move if index is same (though dispatcher handles no-op)
    // Actually, 'move-sheet' logic in API handles reordering. 

    // ADJUSTMENT for Physical Splice Logic:
    // If moving RIGHT (from < to), the target index shifts down by 1 after removal.
    // We must decrement toSheetIndex to insert "Before" the target in the post-removal array.
    // However, if we are appending (toSheetIndex === sheetCount), we don't decrement?
    // Case 0->2 (Target S3, idx 2). Count 3. 2 != 3.
    // We want outcome [S2, S1, S3]. S1 at index 1.
    // moveSheet(0, 1) -> Correct.
    // So if from < to, decrement.

    if (fromIndex < toIndex && toSheetIndex < sheetCount) {
        // Only decrement if we are NOT appending to the very end
        // Wait, if toSheetIndex == sheetCount, we append.
        // If we drop past last sheet, toSheetIndex is set to sheetCount above.
        // If we drop "Before S3" (Idx 2), we want Idx 1.
        // So yes, decrement.
        toSheetIndex--;
    }

    // Check if we need metadata? Only if structure is complex?
    // S1, S2 case: Pure physical.

    // Special Check: Is the move effectively a NO-OP for physical layer?
    // e.g. moving 0 to 1 (insert before 1) -> 0,1. No change.

    // Predicte Physical Structure after Move
    const predictedFileStructure = parseFileStructure(tabs);
    // Sort logic from before is irrelevant if we simply simulate the splice on the sheets array?
    // Actually, currentFileStructure.sheets IS the sorted list of indices [0, 1, 2...].
    // If we move sheet 0 to 0, it remains [0, 1, 2...].
    // If we move sheet 0 to 1, it becomes [1, 0, 2...] ? NO.
    // moveSheet reorders content. The indices 0, 1, 2... refer to POSITIONS in the new array.
    // So the 'sheets' part of file structure ALWAYS remains [0, 1, 2...] physically (unless we deleted?).
    // No, wait. 
    // FileStructure.sheets is list of ID-like indices?
    // No. parseFileStructure pushes tab.sheetIndex.
    // If we move sheet 0 to position 1.
    // The sheet that WAS 0 is now at position 1.
    // The sheet that WAS 1 is now at position 0.
    // On Disk, the content is swapped.
    // BUT the 'sheetIndex' property in TabInfo assumes we reload state?
    // isMetadataRequired compares NEW STATE vs NEW STRUCTURE.
    // In NEW structure, the sheet at position 0 will have index 0 (renumbered?).
    // NO. ID persists?
    // In this codebase, `sheetIndex` is index in `workbook.sheets` array.
    // If we verify using `isMetadataRequired`, we compare:
    // DisplayItem.index vs FileStructure.sheets[i].
    // DisplayItem.index comes from `t.sheetIndex`.
    // If we executed move, the sheet at pos 0 in Display is `S1` (old index 0).
    // In Logic, does `moveSheet` reassign indices?
    // `editor.getState()` returns updated structure.
    // If we rely on `isMetadataRequired` to predict, we assume indices match positions.
    // The "Sheet Indices" in `currentFileStructure` are [0, 1, 2...].
    // After move, the Physical Structure's `sheets` array will STILL be [0, 1, 2...] (because it lists indices in order).
    // So `predictedFileStructure` is SAME as `currentFileStructure` regarding `sheets` array content (just filtered 0..N).
    // The CHANGE is in `newTabOrder`.
    // `newTabOrder` has `S1` at pos X. `S1.index` is 0.
    // `predictedFileStructure.sheets` has `0` at pos 0.
    // So `isMetadataRequired` effectively compares Visual Position vs Physical Position.
    // And `docs` positions matter.
    // If `docs` are interleaved visually, `newTabOrder` reflects that.
    // `predictedFileStructure` keeps `docs` where they physically are.
    // So `isMetadataRequired` will return TRUE if Visual != Physical.

    // So we just need to pass `currentFileStructure` (with sorted sheets) to `isMetadataRequired`?
    // Yes, essentially.

    // Re-ensure sheets are sorted (Physical Definition)
    predictedFileStructure.sheets.sort((a, b) => a - b);

    const needsMetadata = isMetadataRequired(newTabOrder, predictedFileStructure);

    // =========================================================================
    // H9 Physical Normalization Principle:
    // When a Sheet move causes a Document to become visually FIRST (before all
    // Sheets), and that Document is currently physically AFTER the Workbook,
    // we MUST move the Workbook physically after that Document.
    // 
    // Example: File [WB(S1,S2), D1], Tab [S1, D1, S2]
    //          Drag S1 to index 2 → Tab [D1, S1, S2]
    //          D1 is now first visually but still physically after WB.
    //          → Return move-workbook to make File [D1, WB(S1,S2)]
    // =========================================================================

    if (newTabOrder.length > 0 && newTabOrder[0].type === 'document') {
        const firstDocIndex = newTabOrder[0].index;

        // Check if this document is physically AFTER the Workbook
        // In currentFileStructure: docsBeforeWb are before WB, docsAfterWb are after
        const isPhysicallyAfterWb = currentFileStructure.docsAfterWb.includes(firstDocIndex);

        if (isPhysicallyAfterWb) {
            // H10 Check: After move-workbook, will we still need metadata?
            // Check if sheets remain contiguous in newTabOrder
            let sheetsContiguous = true;
            let lastWasSheet = false;
            let sawDocAfterSheet = false;

            for (let i = 1; i < newTabOrder.length; i++) {
                const item = newTabOrder[i];
                if (item.type === 'sheet') {
                    if (sawDocAfterSheet && !lastWasSheet) {
                        sheetsContiguous = false;
                        break;
                    }
                    lastWasSheet = true;
                } else {
                    if (lastWasSheet) sawDocAfterSheet = true;
                    lastWasSheet = false;
                }
            }

            if (sheetsContiguous) {
                // H9/H11: Check if sheet ORDER also matches physical
                const visualSheetOrder = newTabOrder
                    .filter((item) => item.type === 'sheet')
                    .map((item) => item.index);
                const physicalSheetOrder = currentFileStructure.sheets;

                const orderMatches =
                    visualSheetOrder.length === physicalSheetOrder.length &&
                    visualSheetOrder.every((v, i) => v === physicalSheetOrder[i]);

                if (orderMatches) {
                    // SAD3/H9: Pure physical normalization, no metadata
                    return {
                        actionType: 'physical+metadata',
                        physicalMove: {
                            type: 'move-workbook',
                            direction: 'after-doc',
                            targetDocIndex: firstDocIndex
                        },
                        metadataRequired: false,
                        newTabOrder: undefined
                    };
                } else {
                    // SAD4/H11: Sheet order differs, need metadata
                    return {
                        actionType: 'physical+metadata',
                        physicalMove: {
                            type: 'move-workbook',
                            direction: 'after-doc',
                            targetDocIndex: firstDocIndex
                        },
                        newTabOrder,
                        metadataRequired: true
                    };
                }
            }
            // H10: Sheets interleaved with docs, skip H9 early return
        }
    }

    return {
        actionType: 'physical',
        physicalMove: {
            type: 'move-sheet',
            fromSheetIndex: fromTab.sheetIndex!,
            toSheetIndex
        },
        metadataRequired: needsMetadata,
        newTabOrder: needsMetadata ? newTabOrder : undefined
    };
}

/**
 * Handle Sheet → Document Position (Moves Workbook or Metadata)
 * Uses Finite Pattern dispatch (SPECS.md 8.6.8)
 */
function handleSheetToDoc(
    fromIndex: number,
    toIndex: number,
    tabs: TabInfo[]
): ReorderAction {
    const ctx = buildPatternContext(tabs, fromIndex, toIndex);
    const pattern = classifySheetToDocPattern(ctx);


    switch (pattern) {
        // =====================================================================
        // Single Sheet Workbook Patterns (S3, S4)
        // =====================================================================
        case 'SBD1_single_before_doc': {
            // S3: Single sheet to before doc - move WB before first doc
            const firstDoc = ctx.newTabs.find((t) => t.type === 'document');
            return {
                actionType: 'physical',
                physicalMove: {
                    type: 'move-workbook',
                    direction: 'before-doc',
                    targetDocIndex: firstDoc?.docIndex ?? 0
                },
                metadataRequired: false
            };
        }

        case 'SAD1_single_after_doc': {
            // S4: Single sheet to after doc - move WB after target doc
            const newWbPos = ctx.newTabs.findIndex((t) => t.type === 'sheet');
            const prevDoc = ctx.newTabs[newWbPos - 1];
            return {
                actionType: 'physical',
                physicalMove: {
                    type: 'move-workbook',
                    direction: 'after-doc',
                    targetDocIndex: prevDoc?.docIndex ?? 0
                },
                metadataRequired: false
            };
        }

        // =====================================================================
        // Doc Becomes First Patterns (H9, H11)
        // =====================================================================
        case 'SAD3_doc_first_order_same': {
            // H9: Doc first, sheets contiguous, order SAME
            //     → move-workbook, NO metadata (physical matches visual)
            const firstDocIdx = ctx.newTabOrder[0].index;
            return {
                actionType: 'physical',
                physicalMove: {
                    type: 'move-workbook',
                    direction: 'after-doc',
                    targetDocIndex: firstDocIdx
                },
                metadataRequired: false
            };
        }

        case 'SAD4_doc_first_order_differs': {
            // H11: Doc first, sheets contiguous, order DIFFERS
            //      → move-workbook + METADATA (to express sheet order)
            const firstDocIdx = ctx.newTabOrder[0].index;
            return {
                actionType: 'physical+metadata',
                physicalMove: {
                    type: 'move-workbook',
                    direction: 'after-doc',
                    targetDocIndex: firstDocIdx
                },
                newTabOrder: ctx.newTabOrder,
                metadataRequired: true  // KEY FIX: Sheet order differs from physical!
            };
        }

        case 'SAD5_sheet_past_docs': {
            // H10: Sheet to end past multiple docs, sheets NOT contiguous
            //      → move-sheet to end of WB + metadata
            return {
                actionType: 'physical+metadata',
                physicalMove: {
                    type: 'move-sheet',
                    fromSheetIndex: ctx.fromTab.sheetIndex!,
                    toSheetIndex: ctx.sheetCount
                },
                newTabOrder: ctx.newTabOrder,
                metadataRequired: true
            };
        }

        // =====================================================================
        // Inside Doc Range Patterns (C8)
        // =====================================================================
        case 'SIDR1_inside_not_last': {
            // C8: Non-last sheet to inside doc range
            //     → move-sheet to end of WB + metadata
            return {
                actionType: 'physical+metadata',
                physicalMove: {
                    type: 'move-sheet',
                    fromSheetIndex: ctx.fromTab.sheetIndex!,
                    toSheetIndex: ctx.sheetCount
                },
                newTabOrder: ctx.newTabOrder,
                metadataRequired: true
            };
        }

        case 'SIDR2_inside_already_last': {
            // C8v: Last sheet to inside doc range (already at end)
            //      → metadata only (no physical move needed)
            return {
                actionType: 'metadata',
                newTabOrder: ctx.newTabOrder,
                metadataRequired: true
            };
        }

        // =====================================================================
        // Multi-Sheet Before/After Doc Patterns (S5, S6)
        // =====================================================================
        case 'SBD2_multi_before_doc': {
            // S5: Multi-sheet, one sheet before doc
            //     → move-workbook + metadata
            const firstDoc = ctx.newTabs.find((t) => t.type === 'document');
            return {
                actionType: 'physical+metadata',
                physicalMove: {
                    type: 'move-workbook',
                    direction: 'before-doc',
                    targetDocIndex: firstDoc?.docIndex ?? 0
                },
                newTabOrder: ctx.newTabOrder,
                metadataRequired: true
            };
        }

        case 'SAD2_multi_after_no_reorder':
        default: {
            // S6: Multi-sheet after doc (default stability pattern)
            //     → metadata only
            return {
                actionType: 'metadata',
                newTabOrder: ctx.newTabOrder,
                metadataRequired: true
            };
        }
    }
}

/**
 * Handle Doc -> Doc (Physical Move)
 */
function handleDocToDoc(
    fromIndex: number,
    toIndex: number,
    tabs: TabInfo[]
): ReorderAction {
    const fromTab = tabs[fromIndex];
    const fromDocIndex = fromTab.docIndex!;

    const firstSheetIdx = tabs.findIndex(t => t.type === 'sheet');
    const lastSheetIdx = tabs.reduce((acc, t, i) => t.type === 'sheet' ? i : acc, -1);
    const hasWorkbook = firstSheetIdx !== -1;

    // Check Target Zone
    const isToAfterWb = toIndex > lastSheetIdx;
    const isToBeforeWb = toIndex <= firstSheetIdx;
    const isToBetweenSheets = toIndex > firstSheetIdx && toIndex <= lastSheetIdx + 1;

    // Case 2: Doc → Doc (both on same side of WB, not between sheets)
    // Skip this case if target is between sheets - that's Case 4 (metadata-only)
    const toTab = toIndex < tabs.length ? tabs[toIndex] : null;

    // General Logic: If targeting a specific document (Insert Before), use toDocIndex.
    // Boundary flags are secondary/fallback for "Insert before WB" or "Insert after WB".

    let toDocIndex: number | null = null;
    let toBeforeWorkbook = false;
    let toAfterWorkbook = false;

    if (toTab?.type === 'document') {
        // Explicit Insert-Before-Doc
        toDocIndex = toTab.docIndex!;
    } else if (toTab?.type === 'sheet' && !isToBetweenSheets) {
        // Inserting before a sheet -> Inserting before WB
        toBeforeWorkbook = true;
    } else if (isToBeforeWb) {
        // Boundary fallback (e.g. empty space before WB?)
        toBeforeWorkbook = true;
    } else if (isToAfterWb) {
        // Boundary fallback (e.g. empty space after WB or append)
        // Check append
        const isAppend = toIndex === tabs.length || toTab?.type === 'add-sheet';
        if (!isAppend) {
            // Inserting before something that isn't a doc/sheet? Impossible in finite matrix?
            // Maybe "Insert After WB" explicitly?
            // If we are here, toTab is null (append) or undefined?
            toAfterWorkbook = true; // Use AfterWB as insertion point
        }
        // If isAppend, all flags false -> default append
    }

    // Refinement for Cross-WB moves:
    // Prioritize explicit document targets over boundary flags if both exist?
    // Actually, if we have `toDocIndex`, `moveDocumentSection` ignores flags usually?
    // Let's rely on Editor API check: if `toDocIndex` is provided, it inserts before that doc.

    // D-D Cross Check (Case 3) special handling?
    // Actually, generic logic above covers it:
    // D1 -> D2 (Cross WB): Target is D2. toDocIndex = D2.index. flags=false. API moves D1 to before D2.
    // D1 -> Before S1 (Cross WB): Target S1. toBeforeWorkbook = true. API moves D1 to before WB.

    // Simulate new order to check if metadata is required
    const newTabs = [...tabs];
    const [moved] = newTabs.splice(fromIndex, 1);
    const insertIdx = fromIndex < toIndex ? toIndex - 1 : toIndex;
    newTabs.splice(insertIdx, 0, moved);

    const newTabOrder = newTabs
        .filter(t => t.type === 'sheet' || t.type === 'document')
        .map(t => ({ type: t.type as 'sheet' | 'document', index: t.type === 'sheet' ? t.sheetIndex! : t.docIndex! }));

    const newFileStructure = parseFileStructure(newTabs);
    const needsMetadata = isMetadataRequired(newTabOrder, newFileStructure);

    if (isToBetweenSheets && toTab?.type !== 'document') {
        // Case 4: Doc → Sheet (Metadata only or Hybrid)
        const currentFileStructure = parseFileStructure(tabs);
        const isFromBeforeWb = currentFileStructure.docsBeforeWb.includes(fromDocIndex);

        if (isFromBeforeWb) {
            // Must physically move to After WB
            const result: ReorderAction = {
                actionType: needsMetadata ? 'physical+metadata' : 'physical',
                physicalMove: {
                    type: 'move-document',
                    fromDocIndex,
                    toDocIndex: null, // Append to after WB section
                    toAfterWorkbook: true, // Force to start of After-WB section
                    toBeforeWorkbook: false
                },
                newTabOrder: needsMetadata ? newTabOrder : undefined,
                metadataRequired: needsMetadata
            };
            return result;
        } else {
            // Already After WB (or isolated).
            if (!needsMetadata) {
                // Calculate target doc index (where it ends up physically)
                // We need to count docs in 'tabs' up to the insertion point.

                // Count docs before toIndex (excluding source tab if it was before)
                let targetDocIdx = 0;
                for (let i = 0; i < toIndex; i++) {
                    if (i === fromIndex) continue; // Skip self
                    if (tabs[i].type === 'document') targetDocIdx++;
                }

                // Adjust for moveDocumentSection behavior (relative to original array)
                if (targetDocIdx >= fromTab.docIndex!) {
                    targetDocIdx++;
                }

                return {
                    actionType: 'physical',
                    physicalMove: {
                        type: 'move-document',
                        fromDocIndex: fromTab.docIndex!,
                        toDocIndex: targetDocIdx,
                        toAfterWorkbook: false,
                        toBeforeWorkbook: false
                    },
                    metadataRequired: false
                };
            }

            const result: ReorderAction = {
                actionType: 'metadata',
                newTabOrder,
                metadataRequired: true
            };
            return result;
        }
    }

    if (!hasWorkbook) {
        // If no workbook, all docs are in one block, so it's always physical.
        // No metadata needed as there's no WB to complicate order.
        const result: ReorderAction = {
            actionType: 'physical',
            physicalMove: {
                type: 'move-document',
                fromDocIndex,
                toDocIndex,
                toAfterWorkbook,
                toBeforeWorkbook
            },
            metadataRequired: false
        };
        return result;
    }

    const result: ReorderAction = {
        actionType: needsMetadata ? 'physical+metadata' : 'physical',
        physicalMove: {
            type: 'move-document',
            fromDocIndex,
            toDocIndex,
            toAfterWorkbook,
            toBeforeWorkbook
        },
        newTabOrder: needsMetadata ? newTabOrder : undefined,
        metadataRequired: needsMetadata
    };
    return result;
}

/**
 * Handle Doc -> Inside Workbook (Metadata Representation)
 */
function handleDocToSheet(
    fromIndex: number,
    toIndex: number,
    tabs: TabInfo[]
): ReorderAction {
    const fromTab = tabs[fromIndex];

    // Doc moves to between sheets.
    // PHYSICAL: Must be AFTER Workbook (Standardization).
    // METADATA: Shows it between sheets.

    const firstSheetIdx = tabs.findIndex(t => t.type === 'sheet');
    const isFromBeforeWb = fromIndex < firstSheetIdx;

    // Simulate new order
    const newTabs = [...tabs];
    const [moved] = newTabs.splice(fromIndex, 1);
    const insertIdx = fromIndex < toIndex ? toIndex - 1 : toIndex;
    newTabs.splice(insertIdx, 0, moved);

    const newTabOrder = newTabs
        .filter(t => t.type === 'sheet' || t.type === 'document')
        .map(t => ({ type: t.type as 'sheet' | 'document', index: t.type === 'sheet' ? t.sheetIndex! : t.docIndex! }));

    // Physical Move required?
    // If From Before WB -> YES. Move to After WB.
    // If From After WB -> NO. (But D8 reorder logic applies)

    // D8 Check: Existing docs after WB reorder
    // (Omitted for brevity in this initial pass, assuming D8 is edge case handled by generic logic if needed, 
    // but strictly, handleDocToSheet implies target is inside WB range).

    // Simple logic:
    const newFileStructure = parseFileStructure(newTabs);
    const needsMetadata = isMetadataRequired(newTabOrder, newFileStructure);

    // Simple logic:
    if (isFromBeforeWb) {
        return {
            actionType: needsMetadata ? 'physical+metadata' : 'physical',
            physicalMove: {
                type: 'move-document',
                fromDocIndex: fromTab.docIndex!,
                toDocIndex: null,
                toAfterWorkbook: false, // Standard append behavior moves it after WB
                toBeforeWorkbook: false
            },
            newTabOrder: needsMetadata ? newTabOrder : undefined,
            metadataRequired: needsMetadata
        };
    }

    // If already After/Inside WB, check if Physical Move works (Normalization)
    if (!needsMetadata) {
        // Calculate target doc index (where it ends up physically)
        // We need to count docs in 'tabs' up to the insertion point.
        // If we move it physically to the end of the list, it's an append.

        // Count docs before toIndex (excluding source tab if it was before)
        let targetDocIdx = 0;
        for (let i = 0; i < toIndex; i++) {
            if (i === fromIndex) continue; // Skip self
            if (tabs[i].type === 'document') targetDocIdx++;
        }

        // Adjust for moveDocumentSection behavior (relative to original array)
        if (targetDocIdx >= fromTab.docIndex!) {
            targetDocIdx++;
        }

        return {
            actionType: 'physical',
            physicalMove: {
                type: 'move-document',
                fromDocIndex: fromTab.docIndex!,
                toDocIndex: targetDocIdx,
                toAfterWorkbook: false,
                toBeforeWorkbook: false
            },
            metadataRequired: false
        };
    }

    return {
        actionType: 'metadata',
        newTabOrder,
        metadataRequired: true
    };
}


// =============================================================================
// Main Dispatcher
// =============================================================================

export function determineReorderAction(
    tabs: Array<TabInfo>,
    fromIndex: number,
    toIndex: number
): ReorderAction {
    if (fromIndex === toIndex || toIndex === fromIndex + 1) {
        // Index+1 check: Dropping "after" self is same position
        // This fixes the "Drop on Self" tests
        return { actionType: 'no-op', metadataRequired: false };
    }

    const fromTab = tabs[fromIndex];

    // Identify Zones
    const firstSheetIdx = tabs.findIndex(t => t.type === 'sheet');
    const lastSheetIdx = tabs.reduce((acc, t, i) => t.type === 'sheet' ? i : acc, -1);
    const hasWorkbook = firstSheetIdx !== -1;

    // Is Target Inside Workbook?
    // Inside = [FirstSheet ... LastSheet+1] (Inclusive of append to sheets)
    // BUT exception: If dropping onto a Doc that is "between sheets" (visually), it's Inside.
    // If dropping onto a Doc that is "outside", it's Outside.

    // Simpler View:
    // If toTab is SHEET -> Inside.
    // If toTab is ADD-SHEET -> Inside matches last sheet.
    // If toTab is DOC -> Outside.
    // What if toIndex is boundary?

    const toTab = toIndex < tabs.length ? tabs[toIndex] : undefined;

    let targetZone: 'inside-wb' | 'outside-wb';

    if (toTab?.type === 'sheet') {
        // Special Case: Moving a Document to before the FIRST sheet means moving it Before Workbook.
        // This is an 'outside-wb' action (Doc -> Doc/BeforeWB).
        if (fromTab.type === 'document' && toIndex === firstSheetIdx) {
            targetZone = 'outside-wb';
        } else {
            targetZone = 'inside-wb';
        }
    } else if (toTab?.type === 'add-sheet') {
        // Depending on existing structure? Usually Inside.
        targetZone = 'inside-wb';
    } else if (toTab?.type === 'document') {
        targetZone = 'outside-wb';
    } else {
        // Appending to end or empty space
        // If last tab was sheet -> Inside/Append?
        // If last tab was doc -> Outside/Append?
        const lastTab = tabs[tabs.length - 1];
        if (lastTab?.type === 'sheet') targetZone = 'inside-wb';
        else targetZone = 'outside-wb';
    }

    // Dispatch
    let result: ReorderAction;
    if (fromTab.type === 'sheet') {
        if (targetZone === 'inside-wb') result = handleSheetToSheet(fromIndex, toIndex, tabs);
        else result = handleSheetToDoc(fromIndex, toIndex, tabs);
    } else { // fromTab.type === 'document'
        if (targetZone === 'outside-wb') result = handleDocToDoc(fromIndex, toIndex, tabs);
        else result = handleDocToSheet(fromIndex, toIndex, tabs);
    }

    // Promote 'physical' to 'physical+metadata' if metadata is required
    if (result.actionType === 'physical' && result.metadataRequired && result.physicalMove) {
        return {
            ...result,
            actionType: 'physical+metadata'
        };
    }

    return result;

    // Fallback
    return { actionType: 'no-op', metadataRequired: false };
}
