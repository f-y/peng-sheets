/**
 * Metadata Shift Tests
 *
 * Ported from Python tests: test_metadata_sync.py, test_metadata_persistence.py
 *
 * These tests verify that column-indexed metadata (like validation rules)
 * correctly shifts when columns are inserted, deleted, or moved.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    initializeWorkbook,
    getState,
    resetContext,
    insertColumn,
    deleteColumns,
    moveColumns,
    generateAndGetRange,
} from '../../../src/editor';

const SAMPLE_CONFIG = JSON.stringify({
    rootMarker: '# Tables',
    sheetHeaderLevel: 2,
});

describe('Metadata Shift Tests', () => {
    beforeEach(() => {
        resetContext();
    });

    describe('Insert Column Shifts Validation', () => {
        const MD_WITH_VALIDATION = `# Tables

## Sheet1

### Table1

| Col1 | Col2 |
| --- | --- |
| A | B |

<!-- md-spreadsheet-table-metadata: {"validation": {"0": {"type": "list", "values": ["A", "B"]}}} -->
`;

        it('should shift validation metadata when inserting column at index 0', () => {
            initializeWorkbook(MD_WITH_VALIDATION, SAMPLE_CONFIG);

            // Insert column at index 0. Validation on "0" should shift to "1".
            const result = insertColumn(0, 0, 0, 'NewCol');
            expect(result.error).toBeUndefined();

            const genResult = generateAndGetRange();
            expect(genResult.error).toBeUndefined();

            const content = genResult.content || '';

            // Metadata block should be present
            expect(content).toContain('md-spreadsheet-table-metadata');

            // Validation key should have shifted from "0" to "1"
            expect(content).toContain('"1":');
            expect(content).not.toMatch(/"0":\s*\{/); // "0" should not be a top-level key in validation
        });
    });

    describe('Delete Column Shifts Validation', () => {
        const MD_WITH_VALIDATION_ON_COL1 = `# Tables

## Sheet1

### Table1

| Col0 | Col1 | Col2 |
| --- | --- | --- |
| A | B | C |

<!-- md-spreadsheet-table-metadata: {"validation": {"1": {"type": "integer"}}} -->
`;

        it('should shift validation metadata when deleting column 0', () => {
            initializeWorkbook(MD_WITH_VALIDATION_ON_COL1, SAMPLE_CONFIG);

            // Delete Column 0. Old Column 1 becomes Column 0.
            // Validation metadata for "1" should move to "0".
            const result = deleteColumns(0, 0, [0]);
            expect(result.error).toBeUndefined();

            const genResult = generateAndGetRange();
            expect(genResult.error).toBeUndefined();

            const content = genResult.content || '';

            // Validation key should have shifted from "1" to "0"
            expect(content).toContain('"0":');
            // Old index should be gone
            expect(content).not.toMatch(/"1":\s*\{.*"type":\s*"integer"/);
        });
    });

    describe('Move Column Shifts Validation', () => {
        const MD_WITH_MULTI_VALIDATION = `# Tables

## Sheet1

### Table1

| Col0 | Col1 |
| --- | --- |
| A | B |

<!-- md-spreadsheet-table-metadata: {"validation": {"0": {"type": "A"}, "1": {"type": "B"}}} -->
`;

        it('should shift validation metadata when moving columns', () => {
            initializeWorkbook(MD_WITH_MULTI_VALIDATION, SAMPLE_CONFIG);

            // Move Column 0 to Index 2 (After Col 1)
            // [Col0, Col1] -> [Col1, Col0]
            // Old 0 becomes New 1. Old 1 becomes New 0.
            const result = moveColumns(0, 0, [0], 2);
            expect(result.error).toBeUndefined();

            const genResult = generateAndGetRange();
            expect(genResult.error).toBeUndefined();

            const content = genResult.content || '';

            // Validation should still have both keys
            expect(content).toContain('"0":');
            expect(content).toContain('"1":');

            // Old 0 (Rule A) should now be at 1
            // Old 1 (Rule B) should now be at 0
            expect(content).toMatch(/"1":\s*\{[^}]*"type":\s*"A"/);
            expect(content).toMatch(/"0":\s*\{[^}]*"type":\s*"B"/);
        });
    });
});
