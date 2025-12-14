
import { describe, it, expect } from 'vitest';
import { fixture, html } from "@open-wc/testing";
import { SpreadsheetTable } from "../components/spreadsheet-table";
import "../components/spreadsheet-table";

describe("SpreadsheetTable Metadata Edit", () => {
    it("Enters metadata edit mode on double click", async () => {
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

        // Verify initial state
        const titleEl = el.shadowRoot!.querySelector('h3');
        expect(titleEl).toBeTruthy();
        expect(titleEl?.textContent).toBe("Test Table");

        // Double Click
        titleEl!.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, composed: true }));
        await el.updateComplete;

        // Check state
        expect(el.editingMetadata).toBe(true);

        // Check UI (input should be visible)
        // Wait for potential re-render if it wasn't synchronous
        await new Promise(r => setTimeout(r, 10)); // Allow timeout(0) to run if any
        await el.updateComplete;

        const input = el.shadowRoot!.querySelector('.metadata-input-title') as HTMLInputElement;
        expect(input).toBeTruthy();
        expect(input.value).toBe("Test Table");

        // Cannot easily check document.activeElement inside shadow dom across boundaries in JSDOM easily without care,
        // but ensuring input exists is step 1.
    });
});
