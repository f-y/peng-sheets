
import { describe, it, expect } from 'vitest';
import { fixture, html } from "@open-wc/testing";
import { SpreadsheetTable } from "../components/spreadsheet-table";
import "../components/spreadsheet-table";

describe("SpreadsheetTable Metadata Re-Edit", () => {
    it("Allows entering edit mode again after a commit", async () => {
        const el = (await fixture(html`
            <spreadsheet-table></spreadsheet-table>
        `)) as SpreadsheetTable;

        el.table = {
            name: "Table A",
            description: "Desc A",
            headers: ["A"],
            rows: [["1"]],
            metadata: {},
            start_line: 0,
            end_line: 5
        } as any;
        await el.updateComplete;

        // 1. Enter Edit Mode
        const descEl = el.shadowRoot!.querySelector('.metadata-desc');
        descEl!.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
        await el.updateComplete;
        expect(el.editingMetadata).toBe(true);

        // 2. Commit (Blur)
        const input = el.shadowRoot!.querySelector('.metadata-input-desc') as HTMLTextAreaElement;
        input.dispatchEvent(new FocusEvent('blur', { bubbles: true, composed: true }));
        await el.updateComplete;
        // Extra wait for potential async rendering
        await new Promise(r => setTimeout(r, 50));
        await el.updateComplete;

        expect(el.editingMetadata).toBe(false);

        // 3. Re-Enter Edit Mode
        const descElAgain = el.shadowRoot!.querySelector('.metadata-desc');
        expect(descElAgain).not.toBeNull();
        descElAgain!.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
        await el.updateComplete;

        // 4. Expectation: Editing is true again
        expect(el.editingMetadata).toBe(true);
    });

    it("Allows entering edit mode again after Enter commit", async () => {
        const el = (await fixture(html`
            <spreadsheet-table></spreadsheet-table>
        `)) as SpreadsheetTable;

        el.table = {
            name: "Table A",
            description: "Desc A",
            headers: ["A"],
            rows: [["1"]],
            metadata: {},
            start_line: 0,
            end_line: 5
        } as any;
        await el.updateComplete;

        // 1. Enter Edit Mode
        const descEl = el.shadowRoot!.querySelector('.metadata-desc');
        descEl!.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
        await el.updateComplete;
        expect(el.editingMetadata).toBe(true);

        // 2. Modify and Commit via Enter
        const input = el.shadowRoot!.querySelector('.metadata-input-desc') as HTMLTextAreaElement;
        input.value = "Desc B";
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        await el.updateComplete;

        expect(el.editingMetadata).toBe(false);

        // 3. Simulate prop update
        el.table = {
            name: "Table A",
            description: "Desc B",
            headers: ["A"],
            rows: [["1"]],
            metadata: {},
            start_line: 0,
            end_line: 5
        } as any;
        await el.updateComplete;

        // 4. Re-Enter Edit Mode
        const descElAgain = el.shadowRoot!.querySelector('.metadata-desc');
        expect(descElAgain).not.toBeNull();
        expect(descElAgain!.textContent).toContain("Desc B");

        descElAgain!.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
        await el.updateComplete;

        // 5. Expectation: Editing is true again
        expect(el.editingMetadata).toBe(true);
    });
});
