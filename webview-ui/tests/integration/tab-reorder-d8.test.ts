/**
 * Integration Test for D8: Doc after WB to between sheets
 *
 * This test verifies the ACTUAL document content moves correctly, not just that
 * `docIndex` values are manipulated correctly. This catches bugs where the
 * unit tests pass but the real behavior is wrong due to:
 * - State leakage from previous operations
 * - Mismatch between docIndex and actual document identity
 * - Incorrect assumptions about physical file order
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as editor from '../../../src/editor';

describe('D8 Integration: Doc after WB to between sheets', () => {
    const WORKBOOK_MD = `# Tables

## Sheet 1

| Column 1 | Column 2 |
| --- | --- |
|  |  |

## Sheet 2

| Column 1 | Column 2 |
| --- | --- |
|  |  |

# Doc 1

Content of Doc 1

# Doc 2

Content of Doc 2

# Doc 3

Content of Doc 3
`;

    beforeEach(() => {
        // Initialize with clean workbook state
        editor.initializeWorkbook(WORKBOOK_MD, JSON.stringify({ rootMarker: '# Tables' }));
    });

    it('D8: moving D2 to between sheets should physically move D2, not D1', () => {
        // Get initial state
        const initialState = JSON.parse(editor.getState());
        const initialStructure = initialState.structure;

        // Verify initial physical order by checking document titles
        const docSections = initialStructure.filter((s: { type: string; title?: string }) => s.type === 'document');
        expect(docSections.map((d: { title: string }) => d.title)).toEqual(['Doc 1', 'Doc 2', 'Doc 3']);

        // D2 is at physical index 1
        const d2PhysicalIndex = 1;

        // Move D2 to after workbook (= first in docs-after-WB section)
        const result = editor.moveDocumentSection(
            d2PhysicalIndex, // fromDocIndex = 1 (D2)
            null,
            true, // toAfterWorkbook
            false // toBeforeWorkbook
        );

        expect(result.error).toBeUndefined();

        // Get state after move
        const afterState = JSON.parse(editor.getState());
        const afterStructure = afterState.structure;

        // Verify new physical order by checking document TITLES (not indices)
        const afterDocSections = afterStructure.filter((s: { type: string; title?: string }) => s.type === 'document');
        const afterTitles = afterDocSections.map((d: { title: string }) => d.title);

        // KEY ASSERTION: D2 should now be FIRST, D1 second, D3 third
        expect(afterTitles).toEqual([
            'Doc 2', // D2 moved to first position
            'Doc 1', // D1 is now second
            'Doc 3' // D3 unchanged
        ]);
    });

    it('D8: moving D3 to after workbook should physically move D3, not any other doc', () => {
        // Get initial state
        const initialState = JSON.parse(editor.getState());
        const docSections = initialState.structure.filter((s: { type: string }) => s.type === 'document');
        expect(docSections.map((d: { title: string }) => d.title)).toEqual(['Doc 1', 'Doc 2', 'Doc 3']);

        // D3 is at physical index 2
        const d3PhysicalIndex = 2;

        // Move D3 to after workbook
        const result = editor.moveDocumentSection(
            d3PhysicalIndex, // fromDocIndex = 2 (D3)
            null,
            true, // toAfterWorkbook
            false
        );

        expect(result.error).toBeUndefined();

        // Verify D3 is now first
        const afterState = JSON.parse(editor.getState());
        const afterDocSections = afterState.structure.filter((s: { type: string }) => s.type === 'document');
        const afterTitles = afterDocSections.map((d: { title: string }) => d.title);

        expect(afterTitles).toEqual([
            'Doc 3', // D3 moved to first
            'Doc 1', // D1 unchanged relative position
            'Doc 2' // D2 unchanged relative position
        ]);
    });

    it('D8: should verify document content in UpdateResult', () => {
        // Move D2 and get the result
        const result = editor.moveDocumentSection(1, null, true, false);

        // The result.content should contain the full file with D2 moved
        expect(result.error).toBeUndefined();
        expect(result.content).toBeDefined();

        const mdContent = result.content!;

        // Find positions of document headers in the file
        const doc1Pos = mdContent.indexOf('# Doc 1');
        const doc2Pos = mdContent.indexOf('# Doc 2');
        const doc3Pos = mdContent.indexOf('# Doc 3');
        const tablesPos = mdContent.indexOf('# Tables');

        // D2 should come right after Tables (workbook), before D1
        expect(tablesPos).toBeGreaterThanOrEqual(0);
        expect(doc2Pos).toBeGreaterThan(tablesPos);
        expect(doc2Pos).toBeLessThan(doc1Pos);
        expect(doc1Pos).toBeLessThan(doc3Pos);
    });
});
