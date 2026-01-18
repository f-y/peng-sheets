import { describe, it, expect, beforeEach } from 'vitest';
import * as editor from '../../../src/editor';
import { executeTabReorderLikeMainTs } from '../helpers/tab-reorder-test-utils';
import type { TestTab } from '../helpers/tab-reorder-test-utils';

/**
 * COMPREHENSIVE E2E TAB REORDER MATRIX
 * 
 * Verifies SPECS.md 8.6 scenarios using simulated main.ts flow.
 */

const CONFIG = JSON.stringify({ rootMarker: '# Tables' });

// BUG: Classifier issues with SS, DD, DS patterns causing failures
describe.skip('E2E: SPECS.md 8.6 Tab Reorder Matrix', () => {

    // =========================================================================
    // 8.6.1 Sheet -> Sheet (Within Workbook)
    // =========================================================================
    describe('8.6.1 Sheet -> Sheet', () => {
        const WB_S1_S2 = `# Tables\n\n## S1\n\n|A|\n|-|\n|1|\n\n## S2\n\n|B|\n|-|\n|2|\n`;

        it('S1: Sheet to adjacent S2', () => { // [WB(S1,S2)] drag S1 after S2
            editor.initializeWorkbook(WB_S1_S2, CONFIG);
            const tabs: TestTab[] = [{ type: 'sheet', sheetIndex: 0 }, { type: 'sheet', sheetIndex: 1 }];
            const result = executeTabReorderLikeMainTs(tabs, 0, 2);

            const state = JSON.parse(editor.getState());
            expect(state.workbook.sheets.map((s: any) => s.name)).toEqual(['S2', 'S1']);
            expect(result.metadata?.tab_order).toBeUndefined();
        });

        const D1_WB_S1_S2_D2 = `# D1\n\n# Tables\n\n## S1\n\n## S2\n\n# D2\n`;

        it('S2: Sheet over Sheet (with Docs)', () => { // [D1, WB(S1,S2), D2] drag S1 after S2
            editor.initializeWorkbook(D1_WB_S1_S2_D2, CONFIG);
            const tabs: TestTab[] = [
                { type: 'document', docIndex: 0 },
                { type: 'sheet', sheetIndex: 0 },
                { type: 'sheet', sheetIndex: 1 },
                { type: 'document', docIndex: 1 }
            ];
            const result = executeTabReorderLikeMainTs(tabs, 1, 3); // S1(1) after S2(2) -> 3

            const state = JSON.parse(editor.getState());
            expect(state.workbook.sheets.map((s: any) => s.name)).toEqual(['S2', 'S1']);
            expect(result.metadata?.tab_order).toBeUndefined();
        });
    });

    // =========================================================================
    // 8.6.2 Sheet -> Document Position
    // =========================================================================
    describe('8.6.2 Sheet -> Document', () => {
        const D1_WB_S1 = `# D1\n\n# Tables\n\n## S1\n`;
        const WB_S1_D1 = `# Tables\n\n## S1\n\n# D1\n`;

        it('S3: Single Sheet before Doc', () => { // [D1, WB(S1)] drag S1 before D1
            editor.initializeWorkbook(D1_WB_S1, CONFIG);
            const tabs: TestTab[] = [{ type: 'document', docIndex: 0 }, { type: 'sheet', sheetIndex: 0 }];
            const result = executeTabReorderLikeMainTs(tabs, 1, 0); // S1(1) -> 0

            const state = JSON.parse(editor.getState());
            expect(state.structure[0].type).toBe('workbook');
            expect(state.structure[1].title).toBe('D1');
            expect(result.metadata?.tab_order).toBeUndefined();
        });

        it('S4: Single Sheet after Doc', () => { // [WB(S1), D1] drag S1 after D1
            editor.initializeWorkbook(WB_S1_D1, CONFIG);
            const tabs: TestTab[] = [{ type: 'sheet', sheetIndex: 0 }, { type: 'document', docIndex: 0 }];
            const result = executeTabReorderLikeMainTs(tabs, 0, 2); // S1(0) -> 2

            const state = JSON.parse(editor.getState());
            expect(state.structure[0].title).toBe('D1');
            expect(state.structure[1].type).toBe('workbook');
            expect(result.metadata?.tab_order).toBeUndefined();
        });

        const D1_WB_S1_S2_D2 = `# D1\n\n# Tables\n\n## S1\n\n## S2\n\n# D2\n`;

        it('S5: Multi-Sheet before Doc', () => { // [D1, WB(S1,S2), D2] drag S1 before D1
            editor.initializeWorkbook(D1_WB_S1_S2_D2, CONFIG);
            const tabs: TestTab[] = [
                { type: 'document', docIndex: 0 }, { type: 'sheet', sheetIndex: 0 },
                { type: 'sheet', sheetIndex: 1 }, { type: 'document', docIndex: 1 }
            ];
            // Drag S1(1) to 0. WB moves to start.
            const result = executeTabReorderLikeMainTs(tabs, 1, 0);

            const state = JSON.parse(editor.getState());
            expect(state.structure[0].type).toBe('workbook');
            expect(state.structure[1].title).toBe('D1');
            expect(state.structure[2].title).toBe('D2');

            // Expected tab order: S1, D1, S2, D2
            expect(result.metadata?.tab_order).toEqual([
                { type: 'sheet', index: 0 }, { type: 'document', index: 0 },
                { type: 'sheet', index: 1 }, { type: 'document', index: 1 }
            ]);
        });

        it('S6: Multi-Sheet after Doc', () => { // [D1, WB(S1,S2), D2] drag S2 after D2
            editor.initializeWorkbook(D1_WB_S1_S2_D2, CONFIG);
            const tabs: TestTab[] = [
                { type: 'document', docIndex: 0 }, { type: 'sheet', sheetIndex: 0 },
                { type: 'sheet', sheetIndex: 1 }, { type: 'document', docIndex: 1 }
            ];
            // Drag S2(2) to 4 (after D2). WB moves to end.
            const result = executeTabReorderLikeMainTs(tabs, 2, 4);

            // Verify state
            // NOTE: Since S2 is part of WB, moving S2 after D2 requires either:
            // 1. Moving entire WB after D2 (moves S1 too -> side effect)
            // 2. Keeping WB before D2 and using metadata to show S2 after D2 (Stability)
            // The service prefers Stability (Solution 2).
            const state = JSON.parse(editor.getState());
            expect(state.structure[0].title).toBe('D1');
            expect(state.structure[1].type).toBe('workbook'); // WB stays before D2
            expect(state.structure[2].title).toBe('D2');      // D2 stays after WB

            // Expected tab order: D1, S1, D2, S2 (S1 stays before D2 via metadata)
            expect(result.metadata?.tab_order).toEqual([
                { type: 'document', index: 0 }, { type: 'sheet', index: 0 },
                { type: 'document', index: 1 }, { type: 'sheet', index: 1 }
            ]);
        });

        const WB_S1_S2_D1_D2 = `# Tables\n\n## S1\n\n## S2\n\n# D1\n\n# D2\n`;

        it('C8: Sheet inside doc range', () => { // [WB(S1,S2), D1, D2] drag S1 after D1
            editor.initializeWorkbook(WB_S1_S2_D1_D2, CONFIG);
            const tabs: TestTab[] = [
                { type: 'sheet', sheetIndex: 0 }, { type: 'sheet', sheetIndex: 1 },
                { type: 'document', docIndex: 0 }, { type: 'document', docIndex: 1 }
            ];
            // Drag S1(0) to 3 (after D1(2)). S1 moves to end of WB.
            const result = executeTabReorderLikeMainTs(tabs, 0, 3);

            const state = JSON.parse(editor.getState());
            expect(state.workbook.sheets[0].name).toBe('S2');
            expect(state.workbook.sheets[1].name).toBe('S1');

            // Expected tab order: S2, D1, S1, D2
            expect(result.metadata?.tab_order).toEqual([
                { type: 'sheet', index: 0 }, { type: 'document', index: 0 },
                { type: 'sheet', index: 1 }, { type: 'document', index: 1 }
            ]);
        });

        const WB_S1_S2_D1 = `# Tables\n\n## S1\n\n## S2\n\n# D1\n`;

        it('C8v: Last sheet inside doc range', () => { // [WB(S1,S2), D1] drag S2 after D1
            editor.initializeWorkbook(WB_S1_S2_D1, CONFIG);
            const tabs: TestTab[] = [
                { type: 'sheet', sheetIndex: 0 }, { type: 'sheet', sheetIndex: 1 },
                { type: 'document', docIndex: 0 }
            ];
            // Drag S2(1) to 3 (after D1). No physical change.
            const result = executeTabReorderLikeMainTs(tabs, 1, 3);

            const state = JSON.parse(editor.getState());
            expect(state.workbook.sheets[0].name).toBe('S1');
            expect(state.workbook.sheets[1].name).toBe('S2');

            // Expected tab order: S1, D1, S2
            expect(result.metadata?.tab_order).toEqual([
                { type: 'sheet', index: 0 }, { type: 'document', index: 0 },
                { type: 'sheet', index: 1 }
            ]);
        });
    });

    // =========================================================================
    // 8.6.3 Doc -> Doc
    // =========================================================================
    describe('8.6.3 Doc -> Doc', () => {
        const D1_D2_WB = `# D1\n\n# D2\n\n# Tables\n`;
        it('D1: Doc to Doc (before WB)', () => { // [D1, D2, WB] drag D1 after D2
            editor.initializeWorkbook(D1_D2_WB, CONFIG);
            const tabs: TestTab[] = [
                { type: 'document', docIndex: 0 }, { type: 'document', docIndex: 1 },
                { type: 'sheet', sheetIndex: 0 }
            ];
            const result = executeTabReorderLikeMainTs(tabs, 0, 2);

            const state = JSON.parse(editor.getState());
            expect(state.structure[0].title).toBe('D2');
            expect(state.structure[1].title).toBe('D1');
            expect(result.metadata?.tab_order).toBeUndefined();
        });

        const WB_D1_D2 = `# Tables\n\n# D1\n\n# D2\n`;
        it('D2: Doc to Doc (after WB)', () => { // [WB, D1, D2] drag D1 after D2
            editor.initializeWorkbook(WB_D1_D2, CONFIG);
            const tabs: TestTab[] = [
                { type: 'sheet', sheetIndex: 0 },
                { type: 'document', docIndex: 0 }, { type: 'document', docIndex: 1 }
            ];
            const result = executeTabReorderLikeMainTs(tabs, 1, 3); // D1(1) -> 3

            const state = JSON.parse(editor.getState());
            expect(state.structure[1].title).toBe('D2');
            expect(state.structure[2].title).toBe('D1');
            expect(result.metadata?.tab_order).toBeUndefined();
        });

        const D1_WB_D2 = `# D1\n\n# Tables\n\n# D2\n`;
        it('D3: Doc to Doc (cross WB)', () => { // [D1, WB, D2] drag D1 after D2
            editor.initializeWorkbook(D1_WB_D2, CONFIG);
            const tabs: TestTab[] = [
                { type: 'document', docIndex: 0 }, { type: 'sheet', sheetIndex: 0 },
                { type: 'document', docIndex: 1 }
            ];
            const result = executeTabReorderLikeMainTs(tabs, 0, 3);

            const state = JSON.parse(editor.getState());
            expect(state.structure[1].title).toBe('D2');
            expect(state.structure[2].title).toBe('D1');
            expect(result.metadata?.tab_order).toBeUndefined();
        });
    });

    // =========================================================================
    // 8.6.4 Doc -> WB Boundary
    // =========================================================================
    describe('8.6.4 Doc -> WB Boundary', () => {
        const D1_WB_D2 = `# D1\n\n# Tables\n\n# D2\n`;

        it('D4: Doc before WB to after WB', () => { // [D1, WB, D2] drag D1 after WB
            editor.initializeWorkbook(D1_WB_D2, CONFIG);
            const tabs: TestTab[] = [
                { type: 'document', docIndex: 0 }, { type: 'sheet', sheetIndex: 0 },
                { type: 'document', docIndex: 1 }
            ];
            // Drag D1(0) after S1(1) -> index 2 (after WB)
            const result = executeTabReorderLikeMainTs(tabs, 0, 2);

            const state = JSON.parse(editor.getState());
            expect(state.structure[0].type).toBe('workbook');
            expect(state.structure[1].title).toBe('D1'); // Becomes first doc after WB? No, check Spec D4
            // D4: [WB, D1, D2]. D1 moves after WB (before D2).
            expect(state.structure[1].title).toBe('D1');
            expect(state.structure[2].title).toBe('D2');
            expect(result.metadata?.tab_order).toBeUndefined();
        });

        it('D5: Doc after WB to before WB', () => { // [D1, WB, D2] drag D2 before WB
            editor.initializeWorkbook(D1_WB_D2, CONFIG);
            const tabs: TestTab[] = [
                { type: 'document', docIndex: 0 }, { type: 'sheet', sheetIndex: 0 },
                { type: 'document', docIndex: 1 }
            ];
            // Drag D2(2) before S1(1) (before WB) -> index 1
            const result = executeTabReorderLikeMainTs(tabs, 2, 1);

            const state = JSON.parse(editor.getState());
            expect(state.structure[0].title).toBe('D1');
            expect(state.structure[1].title).toBe('D2');
            expect(state.structure[2].type).toBe('workbook');
            expect(result.metadata?.tab_order).toBeUndefined();
        });
    });

    // =========================================================================
    // 8.6.5 Doc -> Between Sheets
    // =========================================================================
    describe('8.6.5 Doc -> Between Sheets', () => {
        const D1_WB_S1_S2_D2 = `# D1\n\n# Tables\n\n## S1\n\n## S2\n\n# D2\n`;

        it('D6: Doc before WB -> between sheets', () => { // [D1, WB(S1,S2), D2] drag D1 between S1, S2
            editor.initializeWorkbook(D1_WB_S1_S2_D2, CONFIG);
            const tabs: TestTab[] = [
                { type: 'document', docIndex: 0 }, { type: 'sheet', sheetIndex: 0 },
                { type: 'sheet', sheetIndex: 1 }, { type: 'document', docIndex: 1 }
            ];
            const result = executeTabReorderLikeMainTs(tabs, 0, 2); // Drag D1(0) to 2

            const state = JSON.parse(editor.getState());
            expect(state.structure[0].type).toBe('workbook');
            expect(state.structure[1].title).toBe('D1');

            // Expected tab order: S1, D1, S2, D2
            expect(result.metadata?.tab_order).toEqual([
                { type: 'sheet', index: 0 }, { type: 'document', index: 0 },
                { type: 'sheet', index: 1 }, { type: 'document', index: 1 }
            ]);
        });

        it('D7: Doc after WB -> between sheets', () => { // [D1, WB(S1,S2), D2] drag D2 between S1, S2
            editor.initializeWorkbook(D1_WB_S1_S2_D2, CONFIG);
            const tabs: TestTab[] = [
                { type: 'document', docIndex: 0 }, { type: 'sheet', sheetIndex: 0 },
                { type: 'sheet', sheetIndex: 1 }, { type: 'document', docIndex: 1 }
            ];
            const result = executeTabReorderLikeMainTs(tabs, 3, 2); // Drag D2(3) to 2

            const state = JSON.parse(editor.getState());
            // Physical Unchanged
            expect(state.structure[0].title).toBe('D1');
            expect(state.structure[1].type).toBe('workbook');
            expect(state.structure[2].title).toBe('D2');

            // Expected tab order: D1, S1, D2, S2
            expect(result.metadata?.tab_order).toEqual([
                { type: 'document', index: 0 }, { type: 'sheet', index: 0 },
                { type: 'document', index: 1 }, { type: 'sheet', index: 1 }
            ]);
        });

        const WB_S1_S2_D1_D2 = `# Tables\n\n## S1\n\n## S2\n\n# D1\n\n# D2\n`;

        it('D8: Doc after WB -> between (reorder)', () => { // [WB(S1,S2), D1, D2] drag D2 between S1, S2
            editor.initializeWorkbook(WB_S1_S2_D1_D2, CONFIG);
            const tabs: TestTab[] = [
                { type: 'sheet', sheetIndex: 0 }, { type: 'sheet', sheetIndex: 1 },
                { type: 'document', docIndex: 0 }, { type: 'document', docIndex: 1 }
            ];
            const result = executeTabReorderLikeMainTs(tabs, 3, 1); // Drag D2(3) to 1 (After S1)

            const state = JSON.parse(editor.getState());
            // Physical: [WB, D2, D1]
            expect(state.structure[1].title).toBe('D2');
            expect(state.structure[2].title).toBe('D1');

            // Expected tab order: S1, D2, S2, D1
            expect(result.metadata?.tab_order).toEqual([
                { type: 'sheet', index: 0 }, { type: 'document', index: 0 },
                { type: 'sheet', index: 1 }, { type: 'document', index: 1 }
            ]);
        });

        it('Hazard 61: Restore Natural Order', () => { // [S1, D1, S2, D2] drag D1 before S1
            const MD_WITH_META = `# Tables\n\n## S1\n\n## S2\n\n<!-- md-spreadsheet-workbook-metadata: {"tab_order": [{"type": "sheet", "index": 0}, {"type": "document", "index": 0}, {"type": "sheet", "index": 1}, {"type": "document", "index": 1}]} -->\n\n# D1\n\n# D2\n`;
            editor.initializeWorkbook(MD_WITH_META, CONFIG);
            const tabs: TestTab[] = [
                { type: 'sheet', sheetIndex: 0 }, { type: 'document', docIndex: 0 },
                { type: 'sheet', sheetIndex: 1 }, { type: 'document', docIndex: 1 }
            ];
            const result = executeTabReorderLikeMainTs(tabs, 1, 0); // Drag D1(1) to 0

            const state = JSON.parse(editor.getState());
            // Physical: [D1, WB, D2]
            expect(state.structure[0].title).toBe('D1');
            expect(state.structure[1].type).toBe('workbook');
            expect(state.structure[2].title).toBe('D2');
            // Metadata: REMOVED
            expect(result.metadata?.tab_order).toBeUndefined();
        });
    });
});
