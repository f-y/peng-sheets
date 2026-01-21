/**
 * Regression Test: D3→after S1 with D1 before workbook
 *
 * USER BUG: Moving D3 to between S1 and S2 in [D1, S1, S2, D2, D3]
 * only adds tab_order metadata but does NOT physically move D3.
 *
 * Physical structure: [D1, WB(S1,S2), D2, D3]
 * Tab display order: [D1, S1, S2, D2, D3]
 *
 * Expected after D3→after S1:
 * - Physical structure should become: [D1, WB(S1,S2), D3, D2]
 * - Tab display order (via metadata): [D1, S1, D3, S2, D2]
 *
 * Actual bug:
 * - Physical structure remains: [D1, WB(S1,S2), D2, D3] ← D3 NOT moved
 * - Only metadata is added
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as editor from '../../../src/editor';
import { determineReorderAction } from '../../services/tab-reorder-service';

// TEMP: Unskip to test with current classifier and editor fixes
describe('Regression: D3→after S1 with D1 before WB', () => {
    // Exact user scenario: D1 is BEFORE workbook
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

    it('should verify initial structure [D1, WB, D2, D3]', () => {
        const state = JSON.parse(editor.getState());
        const structure = state.structure;

        // Verify order: doc(D1), workbook, doc(D2), doc(D3)
        expect(structure[0].type).toBe('document');
        expect(structure[0].title).toBe('Doc 1');
        expect(structure[1].type).toBe('workbook');
        expect(structure[2].type).toBe('document');
        expect(structure[2].title).toBe('Doc 2');
        expect(structure[3].type).toBe('document');
        expect(structure[3].title).toBe('Doc 3');
    });

    it('determineReorderAction: D3→after S1 should require physical move', () => {
        // Tab order: [D1, S1, S2, D2, D3]
        const tabs = [
            { type: 'document' as const, docIndex: 0 }, // D1 at tab 0
            { type: 'sheet' as const, sheetIndex: 0 }, // S1 at tab 1
            { type: 'sheet' as const, sheetIndex: 1 }, // S2 at tab 2
            { type: 'document' as const, docIndex: 1 }, // D2 at tab 3
            { type: 'document' as const, docIndex: 2 }, // D3 at tab 4
            { type: 'add-sheet' as const }
        ];

        // D3 (tab 4) → after S1 (toIndex = 2)
        const action = determineReorderAction(tabs, 4, 2);

        // CRITICAL: This should require PHYSICAL move, not just metadata
        // D3 is a doc-after-WB being moved to between sheets
        // It should physically move to first docs-after-WB position
        console.log('Action type:', action.actionType);
        console.log('Physical move:', action.physicalMove);
        console.log('Metadata required:', action.metadataRequired);

        // D3 moving to between sheets means it needs to be first doc after WB
        // This requires a physical move
        expect(action.actionType).toBe('physical+metadata');
        expect(action.physicalMove).toBeDefined();
        expect(action.physicalMove?.type).toBe('move-document');
        if (action.physicalMove?.type === 'move-document') {
            expect(action.physicalMove.fromDocIndex).toBe(2); // D3
            expect(action.physicalMove.toAfterWorkbook).toBe(true);
        }
    });

    it('editor.moveDocumentSection: D3 to after WB should physically move D3', () => {
        // D3 is at docIndex 2 (D1=0, D2=1, D3=2)
        const result = editor.moveDocumentSection(
            2, // fromDocIndex: D3
            null, // toDocIndex: relative to WB
            true, // toAfterWorkbook
            false
        );

        expect(result.error).toBeUndefined();
        expect(result.content).toBeDefined();

        // Verify file content has D3 before D2
        const content = result.content!;
        const doc3Pos = content.indexOf('# Doc 3');
        const doc2Pos = content.indexOf('# Doc 2');
        const tablesPos = content.indexOf('# Tables');
        const doc1Pos = content.indexOf('# Doc 1');

        console.log('Positions:', { doc1Pos, tablesPos, doc3Pos, doc2Pos });

        // D1 should still be first
        expect(doc1Pos).toBeLessThan(tablesPos);

        // D3 should be right after workbook, before D2
        expect(doc3Pos).toBeGreaterThan(tablesPos);
        expect(doc3Pos).toBeLessThan(doc2Pos);

        // Verify structure after move
        const afterState = JSON.parse(editor.getState());
        const docs = afterState.structure
            .filter((s: { type: string }) => s.type === 'document')
            .map((s: { title: string }) => s.title);

        // Should be [Doc 1, Doc 3, Doc 2] - D3 moved to second position
        expect(docs).toEqual(['Doc 1', 'Doc 3', 'Doc 2']);
    });

    it('FULL SCENARIO: D3→after S1 with metadata + physical move', () => {
        // This simulates what _handleTabReorder should do

        // Step 1: Update metadata first (set tab_order) - NOT posted to batch
        const metadataResult = editor.updateWorkbookTabOrder([
            { type: 'document', index: 0 }, // D1
            { type: 'sheet', index: 0 }, // S1
            { type: 'document', index: 2 }, // D3 (moved between sheets)
            { type: 'sheet', index: 1 }, // S2
            { type: 'document', index: 1 } // D2
        ]);
        expect(metadataResult.error).toBeUndefined();

        // Step 2: Physical move - D3 to after workbook
        const moveResult = editor.moveDocumentSection(
            2, // D3
            null,
            true, // after WB
            false
        );
        expect(moveResult.error).toBeUndefined();

        // Step 3: Regenerate workbook section and merge (as _handleTabReorder does)
        // This is the key step that includes metadata in the final content
        const wbUpdate = editor.generateAndGetRange();
        expect(wbUpdate.error).toBeUndefined();

        // Merge like _handleTabReorder lines 1469-1474
        const lines = moveResult.content!.split('\n');
        const wbStart = wbUpdate.startLine ?? 0;
        const wbEnd = wbUpdate.endLine ?? 0;
        const wbContentLines = wbUpdate.content!.trimEnd().split('\n');
        wbContentLines.push('');

        const mergedLines = [...lines.slice(0, wbStart), ...wbContentLines, ...lines.slice(wbEnd + 1)];
        const mergedContent = mergedLines.join('\n');

        // The MERGED content should have BOTH metadata AND physical move
        // Check metadata is present
        expect(mergedContent).toContain('tab_order');

        // Check physical order: D3 before D2
        const doc3Pos = mergedContent.indexOf('# Doc 3');
        const doc2Pos = mergedContent.indexOf('# Doc 2');
        expect(doc3Pos).toBeLessThan(doc2Pos);

        console.log('Final merged content structure:');
        console.log('D3 at:', doc3Pos);
        console.log('D2 at:', doc2Pos);
        console.log('Contains tab_order:', mergedContent.includes('tab_order'));
    });
});
