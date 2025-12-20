/**
 * Unit tests for EditController
 *
 * Focuses on:
 * - State machine transitions (isEditing, isReplacementMode)
 * - Metadata editing state
 * - Pending value management
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { EditController } from '../../controllers/edit-controller';
import { createMockHost } from './controller-test-helpers';

describe('EditController', () => {
    let host: ReturnType<typeof createMockHost>;
    let editCtrl: EditController;

    beforeEach(() => {
        host = createMockHost();
        editCtrl = new EditController(host);
    });

    describe('startEditing', () => {
        it('should enter editing mode with replacement', () => {
            editCtrl.startEditing('test', true);

            expect(editCtrl.isEditing).toBe(true);
            expect(editCtrl.pendingEditValue).toBe('test');
            expect(editCtrl.isReplacementMode).toBe(true);
            expect(host.requestUpdate).toHaveBeenCalled();
        });

        it('should enter editing mode with append (no replacement)', () => {
            editCtrl.startEditing('test', false);

            expect(editCtrl.isEditing).toBe(true);
            expect(editCtrl.pendingEditValue).toBe('test');
            expect(editCtrl.isReplacementMode).toBe(false);
        });

        it('should handle null initial value', () => {
            editCtrl.startEditing(null, false);

            expect(editCtrl.isEditing).toBe(true);
            expect(editCtrl.pendingEditValue).toBe('');
            expect(editCtrl.isReplacementMode).toBe(false);
        });

        it('should handle undefined initial value', () => {
            editCtrl.startEditing(undefined, false);

            expect(editCtrl.isEditing).toBe(true);
            expect(editCtrl.pendingEditValue).toBe('');
        });

        it('should default to non-replacement mode when not specified', () => {
            editCtrl.startEditing('test');

            expect(editCtrl.isReplacementMode).toBe(false);
        });
    });

    describe('cancelEditing', () => {
        it('should reset all editing state', () => {
            // Setup editing state
            editCtrl.startEditing('test', true);
            editCtrl.editingMetadata = true;
            editCtrl.hasUserInsertedNewline = true;

            // Cancel
            editCtrl.cancelEditing();

            expect(editCtrl.isEditing).toBe(false);
            expect(editCtrl.editingMetadata).toBe(false);
            expect(editCtrl.pendingEditValue).toBeNull();
            expect(editCtrl.isReplacementMode).toBe(false);
            expect(editCtrl.hasUserInsertedNewline).toBe(false);
            expect(host.requestUpdate).toHaveBeenCalled();
        });

        it('should be idempotent (safe to call multiple times)', () => {
            editCtrl.startEditing('test', true);
            editCtrl.cancelEditing();
            editCtrl.cancelEditing(); // Second call

            expect(editCtrl.isEditing).toBe(false);
        });
    });

    describe('setPendingValue', () => {
        it('should update pending edit value', () => {
            editCtrl.setPendingValue('new value');

            expect(editCtrl.pendingEditValue).toBe('new value');
        });

        it('should allow empty string', () => {
            editCtrl.setPendingValue('');

            expect(editCtrl.pendingEditValue).toBe('');
        });
    });

    describe('state transitions', () => {
        it('should transition from not editing -> editing -> not editing', () => {
            expect(editCtrl.isEditing).toBe(false);

            editCtrl.startEditing('a');
            expect(editCtrl.isEditing).toBe(true);

            editCtrl.cancelEditing();
            expect(editCtrl.isEditing).toBe(false);
        });

        it('should maintain pendingEditValue during editing', () => {
            editCtrl.startEditing('initial');
            expect(editCtrl.pendingEditValue).toBe('initial');

            editCtrl.setPendingValue('updated');
            expect(editCtrl.pendingEditValue).toBe('updated');
        });

        it('should clear pendingEditValue on cancel', () => {
            editCtrl.startEditing('test');
            editCtrl.setPendingValue('updated');
            editCtrl.cancelEditing();

            expect(editCtrl.pendingEditValue).toBeNull();
        });
    });

    describe('metadata editing', () => {
        it('should track metadata editing state separately', () => {
            editCtrl.editingMetadata = true;

            expect(editCtrl.editingMetadata).toBe(true);
            expect(editCtrl.isEditing).toBe(false); // Independent
        });

        it('should clear metadata editing on cancel', () => {
            editCtrl.editingMetadata = true;
            editCtrl.cancelEditing();

            expect(editCtrl.editingMetadata).toBe(false);
        });
    });

    describe('newline tracking', () => {
        it('should track user-inserted newlines', () => {
            editCtrl.hasUserInsertedNewline = true;

            expect(editCtrl.hasUserInsertedNewline).toBe(true);
        });

        it('should reset newline flag on cancel', () => {
            editCtrl.hasUserInsertedNewline = true;
            editCtrl.cancelEditing();

            expect(editCtrl.hasUserInsertedNewline).toBe(false);
        });
    });
});
