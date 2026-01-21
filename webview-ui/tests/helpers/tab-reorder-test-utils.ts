import { expect } from 'vitest';
import * as editor from '../../../src/editor';
import { determineReorderAction } from '../../services/tab-reorder-service';
import type { TabOrderItem } from '../../../src/editor/types';

// Simplified Tab type for tests
export interface TestTab {
    type: 'sheet' | 'document' | 'add-sheet';
    sheetIndex?: number;
    docIndex?: number;
}

/**
 * Simulates the exact logic of main.ts: _handleTabReorder
 * This ensures that tests verify the ACTUAL behavior of the application,
 * not just the return value of determineReorderAction.
 *
 * @see webview-ui/main.ts: _handleTabReorder
 */
export function executeTabReorderLikeMainTs(
    tabs: TestTab[],
    fromIndex: number,
    toIndex: number
): {
    content: string;
    metadata: { tab_order?: TabOrderItem[] } | null;
    actionType: string;
    metadataRequired?: boolean;
    newTabOrder?: TabOrderItem[] | null;
    physicalMove?: any;
} {
    // 1. Determine Action
    const action = determineReorderAction(tabs, fromIndex, toIndex);
    console.log(`[DEBUG] Reorder ${fromIndex} -> ${toIndex}`, JSON.stringify(action, null, 2));

    // 2. Metadata Update (main.ts lines 1409-1418)
    if (action.metadataRequired && action.physicalMove) {
        if (action.newTabOrder) {
            editor.updateWorkbookTabOrder(action.newTabOrder);
        }
    } else if (!action.metadataRequired && action.physicalMove) {
        // Fix for Hazard 61: Remove tab_order when restoring natural order
        editor.updateWorkbookTabOrder(null);
    } else if (action.actionType === 'metadata') {
        if (action.newTabOrder) {
            // Metadata update
            editor.updateWorkbookTabOrder(action.newTabOrder);
        } else if (!action.metadataRequired) {
            // Metadata removal (explicit)
            editor.updateWorkbookTabOrder(null);
        }
    }

    // 3. Physical Move (main.ts lines 1420-1524)
    if (action.physicalMove) {
        console.log(`[DEBUG] Physical Move:`, JSON.stringify(action.physicalMove));
        switch (action.physicalMove.type) {
            case 'move-sheet': {
                const { fromSheetIndex, toSheetIndex } = action.physicalMove;
                const targetTabOrderIndex = action.metadataRequired ? toIndex : null;
                editor.moveSheet(fromSheetIndex, toSheetIndex, targetTabOrderIndex);
                break;
            }
            case 'move-workbook': {
                const { direction, targetDocIndex } = action.physicalMove;
                const toAfter = direction === 'after-doc';
                editor.moveWorkbookSection(targetDocIndex, toAfter);
                break;
            }
            case 'move-document': {
                const { fromDocIndex, toDocIndex, toAfterWorkbook, toBeforeWorkbook } = action.physicalMove;
                const moveResult = editor.moveDocumentSection(
                    fromDocIndex,
                    toDocIndex,
                    toAfterWorkbook,
                    toBeforeWorkbook
                );

                // Fix for Hazard 61: Always regenerate workbook section for move-document
                if (moveResult.content) {
                    // Logic from main.ts: Regenerate WB to ensure metadata changes (add or remove) are included
                    editor.generateAndGetRange();
                }
                break;
            }
        }
    }

    // Return final state
    const content = editor.getFullMarkdown();
    const state = JSON.parse(editor.getState());
    return {
        content,
        metadata: state.workbook?.metadata || null,
        actionType: action.actionType,
        physicalMove: action.physicalMove,
        metadataRequired: action.metadataRequired,
        newTabOrder: action.newTabOrder
    };
}

/**
 * Verifies that the final state matches expectations
 */
export function verifyFinalState(
    currentStructure: any[],
    expectedPhysicalOrder: string[], // List of titles/names in physical order
    expectedTabOrder: TabOrderItem[] | null // Expected metadata tab_order or null if removed
): void {
    // 1. Verify Physical Order
    const _actualOrder = currentStructure.map((item) => {
        if (item.type === 'workbook') return 'WB'; // Represent WB as a block
        return item.title || item.name;
    });

    // Note: The structure array from getState() usually expands workbook into sheets.
    // For this verification, we need to handle how editor.getState() returns structure.

    // Actually, let's verify by checking titles against the expected list.
    // Workbook sheets will be returned individually.
    // We expect the test caller to provide the expected flattened list if needed,
    // OR we simplify to just checking Doc/Sheet names.

    // Let's refine: verifyFinalState should take the raw structure array and check names.
    const actualNames = currentStructure.map((item) => item.title || item.name);

    // We'll trust the caller to provide the correct flat list of names
    expect(actualNames).toEqual(expectedPhysicalOrder);

    // 2. Verify Metadata
    const state = JSON.parse(editor.getState());
    const metadata = state.workbook?.metadata;

    if (expectedTabOrder === null) {
        if (metadata && metadata.tab_order) {
            expect(metadata.tab_order).toBeUndefined(); // Should be removed
        } else {
            // OK - undefined or null
        }
    } else {
        expect(metadata?.tab_order).toBeDefined();
        // Compare tab_order content logic
        // We match type and index.
        // Note: index might change if sheets reordered?
        // SPECS say index is 0-based index within that TYPE.
        expect(metadata.tab_order).toEqual(expectedTabOrder);
    }
}
