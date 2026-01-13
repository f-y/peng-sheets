/**
 * Move Document Section Tests
 *
 * Created as part of Phase 1 migration verification.
 * Tests for moveDocumentSection parity between Python and TypeScript.
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
            const result = moveDocumentSection(0, null, true, false, 1);

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
            const result = moveDocumentSection(1, null, false, true, 0);

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
            const result = moveDocumentSection(0, null, true, false, 2);

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
            const result = moveDocumentSection(0, null, true, false, 1);
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
            const result = moveDocumentSection(0, null, true, false, 1);

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
            const result = moveDocumentSection(1, null, true, false, 2);

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
         * BUG REPRODUCTION: Metadata comment disappears after moving Doc
         * User scenario: [Doc1, Doc3, Workbook, Doc2], move Doc3 to between sheets
         */
        it('should preserve metadata comment after moving doc', () => {
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

            // Move Doc 3 (index 1) from before Workbook to after Workbook (targeting between sheets)
            const result = moveDocumentSection(1, null, true, false, 2);

            expect(result.error).toBeUndefined();

            const content = result.content!;

            // Metadata comment should still exist
            const metadataMatch = content.match(/<!-- md-spreadsheet-workbook-metadata: ({.*?}) -->/);
            expect(metadataMatch).not.toBeNull();

            // Tab order should be updated
            if (metadataMatch) {
                const metadata = JSON.parse(metadataMatch[1]);
                expect(metadata.tab_order).toBeDefined();
            }
        });

        /**
         * BUG REPRODUCTION: No initial metadata comment
         * User scenario: Start with no metadata, move doc to between sheets
         */
        it('should add metadata comment when none exists initially', () => {
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
            const result = moveDocumentSection(1, null, true, false, 2);

            expect(result.error).toBeUndefined();

            const content = result.content!;

            // Metadata comment should be ADDED
            const metadataMatch = content.match(/<!-- md-spreadsheet-workbook-metadata: ({.*?}) -->/);
            expect(metadataMatch).not.toBeNull();

            // Verify correct spacing: 1 blank line before metadata, 1 blank line after
            // Expected: ...\n\n<!-- metadata -->\n\n# Doc 3...
            const metadataIdx = content.indexOf('<!-- md-spreadsheet-workbook-metadata');
            const beforeMeta = content.slice(0, metadataIdx);
            const afterMeta = content.slice(content.indexOf('-->', metadataIdx) + 3);

            // Should have exactly 1 blank line before (2 newlines at end)
            expect(beforeMeta.endsWith('\n\n')).toBe(true);
            expect(beforeMeta.endsWith('\n\n\n')).toBe(false);

            // Should have exactly 1 blank line after (start with 2 newlines)
            expect(afterMeta.startsWith('\n\n')).toBe(true);
            expect(afterMeta.startsWith('\n\n\n')).toBe(false);
        });
    });
});
