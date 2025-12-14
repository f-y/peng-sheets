
import { describe, it, expect } from 'vitest';
import { fixture, html } from "@open-wc/testing";
import { SpreadsheetTable } from "../components/spreadsheet-table";
import "../components/spreadsheet-table";

describe("SpreadsheetTable Metadata Edit", () => {
    it("Enters metadata edit mode on description click", async () => {
        const el = (await fixture(html`
            <spreadsheet-table></spreadsheet-table>
        `)) as SpreadsheetTable;

        const tableData = {
            name: "Test Table",
            description: "Desc",
            headers: ["A"],
            rows: [["1"]],
            metadata: {},
            start_line: 0,
            end_line: 5
        };

        el.table = tableData;
        await el.updateComplete;

        // Verify initial state: Check for description element
        const descEl = el.shadowRoot!.querySelector('.metadata-desc');
        expect(descEl).toBeTruthy();
        expect(descEl?.textContent).toContain("Desc");

        // Click to edit
        descEl!.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
        await el.updateComplete;

        // Check state
        expect(el.editingMetadata).toBe(true);

        // Check UI (input should be visible)
        await new Promise(r => setTimeout(r, 10)); // Allow timeout(0) to run if any
        await el.updateComplete;

        const input = el.shadowRoot!.querySelector('.metadata-input-desc') as HTMLTextAreaElement;
        expect(input).toBeTruthy();
        expect(input.value).toBe("Desc");
    });
});
