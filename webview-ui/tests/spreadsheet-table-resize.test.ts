
import { describe, it, expect } from 'vitest';
import { SpreadsheetTable } from '../components/spreadsheet-table';

describe('SpreadsheetTable Column Resize', () => {

    it('emits metadata-change event when column is resized', async () => {
        const el = new SpreadsheetTable();
        document.body.appendChild(el);

        el.table = {
            name: 'Test', description: '',
            headers: ['A', 'B'],
            rows: [['1', '2']],
            metadata: {},
            start_line: 0, end_line: 0
        };
        await el.updateComplete;

        let metadataEvent = null;
        el.addEventListener('metadata-change', (e: any) => {
            metadataEvent = e.detail;
            console.log('Fired: metadata-change', e.detail);
        });

        const root = el.shadowRoot!;
        // 1. Locate resize handle for Column 0
        // (Note: Currently this selector will fail as handle is not implemented)
        const resizeHandle = root.querySelector('.header-col[data-col="0"] .col-resize-handle') as HTMLElement;
        expect(resizeHandle, 'Resize handle should exist').to.exist;

        // 2. Simulate Drag Start
        resizeHandle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true, clientX: 100 }));

        // 3. Simulate Drag Move (Move +20px)
        document.dispatchEvent(new MouseEvent('mousemove', { clientX: 120 }));

        // 4. Simulate Drag End
        document.dispatchEvent(new MouseEvent('mouseup'));

        await el.updateComplete;

        // Expectation: metadata-change fired with new width
        expect(metadataEvent, 'metadata-change should fire').to.exist;
        // Default width is typically 100px or undefined. If undefined, we might need to assume a start width.
        // Assuming we default to 100px, new width should be 120px.
        // Or if we read computed style.
        // The event payload should match { key: "visual", value: { columnWidths: { "0": 120 } } } or similar.
        // The spec says: {"columnWidths": { 0: 120 }} (using dict map).

        const payload = (metadataEvent as any).metadata;
        expect(payload).to.exist;
        expect(payload.columnWidths).to.exist;
        // Check fuzzy match close to 120 ?
        // Widths are usually absolute.
    });
});
