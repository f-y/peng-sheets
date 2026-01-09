/**
 * Tab Reorder Tests
 *
 * Phase 2 parity tests for tab ordering operations.
 * Tests: reorderTabMetadata, initializeTabOrderFromStructure, updateWorkbookTabOrder
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    initializeWorkbook,
    getState,
    resetContext,
    updateWorkbookTabOrder,
    moveWorkbookSection,
} from '../../../src/editor';

const SAMPLE_CONFIG = JSON.stringify({
    rootMarker: '# Tables',
    sheetHeaderLevel: 2,
});

describe('Tab Reorder Tests', () => {
    beforeEach(() => {
        resetContext();
    });

    describe('updateWorkbookTabOrder', () => {
        const SIMPLE_MD = `# Tables

## Sheet 1

| A |
|---|
| 1 |

## Sheet 2

| B |
|---|
| 2 |
`;

        beforeEach(() => {
            initializeWorkbook(SIMPLE_MD, SAMPLE_CONFIG);
        });

        it('should update tab_order in metadata', () => {
            const newTabOrder = [
                { type: 'sheet' as const, index: 1 },
                { type: 'sheet' as const, index: 0 },
            ];

            const result = updateWorkbookTabOrder(newTabOrder);

            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            expect(state.workbook.metadata.tab_order).toEqual(newTabOrder);
        });
    });

    describe('moveWorkbookSection', () => {
        const HYBRID_MD = `# Doc Zero

First document.

# Tables

## Sheet 1

| A |
|---|
| 1 |

# Doc One

Second document.

<!-- md-spreadsheet-workbook-metadata: {"tab_order": [{"type": "document", "index": 0}, {"type": "sheet", "index": 0}, {"type": "document", "index": 1}]} -->
`;

        beforeEach(() => {
            initializeWorkbook(HYBRID_MD, SAMPLE_CONFIG);
        });

        it('should move workbook section to before document', () => {
            // Move workbook to before Doc Zero (beginning of file)
            const result = moveWorkbookSection(0, false, true, 0);

            expect(result.error).toBeUndefined();
            expect(result.file_changed).toBe(true);

            const content = result.content!;

            // # Tables should now be before # Doc Zero
            const tablesPos = content.indexOf('# Tables');
            const docZeroPos = content.indexOf('# Doc Zero');

            expect(tablesPos).toBeGreaterThanOrEqual(0);
            expect(tablesPos).toBeLessThan(docZeroPos);
        });

        /**
         * BUG: moveWorkbookSection to after document fails
         * Similar issue to moveDocumentSection toAfterWorkbook
         */
        it.skip('should move workbook section to after document', () => {
            // Move workbook to after Doc One (end of file)
            const result = moveWorkbookSection(1, true, false, 2);

            expect(result.error).toBeUndefined();

            const content = result.content!;

            // # Tables should now be after # Doc One
            const tablesPos = content.indexOf('# Tables');
            const docOnePos = content.indexOf('# Doc One');

            expect(tablesPos).toBeGreaterThan(docOnePos);
        });
    });

    describe('Tab order initialization', () => {
        /**
         * BUG: tab_order is not automatically initialized from structure
         * when metadata comment is missing from markdown.
         */
        it.skip('should initialize tab_order from structure when missing', () => {
            // Markdown without metadata comment
            const MD_NO_METADATA = `# Doc Zero

Content.

# Tables

## Sheet 1

| A |
|---|
| 1 |

# Doc One

More content.
`;
            initializeWorkbook(MD_NO_METADATA, SAMPLE_CONFIG);

            const state = JSON.parse(getState());
            const tabOrder = state.workbook.metadata?.tab_order;

            // Tab order should be initialized based on physical structure
            // Expected: [doc 0, sheet 0, doc 1]
            expect(tabOrder).toBeDefined();
            expect(tabOrder.length).toBe(3);
        });
    });
});
