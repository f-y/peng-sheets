
import { describe, it, expect } from 'vitest';
import { fixture, html } from "@open-wc/testing";
import { SpreadsheetTable } from "../components/spreadsheet-table";
import "../components/spreadsheet-table";

describe("SpreadsheetTable State Persistence", () => {
    it("Resets editing state when switching sheets (component reuse)", async () => {
        const el = (await fixture(html`
            <spreadsheet-table></spreadsheet-table>
        `)) as SpreadsheetTable;

        const tableA = { name: "Table A", rows: [] };
        const tableB = { name: "Table B", rows: [] };

        // 1. Initial State (Sheet 1)
        el.sheetIndex = 0;
        el.table = tableA as any;
        await el.updateComplete;

        // 2. Start Editing Metadata
        const h3 = el.shadowRoot!.querySelector('h3');
        h3!.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, composed: true }));
        await el.updateComplete;

        expect(el.editingMetadata).toBe(true);
        expect((el.shadowRoot!.querySelector('.metadata-input-title') as HTMLInputElement).value).toBe("Table A");

        // 3. Switch Sheet (Sheet 3) - Update props
        el.sheetIndex = 2;
        el.table = tableB as any;
        // Lit update happens
        await el.updateComplete;

        // 4. Expectation: Editing should be cancelled/reset
        expect(el.editingMetadata).toBe(false);
        // AND pending title should not leak
        expect(el.shadowRoot!.querySelector('.metadata-input-title')).toBeNull();
        expect(el.shadowRoot!.querySelector('h3')!.textContent).toBe("Table B");
    });

    it("Commits metadata edit on blur to external element", async () => {
        const el = (await fixture(html`
            <spreadsheet-table></spreadsheet-table>
        `)) as SpreadsheetTable;
        el.table = { name: "Table A", rows: [] } as any;
        await el.updateComplete;

        // Start edit
        const h3 = el.shadowRoot!.querySelector('h3');
        h3!.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, composed: true }));
        await el.updateComplete;
        expect(el.editingMetadata).toBe(true);

        const input = el.shadowRoot!.querySelector('.metadata-input-title') as HTMLInputElement;

        // Blur to... something outside.
        // In JSDOM, simulating blur to document.body or a sibling div.
        // dispatching 'blur' with relatedTarget as null (or body).

        input.dispatchEvent(new FocusEvent('blur', {
            bubbles: true, composed: true, relatedTarget: null
        }));
        await el.updateComplete;

        // Expect: Edit Mode Closed
        expect(el.editingMetadata).toBe(false);
    });
});
