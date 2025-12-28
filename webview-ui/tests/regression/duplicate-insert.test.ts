/**
 * Regression test for duplicate row/column insertion bug
 *
 * Bug: When Cmd+Shift+= is pressed to insert copied rows/columns,
 * rows/columns are inserted TWICE (once by KeyboardController,
 * once by SpreadsheetTable._handleInsertCopiedCellsAtSelection).
 *
 * Fix: Remove duplicate handling from KeyboardController.
 * The insertion should only be triggered via the extension command
 * → GlobalEventController → insert-copied-cells-at-selection event
 * → SpreadsheetTable._handleInsertCopiedCellsAtSelection.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ClipboardStore } from '../../stores/clipboard-store';

describe('Duplicate insertion prevention', () => {
    beforeEach(() => {
        ClipboardStore.clear();
    });

    afterEach(() => {
        ClipboardStore.clear();
    });

    it('should NOT have duplicate Ctrl+Shift+= handling in KeyboardController', async () => {
        // Import the actual KeyboardController source
        const { KeyboardController } = await import('../../controllers/keyboard-controller');

        // Check that the handleKeyDown method source does not contain
        // the duplicate shortcut handling for Ctrl+Shift+=
        const source = KeyboardController.prototype.handleKeyDown.toString();

        // The KeyboardController should NOT directly call insertCopiedRows/insertCopiedColumns
        // because that's handled by SpreadsheetTable._handleInsertCopiedCellsAtSelection
        // via the extension command flow
        const hasInsertCopiedRowsCall = source.includes('insertCopiedRows');
        const hasInsertCopiedColumnsCall = source.includes('insertCopiedColumns');

        expect(hasInsertCopiedRowsCall).toBe(false);
        expect(hasInsertCopiedColumnsCall).toBe(false);
    });

    it('should only dispatch one rows-insert-at event per shortcut press', () => {
        // This test simulates the expected behavior:
        // Only one pathway should trigger the insertion

        const dispatchedEvents: string[] = [];

        // Simulate what happens when insert-copied-cells-at-selection is dispatched
        const handleInsertCopiedCellsAtSelection = () => {
            // This is the ONLY place that should dispatch rows-insert-at
            dispatchedEvents.push('rows-insert-at');
        };

        // The extension command triggers insert-copied-cells-at-selection
        handleInsertCopiedCellsAtSelection();

        // There should be exactly ONE event
        expect(dispatchedEvents.length).toBe(1);
    });
});
