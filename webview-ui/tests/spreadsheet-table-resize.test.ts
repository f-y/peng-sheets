import { describe, it, expect } from 'vitest';
import { SpreadsheetTable } from '../components/spreadsheet-table';

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
        await el.updateComplete;

        let resizeEvent = null;
        el.addEventListener('column-resize', (e: any) => {
            resizeEvent = e.detail;
            console.log('Fired: column-resize', e.detail);
        });

        const root = el.shadowRoot!;
        // 1. Locate resize handle for Column 0
        const resizeHandle = root.querySelector('.header-col[data-col="0"] .col-resize-handle') as HTMLElement;
        expect(resizeHandle, 'Resize handle should exist').to.exist;

        // 2. Simulate Drag Start
        resizeHandle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true, clientX: 100 }));

        // 3. Simulate Drag Move (Move +20px)
        document.dispatchEvent(new MouseEvent('mousemove', { clientX: 120 }));

        // 4. Simulate Drag End
        document.dispatchEvent(new MouseEvent('mouseup'));

        await el.updateComplete;

        // Expectation: column-resize fired
        expect(resizeEvent, 'column-resize should fire').to.exist;

        const payload = resizeEvent as any;
        expect(payload).to.exist;
        expect(payload.col).to.equal(0);
        // Initial width default 100 + 20 = 120
        expect(payload.width).to.equal(120);
    });
});
