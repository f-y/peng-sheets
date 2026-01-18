import { describe, it, expect } from 'vitest';
import * as editor from '../../../src/editor';
import { executeTabReorderLikeMainTs, TestTab } from '../helpers/tab-reorder-test-utils';

/**
 * FINITE PATTERN COVERAGE TESTS
 * 
 * Focuses on gap analysis:
 * 1. Drop on Self / Neighbor (No-Op)
 * 2. Explicit Directional Checks (Left vs Right)
 * 3. Boundary Conditions (Start/End)
 */

const CONFIG = JSON.stringify({ rootMarker: '# Tables' });

describe('Finite Pattern Coverage', () => {

    describe('1. No-Op / Drop on Self', () => {
        const BASIC_WB = `# D1\n\n# Tables\n\n## S1\n\n## S2\n\n# D2\n`;

        it('should do nothing when dragging S1 to S1 index (0 -> 0)', () => {
            editor.initializeWorkbook(BASIC_WB, CONFIG);
            const tabs: TestTab[] = [
                { type: 'document', docIndex: 0 }, { type: 'sheet', sheetIndex: 0 },
                { type: 'sheet', sheetIndex: 1 }, { type: 'document', docIndex: 1 }
            ];
            // Drag S1(1) to 1 (Insert before itself) OR 2 (Insert after itself)
            // Logic: Dropping at 'current index' or 'current index + 1' is typically no-op

            // 1 -> 1 (Before self)
            let result = executeTabReorderLikeMainTs(tabs, 1, 1);
            expect(result.actionType).toBe('no-op');

            // 1 -> 2 (After self)
            result = executeTabReorderLikeMainTs(tabs, 1, 2);
            expect(result.actionType).toBe('no-op');
        });

        it('should do nothing when dragging D1 to D1 position', () => {
            editor.initializeWorkbook(BASIC_WB, CONFIG);
            const tabs: TestTab[] = [
                { type: 'document', docIndex: 0 }, { type: 'sheet', sheetIndex: 0 },
                { type: 'sheet', sheetIndex: 1 }, { type: 'document', docIndex: 1 }
            ];
            // Drag D1(0) to 0 (Before self)
            let result = executeTabReorderLikeMainTs(tabs, 0, 0);
            expect(result.actionType).toBe('no-op');

            // Drag D1(0) to 1 (After self)
            result = executeTabReorderLikeMainTs(tabs, 0, 1);
            expect(result.actionType).toBe('no-op');
        });
    });

    describe('2. Directional Consistency', () => {
        const WB_S1_S2_S3 = `# Tables\n\n## S1\n\n## S2\n\n## S3\n`;

        it('Sheet: Drag Right (S1 -> after S2)', () => {
            // [S1, S2, S3]. Drag S1(0) -> 2 (After S2) -> [S2, S1, S3]
            editor.initializeWorkbook(WB_S1_S2_S3, CONFIG);
            const tabs: TestTab[] = [
                { type: 'sheet', sheetIndex: 0 }, { type: 'sheet', sheetIndex: 1 }, { type: 'sheet', sheetIndex: 2 }
            ];
            const result = executeTabReorderLikeMainTs(tabs, 0, 2);
            const state = JSON.parse(editor.getState());
            expect(state.workbook.sheets.map((s: any) => s.name)).toEqual(['S2', 'S1', 'S3']);
        });

        it('Sheet: Drag Left (S2 -> before S1)', () => {
            // [S1, S2, S3]. Drag S2(1) -> 0 (Before S1) -> [S2, S1, S3]
            editor.initializeWorkbook(WB_S1_S2_S3, CONFIG);
            const tabs: TestTab[] = [
                { type: 'sheet', sheetIndex: 0 }, { type: 'sheet', sheetIndex: 1 }, { type: 'sheet', sheetIndex: 2 }
            ];
            const result = executeTabReorderLikeMainTs(tabs, 1, 0);
            const state = JSON.parse(editor.getState());
            expect(state.workbook.sheets.map((s: any) => s.name)).toEqual(['S2', 'S1', 'S3']);
        });
    });

    describe('3. Boundary Conditions', () => {
        const D1_WB_D2 = `# D1\n\n# Tables\n\n## S1\n\n# D2\n`;

        it('Doc -> Start (Index 0)', () => {
            // [D1, S1, D2]. Drag D2(2) -> 0. Expected: [D2, D1, S1]
            editor.initializeWorkbook(D1_WB_D2, CONFIG);
            const tabs: TestTab[] = [
                { type: 'document', docIndex: 0 }, { type: 'sheet', sheetIndex: 0 },
                { type: 'document', docIndex: 1 }
            ];
            const result = executeTabReorderLikeMainTs(tabs, 2, 0);

            const state = JSON.parse(editor.getState());
            expect(state.structure[0].title).toBe('D2');
            expect(state.structure[1].title).toBe('D1');
            expect(state.structure[2].type).toBe('workbook');
            expect(result.metadata?.tab_order).toBeUndefined(); // Physical move sufficient
        });

        it('Doc -> End (Append)', () => {
            // [D1, S1, D2]. Drag D1(0) -> End (3). Expected: [S1, D2, D1]
            editor.initializeWorkbook(D1_WB_D2, CONFIG);
            const tabs: TestTab[] = [
                { type: 'document', docIndex: 0 }, { type: 'sheet', sheetIndex: 0 },
                { type: 'document', docIndex: 1 }
            ];
            const result = executeTabReorderLikeMainTs(tabs, 0, 3);

            const state = JSON.parse(editor.getState());
            // Physical: [WB, D2, D1]
            expect(state.structure[0].type).toBe('workbook');
            expect(state.structure[1].title).toBe('D2');
            expect(state.structure[2].title).toBe('D1');
        });
    });
});
