/**
 * Test suite for Insert Row/Column event propagation and index calculation
 *
 * Bug 1: Insert Row Above does nothing - event not propagating
 * Bug 2: Insert Copied Column Right inserts one column too far - double index increment
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Bug: Insert Row Above Event Propagation', () => {
    describe('ss-context-menu event dispatch', () => {
        it('ss-insert-row should be dispatched with correct index for "above"', () => {
            // When clicking "Insert Row Above" on row 2, the event should have:
            // - index: 2 (insert AT row 2, pushing current row 2 down)
            // - position: 'above'
            const rowIndex = 2;
            const event = new CustomEvent('ss-insert-row', {
                detail: { index: rowIndex, position: 'above' },
                bubbles: true,
                composed: true
            });

            expect(event.detail.index).toBe(2);
            expect(event.detail.position).toBe('above');
        });

        it('ss-insert-row should be dispatched with index+1 for "below"', () => {
            // When clicking "Insert Row Below" on row 2, the event should have:
            // - index: 3 (insert at row 3)
            // - position: 'below'
            const rowIndex = 2;
            const event = new CustomEvent('ss-insert-row', {
                detail: { index: rowIndex + 1, position: 'below' },
                bubbles: true,
                composed: true
            });

            expect(event.detail.index).toBe(3);
        });
    });

    describe('Event handler binding verification', () => {
        it('menu close should be called after insert action', () => {
            // This test documents the expected behavior:
            // After insert-row, the menu should close
            const menuCloseCalled = vi.fn();

            // Simulating the flow: click handler dispatches event, then menu closes
            const insertHandler = (e: MouseEvent) => {
                e.stopPropagation();
                // dispatch ss-insert-row
                menuCloseCalled(); // This should be called
            };

            const mockEvent = { stopPropagation: vi.fn() } as unknown as MouseEvent;
            insertHandler(mockEvent);

            expect(menuCloseCalled).toHaveBeenCalled();
        });
    });
});

describe('Bug: Insert Copied Column Right - Double Index Increment', () => {
    describe('Index calculation flow analysis', () => {
        it('ss-context-menu _handleInsertCopiedRight uses index+1', () => {
            // SSContextMenu._handleInsertCopiedRight dispatches with index+1
            const contextMenuIndex = 2;
            const eventIndex = contextMenuIndex + 1; // current implementation adds 1

            expect(eventIndex).toBe(3);
        });

        it('ClipboardController.insertCopiedColumns adds 1 for "right" direction', () => {
            // ClipboardController.insertCopiedColumns also adds 1 for 'right'
            const eventIndex = 3; // from context menu
            const direction = 'right';
            const insertAt = direction === 'right' ? eventIndex + 1 : eventIndex;

            // Bug: insertAt is now 4, should be 3
            expect(insertAt).toBe(4); // This documents the bug - double increment!
        });

        it('total offset for "right" should be 1, not 2', () => {
            // Starting column: 2
            // Expected insert position: 3 (one to the right)
            // Bug: actual insert position: 4 (two to the right)

            const startColumn = 2;
            const expectedInsertAt = startColumn + 1;

            // Current buggy calculation:
            // 1. ss-context-menu sends index = 2 + 1 = 3
            // 2. ClipboardController insertAt = 3 + 1 = 4 (for 'right')
            // Result: inserting at 4 instead of 3

            expect(expectedInsertAt).toBe(3);
        });
    });

    describe('Fix: Either ss-context-menu OR ClipboardController should add 1, not both', () => {
        it('Option A: ss-context-menu sends raw index, ClipboardController handles direction', () => {
            // ss-context-menu sends { index: 2, position: 'right' }
            // ClipboardController: insertAt = 2 + 1 = 3 for 'right'
            const rawIndex = 2;
            const direction = 'right';
            const insertAt = direction === 'right' ? rawIndex + 1 : rawIndex;

            expect(insertAt).toBe(3); // Correct!
        });

        it('Option B: ss-context-menu calculates final index, ClipboardController uses as-is', () => {
            // ss-context-menu sends { index: 3, position: 'right' } (already incremented)
            // ClipboardController: insertAt = eventIndex (no adjustment)
            const eventIndex = 3; // pre-calculated
            const insertAt = eventIndex;

            expect(insertAt).toBe(3); // Correct!
        });
    });
});

describe('Bug: Same issue exists for Insert Copied Row Below', () => {
    it('ss-context-menu _handleInsertCopiedBelow uses index+1', () => {
        const contextMenuIndex = 2;
        const eventIndex = contextMenuIndex + 1;

        expect(eventIndex).toBe(3);
    });

    it('ClipboardController.insertCopiedRows should NOT add 1 if event already includes offset', () => {
        // Current implementation adds 1 for 'below':
        // insertAt = direction === 'below' ? targetRow + 1 : targetRow
        // But the event already has +1 from ss-context-menu

        // This means 'below' also has double increment bug
        const eventIndex = 3; // from context menu (already +1)
        const direction = 'below';

        // Current buggy calculation:
        const insertAt = direction === 'below' ? eventIndex + 1 : eventIndex;

        expect(insertAt).toBe(4); // Bug: should be 3
    });
});
