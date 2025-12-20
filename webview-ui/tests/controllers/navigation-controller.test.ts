/**
 * Unit tests for NavigationController
 *
 * Focuses on:
 * - Arrow key navigation
 * - Tab/Enter navigation with wrapping
 * - Boundary checking
 * - Shift-key extension behavior
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NavigationController } from '../../controllers/navigation-controller';
import { SelectionController } from '../../controllers/selection-controller';
import { createMockHost } from './controller-test-helpers';

describe('NavigationController', () => {
    let host: ReturnType<typeof createMockHost>;
    let selectionCtrl: SelectionController;
    let navCtrl: NavigationController;

    beforeEach(() => {
        host = createMockHost();
        selectionCtrl = new SelectionController(host);
        navCtrl = new NavigationController(host, selectionCtrl);

        // Mock getNextVisibleRowIndex (used for row filtering)
        (host as any).getNextVisibleRowIndex = vi.fn((currentRow, direction) => {
            return currentRow + direction;
        });
    });

    describe('handleKeyDown - Arrow keys', () => {
        it('should move down on ArrowDown', () => {
            selectionCtrl.selectCell(2, 3);

            const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });
            const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

            navCtrl.handleKeyDown(event, 10, 10);

            expect(selectionCtrl.selectedRow).toBe(3);
            expect(selectionCtrl.selectedCol).toBe(3);
            expect(preventDefaultSpy).toHaveBeenCalled();
        });

        it('should move up on ArrowUp', () => {
            selectionCtrl.selectCell(2, 3);

            const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });
            navCtrl.handleKeyDown(event, 10, 10);

            expect(selectionCtrl.selectedRow).toBe(1);
            expect(selectionCtrl.selectedCol).toBe(3);
        });

        it('should move right on ArrowRight', () => {
            selectionCtrl.selectCell(2, 3);

            const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });
            navCtrl.handleKeyDown(event, 10, 10);

            expect(selectionCtrl.selectedRow).toBe(2);
            expect(selectionCtrl.selectedCol).toBe(4);
        });

        it('should move left on ArrowLeft', () => {
            selectionCtrl.selectCell(2, 3);

            const event = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
            navCtrl.handleKeyDown(event, 10, 10);

            expect(selectionCtrl.selectedRow).toBe(2);
            expect(selectionCtrl.selectedCol).toBe(2);
        });

        it('should not move beyond bottom boundary', () => {
            selectionCtrl.selectCell(9, 5); // Last row (0-indexed, maxRows=10)

            const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });
            navCtrl.handleKeyDown(event, 10, 10);

            expect(selectionCtrl.selectedRow).toBe(9); // Clamped
        });

        it('should not move beyond right boundary', () => {
            selectionCtrl.selectCell(5, 9); // Last column

            const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });
            navCtrl.handleKeyDown(event, 10, 10);

            expect(selectionCtrl.selectedCol).toBe(9); // Clamped
        });

        it('should not move beyond left boundary', () => {
            selectionCtrl.selectCell(5, 0);

            const event = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
            navCtrl.handleKeyDown(event, 10, 10);

            expect(selectionCtrl.selectedCol).toBe(0); // Clamped
        });

        it('should not move beyond top boundary', () => {
            selectionCtrl.selectCell(0, 5);

            const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });
            navCtrl.handleKeyDown(event, 10, 10);

            expect(selectionCtrl.selectedRow).toBe(0); // Clamped
        });
    });

    describe('handleKeyDown - Shift+Arrow (extend selection)', () => {
        it('should extend selection downward with Shift+ArrowDown', () => {
            selectionCtrl.selectCell(2, 3);
            const selectCellSpy = vi.spyOn(selectionCtrl, 'selectCell');

            const event = new KeyboardEvent('keydown', { key: 'ArrowDown', shiftKey: true });
            navCtrl.handleKeyDown(event, 10, 10);

            // Should call selectCell with extend=true
            expect(selectCellSpy).toHaveBeenCalledWith(3, 3, true);
        });

        it('should extend selection without shift being false', () => {
            selectionCtrl.selectCell(2, 3);
            const selectCellSpy = vi.spyOn(selectionCtrl, 'selectCell');

            const event = new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: false });
            navCtrl.handleKeyDown(event, 10, 10);

            // Should call selectCell with extend=false
            expect(selectCellSpy).toHaveBeenCalledWith(2, 4, false);
        });
    });

    describe('handleKeyDown - Tab', () => {
        it('should move right on Tab', () => {
            selectionCtrl.selectCell(2, 3);
            const selectCellSpy = vi.spyOn(selectionCtrl, 'selectCell');

            const event = new KeyboardEvent('keydown', { key: 'Tab' });
            const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

            navCtrl.handleKeyDown(event, 10, 10);

            expect(selectCellSpy).toHaveBeenCalledWith(2, 4, false); // extend=false for Tab
            expect(preventDefaultSpy).toHaveBeenCalled();
        });

        it('should move left on Shift+Tab', () => {
            selectionCtrl.selectCell(2, 3);
            const selectCellSpy = vi.spyOn(selectionCtrl, 'selectCell');

            const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true });
            navCtrl.handleKeyDown(event, 10, 10);

            expect(selectCellSpy).toHaveBeenCalledWith(2, 2, false); // extend=false
        });
    });

    describe('handleKeyDown - Enter', () => {
        it('should move down on Enter', () => {
            selectionCtrl.selectCell(2, 3);
            const selectCellSpy = vi.spyOn(selectionCtrl, 'selectCell');

            const event = new KeyboardEvent('keydown', { key: 'Enter' });
            const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

            navCtrl.handleKeyDown(event, 10, 10);

            expect(selectCellSpy).toHaveBeenCalledWith(3, 3, false);
            expect(preventDefaultSpy).toHaveBeenCalled();
        });

        it('should move up on Shift+Enter', () => {
            selectionCtrl.selectCell(2, 3);
            const selectCellSpy = vi.spyOn(selectionCtrl, 'selectCell');

            const event = new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true });
            navCtrl.handleKeyDown(event, 10, 10);

            expect(selectCellSpy).toHaveBeenCalledWith(1, 3, false);
        });
    });

    describe('handleKeyDown - non-navigation keys', () => {
        it('should ignore non-navigation keys', () => {
            selectionCtrl.selectCell(2, 3);
            const selectCellSpy = vi.spyOn(selectionCtrl, 'selectCell');

            const event = new KeyboardEvent('keydown', { key: 'a' });
            const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

            navCtrl.handleKeyDown(event, 10, 10);

            expect(selectCellSpy).not.toHaveBeenCalled();
            expect(preventDefaultSpy).not.toHaveBeenCalled();
        });
    });

    describe('handleTabWrap', () => {
        it('should wrap to next row on Tab at last column', () => {
            selectionCtrl.selectCell(2, 4); // Last column (colCount=5)

            navCtrl.handleTabWrap(false, 5);

            expect(selectionCtrl.selectedRow).toBe(3);
            expect(selectionCtrl.selectedCol).toBe(0);
        });

        it('should not wrap Tab in middle of row', () => {
            selectionCtrl.selectCell(2, 2);

            navCtrl.handleTabWrap(false, 5);

            expect(selectionCtrl.selectedRow).toBe(2);
            expect(selectionCtrl.selectedCol).toBe(3);
        });

        it('should wrap to previous row on Shift+Tab at column 0', () => {
            selectionCtrl.selectCell(2, 0);

            navCtrl.handleTabWrap(true, 5);

            expect(selectionCtrl.selectedRow).toBe(1);
            expect(selectionCtrl.selectedCol).toBe(4); // Last column
        });

        it('should not wrap Shift+Tab in middle of row', () => {
            selectionCtrl.selectCell(2, 3);

            navCtrl.handleTabWrap(true, 5);

            expect(selectionCtrl.selectedRow).toBe(2);
            expect(selectionCtrl.selectedCol).toBe(2);
        });

        it('should clamp Shift+Tab at row -1 (header)', () => {
            selectionCtrl.selectCell(-1, 0);

            navCtrl.handleTabWrap(true, 5);

            expect(selectionCtrl.selectedRow).toBe(-1); // Clamped
            expect(selectionCtrl.selectedCol).toBe(4);
        });

        it('should return true when handled', () => {
            selectionCtrl.selectCell(2, 2);

            const result = navCtrl.handleTabWrap(false, 5);

            expect(result).toBe(true);
        });
    });

    describe('edge cases', () => {
        it('should handle single-cell table (1x1)', () => {
            selectionCtrl.selectCell(0, 0);

            const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });
            navCtrl.handleKeyDown(event, 1, 1);

            expect(selectionCtrl.selectedRow).toBe(0); // Clamped
        });

        it('should handle very large tables', () => {
            selectionCtrl.selectCell(999, 99);

            const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });
            navCtrl.handleKeyDown(event, 1000, 100);

            expect(selectionCtrl.selectedCol).toBe(99); // Clamped to max
        });
    });
});
