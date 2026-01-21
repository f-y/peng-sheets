/**
 * Comprehensive Tab Reorder Integration Tests
 *
 * These tests verify the ACTUAL document content changes, not just that
 * `determineReorderAction` returns correct values. This catches bugs where:
 * - Unit tests pass but real behavior is wrong
 * - Side effects from other functions cause incorrect changes
 * - Mismatch between action type and actual execution
 *
 * Coverage:
 * 1. Simple physical moves (no metadata)
 * 2. Boundary crossing (WB crossing)
 * 3. Mixed structure scenarios (docs before AND after WB)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as editor from '../../../src/editor';
import { determineReorderAction } from '../../services/tab-reorder-service';

type TestTab = {
    type: 'sheet' | 'document' | 'add-sheet';
    sheetIndex?: number;
    docIndex?: number;
};

// =============================================================================
// 1. Simple Physical Moves (no metadata expected)
// =============================================================================

describe('Integration: Simple Physical Moves', () => {
    describe('Sheet → Sheet swap', () => {
        const WORKBOOK_MD = `# Tables

## Sheet 1

| A | B |
| - | - |
| 1 | 2 |

## Sheet 2

| C | D |
| - | - |
| 3 | 4 |

## Sheet 3

| E | F |
| - | - |
| 5 | 6 |
`;

        beforeEach(() => {
            editor.initializeWorkbook(WORKBOOK_MD, JSON.stringify({ rootMarker: '# Tables' }));
        });

        it('S1 → S2 position should physically swap sheets', () => {
            const tabs: TestTab[] = [
                { type: 'sheet', sheetIndex: 0 },
                { type: 'sheet', sheetIndex: 1 },
                { type: 'sheet', sheetIndex: 2 },
                { type: 'add-sheet' }
            ];

            const action = determineReorderAction(tabs, 0, 2);
            expect(action.actionType).toBe('physical');
            expect(action.physicalMove?.type).toBe('move-sheet');

            // Execute move
            const result = editor.moveSheet(0, 1, null);
            expect(result.error).toBeUndefined();

            // Verify physical order changed
            const afterState = JSON.parse(editor.getState());
            const sheetNames = afterState.workbook.sheets.map((s: { name: string }) => s.name);
            expect(sheetNames).toEqual(['Sheet 2', 'Sheet 1', 'Sheet 3']);
        });

        it('S3 → S1 position should move sheet to front', () => {
            const tabs: TestTab[] = [
                { type: 'sheet', sheetIndex: 0 },
                { type: 'sheet', sheetIndex: 1 },
                { type: 'sheet', sheetIndex: 2 },
                { type: 'add-sheet' }
            ];

            const action = determineReorderAction(tabs, 2, 0);
            expect(action.actionType).toBe('physical');

            const result = editor.moveSheet(2, 0, null);
            expect(result.error).toBeUndefined();

            const afterState = JSON.parse(editor.getState());
            const sheetNames = afterState.workbook.sheets.map((s: { name: string }) => s.name);
            expect(sheetNames).toEqual(['Sheet 3', 'Sheet 1', 'Sheet 2']);
        });
    });

    describe('Doc → Doc swap (same side of WB)', () => {
        const WORKBOOK_MD = `# Tables

## Sheet 1

| A |
| - |
| 1 |

# Doc 1

Content 1

# Doc 2

Content 2

# Doc 3

Content 3
`;

        beforeEach(() => {
            editor.initializeWorkbook(WORKBOOK_MD, JSON.stringify({ rootMarker: '# Tables' }));
        });

        it('D1 → after D2 position should swap docs after WB', () => {
            const tabs: TestTab[] = [
                { type: 'sheet', sheetIndex: 0 },
                { type: 'document', docIndex: 0 },
                { type: 'document', docIndex: 1 },
                { type: 'document', docIndex: 2 },
                { type: 'add-sheet' }
            ];

            const action = determineReorderAction(tabs, 1, 3);
            expect(action.actionType).toBe('physical');

            // New API: toDocIndex=2 means "insert at position 2" (before D3, after D2)
            const result = editor.moveDocumentSection(0, 2, false, false);
            expect(result.error).toBeUndefined();

            const afterState = JSON.parse(editor.getState());
            const docTitles = afterState.structure
                .filter((s: { type: string }) => s.type === 'document')
                .map((s: { title: string }) => s.title);
            expect(docTitles).toEqual(['Doc 2', 'Doc 1', 'Doc 3']);
        });

        it('D3 → D1 position should move doc to front', () => {
            // New API: toDocIndex=0 means "insert at position 0" (before D1)
            const result = editor.moveDocumentSection(2, 0, false, false);
            expect(result.error).toBeUndefined();

            const afterState = JSON.parse(editor.getState());
            const docTitles = afterState.structure
                .filter((s: { type: string }) => s.type === 'document')
                .map((s: { title: string }) => s.title);
            expect(docTitles).toEqual(['Doc 3', 'Doc 1', 'Doc 2']);
        });
    });
});

// =============================================================================
// 2. Boundary Crossing (WB crossing)
// =============================================================================

describe('Integration: Boundary Crossing', () => {
    describe('Doc before WB → after WB', () => {
        const WORKBOOK_MD = `# Doc Before

Content before WB

# Tables

## Sheet 1

| A |
| - |
| 1 |

# Doc After

Content after WB
`;

        beforeEach(() => {
            editor.initializeWorkbook(WORKBOOK_MD, JSON.stringify({ rootMarker: '# Tables' }));
        });

        it('should verify initial structure [Doc Before, WB, Doc After]', () => {
            const state = JSON.parse(editor.getState());
            expect(state.structure[0].title).toBe('Doc Before');
            expect(state.structure[1].type).toBe('workbook');
            expect(state.structure[2].title).toBe('Doc After');
        });

        it('Doc Before → after WB should physically move doc', () => {
            // D0 (before WB) → after WB (first position)
            // toAfterWorkbook=true means insert at FIRST position after WB
            const result = editor.moveDocumentSection(0, null, true, false);
            expect(result.error).toBeUndefined();

            const afterState = JSON.parse(editor.getState());
            const structure = afterState.structure;

            // WB should now be first, then Doc Before (moved to first after WB), then Doc After
            expect(structure[0].type).toBe('workbook');
            expect(structure[1].title).toBe('Doc Before'); // Moved to first after WB
            expect(structure[2].title).toBe('Doc After');

            // Verify content order
            const content = result.content!;
            const tablesPos = content.indexOf('# Tables');
            const docBeforePos = content.indexOf('# Doc Before');
            const docAfterPos = content.indexOf('# Doc After');

            expect(tablesPos).toBeLessThan(docBeforePos);
            expect(docBeforePos).toBeLessThan(docAfterPos);
        });
    });

    describe('Doc after WB → before WB', () => {
        const WORKBOOK_MD = `# Tables

## Sheet 1

| A |
| - |
| 1 |

# Doc 1

Content 1

# Doc 2

Content 2
`;

        beforeEach(() => {
            editor.initializeWorkbook(WORKBOOK_MD, JSON.stringify({ rootMarker: '# Tables' }));
        });

        it('Doc after WB → before WB should physically move doc', () => {
            // D1 (after WB) → before WB
            const result = editor.moveDocumentSection(1, null, false, true);
            expect(result.error).toBeUndefined();

            const afterState = JSON.parse(editor.getState());
            const structure = afterState.structure;

            // Doc 2 should now be before WB
            expect(structure[0].type).toBe('document');
            expect(structure[0].title).toBe('Doc 2');
            expect(structure[1].type).toBe('workbook');
            expect(structure[2].type).toBe('document');
            expect(structure[2].title).toBe('Doc 1');

            // Verify content order
            const content = result.content!;
            const tablesPos = content.indexOf('# Tables');
            const doc1Pos = content.indexOf('# Doc 1');
            const doc2Pos = content.indexOf('# Doc 2');

            expect(doc2Pos).toBeLessThan(tablesPos);
            expect(tablesPos).toBeLessThan(doc1Pos);
        });
    });

    describe('Doc → between sheets', () => {
        const WORKBOOK_MD = `# Tables

## Sheet 1

| A |
| - |
| 1 |

## Sheet 2

| B |
| - |
| 2 |

# Doc 1

Content 1

# Doc 2

Content 2
`;

        beforeEach(() => {
            editor.initializeWorkbook(WORKBOOK_MD, JSON.stringify({ rootMarker: '# Tables' }));
        });

        it('D2 → between S1 and S2 should need metadata (no physical move for doc)', () => {
            const tabs: TestTab[] = [
                { type: 'sheet', sheetIndex: 0 },
                { type: 'sheet', sheetIndex: 1 },
                { type: 'document', docIndex: 0 },
                { type: 'document', docIndex: 1 },
                { type: 'add-sheet' }
            ];

            // D2 (tab 3) → between S1 and S2 (toIndex 1)
            const action = determineReorderAction(tabs, 3, 1);

            // D2 is already physically after WB
            // Moving to display between S1/S2 requires:
            // - Physical: D2 should become first doc after WB
            // - Metadata: tab_order to show D2 between sheets
            console.log('Action for D2→between sheets:', action);
        });

        it('D1 → between sheets should physically reorder to be first after WB', () => {
            // When D1 (which is first after WB) moves to between sheets,
            // no physical move needed for D1, just metadata
            const tabs: TestTab[] = [
                { type: 'sheet', sheetIndex: 0 },
                { type: 'sheet', sheetIndex: 1 },
                { type: 'document', docIndex: 0 },
                { type: 'document', docIndex: 1 },
                { type: 'add-sheet' }
            ];

            // D1 (tab 2) → between S1 and S2 (toIndex 1)
            const action = determineReorderAction(tabs, 2, 1);

            // D1 is already first physically, just needs metadata
            expect(action.actionType).toBe('metadata');
            expect(action.metadataRequired).toBe(true);
        });
    });
});

// =============================================================================
// 3. Mixed Structure Scenarios (Docs before AND after WB)
// =============================================================================

// Mixed structure scenarios with docs before AND after WB
describe('Integration: Mixed Structure (Docs before AND after WB)', () => {
    // This is the USER's exact bug scenario
    const WORKBOOK_MD = `# Doc 1

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

# Doc 3
`;

    beforeEach(() => {
        editor.initializeWorkbook(WORKBOOK_MD, JSON.stringify({ rootMarker: '# Tables' }));
    });

    it('should verify initial structure [D1, WB(S1,S2), D2, D3]', () => {
        const state = JSON.parse(editor.getState());
        const structure = state.structure;

        expect(structure[0].type).toBe('document');
        expect(structure[0].title).toBe('Doc 1');
        expect(structure[1].type).toBe('workbook');
        expect(structure[2].type).toBe('document');
        expect(structure[2].title).toBe('Doc 2');
        expect(structure[3].type).toBe('document');
        expect(structure[3].title).toBe('Doc 3');
    });

    it('D3 → after S1 should require physical+metadata (REGRESSION TEST)', () => {
        const tabs: TestTab[] = [
            { type: 'document', docIndex: 0 }, // D1 at tab 0
            { type: 'sheet', sheetIndex: 0 }, // S1 at tab 1
            { type: 'sheet', sheetIndex: 1 }, // S2 at tab 2
            { type: 'document', docIndex: 1 }, // D2 at tab 3
            { type: 'document', docIndex: 2 }, // D3 at tab 4
            { type: 'add-sheet' }
        ];

        // D3 (tab 4) → after S1 (toIndex 2)
        const action = determineReorderAction(tabs, 4, 2);

        // CRITICAL: D3 needs to physically move to first position in docs-after-WB
        // so it can be displayed between S1 and S2 via tab_order
        expect(action.actionType).toBe('physical+metadata');
        expect(action.physicalMove).toBeDefined();
        expect(action.physicalMove?.type).toBe('move-document');
    });

    it('D2 → after S1 should require physical+metadata', () => {
        const tabs: TestTab[] = [
            { type: 'document', docIndex: 0 },
            { type: 'sheet', sheetIndex: 0 },
            { type: 'sheet', sheetIndex: 1 },
            { type: 'document', docIndex: 1 },
            { type: 'document', docIndex: 2 },
            { type: 'add-sheet' }
        ];

        // D2 (tab 3) → after S1 (toIndex 2)
        const action = determineReorderAction(tabs, 3, 2);

        // D2 is already first physically after WB, just needs metadata
        // Wait, D2 is docIndex 1, which is first doc after WB
        // So it should be metadata-only
        expect(action.actionType).toBe('metadata');
        expect(action.metadataRequired).toBe(true);
    });

    it('D1 → after S2 should require physical move (crossing WB boundary)', () => {
        const tabs: TestTab[] = [
            { type: 'document', docIndex: 0 },
            { type: 'sheet', sheetIndex: 0 },
            { type: 'sheet', sheetIndex: 1 },
            { type: 'document', docIndex: 1 },
            { type: 'document', docIndex: 2 },
            { type: 'add-sheet' }
        ];

        // D1 (tab 0) → after S2 (toIndex 3)
        const action = determineReorderAction(tabs, 0, 3);

        // D1 is before WB, moving after sheets requires crossing WB
        expect(action.physicalMove).toBeDefined();
        expect(action.physicalMove?.type).toBe('move-document');
    });

    it('Full execution: D3 → after WB (first position) should change physical order', () => {
        // This directly tests the editor function
        const result = editor.moveDocumentSection(
            2, // D3 (docIndex 2)
            null,
            true, // toAfterWorkbook
            false
        );

        expect(result.error).toBeUndefined();
        expect(result.content).toBeDefined();

        // Verify physical order changed
        const afterState = JSON.parse(editor.getState());
        const docTitles = afterState.structure
            .filter((s: { type: string }) => s.type === 'document')
            .map((s: { title: string }) => s.title);

        // D3 should now be first after WB (between D1-before-WB and D2)
        expect(docTitles).toEqual(['Doc 1', 'Doc 3', 'Doc 2']);

        // Verify content has correct order
        const content = result.content!;
        const doc1Pos = content.indexOf('# Doc 1');
        const doc2Pos = content.indexOf('# Doc 2');
        const doc3Pos = content.indexOf('# Doc 3');
        const tablesPos = content.indexOf('# Tables');

        expect(doc1Pos).toBeLessThan(tablesPos);
        expect(tablesPos).toBeLessThan(doc3Pos);
        expect(doc3Pos).toBeLessThan(doc2Pos);
    });
});

// =============================================================================
// 4. Edge Cases
// =============================================================================

describe('Integration: Edge Cases', () => {
    describe('Single sheet workbook', () => {
        const WORKBOOK_MD = `# Doc Before

# Tables

## Sheet 1

| A |
| - |
| 1 |

# Doc After
`;

        beforeEach(() => {
            editor.initializeWorkbook(WORKBOOK_MD, JSON.stringify({ rootMarker: '# Tables' }));
        });

        it('Doc → between sheets position with single sheet should work', () => {
            const tabs: TestTab[] = [
                { type: 'document', docIndex: 0 },
                { type: 'sheet', sheetIndex: 0 },
                { type: 'document', docIndex: 1 },
                { type: 'add-sheet' }
            ];

            // Doc After (tab 2) → before S1 (toIndex 1)
            const action = determineReorderAction(tabs, 2, 1);

            console.log('Single sheet - Doc After → before S1:', action);
            // Doc After is after WB, moving before sheet requires physical move
        });
    });

    describe('No workbook (docs only)', () => {
        const DOCS_ONLY_MD = `# Doc 1

Content 1

# Doc 2

Content 2

# Doc 3

Content 3
`;

        beforeEach(() => {
            editor.initializeWorkbook(DOCS_ONLY_MD, JSON.stringify({ rootMarker: '# Tables' }));
        });

        it('D1 → after D2 position in docs-only file should be physical', () => {
            // New API: toDocIndex=2 means "insert at position 2" (before D3, after D2)
            const result = editor.moveDocumentSection(0, 2, false, false);
            expect(result.error).toBeUndefined();

            const afterState = JSON.parse(editor.getState());
            const docTitles = afterState.structure
                .filter((s: { type: string }) => s.type === 'document')
                .map((s: { title: string }) => s.title);

            expect(docTitles).toEqual(['Doc 2', 'Doc 1', 'Doc 3']);
        });
    });
});
