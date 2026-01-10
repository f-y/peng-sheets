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
});
