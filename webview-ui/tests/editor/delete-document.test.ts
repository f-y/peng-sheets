/**
 * Delete Document Tests
 *
 * Created as part of Phase 1 migration verification.
 * Tests for deleteDocument parity between Python and TypeScript.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    initializeWorkbook,
    getState,
    resetContext,
    deleteDocument,
    deleteDocumentAndGetFullUpdate,
} from '../../../src/editor';

const SAMPLE_CONFIG = JSON.stringify({
    rootMarker: '# Tables',
    sheetHeaderLevel: 2,
});

describe('Delete Document Tests', () => {
    beforeEach(() => {
        resetContext();
    });

    describe('Basic delete operations', () => {
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
         * Testing delete document content preservation
         */
        it('should delete document by index', () => {
            const result = deleteDocument(0); // Delete Doc Zero

            expect(result.error).toBeUndefined();
            expect(result.file_changed).toBe(true);

            const content = result.content!;
            expect(content).not.toContain('# Doc Zero');
            expect(content).toContain('# Tables');
            expect(content).toContain('# Doc One');
        });

        it('should update tab_order after delete', () => {
            // Initial: [doc 0, sheet 0, doc 1]
            const result = deleteDocument(0);

            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            const tabOrder = state.workbook.metadata.tab_order;

            // After delete: [sheet 0, doc 0] (doc 1 becomes doc 0)
            expect(tabOrder.length).toBe(2);

            // The remaining document should have index 0
            const docEntry = tabOrder.find(
                (item: { type: string }) => item.type === 'document'
            );
            expect(docEntry).toBeDefined();
            expect(docEntry.index).toBe(0);
        });

        it('should handle deleting non-existent document', () => {
            const result = deleteDocument(999);
            expect(result.error).toBeDefined();
        });
    });

    describe('deleteDocumentAndGetFullUpdate', () => {
        const HYBRID_MD = `# Doc Zero

Content.

# Tables

## Sheet 1

| A |
|---|
| 1 |

<!-- md-spreadsheet-workbook-metadata: {"tab_order": [{"type": "document", "index": 0}, {"type": "sheet", "index": 0}]} -->
`;

        beforeEach(() => {
            initializeWorkbook(HYBRID_MD, SAMPLE_CONFIG);
        });

        /**
         * FIXED: deleteDocumentAndGetFullUpdate now returns workbook/structure
         * (same fix as addDocumentAndGetFullUpdate)
         */
        it('should return full state after delete', () => {
            const result = deleteDocumentAndGetFullUpdate(0);

            expect(result.error).toBeUndefined();
            expect(result.workbook).toBeDefined();
            expect(result.structure).toBeDefined();
        });
    });
});
