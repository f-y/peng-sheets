/**
 * Add Document Tests - Bug Reproduction and Verification
 *
 * Created as part of RCA for Add New Document bugs:
 * 1. + button not working
 * 2. Context Menu adds `# Tables` instead of document
 *
 * These tests verify the addDocument API with various parameter combinations
 * to identify the root cause and ensure long-term quality.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    initializeWorkbook,
    getState,
    resetContext,
    addDocument,
    addDocumentAndGetFullUpdate
} from '../../../src/editor';

const SAMPLE_CONFIG = JSON.stringify({
    rootMarker: '# Tables',
    sheetHeaderLevel: 2
});

describe('Add Document API Tests', () => {
    beforeEach(() => {
        resetContext();
    });

    describe('Basic addDocument functionality', () => {
        const SIMPLE_WORKBOOK = `# Tables

## Sheet 1

| A | B |
|---|---|
| 1 | 2 |
`;

        beforeEach(() => {
            initializeWorkbook(SIMPLE_WORKBOOK, SAMPLE_CONFIG);
        });

        it('should add document after workbook (afterWorkbook=true)', () => {
            const result = addDocument('New Document', -1, true, 0);

            expect(result.error).toBeUndefined();
            expect(result.content).toBeDefined();

            // Get full state to verify
            const state = JSON.parse(getState());
            expect(state.structure).toBeDefined();

            // Structure should now have workbook AND document
            const docSections = state.structure.filter((s: { type: string }) => s.type === 'document');
            expect(docSections.length).toBe(1);
            expect(docSections[0].title).toBe('New Document');
        });

        it('should place document AFTER # Tables section, not replace it', () => {
            const result = addDocumentAndGetFullUpdate('New Document', -1, true, 0);

            expect(result.error).toBeUndefined();
            expect(result.content).toBeDefined();

            const content = result.content!;

            // # Tables should still exist
            expect(content).toContain('# Tables');

            // # New Document should appear AFTER # Tables section
            const tablesPos = content.indexOf('# Tables');
            const newDocPos = content.indexOf('# New Document');

            expect(tablesPos).toBeGreaterThanOrEqual(0);
            expect(newDocPos).toBeGreaterThan(tablesPos);
        });
    });

    describe('Hybrid document with sheets and documents', () => {
        const HYBRID_MD = `# My Document

Some content here.

# Tables

## Sheet 1

| A | B |
|---|---|
| 1 | 2 |

# Another Document

More content.
`;

        beforeEach(() => {
            initializeWorkbook(HYBRID_MD, SAMPLE_CONFIG);
        });

        it('should add document at end (afterWorkbook=true) when workbook exists', () => {
            const result = addDocumentAndGetFullUpdate('Third Doc', -1, true, 2);

            expect(result.error).toBeUndefined();

            const content = result.content!;

            // All sections should exist
            expect(content).toContain('# My Document');
            expect(content).toContain('# Tables');
            expect(content).toContain('# Another Document');
            expect(content).toContain('# Third Doc');

            // Third Doc should be after workbook section
            const tablesPos = content.indexOf('# Tables');
            const thirdDocPos = content.indexOf('# Third Doc');
            expect(thirdDocPos).toBeGreaterThan(tablesPos);
        });

        it('should add document after specific document index', () => {
            // afterDocIndex=0 means after "My Document"
            const result = addDocumentAndGetFullUpdate('Inserted Doc', 0, false, 1);

            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            const docSections = state.structure.filter((s: { type: string }) => s.type === 'document');

            // Should now have 3 documents
            expect(docSections.length).toBe(3);
        });

        it('should return updated structure with new document', () => {
            const result = addDocumentAndGetFullUpdate('New Doc', -1, true, 2);

            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            expect(state.structure).toBeDefined();

            // Count document sections
            const docCount = state.structure.filter((s: { type: string }) => s.type === 'document').length;
            expect(docCount).toBe(3); // My Document + Another Document + New Doc
        });
    });

    describe('Edge cases', () => {
        it('should handle adding document to empty workbook', () => {
            const EMPTY_WORKBOOK = `# Tables

## Sheet 1

| A |
|---|
| 1 |
`;
            initializeWorkbook(EMPTY_WORKBOOK, SAMPLE_CONFIG);

            const result = addDocumentAndGetFullUpdate('First Doc', -1, true, 0);

            expect(result.error).toBeUndefined();
            expect(result.content).toContain('# First Doc');
            expect(result.content).toContain('# Tables');
        });

        it('should preserve workbook when adding document', () => {
            const WORKBOOK_ONLY = `# Tables

## Sheet 1

| A | B |
|---|---|
| 1 | 2 |
`;
            initializeWorkbook(WORKBOOK_ONLY, SAMPLE_CONFIG);

            const result = addDocumentAndGetFullUpdate('New Doc', -1, true, 0);

            expect(result.error).toBeUndefined();

            // Workbook should still have the sheet
            const state = JSON.parse(getState());
            expect(state.workbook).toBeDefined();
            expect(state.workbook.sheets.length).toBe(1);
            expect(state.workbook.sheets[0].tables.length).toBe(1);
        });

        /**
         * Testing: Adding document at file beginning
         */
        it('should add document at beginning when afterDocIndex=-1 and afterWorkbook=false', () => {
            const WORKBOOK_ONLY = `# Tables

## Sheet 1

| A |
|---|
| 1 |
`;
            initializeWorkbook(WORKBOOK_ONLY, SAMPLE_CONFIG);

            // afterDocIndex=-1, afterWorkbook=false should add at beginning
            const result = addDocumentAndGetFullUpdate('First Doc', -1, false, 0);

            expect(result.error).toBeUndefined();

            const content = result.content!;

            // Document should be before workbook
            const docPos = content.indexOf('# First Doc');
            const tablesPos = content.indexOf('# Tables');

            expect(docPos).toBeGreaterThanOrEqual(0);
            expect(tablesPos).toBeGreaterThan(docPos);
        });
    });

    describe('Tab order context menu bug (regression)', () => {
        /**
         * Regression test for context menu Add Document bug:
         * When adding document via context menu in the middle of tab_order,
         * document indices were getting corrupted.
         *
         * Initial tab_order:
         * [doc 0, sheet 1, sheet 0, doc 1]
         *
         * Add document after tab index 1 (sheet 1):
         * Expected: [doc 0, sheet 1, NEW doc 2, sheet 0, doc 1]
         * Bug: indices were shuffled incorrectly
         */
        it('should not corrupt tab_order indices when adding document via context menu', () => {
            // Set up workbook with specific tab_order
            const HYBRID_MD = `# Doc Zero

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
            initializeWorkbook(HYBRID_MD, SAMPLE_CONFIG);

            // Verify initial state
            let state = JSON.parse(getState());
            const initialTabOrder = state.workbook.metadata.tab_order;
            expect(initialTabOrder).toEqual([
                { type: 'document', index: 0 },
                { type: 'sheet', index: 1 },
                { type: 'sheet', index: 0 },
                { type: 'document', index: 1 }
            ]);

            // Add document after tab index 1 (sheet index 1)
            // afterDocIndex=-1 (no specific doc), afterWorkbook=true, insertAfterTabOrderIndex=1
            const result = addDocumentAndGetFullUpdate('New Document', -1, true, 1);

            expect(result.error).toBeUndefined();

            // Verify tab_order
            state = JSON.parse(getState());
            const newTabOrder = state.workbook.metadata.tab_order;

            // The new document should be inserted at tab position 2 with index 2
            expect(newTabOrder.length).toBe(5);

            // Find the new document entry
            const newDocEntry = newTabOrder.find(
                (item: { type: string; index: number }) => item.type === 'document' && item.index === 2
            );
            expect(newDocEntry).toBeDefined();

            // Original document indices should NOT be changed
            const doc0 = newTabOrder.find(
                (item: { type: string; index: number }) => item.type === 'document' && item.index === 0
            );
            const doc1 = newTabOrder.find(
                (item: { type: string; index: number }) => item.type === 'document' && item.index === 1
            );
            expect(doc0).toBeDefined();
            expect(doc1).toBeDefined();

            // Sheet indices should NOT be changed
            const sheet0 = newTabOrder.find(
                (item: { type: string; index: number }) => item.type === 'sheet' && item.index === 0
            );
            const sheet1 = newTabOrder.find(
                (item: { type: string; index: number }) => item.type === 'sheet' && item.index === 1
            );
            expect(sheet0).toBeDefined();
            expect(sheet1).toBeDefined();
        });
    });

    describe('Between-sheets Document insertion (SPECS.md 8.5)', () => {
        /**
         * Test for SPECS.md 8.5 Document/Sheet Insertion Rules:
         * When adding Document between sheets:
         * - Physical: Always after Workbook
         * - tab_order: Inserted at correct position
         *
         * Scenario: [Doc0, Sheet0, Sheet1, Doc1]
         * Add Doc between Sheet0 and Sheet1 (target index 2)
         * Expected:
         * - Physical: New Doc after Workbook, before Doc1
         * - tab_order: [Doc0, Sheet0, NewDoc, Sheet1, Doc1]
         */
        it('should insert document after workbook and maintain correct tab_order', () => {
            const HYBRID_MD = `# Doc Zero

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

<!-- md-spreadsheet-workbook-metadata: {"tab_order": [{"type": "document", "index": 0}, {"type": "sheet", "index": 0}, {"type": "sheet", "index": 1}, {"type": "document", "index": 1}]} -->

# Doc One

More content.
`;
            initializeWorkbook(HYBRID_MD, SAMPLE_CONFIG);

            // Verify initial state
            let state = JSON.parse(getState());
            expect(state.workbook.metadata.tab_order).toEqual([
                { type: 'document', index: 0 },
                { type: 'sheet', index: 0 },
                { type: 'sheet', index: 1 },
                { type: 'document', index: 1 }
            ]);

            // Add document between Sheet0 and Sheet1 (insertAfterTabOrderIndex=1)
            // This means: insert at tab position 2
            // afterWorkbook=true per SPECS.md 8.5
            const result = addDocumentAndGetFullUpdate('New Doc', -1, true, 1);

            expect(result.error).toBeUndefined();

            // Verify physical order: New Doc should be after Workbook but before Doc One
            const content = result.content!;
            const workbookEnd = content.indexOf('<!-- md-spreadsheet-workbook-metadata');
            const newDocPos = content.indexOf('# New Doc');
            const docOnePos = content.indexOf('# Doc One');

            expect(newDocPos).toBeGreaterThan(workbookEnd);
            expect(newDocPos).toBeLessThan(docOnePos);

            // Verify tab_order
            state = JSON.parse(getState());
            const newTabOrder = state.workbook.metadata.tab_order;

            // Expected tab_order after insertion:
            // [Doc0, Sheet0, NewDoc(index 1), Sheet1, Doc1(shifted to 2)]
            expect(newTabOrder).toEqual([
                { type: 'document', index: 0 },
                { type: 'sheet', index: 0 },
                { type: 'document', index: 1 }, // New doc gets index 1 (correct)
                { type: 'sheet', index: 1 },
                { type: 'document', index: 2 } // Doc1 shifted from 1 to 2
            ]);
        });

        it('should add document at end when no docs after target in tab_order', () => {
            const HYBRID_MD = `# Doc Zero

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

<!-- md-spreadsheet-workbook-metadata: {"tab_order": [{"type": "document", "index": 0}, {"type": "sheet", "index": 0}, {"type": "sheet", "index": 1}]} -->
`;
            initializeWorkbook(HYBRID_MD, SAMPLE_CONFIG);

            // Add document at end (after Sheet1, target index 2 means insert at position 3)
            const result = addDocumentAndGetFullUpdate('New Doc', -1, true, 2);

            expect(result.error).toBeUndefined();

            // New doc should be at end of file (after workbook)
            const content = result.content!;
            expect(content.trim().endsWith('# New Doc')).toBe(true);

            // Verify tab_order
            const state = JSON.parse(getState());
            const newTabOrder = state.workbook.metadata.tab_order;

            expect(newTabOrder).toEqual([
                { type: 'document', index: 0 },
                { type: 'sheet', index: 0 },
                { type: 'sheet', index: 1 },
                { type: 'document', index: 1 } // New doc
            ]);
        });

        /**
         * Regression test: Reproduces the bug where physical position is correct
         * but tab_order shows document indices reversed.
         *
         * Initial state: [Doc0, Sheet0, Sheet1, Doc1]
         * Add Doc between Sheet0 and Sheet1 via context menu
         *
         * Bug behavior:
         * - Physical: # Doc 3 appears before # Doc 2 (correct)
         * - tab_order: [..., {doc, 2}, ..., {doc, 1}] but doc 2 is actually after doc 1 in file
         *
         * Expected: tab_order indices should match physical order after Workbook
         */
        it('should have tab_order document indices that match physical order after workbook', () => {
            const HYBRID_MD = `# Doc Zero

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

<!-- md-spreadsheet-workbook-metadata: {"tab_order": [{"type": "document", "index": 0}, {"type": "sheet", "index": 0}, {"type": "sheet", "index": 1}, {"type": "document", "index": 1}]} -->

# Doc One

More content.
`;
            initializeWorkbook(HYBRID_MD, SAMPLE_CONFIG);

            // Simulate context menu: Add document after Sheet0 (tab position 1)
            // insertAfterTabOrderIndex=1 means insert AFTER position 1, so at position 2
            const result = addDocumentAndGetFullUpdate('Doc Two', -1, true, 1);

            expect(result.error).toBeUndefined();

            const content = result.content!;
            const state = JSON.parse(getState());
            const tabOrder = state.workbook.metadata.tab_order;

            // Get document titles from structure in their physical order
            const docsInPhysicalOrder = state.structure
                .filter((s: { type: string }) => s.type === 'document')
                .map((s: { title: string }) => s.title);

            // Get document indices from tab_order
            const docEntriesInTabOrder = tabOrder.filter((item: { type: string }) => item.type === 'document');

            // The document indices in tab_order should correspond to physical order
            // Doc 0 = "Doc Zero" (before workbook)
            // After workbook:
            //   First doc physically = should have lowest index among post-workbook docs
            //   Second doc physically = should have next index

            // Find position of new doc in content
            const docTwoPos = content.indexOf('# Doc Two');
            const docOnePos = content.indexOf('# Doc One');
            const workbookMetaPos = content.indexOf('<!-- md-spreadsheet-workbook-metadata');

            // New doc should be physically between workbook and Doc One
            expect(docTwoPos).toBeGreaterThan(workbookMetaPos);
            expect(docTwoPos).toBeLessThan(docOnePos);

            // Key assertion: In tab_order, the new doc entry at position 2
            // should have an index that places it BEFORE Doc One in physical file
            const newDocInTabOrder = tabOrder[2]; // Position after Doc0, Sheet0
            expect(newDocInTabOrder.type).toBe('document');

            // Get the doc at this index from structure
            const docsAfterWorkbook = state.structure.filter(
                (s: { type: string; title: string }) => s.type === 'document' && s.title !== 'Doc Zero'
            );

            // "Doc Two" should come before "Doc One" in both physical and logical order
            const docTwoEntry = docsAfterWorkbook.find((d: { title: string }) => d.title === 'Doc Two');
            const docOneEntry = docsAfterWorkbook.find((d: { title: string }) => d.title === 'Doc One');

            expect(docTwoEntry).toBeDefined();
            expect(docOneEntry).toBeDefined();

            // The structure ordering should match physical file order
            const docTwoStructureIdx = docsAfterWorkbook.indexOf(docTwoEntry);
            const docOneStructureIdx = docsAfterWorkbook.indexOf(docOneEntry);
            expect(docTwoStructureIdx).toBeLessThan(docOneStructureIdx);
        });

        /**
         * BUG REPRODUCTION: newDocIndex calculation in document.ts
         *
         * When afterWorkbook=true and afterDocIndex=-1:
         * - Current code: newDocIndex = total document count
         * - But if Doc0 exists BEFORE Workbook, and Doc1 exists AFTER Workbook
         * - New doc inserted after Workbook should have index between Doc0 and Doc1
         *
         * Scenario:
         * - Initial: [Doc0, Sheet0, Sheet1, Doc1] (Doc0 before Workbook, Doc1 after)
         * - Add Doc between Sheet0 and Sheet1 (afterWorkbook=true, afterDocIndex=-1)
         * - Expected: New doc gets index 1 (after Doc0, before Doc1)
         * - Bug: New doc gets index 2 (total docs = 2, but it should be 1)
         */
        it('should calculate correct newDocIndex when doc exists before workbook', () => {
            const HYBRID_MD = `# Doc Zero

Content before workbook.

# Tables

## Sheet 1

| A |
|---|
| 1 |

## Sheet 2

| B |
|---|
| 2 |

<!-- md-spreadsheet-workbook-metadata: {"tab_order": [{"type": "document", "index": 0}, {"type": "sheet", "index": 0}, {"type": "sheet", "index": 1}, {"type": "document", "index": 1}]} -->

# Doc One

Content after workbook.
`;
            initializeWorkbook(HYBRID_MD, SAMPLE_CONFIG);

            // Verify initial state
            let state = JSON.parse(getState());
            const initialDocs = state.structure.filter((s: { type: string }) => s.type === 'document');
            expect(initialDocs.length).toBe(2);
            expect(initialDocs[0].title).toBe('Doc Zero'); // Before Workbook
            expect(initialDocs[1].title).toBe('Doc One'); // After Workbook

            // Add document after workbook (afterDocIndex=-1, afterWorkbook=true)
            // insertAfterTabOrderIndex=1 means insert after Sheet0 in tab order
            const result = addDocumentAndGetFullUpdate('New Doc', -1, true, 1);

            expect(result.error).toBeUndefined();

            // Get new state
            state = JSON.parse(getState());
            const tabOrder = state.workbook.metadata.tab_order;

            // Find all document entries in tab_order
            const docEntries = tabOrder.filter((item: { type: string }) => item.type === 'document');

            // Should have 3 documents now
            expect(docEntries.length).toBe(3);

            // Get document indices from tab_order
            const docIndices = docEntries
                .map((item: { index: number }) => item.index)
                .sort((a: number, b: number) => a - b);

            // Doc0 = index 0 (before Workbook)
            // NewDoc = index 1 (first position after Workbook)
            // Doc1 = index 2 (shifted from 1 to 2)
            expect(docIndices).toEqual([0, 1, 2]);

            // Verify the new doc at tab position 2 has index 1 (not 2)
            const newDocEntry = tabOrder[2]; // Position after Doc0, Sheet0
            expect(newDocEntry.type).toBe('document');
            expect(newDocEntry.index).toBe(1); // KEY ASSERTION: index should be 1, not 2
        });
    });
});
