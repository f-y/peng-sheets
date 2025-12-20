import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { queryView, awaitView } from './test-helpers';
import { fixture, html } from '@open-wc/testing';
import '../components/spreadsheet-table';
import { SpreadsheetTable } from '../components/spreadsheet-table';

/**
 * Bug Reproduction Test: Corner Selection Ctrl+C Copy Not Working
 *
 * Issue: When corner cell is clicked to select entire table, Ctrl+C doesn't copy anything.
 *
 * This test simulates the actual user flow:
 * 1. Click corner cell to select entire table
 * 2. Press Ctrl+C
 * 3. Verify clipboard contains full table with headers
 */
describe('Bug Reproduction: Corner Selection Copy', () => {
    let element: SpreadsheetTable;
    let writeTextSpy: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
        element = await fixture<SpreadsheetTable>(html`<spreadsheet-table></spreadsheet-table>`);

        // Mock Clipboard API
        writeTextSpy = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', {
            value: {
                writeText: writeTextSpy,
                readText: vi.fn()
            },
            configurable: true,
            writable: true
        });

        element.table = {
            name: 'Test',
            description: '',
            headers: ['A', 'B'],
            rows: [
                ['1', '2'],
                ['3', '4']
            ],
            metadata: {},
            start_line: 0,
            end_line: 0
        };
        await awaitView(element);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('copies full table when corner cell is clicked then Ctrl+C pressed', async () => {
        // Step 1: Click corner cell to select entire table
        const cornerCell = queryView(element, '.cell.header-corner') as HTMLElement;
        expect(cornerCell).toBeTruthy();

        cornerCell.click();
        await awaitView(element);

        // Verify selection state after corner click
        console.log('[DEBUG] After corner click:');
        console.log('  selectedRow:', element.selectionCtrl.selectedRow);
        console.log('  selectedCol:', element.selectionCtrl.selectedCol);
        console.log('  anchorRow:', element.selectionCtrl.selectionAnchorRow);
        console.log('  anchorCol:', element.selectionCtrl.selectionAnchorCol);

        expect(element.selectionCtrl.selectedRow).toBe(-2);
        expect(element.selectionCtrl.selectedCol).toBe(-2);
        expect(element.selectionCtrl.selectionAnchorRow).toBe(-2);
        expect(element.selectionCtrl.selectionAnchorCol).toBe(-2);

        // Step 2: Press Ctrl+C
        // Using keyboardCtrl.handleKeyDown directly since that's what the actual keyboard handler invokes
        const event = {
            ctrlKey: true,
            metaKey: false,
            key: 'c',
            preventDefault: () => {}
        } as unknown as KeyboardEvent;

        await (element as any).keyboardCtrl.handleKeyDown(event);
        await new Promise((r) => setTimeout(r, 10));

        // Step 3: Verify clipboard content
        // Expected: "A\tB\n1\t2\n3\t4" (headers + all data rows)
        expect(writeTextSpy).toHaveBeenCalled();
        expect(writeTextSpy).toHaveBeenCalledWith('A\tB\n1\t2\n3\t4');
    });

    it('corner click should set selection state to (-2, -2)', async () => {
        // Click corner
        const cornerCell = queryView(element, '.cell.header-corner') as HTMLElement;
        expect(cornerCell).toBeTruthy();

        cornerCell.click();
        await awaitView(element);

        // After corner click, both selected and anchor should be (-2, -2)
        expect(element.selectionCtrl.selectedRow).toBe(-2);
        expect(element.selectionCtrl.selectedCol).toBe(-2);
        expect(element.selectionCtrl.selectionAnchorRow).toBe(-2);
        expect(element.selectionCtrl.selectionAnchorCol).toBe(-2);
    });
});
