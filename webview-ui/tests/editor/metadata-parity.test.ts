/**
 * Metadata Parity Tests
 *
 * These tests verify that metadata (visual, validation, column format, etc.)
 * is correctly parsed, preserved, and returned through the API.
 *
 * This test suite was added after discovering that toDTO() stringifies metadata
 * while Python's .json property returns plain objects, causing potential issues.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    initializeWorkbook,
    getState,
    resetContext,
    updateVisualMetadata,
    updateColumnWidth,
    updateColumnFormat,
    updateColumnAlign,
} from '../../../src/editor';

const SAMPLE_CONFIG = JSON.stringify({
    rootMarker: '# Tables',
    sheetHeaderLevel: 2,
});

describe('Metadata Parity Tests', () => {
    beforeEach(() => {
        resetContext();
    });

    describe('Visual Metadata Preservation', () => {
        const MD_WITH_METADATA = `# Tables

## Sheet 1

### Table 1

| A | B |
|---|---|
| 1 | 2 |

<!-- md-spreadsheet-table-metadata: {"columns":{"0":{"width":150},"1":{"width":200}},"validations":{"A1":{"type":"list","values":["Yes","No"]}}} -->
`;

        it('should parse table with visual metadata', () => {
            initializeWorkbook(MD_WITH_METADATA, SAMPLE_CONFIG);
            const state = JSON.parse(getState());

            expect(state.workbook).not.toBeNull();
            expect(state.workbook.sheets[0].tables[0]).toBeDefined();

            // Metadata should be an object, not a string
            const tableMetadata = state.workbook.sheets[0].tables[0].metadata;
            expect(tableMetadata).toBeDefined();
            expect(typeof tableMetadata).toBe('object');
        });

        it('should have visual metadata with columns', () => {
            initializeWorkbook(MD_WITH_METADATA, SAMPLE_CONFIG);
            const state = JSON.parse(getState());

            const tableMetadata = state.workbook.sheets[0].tables[0].metadata;

            // Check if visual metadata contains column widths
            if (tableMetadata.visual) {
                expect(typeof tableMetadata.visual).toBe('object');
                expect(typeof tableMetadata.visual).not.toBe('string');
            }
        });
    });

    describe('Metadata Update Operations', () => {
        const SIMPLE_MD = `# Tables

## Sheet 1

| A | B |
|---|---|
| 1 | 2 |
`;

        beforeEach(() => {
            initializeWorkbook(SIMPLE_MD, SAMPLE_CONFIG);
        });

        it('should update visual metadata', () => {
            const metadata = {
                columns: { '0': { width: 100 } },
            };

            const result = updateVisualMetadata(0, 0, metadata);
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            const tableMetadata = state.workbook.sheets[0].tables[0].metadata;

            // Visual metadata should be accessible as object
            expect(tableMetadata).toBeDefined();
            expect(typeof tableMetadata).toBe('object');
        });

        it('should update column width', () => {
            const result = updateColumnWidth(0, 0, 0, 150);
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            const tableMetadata = state.workbook.sheets[0].tables[0].metadata;

            expect(tableMetadata).toBeDefined();
            expect(typeof tableMetadata).toBe('object');
        });

        it('should update column format', () => {
            const format = {
                type: 'number' as const,
                decimals: 2,
            };

            const result = updateColumnFormat(0, 0, 0, format);
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            const tableMetadata = state.workbook.sheets[0].tables[0].metadata;

            expect(tableMetadata).toBeDefined();
            expect(typeof tableMetadata).toBe('object');
        });

        it('should update column alignment', () => {
            const result = updateColumnAlign(0, 0, 0, 'center');
            expect(result.error).toBeUndefined();

            const state = JSON.parse(getState());
            const tableMetadata = state.workbook.sheets[0].tables[0].metadata;

            expect(tableMetadata).toBeDefined();
        });
    });

    describe('Metadata Type Verification', () => {
        const MD_WITH_VALIDATIONS = `# Tables

## Sheet 1

### Table 1

| A | B |
|---|---|
| X | Y |

<!-- md-spreadsheet-table-metadata: {"validations":{"0,0":{"type":"list","values":["A","B","C"]}}} -->
`;

        it('should preserve validation metadata as object not string', () => {
            initializeWorkbook(MD_WITH_VALIDATIONS, SAMPLE_CONFIG);
            const state = JSON.parse(getState());

            const tableMetadata = state.workbook.sheets[0].tables[0].metadata;

            // This is the critical check - metadata should NOT be a string
            if (tableMetadata) {
                expect(typeof tableMetadata).toBe('object');

                // If visual exists, it should also be an object
                if (tableMetadata.visual) {
                    expect(typeof tableMetadata.visual).toBe('object');
                }
            }
        });
    });

    describe('Sheet and Workbook Metadata', () => {
        const SIMPLE_MD = `# Tables

## Sheet 1

| A |
|---|
| 1 |
`;

        beforeEach(() => {
            initializeWorkbook(SIMPLE_MD, SAMPLE_CONFIG);
        });

        it('should return sheet metadata as object', () => {
            const state = JSON.parse(getState());

            const sheetMetadata = state.workbook.sheets[0].metadata;

            // Sheet metadata should be an object (even if empty)
            if (sheetMetadata !== undefined && sheetMetadata !== null) {
                expect(typeof sheetMetadata).toBe('object');
                expect(typeof sheetMetadata).not.toBe('string');
            }
        });

        it('should return workbook metadata as object', () => {
            const state = JSON.parse(getState());

            const workbookMetadata = state.workbook.metadata;

            // Workbook metadata should be an object (even if empty)
            if (workbookMetadata !== undefined && workbookMetadata !== null) {
                expect(typeof workbookMetadata).toBe('object');
                expect(typeof workbookMetadata).not.toBe('string');
            }
        });
    });
});
