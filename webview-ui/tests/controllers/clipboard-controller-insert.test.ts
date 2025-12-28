/**
 * Test suite for ClipboardController insert copied rows/columns functionality
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Simple mock for SelectionController
function createMockSelectionController() {
    return {
        selectedRow: 0,
        selectedCol: 0,
        selectionAnchorRow: 0,
        selectionAnchorCol: 0,
        isRowSelection: () => false,
        isColumnSelection: () => false
    };
}

// Simple mock for EditController
function createMockEditController() {
    return {
        isEditing: false,
        isReplacementMode: false
    };
}

// Create mock host for ClipboardController
function createMockHost(overrides = {}) {
    const dispatchedEvents: CustomEvent[] = [];
    return {
        table: {
            headers: ['Col A', 'Col B', 'Col C'],
            rows: [
                ['A1', 'B1', 'C1'],
                ['A2', 'B2', 'C2'],
                ['A3', 'B3', 'C3']
            ]
        },
        sheetIndex: 0,
        tableIndex: 0,
        selectionCtrl: createMockSelectionController(),
        editCtrl: createMockEditController(),
        dispatchEvent: (event: CustomEvent) => {
            dispatchedEvents.push(event);
            return true;
        },
        requestUpdate: vi.fn(),
        addController: vi.fn(),
        removeController: vi.fn(),
        updateComplete: Promise.resolve(true),
        // Helper to access dispatched events in tests
        _dispatchedEvents: dispatchedEvents,
        ...overrides
    };
}

// Import after mocks are set up
import { ClipboardController } from '../../controllers/clipboard-controller';

describe('ClipboardController - Insert Copied Rows', () => {
    let host: ReturnType<typeof createMockHost>;
    let controller: ClipboardController;

    beforeEach(() => {
        host = createMockHost();
        controller = new ClipboardController(host as any);
    });

    describe('insertCopiedRows', () => {
        it('should not dispatch event when no rows are copied', () => {
            controller.insertCopiedRows(1, 'above');
            expect(host._dispatchedEvents.length).toBe(0);
        });

        it('should not dispatch event when copyType is not "rows"', () => {
            // Set up copied data with wrong type
            controller.copiedData = [['A1', 'B1']];
            controller.copyType = 'cells'; // Not 'rows'

            controller.insertCopiedRows(1, 'above');
            expect(host._dispatchedEvents.length).toBe(0);
        });

        it('should dispatch rows-insert-at event with correct detail for "above" direction', () => {
            // Set up copied rows
            controller.copiedData = [
                ['Row1-A', 'Row1-B'],
                ['Row2-A', 'Row2-B']
            ];
            controller.copyType = 'rows';

            controller.insertCopiedRows(2, 'above');

            expect(host._dispatchedEvents.length).toBe(1);
            const event = host._dispatchedEvents[0];
            expect(event.type).toBe('rows-insert-at');
            expect(event.detail).toEqual({
                sheetIndex: 0,
                tableIndex: 0,
                targetRow: 2, // Same as input for 'above'
                rowsData: [
                    ['Row1-A', 'Row1-B'],
                    ['Row2-A', 'Row2-B']
                ]
            });
        });

        it('should dispatch rows-insert-at event with targetRow + 1 for "below" direction', () => {
            controller.copiedData = [['A', 'B']];
            controller.copyType = 'rows';

            controller.insertCopiedRows(2, 'below');

            expect(host._dispatchedEvents.length).toBe(1);
            const event = host._dispatchedEvents[0];
            expect(event.detail.targetRow).toBe(3); // 2 + 1 for 'below'
        });

        it('should include current sheetIndex and tableIndex in event', () => {
            host.sheetIndex = 2;
            host.tableIndex = 3;
            controller.copiedData = [['A', 'B']];
            controller.copyType = 'rows';

            controller.insertCopiedRows(0, 'above');

            const event = host._dispatchedEvents[0];
            expect(event.detail.sheetIndex).toBe(2);
            expect(event.detail.tableIndex).toBe(3);
        });
    });
});

describe('ClipboardController - Insert Copied Columns', () => {
    let host: ReturnType<typeof createMockHost>;
    let controller: ClipboardController;

    beforeEach(() => {
        host = createMockHost();
        controller = new ClipboardController(host as any);
    });

    describe('insertCopiedColumns', () => {
        it('should not dispatch event when no columns are copied', () => {
            controller.insertCopiedColumns(1, 'left');
            expect(host._dispatchedEvents.length).toBe(0);
        });

        it('should not dispatch event when copyType is not "columns"', () => {
            controller.copiedData = [['A1'], ['A2']];
            controller.copyType = 'cells';

            controller.insertCopiedColumns(1, 'left');
            expect(host._dispatchedEvents.length).toBe(0);
        });

        it('should dispatch columns-insert-at event with correct detail for "left" direction', () => {
            // Copied columns data in row-major format (2 rows, 2 columns)
            controller.copiedData = [
                ['Col1-R1', 'Col2-R1'],
                ['Col1-R2', 'Col2-R2']
            ];
            controller.copyType = 'columns';

            controller.insertCopiedColumns(2, 'left');

            expect(host._dispatchedEvents.length).toBe(1);
            const event = host._dispatchedEvents[0];
            expect(event.type).toBe('columns-insert-at');
            expect(event.detail.targetCol).toBe(2); // Same as input for 'left'
            expect(event.detail.sheetIndex).toBe(0);
            expect(event.detail.tableIndex).toBe(0);
            // columnsData should be transposed to column-major format
            expect(event.detail.columnsData).toEqual([
                ['Col1-R1', 'Col1-R2'], // First column
                ['Col2-R1', 'Col2-R2'] // Second column
            ]);
        });

        it('should dispatch columns-insert-at event with targetCol + 1 for "right" direction', () => {
            controller.copiedData = [['A'], ['B']];
            controller.copyType = 'columns';

            controller.insertCopiedColumns(2, 'right');

            expect(host._dispatchedEvents.length).toBe(1);
            const event = host._dispatchedEvents[0];
            expect(event.detail.targetCol).toBe(3); // 2 + 1 for 'right'
        });

        it('should handle single column correctly', () => {
            controller.copiedData = [['A1'], ['A2'], ['A3']];
            controller.copyType = 'columns';

            controller.insertCopiedColumns(0, 'left');

            const event = host._dispatchedEvents[0];
            expect(event.detail.columnsData).toEqual([['A1', 'A2', 'A3']]);
        });

        it('should handle empty data gracefully', () => {
            controller.copiedData = [];
            controller.copyType = 'columns';

            controller.insertCopiedColumns(0, 'left');

            const event = host._dispatchedEvents[0];
            expect(event.detail.columnsData).toEqual([]);
        });
    });
});

describe('ClipboardController - copiedData and copyType state', () => {
    let host: ReturnType<typeof createMockHost>;
    let controller: ClipboardController;

    beforeEach(() => {
        host = createMockHost();
        controller = new ClipboardController(host as any);
    });

    it('should have null copiedData and copyType initially', () => {
        expect(controller.copiedData).toBeNull();
        expect(controller.copyType).toBeNull();
    });

    it('should clear copiedData and copyType when clearCopiedRange is called', () => {
        controller.copiedData = [['A', 'B']];
        controller.copyType = 'rows';
        controller.copiedRange = {
            sheetIndex: 0,
            tableIndex: 0,
            startRow: 0,
            endRow: 0,
            startCol: 0,
            endCol: 1
        };

        controller.clearCopiedRange();

        expect(controller.copiedData).toBeNull();
        expect(controller.copyType).toBeNull();
        expect(controller.copiedRange).toBeNull();
    });
});
