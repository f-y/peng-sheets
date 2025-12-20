import { describe, it, expect } from 'vitest';
import { queryView, queryAllView, awaitView } from '../../helpers/test-helpers';
import { SpreadsheetTable } from '../../../components/spreadsheet-table';
import '../../../components/spreadsheet-table';
import '../../../components/spreadsheet-table';

describe('SpreadsheetTable Column Resize', () => {
    it('emits metadata-change event when column is resized', async () => {
        const el = new SpreadsheetTable();
        document.body.appendChild(el);

        el.table = {
            name: 'Test',
            description: '',
            headers: ['A', 'B'],
            rows: [['1', '2']],
            metadata: {},
            start_line: 0,
            end_line: 0
        };
        await awaitView(el);

        let resizeEvent = null;
        el.addEventListener('column-resize', (e: any) => {
            resizeEvent = e.detail;
            console.log('Fired: column-resize', e.detail);
        });

        const root = el.shadowRoot!;
        // Column headers are in View's shadowRoot, ss-column-header uses Light DOM
        const view = root.querySelector('spreadsheet-table-view');
        const columnHeaders = view?.shadowRoot?.querySelectorAll('ss-column-header');
        expect(columnHeaders?.length, 'Column headers should exist').to.be.greaterThan(0);
        const firstColHeader = columnHeaders![0];
        const resizeHandle = firstColHeader?.querySelector('.col-resize-handle') as HTMLElement;
        expect(resizeHandle, 'Resize handle should exist').to.exist;

        // 2. Simulate Drag Start
        resizeHandle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true, clientX: 100 }));

        // 3. Simulate Drag Move (Move +20px)
        document.dispatchEvent(new MouseEvent('mousemove', { clientX: 120 }));

        // 4. Simulate Drag End
        document.dispatchEvent(new MouseEvent('mouseup'));

        await awaitView(el);

        // Expectation: column-resize fired
        expect(resizeEvent, 'column-resize should fire').to.exist;

        const payload = resizeEvent as any;
        expect(payload).to.exist;
        expect(payload.col).to.equal(0);
        // Initial width default 100 + 20 = 120
        expect(payload.width).to.equal(120);
        expect(payload.sheetIndex).to.equal(0);
        expect(payload.tableIndex).to.equal(0);
    });
});
