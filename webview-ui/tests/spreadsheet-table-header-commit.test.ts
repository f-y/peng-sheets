
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fixture, html } from "@open-wc/testing";
import { SpreadsheetTable } from "../components/spreadsheet-table";
import "../components/spreadsheet-table";

describe("SpreadsheetTable Header Commit", () => {
    it("Updates header value on Enter without Lit errors", async () => {
        const el = (await fixture(html`
            <spreadsheet-table></spreadsheet-table>
        `)) as SpreadsheetTable;

        const tableData = {
            name: "Test",
            description: null,
            headers: ["ColA", "ColB"],
            rows: [["1", "2"]],
            metadata: {},
            start_line: 0,
            end_line: 5
        };

        el.table = tableData;
        await el.updateComplete;

        // 1. Enter Edit Mode on Header 0
        const headerCell = el.shadowRoot!.querySelector('.cell.header-col[data-col="0"]') as HTMLElement;
        headerCell.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, composed: true }));
        await el.updateComplete;

        expect(el.isEditing).toBe(true);

        // 2. Simulate User Input in the content span
        // Note: dblclick logic focuses the span.
        const span = headerCell.querySelector('.cell-content') as HTMLElement;
        expect(span).toBeTruthy();

        // Manually set text (simulating browser edit)
        span.innerText = "NewColA";
        // Dispatch input event to update _pendingEditValue
        span.dispatchEvent(new Event('input', { bubbles: true, composed: true }));

        // 3. Commit with Enter
        // Keydown on the active element (which should be the span or cell)
        // usage: _handleKeyDown listens on the cell/host? 
        // Logic: @keydown="${this._handleKeyDown}" is on the .header-col div.
        // Event bubbles from span to div.
        span.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));

        await el.updateComplete;

        // 4. Verification
        // State should be updated (Optimistic)
        expect(el.table!.headers![0]).toBe("NewColA");

        // UI should reflect it
        // Check if span text content matches
        const newSpan = el.shadowRoot!.querySelector('.cell.header-col[data-col="0"] .cell-content') as HTMLElement;
        expect(newSpan.textContent?.trim()).toBe("NewColA");
    });
});
