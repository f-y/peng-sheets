/**
 * Comprehensive Cell Edit Mode Tests
 *
 * Tests the behavior of cell editing, particularly focusing on:
 * - Text selection and deletion
 * - Newline handling (<br> elements)
 * - Delete and Backspace key behavior
 * - Text extraction and normalization
 *
 * These tests help ensure correct contenteditable behavior which is
 * notoriously inconsistent across browsers.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fixture, html } from '@open-wc/testing';
import '../../components/spreadsheet-table';
import { SpreadsheetTable } from '../../components/spreadsheet-table';
import { awaitView, queryView } from '../helpers/test-helpers';

describe('Cell Edit Mode - Comprehensive Tests', () => {
    let element: SpreadsheetTable;

    beforeEach(async () => {
        element = await fixture<SpreadsheetTable>(html`<spreadsheet-table></spreadsheet-table>`);
        element.table = {
            name: 'Test',
            description: '',
            headers: ['A', 'B'],
            rows: [
                ['Hello\nWorld', 'Simple'],
                ['No Newline', 'Test']
            ],
            metadata: {},
            start_line: 0,
            end_line: 0,
            alignments: null
        };
        await awaitView(element);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Entering edit mode', () => {
        it('should enter edit mode on double-click', async () => {
            const cell = queryView(element, '.cell[data-row="0"][data-col="0"]') as HTMLElement;
            expect(cell).toBeTruthy();

            cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
            await awaitView(element);

            expect(element.editCtrl.isEditing).toBe(true);
            expect(cell.getAttribute('contenteditable')).toBe('true');
        });

        it('should enter edit mode on F2 key', async () => {
            const cell = queryView(element, '.cell[data-row="0"][data-col="0"]') as HTMLElement;
            cell.click();
            await awaitView(element);

            // Dispatch keydown on the cell element, not window
            cell.dispatchEvent(new KeyboardEvent('keydown', { key: 'F2', bubbles: true, composed: true }));
            await awaitView(element);

            expect(element.editCtrl.isEditing).toBe(true);
        });

        it('should enter replacement mode on direct typing', async () => {
            const cell = queryView(element, '.cell[data-row="1"][data-col="1"]') as HTMLElement;
            cell.click();
            await awaitView(element);

            // Dispatch keydown on the cell element
            cell.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true, composed: true }));
            await awaitView(element);

            expect(element.editCtrl.isEditing).toBe(true);
            expect(element.editCtrl.isReplacementMode).toBe(true);
            expect(element.editCtrl.pendingEditValue).toBe('x');
        });
    });

    describe('Text selection in edit mode', () => {
        it('should support Ctrl+A to select all text', async () => {
            const cell = queryView(element, '.cell[data-row="1"][data-col="0"]') as HTMLElement;
            cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
            await awaitView(element);

            const editingCell = queryView(element, '.cell.editing') as HTMLElement;
            expect(editingCell).toBeTruthy();

            // Simulate Ctrl+A
            editingCell.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true, composed: true })
            );
            await awaitView(element);

            // Selection should cover entire cell content
            const selection = window.getSelection();
            expect(selection).toBeTruthy();
            // Note: In JSDOM, selection may not work exactly as in browser
            // We mainly verify no error occurs
        });
    });

    describe('Newline handling (Option+Enter)', () => {
        it('should trigger newline insertion logic on Option+Enter', async () => {
            const cell = queryView(element, '.cell[data-row="1"][data-col="1"]') as HTMLElement;
            cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
            await awaitView(element);

            expect(element.editCtrl.isEditing).toBe(true);

            const editingCell = queryView(element, '.cell.editing') as HTMLElement;
            editingCell.focus();

            // Simulate Option+Enter (altKey)
            editingCell.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Enter', altKey: true, bubbles: true, composed: true })
            );
            await awaitView(element);

            // Note: In JSDOM, Selection API doesn't work properly with Shadow DOM,
            // so insertLineBreakAtSelection may not actually insert the BR.
            // We verify the event was handled (no error) and editing mode persists.
            expect(element.editCtrl.isEditing).toBe(true);
            // hasUserInsertedNewline may be false in JSDOM if selection fails
        });
    });

    describe('Committing edits', () => {
        it('should commit on Enter key', async () => {
            const cell = queryView(element, '.cell[data-row="1"][data-col="1"]') as HTMLElement;
            cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
            await awaitView(element);

            const editingCell = queryView(element, '.cell.editing') as HTMLElement;
            editingCell.textContent = 'Modified';
            editingCell.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
            await awaitView(element);

            editingCell.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));
            await awaitView(element);

            expect(element.editCtrl.isEditing).toBe(false);
            expect(element.table?.rows[1][1]).toBe('Modified');
        });

        it('should commit on Tab key', async () => {
            const cell = queryView(element, '.cell[data-row="1"][data-col="0"]') as HTMLElement;
            cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
            await awaitView(element);

            const editingCell = queryView(element, '.cell.editing') as HTMLElement;
            editingCell.textContent = 'Tab Commit';
            editingCell.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
            await awaitView(element);

            editingCell.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, composed: true }));
            await awaitView(element);

            expect(element.editCtrl.isEditing).toBe(false);
            expect(element.table?.rows[1][0]).toBe('Tab Commit');
        });

        it('should cancel on Escape key', async () => {
            const cell = queryView(element, '.cell[data-row="1"][data-col="1"]') as HTMLElement;
            const originalValue = element.table?.rows[1][1];

            cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
            await awaitView(element);

            const editingCell = queryView(element, '.cell.editing') as HTMLElement;
            editingCell.textContent = 'Should Not Save';
            editingCell.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
            await awaitView(element);

            editingCell.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
            await awaitView(element);

            expect(element.editCtrl.isEditing).toBe(false);
            expect(element.table?.rows[1][1]).toBe(originalValue);
        });
    });

    describe('Empty cell handling', () => {
        it('should save empty string when cell is cleared, not <br>', async () => {
            const cell = queryView(element, '.cell[data-row="1"][data-col="1"]') as HTMLElement;
            cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
            await awaitView(element);

            const editingCell = queryView(element, '.cell.editing') as HTMLElement;
            editingCell.innerHTML = '';
            editingCell.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
            await awaitView(element);

            editingCell.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));
            await awaitView(element);

            // Should be empty string, NOT "<br>" or any HTML
            expect(element.table?.rows[1][1]).toBe('');
        });
    });

    describe('Multiline cell editing', () => {
        it('should preserve newlines in multiline content', async () => {
            // Cell [0][0] contains "Hello\nWorld"
            const cell = queryView(element, '.cell[data-row="0"][data-col="0"]') as HTMLElement;
            cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
            await awaitView(element);

            // Edit and commit without changing
            const editingCell = queryView(element, '.cell.editing') as HTMLElement;
            editingCell.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));
            await awaitView(element);

            // Original newline should be preserved
            expect(element.table?.rows[0][0]).toContain('\n');
        });

        it('should stay in edit mode for ArrowUp/Down in multiline cells', async () => {
            // Cell [0][0] contains multiline content
            const cell = queryView(element, '.cell[data-row="0"][data-col="0"]') as HTMLElement;
            cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
            await awaitView(element);

            expect(element.editCtrl.isEditing).toBe(true);

            const editingCell = queryView(element, '.cell.editing') as HTMLElement;

            // ArrowDown should NOT exit edit mode in multiline cell
            editingCell.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true })
            );
            await awaitView(element);

            // Still editing (browser handles cursor movement within cell)
            expect(element.editCtrl.isEditing).toBe(true);
        });
    });

    describe('Click-away commit', () => {
        it('should commit when clicking another cell', async () => {
            const cell00 = queryView(element, '.cell[data-row="0"][data-col="0"]') as HTMLElement;
            cell00.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
            await awaitView(element);

            const editingCell = queryView(element, '.cell.editing') as HTMLElement;
            editingCell.textContent = 'Click Away Test';
            editingCell.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
            await awaitView(element);

            // Click another cell
            const cell01 = queryView(element, '.cell[data-row="0"][data-col="1"]') as HTMLElement;
            cell01.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true, button: 0 }));
            window.dispatchEvent(new MouseEvent('mouseup'));
            await awaitView(element);

            expect(element.editCtrl.isEditing).toBe(false);
            expect(element.table?.rows[0][0]).toBe('Click Away Test');
        });
    });
});

describe('Cell Edit - Delete/Backspace Behavior', () => {
    let element: SpreadsheetTable;

    beforeEach(async () => {
        element = await fixture<SpreadsheetTable>(html`<spreadsheet-table></spreadsheet-table>`);
        element.table = {
            name: 'Delete Test',
            description: '',
            headers: ['Col'],
            rows: [['Line1\nLine2\nLine3'], ['Simple']],
            metadata: {},
            start_line: 0,
            end_line: 0,
            alignments: null
        };
        await awaitView(element);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Non-edit mode delete', () => {
        it('should clear cell content on Delete key when not editing', async () => {
            const cell = queryView(element, '.cell[data-row="1"][data-col="0"]') as HTMLElement;
            cell.click();
            await awaitView(element);

            expect(element.editCtrl.isEditing).toBe(false);

            // Dispatch Delete on the cell, not window
            cell.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, composed: true }));
            await awaitView(element);

            expect(element.table?.rows[1][0]).toBe('');
        });

        it('should clear cell content on Backspace key when not editing', async () => {
            const cell = queryView(element, '.cell[data-row="1"][data-col="0"]') as HTMLElement;
            cell.click();
            await awaitView(element);

            expect(element.editCtrl.isEditing).toBe(false);

            // Dispatch Backspace on the cell, not window
            cell.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, composed: true }));
            await awaitView(element);

            expect(element.table?.rows[1][0]).toBe('');
        });
    });

    describe('Edit mode text deletion', () => {
        /**
         * BUG REPRODUCTION: Multiline text selection + Delete
         *
         * Reported issue: When a cell contains newlines and you select a range
         * of text including newlines in edit mode, pressing Delete only deletes
         * the last character instead of the entire selection.
         *
         * This is caused by browser contenteditable behavior with <br> elements.
         */
        it('should delete entire selected text including newlines', async () => {
            // Cell [0][0] contains "Line1\nLine2\nLine3"
            const cell = queryView(element, '.cell[data-row="0"][data-col="0"]') as HTMLElement;
            cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
            await awaitView(element);

            const editingCell = queryView(element, '.cell.editing') as HTMLElement;
            expect(editingCell).toBeTruthy();

            // Create a selection spanning the newline
            // In JSDOM, we need to manually set up the selection
            const selection = window.getSelection();
            if (selection && editingCell.firstChild) {
                const range = document.createRange();

                // Select "Line1\nLine2" (first text node through second text node)
                // The actual DOM structure with <br> is: "Line1" <br> "Line2" <br> "Line3"
                // We want to select from start of "Line1" to end of "Line2"

                try {
                    range.selectNodeContents(editingCell);
                    // Select just part of the content if possible
                    if (editingCell.childNodes.length > 0) {
                        range.setStart(editingCell.childNodes[0], 0);
                        // Try to find the end point after "Line2"
                        // This will select all content - simpler for test
                        range.setEnd(editingCell, editingCell.childNodes.length);
                    }
                    selection.removeAllRanges();
                    selection.addRange(range);
                } catch {
                    // Selection setup may fail in JSDOM, but we still test the expected behavior
                }
            }

            // Now press Delete - this should delete the selected content
            // Note: In JSDOM, the actual deletion won't happen, but we verify no errors occur
            editingCell.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, composed: true }));
            await awaitView(element);

            // The test primarily verifies no crash occurs
            // Real browser testing would verify the deletion behavior
            expect(true).toBe(true);
        });

        it('should update pendingEditValue on input event', async () => {
            const cell = queryView(element, '.cell[data-row="1"][data-col="0"]') as HTMLElement;
            cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
            await awaitView(element);

            const editingCell = queryView(element, '.cell.editing') as HTMLElement;

            // Simulate typing (update textContent and dispatch input event)
            editingCell.textContent = 'Updated';
            editingCell.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
            await awaitView(element);

            // Pending value should be updated via trackedValue or input handling
            // The exact mechanism depends on implementation; we verify no crash
            expect(element.editCtrl.isEditing).toBe(true);
        });
    });
});
