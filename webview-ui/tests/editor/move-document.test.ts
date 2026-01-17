/**
 * Move Document Section Tests
 *
 * Created as part of Phase 1 migration verification.
 * Tests for moveDocumentSection (pure physical move function).
 *
 * KNOWN ISSUES (marked as skip for test-first fixing):
 * 1. effective_to_index calculation missing when toDocIndex is null
 * 2. metadata comment not updated in markdown after move
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { initializeWorkbook, getState, resetContext, moveDocumentSection } from '../../../src/editor';

const SAMPLE_CONFIG = JSON.stringify({
    rootMarker: '# Tables',
    sheetHeaderLevel: 2
});

describe('Move Document Section Tests', () => {
    beforeEach(() => {
        resetContext();
    });

    describe('Basic move operations', () => {
        const HYBRID_MD = `# Doc Zero

First document content.

# Tables

## Sheet 1

| A |
|---|
| 1 |

# Doc One

Second document content.

<!-- md-spreadsheet-workbook-metadata: {"tab_order": [{"type": "document", "index": 0}, {"type": "sheet", "index": 0}, {"type": "document", "index": 1}]} -->
`;

        beforeEach(() => {
            initializeWorkbook(HYBRID_MD, SAMPLE_CONFIG);
        });

        /**
         * Testing toAfterWorkbook movement
         */
        it('should move document to after workbook', () => {
            // Move Doc Zero (index 0) to after workbook
            const result = moveDocumentSection(0, null, true, false);

            expect(result.error).toBeUndefined();
            expect(result.file_changed).toBe(true);

            const content = result.content!;

            // Doc Zero should now be after # Tables section
            const tablesPos = content.indexOf('# Tables');
            const docZeroPos = content.indexOf('# Doc Zero');

            expect(tablesPos).toBeGreaterThanOrEqual(0);
            expect(docZeroPos).toBeGreaterThan(tablesPos);
        });

        it('should move document to before workbook', () => {
            // Move Doc One (index 1) to before workbook
            const result = moveDocumentSection(1, null, false, true);

            expect(result.error).toBeUndefined();
            expect(result.file_changed).toBe(true);

            const content = result.content!;

            // Doc One should now be before # Tables section
            const tablesPos = content.indexOf('# Tables');
            const docOnePos = content.indexOf('# Doc One');

            expect(tablesPos).toBeGreaterThan(docOnePos);
        });
    });

    describe('Tab order updates', () => {
        const REORDER_MD = `# Doc Zero

Content.

# Tables

## Sheet 1

| A |
|---|
| 1 |

## Sheet 2

| B |
|---|
| 2 |

# Doc One

More content.

<!-- md-spreadsheet-workbook-metadata: {"tab_order": [{"type": "document", "index": 0}, {"type": "sheet", "index": 1}, {"type": "sheet", "index": 0}, {"type": "document", "index": 1}]} -->
`;

        beforeEach(() => {
            initializeWorkbook(REORDER_MD, SAMPLE_CONFIG);
        });

        it('should update tab_order when moving document', () => {
            // Initial: [doc 0, sheet 1, sheet 0, doc 1]
            // Move doc 0 to after workbook (targetTabOrderIndex=2)
            const result = moveDocumentSection(0, null, true, false);

            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            const tabOrder = state.workbook.metadata.tab_order;

            // After move: [sheet 1, sheet 0, doc 0, doc 1] or similar
            expect(tabOrder).toBeDefined();
            expect(tabOrder.length).toBe(4);
        });

        /**
         * BUG REPRODUCTION TEST - Marked as skip
         *
         * Root Cause: TypeScript uses `toDocIndex ?? fromDocIndex` directly,
         * but Python calculates `effective_to_index` by counting documents
         * before the target tab order index.
         *
         * Python (correct):
         * ```python
         * if to_doc_index is not None:
         *     effective_to_index = to_doc_index
         * else:
         *     docs_before_target = 0
         *     for i in range(min(target_tab_order_index, len(tab_order))):
         *         item = tab_order[i]
         *         if item["type"] == "document" and item["index"] != from_doc_index:
         *             docs_before_target += 1
         *     effective_to_index = docs_before_target
         * ```
         *
         * TypeScript (bug):
         * ```typescript
         * toDocIndex ?? fromDocIndex  // Wrong when toDocIndex is null
         * ```
         */
        /**
         * Testing effective_to_index calculation
         */
        it('should correctly calculate effective_to_index when toDocIndex is null', () => {
            const result = moveDocumentSection(0, null, true, false);
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            const tabOrder = state.workbook.metadata.tab_order;

            const doc0Position = tabOrder.findIndex(
                (item: { type: string; index: number }) => item.type === 'document' && item.index === 0
            );

            // After move: doc 0 was at position 0, moved to target 1, but since currPos(0) < target(1),
            // target is adjusted to 0, so doc 0 ends up at position 0
            expect(doc0Position).toBe(0);
        });
    });

    describe('Metadata comment update', () => {
        const MD_WITH_METADATA = `# Doc Zero

Content.

# Tables

## Sheet 1

| A |
|---|
| 1 |

# Doc One

More content.

<!-- md-spreadsheet-workbook-metadata: {"tab_order": [{"type": "document", "index": 0}, {"type": "sheet", "index": 0}, {"type": "document", "index": 1}]} -->
`;

        beforeEach(() => {
            initializeWorkbook(MD_WITH_METADATA, SAMPLE_CONFIG);
        });

        /**
         * Testing: Metadata comment should be updated in markdown after move
         */
        it('should update metadata comment in markdown after move', () => {
            // Move Doc Zero to after workbook
            const result = moveDocumentSection(0, null, true, false);

            expect(result.error).toBeUndefined();

            const content = result.content!;

            // The metadata comment in the markdown should reflect the new tab_order
            const metadataMatch = content.match(/<!-- md-spreadsheet-workbook-metadata: ({.*?}) -->/);
            expect(metadataMatch).not.toBeNull();

            const embeddedMetadata = JSON.parse(metadataMatch![1]);
            expect(embeddedMetadata.tab_order).toBeDefined();

            // The tab_order in the comment should match the workbook state
            const state = JSON.parse(getState());
            const workbookTabOrder = state.workbook.metadata.tab_order;

            expect(embeddedMetadata.tab_order).toEqual(workbookTabOrder);
        });
    });

    describe('Between-sheets Document move (SPECS.md 8.5)', () => {
        /**
         * BUG REPRODUCTION: When moving a Document to a sheet position (between sheets),
         * the Document should physically move to AFTER Workbook, not stay before it.
         *
         * Initial state:
         * - Physical: [Doc1, Doc3, # Tables (sheets), Doc2]
         * - Tab order: [Doc1, Sheet1, Doc3, Sheet2, Doc2] (Doc3 is between sheets)
         *
         * Move Doc3 (which is before Workbook) to between Sheet1 and Sheet2:
         * - Expected: Doc3 physically moves to after Workbook
         * - Bug: Doc3 stays before Workbook
         */
        it('should move doc before workbook to after workbook when targeting sheet position', () => {
            const HYBRID_MD = `# Doc 1

First content.

# Doc 3

Content that should move.

# Tables

## Sheet 1

| A |
|---|
| 1 |

## Sheet 2

| B |
|---|
| 2 |

<!-- md-spreadsheet-workbook-metadata: {"tab_order": [{"type": "document", "index": 0}, {"type": "sheet", "index": 0}, {"type": "sheet", "index": 1}, {"type": "document", "index": 2}]} -->

# Doc 2

Content after workbook.
`;
            initializeWorkbook(HYBRID_MD, SAMPLE_CONFIG);

            // Verify initial state
            const state = JSON.parse(getState());
            const initialDocs = state.structure.filter((s: { type: string }) => s.type === 'document');
            expect(initialDocs.length).toBe(3);
            expect(initialDocs[0].title).toBe('Doc 1');
            expect(initialDocs[1].title).toBe('Doc 3'); // Before Workbook
            expect(initialDocs[2].title).toBe('Doc 2'); // After Workbook

            // Move Doc 3 (index 1) to between Sheet1 and Sheet2 (targetTabOrderIndex=2)
            // This is a "cross-type" move, so toAfterWorkbook should be true
            const result = moveDocumentSection(1, null, true, false);

            expect(result.error).toBeUndefined();

            const content = result.content!;

            // Doc 3 should now be AFTER workbook section, not before
            const tablesPos = content.indexOf('# Tables');
            const doc3Pos = content.indexOf('# Doc 3');
            const doc2Pos = content.indexOf('# Doc 2');

            expect(doc3Pos).toBeGreaterThan(tablesPos); // KEY: Doc 3 is after Tables
            expect(doc3Pos).toBeLessThan(doc2Pos); // Doc 3 is before Doc 2
        });

        /**
         * EXACT USER SCENARIO: Doc3 (before Workbook) to after Sheet2
         * Initial: [Doc1, Doc3, Workbook(Sheet1, Sheet2), Doc2]
         * Move Doc3 to between sheets (after Sheet2)
         * Expected: Doc3 physically goes after Workbook, BEFORE Doc2
         * Bug: Doc3 ends up at file end (AFTER Doc2)
         */
        it('should insert doc before existing doc after workbook', () => {
            // Exact markdown from user scenario (no initial metadata)
            const EXACT_USER_MD = `# Doc 1

Integrates with Pydantic and Dataclasses to validate table data as structured data.

# Doc 3

# Tables

## Sheet 1

| Column 1 | Column 2 | Column 3 |
| --- | --- | --- |
|  |  |  |

## Sheet 2

| Column 1 | Column 2 | Column 3 |
| --- | --- | --- |
|  |  |  |

# Doc 2

`;
            initializeWorkbook(EXACT_USER_MD, SAMPLE_CONFIG);

            // Verify initial state
            const state = JSON.parse(getState());
            const docs = state.structure.filter((s: { type: string }) => s.type === 'document');
            expect(docs[0].title).toBe('Doc 1');
            expect(docs[1].title).toBe('Doc 3'); // Before Workbook
            expect(docs[2].title).toBe('Doc 2'); // After Workbook

            // Move Doc 3 (docIndex=1) to after Workbook with toAfterWorkbook=true
            // In UI: toIndex=4 (position after Sheet2, which is at lastSheetIdx=3, so toIndex=lastSheetIdx+1=4)
            // Tab order: [Doc1=0, Doc3=1, Sheet1=2, Sheet2=3, Doc2=4]
            // Dropping after Sheet2 means toIndex=4 (where Doc2 currently is)
            const result = moveDocumentSection(1, null, true, false);

            expect(result.error).toBeUndefined();

            const content = result.content!;

            // Doc 3 should be AFTER Workbook but BEFORE Doc 2
            const tablesPos = content.indexOf('# Tables');
            const doc3Pos = content.indexOf('# Doc 3');
            const doc2Pos = content.indexOf('# Doc 2');

            expect(doc3Pos).toBeGreaterThan(tablesPos);
            expect(doc3Pos).toBeLessThan(doc2Pos); // KEY: Doc 3 BEFORE Doc 2
        });

        /**
         * moveDocumentSection is now a pure physical move.
         * Metadata handling should be done by the caller.
         * This test verifies existing metadata is preserved (not modified).
         */
        it('should preserve existing metadata comment (not modify it)', () => {
            const HYBRID_MD = `# Doc 1

First content.

# Doc 3

Content.

# Tables

## Sheet 1

| A |
|---|
| 1 |

## Sheet 2

| B |
|---|
| 2 |

<!-- md-spreadsheet-workbook-metadata: {"tab_order": [{"type": "document", "index": 0}, {"type": "sheet", "index": 0}, {"type": "document", "index": 1}, {"type": "sheet", "index": 1}, {"type": "document", "index": 2}]} -->

# Doc 2

Content.
`;
            initializeWorkbook(HYBRID_MD, SAMPLE_CONFIG);

            // Move Doc 3 (index 1) from before Workbook to after Workbook
            const result = moveDocumentSection(1, null, true, false);

            expect(result.error).toBeUndefined();

            const content = result.content!;

            // Metadata comment should still exist (moveDocumentSection doesn't remove it)
            const metadataMatch = content.match(/<!-- md-spreadsheet-workbook-metadata: ({.*?}) -->/);
            expect(metadataMatch).not.toBeNull();

            // Physical move verified: Doc 3 is now after Tables
            const tablesPos = content.indexOf('# Tables');
            const doc3Pos = content.indexOf('# Doc 3');
            expect(doc3Pos).toBeGreaterThan(tablesPos);
        });

        /**
         * Pure physical move - does NOT add metadata.
         * Metadata addition is now the caller's responsibility (SPECS.md 8.6).
         */
        it('should not add metadata comment - pure physical move only', () => {
            const NO_META_MD = `# Doc 1

First content.

# Doc 3

Content.

# Tables

## Sheet 1

| A |
|---|
| 1 |

## Sheet 2

| B |
|---|
| 2 |

# Doc 2

Content.
`;
            initializeWorkbook(NO_META_MD, SAMPLE_CONFIG);

            // Move Doc 3 (index 1) from before Workbook to after Workbook
            const result = moveDocumentSection(1, null, true, false);

            expect(result.error).toBeUndefined();

            const content = result.content!;

            // moveDocumentSection is pure - should NOT add metadata
            const metadataMatch = content.match(/<!-- md-spreadsheet-workbook-metadata: ({.*?}) -->/);
            expect(metadataMatch).toBeNull();

            // Physical move verified: Doc 3 is now after Tables
            const tablesPos = content.indexOf('# Tables');
            const doc3Pos = content.indexOf('# Doc 3');
            expect(doc3Pos).toBeGreaterThan(tablesPos);
        });
    });

    /**
     * RCA: Doc→Doc Off-by-One Index Bug
     * Condition: WB exists before Docs OR WB doesn't exist, Doc moved backward
     */
    describe('Doc→Doc Off-by-One Index Bug (RCA)', () => {
        /**
         * BUG CASE 1: WB exists before Docs
         * Initial: [WB, D1, D2]
         * Action: Move D1 after D2
         * Expected: [WB, D2, D1]
         */
        it('should move D1 after D2 when WB is before - [WB, D1, D2] → [WB, D2, D1]', () => {
            const MD = `# Tables

## Sheet 1

| A |
|---|
| 1 |

# Doc 1

First doc.

# Doc 2

Second doc.
`;
            initializeWorkbook(MD, SAMPLE_CONFIG);

            // Move D1 (index 0) after D2 (index 1)
            // toDocIndex = 1 means "move to where D2 is"
            const result = moveDocumentSection(0, 1, false, false);

            expect(result.error).toBeUndefined();

            const content = result.content!;

            // Expected order: Tables, Doc 2, Doc 1
            const tablesPos = content.indexOf('# Tables');
            const doc1Pos = content.indexOf('# Doc 1');
            const doc2Pos = content.indexOf('# Doc 2');

            expect(tablesPos).toBeLessThan(doc2Pos);
            expect(doc2Pos).toBeLessThan(doc1Pos); // KEY: D2 comes before D1
        });

        /**
         * BUG CASE 2: WB doesn't exist (Documents only)
         * Initial: [D1, D2, D3]
         * Action: Move D1 after D2
         * Expected: [D2, D1, D3]
         */
        it('should move D1 after D2 when no WB - [D1, D2, D3] → [D2, D1, D3]', () => {
            const MD = `# Doc 1

First doc.

# Doc 2

Second doc.

# Doc 3

Third doc.
`;
            initializeWorkbook(MD, SAMPLE_CONFIG);

            // Move D1 (index 0) after D2 (index 1)
            const result = moveDocumentSection(0, 1, false, false);

            expect(result.error).toBeUndefined();

            const content = result.content!;

            // Expected order: Doc 2, Doc 1, Doc 3
            const doc1Pos = content.indexOf('# Doc 1');
            const doc2Pos = content.indexOf('# Doc 2');
            const doc3Pos = content.indexOf('# Doc 3');

            expect(doc2Pos).toBeLessThan(doc1Pos); // KEY: D2 comes before D1
            expect(doc1Pos).toBeLessThan(doc3Pos); // D1 comes before D3
        });

        /**
         * BUG CASE 3: Docs before WB
         * Initial: [D1, D2, WB]
         * Action: Move D1 after D2
         * Expected: [D2, D1, WB]
         */
        it('should move D1 after D2 when Docs before WB - [D1, D2, WB] → [D2, D1, WB]', () => {
            const MD = `# Doc 1

First doc.

# Doc 2

Second doc.

# Tables

## Sheet 1

| A |
|---|
| 1 |
`;
            initializeWorkbook(MD, SAMPLE_CONFIG);

            // Move D1 (index 0) after D2 (index 1)
            const result = moveDocumentSection(0, 1, false, false);

            expect(result.error).toBeUndefined();

            const content = result.content!;

            // Expected order: Doc 2, Doc 1, Tables
            const doc1Pos = content.indexOf('# Doc 1');
            const doc2Pos = content.indexOf('# Doc 2');
            const tablesPos = content.indexOf('# Tables');

            expect(doc2Pos).toBeLessThan(doc1Pos); // KEY: D2 comes before D1
            expect(doc1Pos).toBeLessThan(tablesPos); // D1 comes before Tables
        });
    });

    /**
     * EXACT REPRODUCTION: sample-workspace/workbook.md
     * Structure: [WB(S1, S2), Doc1, Doc2, Doc3]
     */
    describe('Exact Reproduction: workbook.md [WB, D1, D2, D3]', () => {
        const WORKBOOK_MD = `# Tables

## Sheet 1

| Column 1 | Column 2 | Column 3 |
| --- | --- | --- |
|  |  |  |

## Sheet 2

| Column 1 | Column 2 | Column 3 |
| --- | --- | --- |
|  |  |  |

# Doc 1

# Doc 2

# Doc 3
`;

        beforeEach(() => {
            initializeWorkbook(WORKBOOK_MD, SAMPLE_CONFIG);
        });

        /**
         * USER BUG REPORT 1: Doc1 → after Doc2
         * Initial: [WB, D1, D2, D3]
         * Action: Move D1 after D2
         * Expected: [WB, D2, D1, D3]
         */
        it('should move Doc1 after Doc2 - [WB, D1, D2, D3] → [WB, D2, D1, D3]', () => {
            // Doc1 is index 0, Doc2 is index 1
            const result = moveDocumentSection(0, 1, false, false);

            expect(result.error).toBeUndefined();

            const content = result.content!;
            const tablesPos = content.indexOf('# Tables');
            const doc1Pos = content.indexOf('# Doc 1');
            const doc2Pos = content.indexOf('# Doc 2');
            const doc3Pos = content.indexOf('# Doc 3');

            // Expected order: Tables < Doc2 < Doc1 < Doc3
            expect(tablesPos).toBeLessThan(doc2Pos);
            expect(doc2Pos).toBeLessThan(doc1Pos); // KEY: D2 before D1
            expect(doc1Pos).toBeLessThan(doc3Pos); // D1 before D3
        });

        /**
         * USER BUG REPORT 2: Doc2 → after Doc3
         * Initial: [WB, D1, D2, D3]
         * Action: Move D2 after D3
         * Expected: [WB, D1, D3, D2]
         */
        it('should move Doc2 after Doc3 - [WB, D1, D2, D3] → [WB, D1, D3, D2]', () => {
            // Doc2 is index 1, Doc3 is index 2
            const result = moveDocumentSection(1, 2, false, false);

            expect(result.error).toBeUndefined();

            const content = result.content!;
            const tablesPos = content.indexOf('# Tables');
            const doc1Pos = content.indexOf('# Doc 1');
            const doc2Pos = content.indexOf('# Doc 2');
            const doc3Pos = content.indexOf('# Doc 3');

            // Expected order: Tables < Doc1 < Doc3 < Doc2
            expect(tablesPos).toBeLessThan(doc1Pos);
            expect(doc1Pos).toBeLessThan(doc3Pos); // D1 before D3
            expect(doc3Pos).toBeLessThan(doc2Pos); // KEY: D3 before D2
        });
    });
});
