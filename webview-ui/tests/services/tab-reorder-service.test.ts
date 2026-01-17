/**
 * Tab Reorder Service Tests
 *
 * Tests matching SPECS.md 8.6 Tab Reorder Test Matrix exactly.
 *
 * Notation:
 * - WB(S1,S2): Workbook containing Sheet1 and Sheet2
 * - D1, D2: Document 1, Document 2
 * - [D1, WB(S1,S2), D2]: File structure (physical order)
 */

import { describe, it, expect } from 'vitest';
import {
    determineReorderAction,
    deriveTabOrderFromFile,
    isMetadataRequired,
    parseFileStructure,
    type FileStructure,
    type TabOrderItem
} from '../../services/tab-reorder-service';

// =============================================================================
// Helper functions to create test data
// =============================================================================

interface TestTab {
    type: 'sheet' | 'document' | 'add-sheet';
    sheetIndex?: number;
    docIndex?: number;
}

/**
 * Create tabs array from file structure notation.
 * Example: createTabs('[D1, WB(S1,S2), D2]')
 */
function createTabs(structure: string): TestTab[] {
    const tabs: TestTab[] = [];
    // Parse: [D1, WB(S1,S2), D2] or [WB(S1,S2)]
    const match = structure.match(/\[(.*)\]/);
    if (!match) return tabs;

    const parts = match[1].split(',').map((s) => s.trim());
    let docIndex = 0;
    let sheetIndex = 0;

    for (const part of parts) {
        if (part.startsWith('D')) {
            tabs.push({ type: 'document', docIndex: docIndex++ });
        } else if (part.startsWith('WB')) {
            // Parse WB(S1,S2)
            const sheetMatch = part.match(/WB\((.*)\)/);
            if (sheetMatch) {
                const sheets = sheetMatch[1].split(',').map((s) => s.trim());
                for (const _ of sheets) {
                    tabs.push({ type: 'sheet', sheetIndex: sheetIndex++ });
                }
            }
        }
    }

    tabs.push({ type: 'add-sheet' });
    return tabs;
}

// =============================================================================
// SPECS.md 8.6.1 Sheet → Sheet (Within Workbook)
// =============================================================================

describe('SPECS.md 8.6.1 Sheet → Sheet (Within Workbook)', () => {
    it('S1: Sheet to adjacent Sheet - [WB(S1,S2)] drag S1 after S2', () => {
        // Initial: [WB(S1,S2)]
        // Action: Drag S1 after S2
        // Expected: S2, S1 in WB (Physical)
        const tabs: TestTab[] = [
            { type: 'sheet', sheetIndex: 0 },
            { type: 'sheet', sheetIndex: 1 },
            { type: 'add-sheet' }
        ];
        // Move Sheet0 (index 0) to Sheet1's position (index 1)
        // In drag-drop, toIndex is where you drop: after S2 means position 2, but that's add-sheet
        // So we target position 1 (Sheet1's slot), which will swap the sheets
        const action = determineReorderAction(tabs, 0, 1);

        expect(action.actionType).toBe('physical');
        expect(action.physicalMove?.type).toBe('move-sheet');
        if (action.physicalMove?.type === 'move-sheet') {
            expect(action.physicalMove.fromSheetIndex).toBe(0);
            expect(action.physicalMove.toSheetIndex).toBe(1);
        }
        expect(action.metadataRequired).toBe(false);
    });

    it('S2: Sheet over Sheet (with Docs) - [D1, WB(S1,S2), D2] drag S1 after S2', () => {
        // Initial: [D1, WB(S1,S2), D2]
        // Action: Drag S1 after S2
        // Expected: S2, S1 in WB (Physical)
        // Note: physical file order is different from tab order due to metadata
        const tabs: TestTab[] = [
            { type: 'document', docIndex: 0 },
            { type: 'sheet', sheetIndex: 0 },
            { type: 'sheet', sheetIndex: 1 },
            { type: 'document', docIndex: 1 },
            { type: 'add-sheet' }
        ];

        // Move Sheet0 (index 1) to Sheet1's position (index 2)
        const action = determineReorderAction(tabs, 1, 2);

        expect(action.actionType).toBe('physical');
        expect(action.physicalMove?.type).toBe('move-sheet');
        expect(action.metadataRequired).toBe(false);
    });
});

// =============================================================================
// SPECS.md 8.6.2 Sheet → Document Position
// =============================================================================

describe('SPECS.md 8.6.2 Sheet → Document Position', () => {
    it('S3: Single Sheet to before Doc - [D1, WB(S1)] drag S1 before D1', () => {
        // Initial: [D1, WB(S1)]
        // Action: Drag S1 before D1
        // Expected: [WB(S1), D1] - Physical (move WB)
        const tabs: TestTab[] = [
            { type: 'document', docIndex: 0 },
            { type: 'sheet', sheetIndex: 0 },
            { type: 'add-sheet' }
        ];

        // Move Sheet (index 1) to position 0 (before Doc)
        const action = determineReorderAction(tabs, 1, 0);

        expect(action.actionType).toBe('physical+metadata');
        expect(action.physicalMove?.type).toBe('move-workbook');
        if (action.physicalMove?.type === 'move-workbook') {
            expect(action.physicalMove.direction).toBe('before-doc');
            expect(action.physicalMove.targetDocIndex).toBe(0);
        }
    });

    it('S4: Single Sheet to after Doc - [WB(S1), D1] drag S1 after D1', () => {
        // Initial: [WB(S1), D1]
        // Action: Drag S1 after D1
        // Expected: [D1, WB(S1)] - Physical (move WB)
        const tabs: TestTab[] = [
            { type: 'sheet', sheetIndex: 0 },
            { type: 'document', docIndex: 0 },
            { type: 'add-sheet' }
        ];

        // Move Sheet (index 0) to position 2 (after Doc)
        const action = determineReorderAction(tabs, 0, 2);

        expect(action.actionType).toBe('physical+metadata');
        expect(action.physicalMove?.type).toBe('move-workbook');
        if (action.physicalMove?.type === 'move-workbook') {
            expect(action.physicalMove.direction).toBe('after-doc');
            expect(action.physicalMove.targetDocIndex).toBe(0);
        }
    });

    it('S5: Multi-Sheet to before Doc - [D1, WB(S1,S2), D2] drag S1 before D1', () => {
        // Initial: [D1, WB(S1,S2), D2]
        // Action: Drag S1 before D1
        // Expected: File [WB(S1,S2), D1, D2], tab [S1,D1,S2,D2] - Physical + Metadata
        const tabs: TestTab[] = [
            { type: 'document', docIndex: 0 },
            { type: 'sheet', sheetIndex: 0 },
            { type: 'sheet', sheetIndex: 1 },
            { type: 'document', docIndex: 1 },
            { type: 'add-sheet' }
        ];

        // Move Sheet0 (index 1) to position 0 (before D1)
        const action = determineReorderAction(tabs, 1, 0);

        expect(action.actionType).toBe('physical+metadata');
        expect(action.physicalMove?.type).toBe('move-workbook');
        if (action.physicalMove?.type === 'move-workbook') {
            expect(action.physicalMove.direction).toBe('before-doc');
        }
        expect(action.metadataRequired).toBe(true);
    });

    it('S6: Multi-Sheet to after Doc - [D1, WB(S1,S2), D2] drag S2 after D2', () => {
        // Initial: [D1, WB(S1,S2), D2]
        // Action: Drag S2 after D2
        // Expected: File [D1, D2, WB(S1,S2)], tab [D1,D2,S1,S2] - Physical + Metadata
        const tabs: TestTab[] = [
            { type: 'document', docIndex: 0 },
            { type: 'sheet', sheetIndex: 0 },
            { type: 'sheet', sheetIndex: 1 },
            { type: 'document', docIndex: 1 },
            { type: 'add-sheet' }
        ];

        // Move Sheet1 (index 2) to position 5 (after D2, at end)
        const action = determineReorderAction(tabs, 2, 5);

        expect(action.actionType).toBe('physical+metadata');
        expect(action.physicalMove?.type).toBe('move-workbook');
        if (action.physicalMove?.type === 'move-workbook') {
            expect(action.physicalMove.direction).toBe('after-doc');
        }
        expect(action.metadataRequired).toBe(true);
    });
});

// =============================================================================
// SPECS.md 8.6.3 Document → Document
// =============================================================================

describe('SPECS.md 8.6.3 Document → Document', () => {
    it('D1: Doc to Doc (both before WB) - [D1, D2, WB] drag D1 after D2', () => {
        // Initial: [D1, D2, WB]
        // Action: Drag D1 to after D2 (insert at WB's position)
        // Expected: [D2, D1, WB] - Physical
        const tabs: TestTab[] = [
            { type: 'document', docIndex: 0 },
            { type: 'document', docIndex: 1 },
            { type: 'sheet', sheetIndex: 0 },
            { type: 'add-sheet' }
        ];

        // Drag D1 (index 0) to after D2 → toIndex = 2 (WB's current position)
        const action = determineReorderAction(tabs, 0, 2);

        expect(action.actionType).toBe('physical');
        expect(action.physicalMove?.type).toBe('move-document');
        if (action.physicalMove?.type === 'move-document') {
            expect(action.physicalMove.fromDocIndex).toBe(0);
            expect(action.physicalMove.toDocIndex).toBe(1); // Insert after D2
        }
        expect(action.metadataRequired).toBe(false);
    });

    it('D2: Doc to Doc (both after WB) - [WB, D1, D2] drag D1 after D2', () => {
        // Initial: [WB, D1, D2]
        // Action: Drag D1 after D2
        // Expected: [WB, D2, D1] - Physical
        const tabs: TestTab[] = [
            { type: 'sheet', sheetIndex: 0 },
            { type: 'document', docIndex: 0 },
            { type: 'document', docIndex: 1 },
            { type: 'add-sheet' }
        ];

        // Move D1 (index 1) to position 3 (after D2)
        const action = determineReorderAction(tabs, 1, 3);

        expect(action.actionType).toBe('physical');
        expect(action.physicalMove?.type).toBe('move-document');
        expect(action.metadataRequired).toBe(false);
    });

    it('D3: Doc to Doc (cross WB) - [D1, WB, D2] drag D1 after D2', () => {
        // Initial: [D1, WB, D2]
        // Action: Drag D1 to after D2 (insert at add-sheet position)
        // Expected: [WB, D2, D1] - Physical
        const tabs: TestTab[] = [
            { type: 'document', docIndex: 0 },
            { type: 'sheet', sheetIndex: 0 },
            { type: 'document', docIndex: 1 },
            { type: 'add-sheet' }
        ];

        // Drag D1 (index 0) to after D2 → toIndex = 3 (add-sheet position)
        const action = determineReorderAction(tabs, 0, 3);

        expect(action.actionType).toBe('physical');
        expect(action.physicalMove?.type).toBe('move-document');
        if (action.physicalMove?.type === 'move-document') {
            expect(action.physicalMove.toDocIndex).toBe(1); // Insert after D2
        }
        expect(action.metadataRequired).toBe(false);
    });
});

// =============================================================================
// SPECS.md 8.6.4 Document → Workbook Boundary
// =============================================================================

describe('SPECS.md 8.6.4 Document → Workbook Boundary', () => {
    it('D4: Doc before WB to after WB - [D1, WB(S1,S2)] drag D1 after last Sheet', () => {
        // Initial: [D1, WB(S1,S2)] (no D2 after WB - pure boundary test)
        // Action: Drag D1 after last Sheet
        // Expected: [WB(S1,S2), D1] - Physical only (tab order matches file)
        const tabs: TestTab[] = [
            { type: 'document', docIndex: 0 },
            { type: 'sheet', sheetIndex: 0 },
            { type: 'sheet', sheetIndex: 1 },
            { type: 'add-sheet' }
        ];

        // Move D1 (index 0) to position 4 (after all sheets, at end)
        const action = determineReorderAction(tabs, 0, 4);

        expect(action.actionType).toBe('physical');
        expect(action.physicalMove?.type).toBe('move-document');
        if (action.physicalMove?.type === 'move-document') {
            expect(action.physicalMove.toAfterWorkbook).toBe(true);
        }
    });

    it('D5: Doc after WB to before WB - [WB(S1,S2), D1] drag D1 before first Sheet', () => {
        // Initial: [WB(S1,S2), D1] (no D before WB - pure boundary test)
        // Action: Drag D1 before first Sheet
        // Expected: [D1, WB(S1,S2)] - Physical only (tab order matches file)
        const tabs: TestTab[] = [
            { type: 'sheet', sheetIndex: 0 },
            { type: 'sheet', sheetIndex: 1 },
            { type: 'document', docIndex: 0 },
            { type: 'add-sheet' }
        ];

        // Move D1 (index 2) to position 0 (before first Sheet)
        const action = determineReorderAction(tabs, 2, 0);

        expect(action.actionType).toBe('physical');
        expect(action.physicalMove?.type).toBe('move-document');
        if (action.physicalMove?.type === 'move-document') {
            expect(action.physicalMove.toBeforeWorkbook).toBe(true);
        }
    });
});

// =============================================================================
// SPECS.md 8.6.5 Document → Between Sheets (Cross-Type)
// =============================================================================

describe('SPECS.md 8.6.5 Document → Between Sheets (Cross-Type)', () => {
    it('D6: Doc before WB to between Sheets - Physical + Metadata', () => {
        // Initial: [D1, WB(S1,S2), D2]
        // Action: Drag D1 between S1 & S2
        // Expected: File [WB(S1,S2), D1, D2], tab [S1,D1,S2,D2] - Physical + Metadata
        const tabs: TestTab[] = [
            { type: 'document', docIndex: 0 },
            { type: 'sheet', sheetIndex: 0 },
            { type: 'sheet', sheetIndex: 1 },
            { type: 'document', docIndex: 1 },
            { type: 'add-sheet' }
        ];

        // Move D1 (index 0) to position 2 (between S1 and S2)
        const action = determineReorderAction(tabs, 0, 2);

        expect(action.actionType).toBe('physical+metadata');
        expect(action.physicalMove?.type).toBe('move-document');
        if (action.physicalMove?.type === 'move-document') {
            expect(action.physicalMove.toAfterWorkbook).toBe(true);
        }
        expect(action.metadataRequired).toBe(true);
    });

    it('D7: Doc after WB to between Sheets - Metadata only', () => {
        // Initial: [D1, WB(S1,S2), D2]
        // Action: Drag D2 between S1 & S2
        // Expected: File unchanged, tab [D1,S1,D2,S2] - Metadata only
        const tabs: TestTab[] = [
            { type: 'document', docIndex: 0 },
            { type: 'sheet', sheetIndex: 0 },
            { type: 'sheet', sheetIndex: 1 },
            { type: 'document', docIndex: 1 },
            { type: 'add-sheet' }
        ];

        // Move D2 (index 3) to position 2 (between S1 and S2)
        const action = determineReorderAction(tabs, 3, 2);

        expect(action.actionType).toBe('metadata');
        expect(action.physicalMove).toBeUndefined();
        expect(action.metadataRequired).toBe(true);
    });
});

// =============================================================================
// Metadata Necessity Tests
// =============================================================================

describe('Metadata Necessity (SPECS.md 8.6)', () => {
    it('should not require metadata when tab order matches file structure', () => {
        const structure: FileStructure = {
            docsBeforeWb: [0],
            sheets: [0, 1],
            docsAfterWb: [1],
            hasWorkbook: true
        };

        // Tab order matches: [D0, S0, S1, D1]
        const tabOrder: TabOrderItem[] = [
            { type: 'document', index: 0 },
            { type: 'sheet', index: 0 },
            { type: 'sheet', index: 1 },
            { type: 'document', index: 1 }
        ];

        expect(isMetadataRequired(tabOrder, structure)).toBe(false);
    });

    it('should require metadata when Doc is between Sheets in tab order', () => {
        const structure: FileStructure = {
            docsBeforeWb: [],
            sheets: [0, 1],
            docsAfterWb: [0],
            hasWorkbook: true
        };

        // Tab order: [S0, D0, S1] - Doc between Sheets
        const tabOrder: TabOrderItem[] = [
            { type: 'sheet', index: 0 },
            { type: 'document', index: 0 },
            { type: 'sheet', index: 1 }
        ];

        expect(isMetadataRequired(tabOrder, structure)).toBe(true);
    });

    it('should derive correct tab order from file structure', () => {
        const structure: FileStructure = {
            docsBeforeWb: [0, 1],
            sheets: [0, 1, 2],
            docsAfterWb: [2],
            hasWorkbook: true
        };

        const derived = deriveTabOrderFromFile(structure);

        expect(derived).toEqual([
            { type: 'document', index: 0 },
            { type: 'document', index: 1 },
            { type: 'sheet', index: 0 },
            { type: 'sheet', index: 1 },
            { type: 'sheet', index: 2 },
            { type: 'document', index: 2 }
        ]);
    });
});

// =============================================================================
// EXACT REPRODUCTION: sample-workspace/workbook.md [WB(S1, S2), D1, D2, D3]
// =============================================================================

describe('Exact Reproduction: workbook.md [WB, D1, D2, D3]', () => {
    // Tab structure: [S1=0, S2=1, D1=2, D2=3, D3=4, add-sheet=5]
    const tabs: TestTab[] = [
        { type: 'sheet', sheetIndex: 0 },
        { type: 'sheet', sheetIndex: 1 },
        { type: 'document', docIndex: 0 },
        { type: 'document', docIndex: 1 },
        { type: 'document', docIndex: 2 },
        { type: 'add-sheet' }
    ];

    /**
     * USER BUG REPORT 1: Drag D1 after D2
     * Initial: [S1, S2, D1, D2, D3] tab indices
     * Action: Drag D1 (idx=2) to after D2 → toIndex = 4 (D3's position)
     * Expected: move-document(fromDocIndex=0, toDocIndex=1)
     */
    it('should move D1 after D2 - [WB, D1, D2, D3] → [WB, D2, D1, D3]', () => {
        // D1 is at tabIndex 2, D2 is at tabIndex 3
        // Dragging D1 "after D2" lands at tabIndex 4 (D3's position)
        const action = determineReorderAction(tabs, 2, 4);

        expect(action.actionType).toBe('physical');
        expect(action.physicalMove?.type).toBe('move-document');
        if (action.physicalMove?.type === 'move-document') {
            expect(action.physicalMove.fromDocIndex).toBe(0); // D1
            expect(action.physicalMove.toDocIndex).toBe(1); // Insert after D2
        }
        expect(action.metadataRequired).toBe(false);
    });

    /**
     * USER BUG REPORT 2: Drag D2 after D3
     * Initial: [S1, S2, D1, D2, D3] tab indices
     * Action: Drag D2 (idx=3) to after D3 → toIndex = 5 (add-sheet position)
     * Expected: move-document(fromDocIndex=1, toDocIndex=2)
     */
    it('should move D2 after D3 - [WB, D1, D2, D3] → [WB, D1, D3, D2]', () => {
        // D2 is at tabIndex 3, D3 is at tabIndex 4
        // Dragging D2 "after D3" lands at tabIndex 5 (add-sheet position)
        const action = determineReorderAction(tabs, 3, 5);

        expect(action.actionType).toBe('physical');
        expect(action.physicalMove?.type).toBe('move-document');
        if (action.physicalMove?.type === 'move-document') {
            expect(action.physicalMove.fromDocIndex).toBe(1); // D2
            expect(action.physicalMove.toDocIndex).toBe(2); // Insert after D3
        }
        expect(action.metadataRequired).toBe(false);
    });
});
