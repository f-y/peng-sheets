/**
 * Comprehensive Integration Test: Tab Reorder Metadata Scenarios
 *
 * This test file covers ALL metadata scenarios:
 * 1. Metadata REMOVAL - when tab order matches physical/natural order
 * 2. Metadata ADDITION - when tab order differs from natural order
 * 3. Metadata UPDATE - when existing metadata needs to change
 * 4. Mixed structures - docs before/after WB in various combinations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as editor from '../../../src/editor';
import {
    determineReorderAction,
    isMetadataRequired,
    deriveTabOrderFromFile,
    type TabOrderItem,
    type FileStructure
} from '../../services/tab-reorder-service';

/**
 * Helper: Build FileStructure from state.structure array and sheetCount
 */
function buildFileStructure(
    stateStructure: Array<{ type: string; title?: string }>,
    sheetCount: number
): FileStructure {
    const docsBeforeWb: number[] = [];
    const docsAfterWb: number[] = [];
    let hasWorkbook = false;
    let seenWorkbook = false;
    let docIndex = 0;

    for (const item of stateStructure) {
        if (item.type === 'workbook') {
            hasWorkbook = true;
            seenWorkbook = true;
        } else if (item.type === 'document') {
            if (seenWorkbook) {
                docsAfterWb.push(docIndex);
            } else {
                docsBeforeWb.push(docIndex);
            }
            docIndex++;
        }
    }

    // Build sheets array from sheetCount
    const sheets: number[] = [];
    for (let i = 0; i < sheetCount; i++) {
        sheets.push(i);
    }

    return { docsBeforeWb, sheets, docsAfterWb, hasWorkbook };
}

// =============================================================================
// 1. Metadata REMOVAL Scenarios (result matches natural order)
// =============================================================================

describe('Integration: Metadata REMOVAL scenarios', () => {
    describe('D3 from between sheets → after S2 (restore natural order)', () => {
        // BUG SCENARIO from user report
        const WORKBOOK_MD = `# Doc 1

# Tables

## Sheet 1

| Column 1 | Column 2 | Column 3 |
| --- | --- | --- |
|  |  |  |

## Sheet 2

| Column 1 | Column 2 | Column 3 |
| --- | --- | --- |
|  |  |  |

<!-- md-spreadsheet-workbook-metadata: {"tab_order": [{"type": "document", "index": 0}, {"type": "sheet", "index": 0}, {"type": "document", "index": 1}, {"type": "sheet", "index": 1}, {"type": "document", "index": 2}]} -->

# Doc 3


# Doc 2
`;

        beforeEach(() => {
            editor.initializeWorkbook(WORKBOOK_MD, JSON.stringify({ rootMarker: '# Tables' }));
        });

        it('should verify initial structure with tab_order metadata', () => {
            const state = JSON.parse(editor.getState());

            // Physical order: D1, WB, D3, D2
            expect(state.structure[0].title).toBe('Doc 1');
            expect(state.structure[1].type).toBe('workbook');
            expect(state.structure[2].title).toBe('Doc 3');
            expect(state.structure[3].title).toBe('Doc 2');

            // tab_order should exist with D3 between S1 and S2
            expect(state.workbook.metadata?.tab_order).toBeDefined();
        });

        it('D3 → after S2: metadataRequired should be FALSE (matches natural order)', () => {
            // Current display: [D1, S1, D3, S2, D2]
            // Moving D3 after S2 → [D1, S1, S2, D3, D2]
            // This IS natural order, so no metadata needed

            const state = JSON.parse(editor.getState());
            const fileStructure = buildFileStructure(state.structure, state.workbook?.sheets?.length ?? 0);

            const newTabOrder: TabOrderItem[] = [
                { type: 'document', index: 0 },  // D1
                { type: 'sheet', index: 0 },     // S1
                { type: 'sheet', index: 1 },     // S2
                { type: 'document', index: 1 },  // D3 (first doc after WB)
                { type: 'document', index: 2 }   // D2 (second doc after WB)
            ];

            const naturalOrder = deriveTabOrderFromFile(fileStructure);
            console.log('Natural order:', naturalOrder);
            console.log('New tab order:', newTabOrder);

            const needsMetadata = isMetadataRequired(newTabOrder, fileStructure);

            // BUG: This should return false but currently returns true
            expect(needsMetadata).toBe(false);
        });

        it('FULL SCENARIO: D3 → after S2 should produce clean file without tab_order', () => {
            const newTabOrder: TabOrderItem[] = [
                { type: 'document', index: 0 },
                { type: 'sheet', index: 0 },
                { type: 'sheet', index: 1 },
                { type: 'document', index: 1 },
                { type: 'document', index: 2 }
            ];

            editor.updateWorkbookTabOrder(newTabOrder);
            const wbUpdate = editor.generateAndGetRange();

            // Should NOT contain tab_order since it matches natural order
            expect(wbUpdate.content).not.toContain('tab_order');
        });
    });

    describe('Remove all customization - restore natural order from custom', () => {
        const CUSTOM_ORDER_MD = `# Tables

## Sheet 1

| A |
| - |
| 1 |

## Sheet 2

| B |
| - |
| 2 |

<!-- md-spreadsheet-workbook-metadata: {"tab_order": [{"type": "sheet", "index": 1}, {"type": "sheet", "index": 0}, {"type": "document", "index": 0}]} -->

# Doc 1
`;

        beforeEach(() => {
            editor.initializeWorkbook(CUSTOM_ORDER_MD, JSON.stringify({ rootMarker: '# Tables' }));
        });

        it('restoring natural order [S1, S2, D1] should remove metadata', () => {
            // Natural order for [WB, D1] is [S1, S2, D1]
            const naturalOrder: TabOrderItem[] = [
                { type: 'sheet', index: 0 },
                { type: 'sheet', index: 1 },
                { type: 'document', index: 0 }
            ];

            editor.updateWorkbookTabOrder(naturalOrder);
            const wbUpdate = editor.generateAndGetRange();

            expect(wbUpdate.content).not.toContain('tab_order');
        });
    });
});

// =============================================================================
// 2. Metadata ADDITION Scenarios (result differs from natural order)
// =============================================================================

describe('Integration: Metadata ADDITION scenarios', () => {
    describe('Clean file → add custom order', () => {
        const CLEAN_MD = `# Tables

## Sheet 1

| A |
| - |
| 1 |

## Sheet 2

| B |
| - |
| 2 |

# Doc 1

Content
`;

        beforeEach(() => {
            editor.initializeWorkbook(CLEAN_MD, JSON.stringify({ rootMarker: '# Tables' }));
        });

        it('initial file should not have tab_order metadata', () => {
            const state = JSON.parse(editor.getState());
            expect(state.workbook.metadata?.tab_order).toBeUndefined();
        });

        it('swapping sheets should ADD metadata', () => {
            // Natural: [S1, S2, D1]
            // Custom:  [S2, S1, D1]
            const customOrder: TabOrderItem[] = [
                { type: 'sheet', index: 1 },
                { type: 'sheet', index: 0 },
                { type: 'document', index: 0 }
            ];

            editor.updateWorkbookTabOrder(customOrder);
            const wbUpdate = editor.generateAndGetRange();

            expect(wbUpdate.content).toContain('tab_order');
        });

        it('moving doc to between sheets should ADD metadata', () => {
            // Natural: [S1, S2, D1]
            // Custom:  [S1, D1, S2]
            const customOrder: TabOrderItem[] = [
                { type: 'sheet', index: 0 },
                { type: 'document', index: 0 },
                { type: 'sheet', index: 1 }
            ];

            editor.updateWorkbookTabOrder(customOrder);
            const wbUpdate = editor.generateAndGetRange();

            expect(wbUpdate.content).toContain('tab_order');
        });
    });

    describe('D2 → between S1 and S2 (from natural order)', () => {
        const NATURAL_ORDER_MD = `# Doc 1

# Tables

## Sheet 1

| A |
| - |
| 1 |

## Sheet 2

| B |
| - |
| 2 |

# Doc 2
`;

        beforeEach(() => {
            editor.initializeWorkbook(NATURAL_ORDER_MD, JSON.stringify({ rootMarker: '# Tables' }));
        });

        it('moving doc to between sheets should require metadata', () => {
            const tabs = [
                { type: 'document' as const, docIndex: 0 },  // D1
                { type: 'sheet' as const, sheetIndex: 0 },   // S1
                { type: 'sheet' as const, sheetIndex: 1 },   // S2
                { type: 'document' as const, docIndex: 1 },  // D2
                { type: 'add-sheet' as const }
            ];

            // D2 (tab 3) → between S1 and S2 (toIndex 2)
            const action = determineReorderAction(tabs, 3, 2);

            expect(action.metadataRequired).toBe(true);
        });
    });
});

// =============================================================================
// 3. Metadata UPDATE Scenarios (change existing metadata)
// =============================================================================

describe('Integration: Metadata UPDATE scenarios', () => {
    describe('Change custom order to different custom order', () => {
        const CUSTOM_MD = `# Tables

## Sheet 1

| A |
| - |
| 1 |

## Sheet 2

| B |
| - |
| 2 |

## Sheet 3

| C |
| - |
| 3 |

<!-- md-spreadsheet-workbook-metadata: {"tab_order": [{"type": "sheet", "index": 2}, {"type": "sheet", "index": 0}, {"type": "sheet", "index": 1}]} -->
`;

        beforeEach(() => {
            editor.initializeWorkbook(CUSTOM_MD, JSON.stringify({ rootMarker: '# Tables' }));
        });

        it('changing from [S3, S1, S2] to [S1, S3, S2] should update metadata', () => {
            const newOrder: TabOrderItem[] = [
                { type: 'sheet', index: 0 },
                { type: 'sheet', index: 2 },
                { type: 'sheet', index: 1 }
            ];

            editor.updateWorkbookTabOrder(newOrder);
            const wbUpdate = editor.generateAndGetRange();

            expect(wbUpdate.content).toContain('tab_order');
            // Verify it's the new order
            expect(wbUpdate.content).toContain('"type": "sheet", "index": 0');
        });
    });
});

// =============================================================================
// 4. Complex Mixed Structure Scenarios
// =============================================================================

describe('Integration: Mixed Structure scenarios', () => {
    describe('Docs before AND after WB', () => {
        const MIXED_MD = `# Doc Before

# Tables

## Sheet 1

| A |
| - |
| 1 |

# Doc After 1

# Doc After 2
`;

        beforeEach(() => {
            editor.initializeWorkbook(MIXED_MD, JSON.stringify({ rootMarker: '# Tables' }));
        });

        it('natural order should be [Doc Before, S1, Doc After 1, Doc After 2]', () => {
            const state = JSON.parse(editor.getState());
            const fileStructure = buildFileStructure(state.structure, state.workbook?.sheets?.length ?? 0);
            const naturalOrder = deriveTabOrderFromFile(fileStructure);

            expect(naturalOrder).toEqual([
                { type: 'document', index: 0 },  // Doc Before
                { type: 'sheet', index: 0 },     // S1
                { type: 'document', index: 1 },  // Doc After 1
                { type: 'document', index: 2 }   // Doc After 2
            ]);
        });

        it('moving Doc After 1 before S1 should require metadata', () => {
            // Natural: [Doc Before, S1, Doc After 1, Doc After 2]
            // Custom:  [Doc Before, Doc After 1, S1, Doc After 2]
            const customOrder: TabOrderItem[] = [
                { type: 'document', index: 0 },
                { type: 'document', index: 1 },
                { type: 'sheet', index: 0 },
                { type: 'document', index: 2 }
            ];

            const state = JSON.parse(editor.getState());
            const fileStructure = buildFileStructure(state.structure, state.workbook?.sheets?.length ?? 0);
            const naturalOrder = deriveTabOrderFromFile(fileStructure);

            const needsMetadata = isMetadataRequired(customOrder, fileStructure);
            expect(needsMetadata).toBe(true);
        });
    });

    describe('Multiple sheets with docs interleaved', () => {
        const INTERLEAVED_MD = `# Doc 1

# Tables

## Sheet 1

| A |
| - |
| 1 |

## Sheet 2

| B |
| - |
| 2 |

## Sheet 3

| C |
| - |
| 3 |

# Doc 2

# Doc 3
`;

        beforeEach(() => {
            editor.initializeWorkbook(INTERLEAVED_MD, JSON.stringify({ rootMarker: '# Tables' }));
        });

        it('natural order should be [D1, S1, S2, S3, D2, D3]', () => {
            const state = JSON.parse(editor.getState());
            const fileStructure = buildFileStructure(state.structure, state.workbook?.sheets?.length ?? 0);
            const naturalOrder = deriveTabOrderFromFile(fileStructure);

            expect(naturalOrder.length).toBe(6);
            expect(naturalOrder[0]).toEqual({ type: 'document', index: 0 });
            expect(naturalOrder[1]).toEqual({ type: 'sheet', index: 0 });
            expect(naturalOrder[4]).toEqual({ type: 'document', index: 1 });
        });

        it('inserting D2 between S1 and S2 should require metadata', () => {
            // Custom: [D1, S1, D2, S2, S3, D3]
            const customOrder: TabOrderItem[] = [
                { type: 'document', index: 0 },
                { type: 'sheet', index: 0 },
                { type: 'document', index: 1 },  // D2 moved
                { type: 'sheet', index: 1 },
                { type: 'sheet', index: 2 },
                { type: 'document', index: 2 }
            ];

            const state = JSON.parse(editor.getState());
            const fileStructure = buildFileStructure(state.structure, state.workbook?.sheets?.length ?? 0);
            const naturalOrder = deriveTabOrderFromFile(fileStructure);

            const needsMetadata = isMetadataRequired(customOrder, fileStructure);
            expect(needsMetadata).toBe(true);
        });
    });
});

// =============================================================================
// 5. Edge Cases
// =============================================================================

describe('Integration: Edge Cases', () => {
    describe('Single sheet, single doc', () => {
        const MINIMAL_MD = `# Tables

## Sheet 1

| A |
| - |
| 1 |

# Doc 1
`;

        beforeEach(() => {
            editor.initializeWorkbook(MINIMAL_MD, JSON.stringify({ rootMarker: '# Tables' }));
        });

        it('only two items - swapping requires metadata', () => {
            // [S1, D1] is natural
            // [D1, S1] requires metadata
            const customOrder: TabOrderItem[] = [
                { type: 'document', index: 0 },
                { type: 'sheet', index: 0 }
            ];

            const state = JSON.parse(editor.getState());
            const fileStructure = buildFileStructure(state.structure, state.workbook?.sheets?.length ?? 0);
            const naturalOrder = deriveTabOrderFromFile(fileStructure);

            const needsMetadata = isMetadataRequired(customOrder, fileStructure);
            expect(needsMetadata).toBe(true);
        });
    });

    describe('No workbook (docs only)', () => {
        const DOCS_ONLY_MD = `# Doc 1

Content 1

# Doc 2

Content 2
`;

        beforeEach(() => {
            editor.initializeWorkbook(DOCS_ONLY_MD, JSON.stringify({ rootMarker: '# Tables' }));
        });

        it('should handle docs-only structure', () => {
            const state = JSON.parse(editor.getState());
            expect(state.structure.length).toBe(2);
            expect(state.structure[0].type).toBe('document');
            expect(state.structure[1].type).toBe('document');
        });
    });

    describe('No docs (sheets only)', () => {
        const SHEETS_ONLY_MD = `# Tables

## Sheet 1

| A |
| - |
| 1 |

## Sheet 2

| B |
| - |
| 2 |
`;

        beforeEach(() => {
            editor.initializeWorkbook(SHEETS_ONLY_MD, JSON.stringify({ rootMarker: '# Tables' }));
        });

        it('swapping sheets should require metadata', () => {
            const customOrder: TabOrderItem[] = [
                { type: 'sheet', index: 1 },
                { type: 'sheet', index: 0 }
            ];

            const state = JSON.parse(editor.getState());
            const fileStructure = buildFileStructure(state.structure, state.workbook?.sheets?.length ?? 0);
            const naturalOrder = deriveTabOrderFromFile(fileStructure);

            const needsMetadata = isMetadataRequired(customOrder, fileStructure);
            expect(needsMetadata).toBe(true);
        });

        it('natural order should not require metadata', () => {
            const naturalOrderInput: TabOrderItem[] = [
                { type: 'sheet', index: 0 },
                { type: 'sheet', index: 1 }
            ];

            const state = JSON.parse(editor.getState());
            const fileStructure = buildFileStructure(state.structure, state.workbook?.sheets?.length ?? 0);
            const fileNaturalOrder = deriveTabOrderFromFile(fileStructure);

            const needsMetadata = isMetadataRequired(naturalOrderInput, fileStructure);
            expect(needsMetadata).toBe(false);
        });
    });
});
