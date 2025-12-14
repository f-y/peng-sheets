
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
            description: null,
            headers: ["A"],
            rows: [["1"]],
            metadata: {},
            start_line: 0,
            end_line: 5
        } as any;
        await el.updateComplete;

        // 1. Enter Edit Mode
        const h3 = el.shadowRoot!.querySelector('h3');
        h3!.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, composed: true }));
        await el.updateComplete;
        expect(el.editingMetadata).toBe(true);

        // 2. Commit (Blur)
        const input = el.shadowRoot!.querySelector('.metadata-input-title') as HTMLInputElement;
        input.dispatchEvent(new FocusEvent('blur', { bubbles: true, composed: true }));
        await el.updateComplete;
        // Extra wait for potential async rendering
        await new Promise(r => setTimeout(r, 50));
        await el.updateComplete;

        expect(el.editingMetadata).toBe(false);
        // Debug: Check what's in the DOM
        const metadataContainer = el.shadowRoot!.querySelector('.metadata-container');
        console.log("Metadata Container HTML:", metadataContainer?.innerHTML);
        console.log("editingMetadata:", el.editingMetadata);

        // 3. Re-Enter Edit Mode
        const h3Again = el.shadowRoot!.querySelector('h3');
        expect(h3Again).not.toBeNull(); // Add explicit check
        h3Again!.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, composed: true }));
        await el.updateComplete;

        // 4. Expectation: Editing is true again
        expect(el.editingMetadata).toBe(true);
    });
});
