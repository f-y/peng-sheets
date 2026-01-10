/**
 * Regression tests for + button (add-tab-dropdown) Add Document functionality.
 *
 * Bug: When clicking + button to add Document, it was inserted at wrong position
 * (after Workbook header, not at end of file).
 *
 * Root Cause: _addDocument() had separate logic from the context menu method
 * (_addDocumentFromMenu). Now both delegate to _addDocumentAtPosition().
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { initializeWorkbook, getState, resetContext, addDocumentAndGetFullUpdate } from '../../../src/editor';

const SAMPLE_CONFIG = JSON.stringify({
    rootMarker: '# Tables',
    sheetHeaderLevel: 2
});

describe('+ Button (Add Tab Dropdown) Regression Tests', () => {
    beforeEach(() => {
        resetContext();
    });

    describe('Add Document via + button (append at end)', () => {
        /**
         * This is the exact scenario that was broken:
         * Hybrid notebook with document sections AFTER the workbook.
         * When adding via + button, the new document should appear at the END of the file,
         * not right after the workbook header.
         */
        it('should add document at file END when documents exist after workbook', () => {
            const HYBRID_NOTEBOOK = `<!-- md-spreadsheet-workbook-metadata: {"tab_order": [{"type": "document", "index": 0}, {"type": "sheet", "index": 0}, {"type": "sheet", "index": 1}, {"type": "document", "index": 1}, {"type": "sheet", "index": 2}, {"type": "sheet", "index": 3}]} -->

# Appendix

## Glossaries

- **Workbook**: A collection of Sheets.

# Tables

## Sheet 1

| A |
|---|
| 1 |

## Sheet 2

| B |
|---|
| 2 |

## Sheet 3

| C |
|---|
| 3 |

## Sheet 4

| D |
|---|
| 4 |
`;
            initializeWorkbook(HYBRID_NOTEBOOK, SAMPLE_CONFIG);

            // The + button adds at position = number of valid tabs
            // For this hybrid notebook: 2 documents + 4 sheets = 6 valid tabs
            // targetTabOrderIndex = 6 (append at end)
            // insertAfterTabOrderIndex = 5 (last valid tab index)
            const result = addDocumentAndGetFullUpdate('Document 3', -1, true, 5);

            expect(result.error).toBeUndefined();

            const content = result.content!;

            // Verify: New document should be at the END of the file
            // Order in file: Appendix content → Tables (4 sheets) → Document 3 at END
            const tablesPos = content.indexOf('# Tables');
            const appendixPos = content.indexOf('# Appendix');
            const newDocPos = content.indexOf('# Document 3');

            expect(appendixPos).toBeGreaterThanOrEqual(0);
            expect(tablesPos).toBeGreaterThan(appendixPos); // Tables after Appendix
            expect(newDocPos).toBeGreaterThan(tablesPos); // New doc at END (after Tables)

            // Verify tab_order has new document entry
            const state = JSON.parse(getState());
            const tabOrder = state.workbook.metadata.tab_order;
            const newDocEntry = tabOrder.find(
                (item: { type: string; index: number }) => item.type === 'document' && item.index === 2
            );
            expect(newDocEntry).toBeDefined();
        });

        it('should add document at end when last visible tab is a sheet', () => {
            const WORKBOOK_LAST = `# My Document

Content.

# Tables

## Sheet 1

| A |
|---|
| 1 |
`;
            initializeWorkbook(WORKBOOK_LAST, SAMPLE_CONFIG);

            // + button: append at end (after sheet, so afterWorkbook=true)
            const result = addDocumentAndGetFullUpdate('New Doc', -1, true, 1);

            expect(result.error).toBeUndefined();

            const content = result.content!;

            // New document should be after the workbook section
            const tablesPos = content.indexOf('# Tables');
            const newDocPos = content.indexOf('# New Doc');

            expect(newDocPos).toBeGreaterThan(tablesPos);
        });
    });
});
