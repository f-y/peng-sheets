import { ReactiveController, ReactiveControllerHost } from 'lit';

export interface TabDragConfig {
    /** Minimum distance in px before drag starts */
    dragThreshold?: number;
    /** Callback when drag starts */
    onDragStart?: (index: number) => void;
    /** Callback during drag with current drop target info */
    onDragOver?: (targetIndex: number, side: 'left' | 'right') => void;
    /** Callback when drag leaves valid drop area */
    onDragLeave?: () => void;
    /** Callback when drag ends (drop or cancel) */
    onDragEnd?: (fromIndex: number, toIndex: number | null) => void;
}

/**
 * TabDragController - Mouse-based drag-and-drop for tabs
 *
 * Uses mouse events instead of HTML5 Drag-and-Drop API to maintain
 * drag state even when cursor leaves the webview boundary.
 */
export class TabDragController implements ReactiveController {
    private host: ReactiveControllerHost;
    private config: TabDragConfig;

    // Drag state
    private _isDragging = false;
    private _dragSourceIndex: number | null = null;
    private _dragStartX = 0;
    private _dragStartY = 0;
    private _currentTargetIndex: number | null = null;
    private _currentTargetSide: 'left' | 'right' | null = null;
    private _dragThreshold: number;

    // Bound handlers for cleanup
    private _boundMouseMove: (e: MouseEvent) => void;
    private _boundMouseUp: (e: MouseEvent) => void;
    private _boundKeyDown: (e: KeyboardEvent) => void;

    constructor(host: ReactiveControllerHost, config: TabDragConfig = {}) {
        this.host = host;
        this.config = config;
        this._dragThreshold = config.dragThreshold ?? 5;
        host.addController(this);

        this._boundMouseMove = this._handleMouseMove.bind(this);
        this._boundMouseUp = this._handleMouseUp.bind(this);
        this._boundKeyDown = this._handleKeyDown.bind(this);
    }

    hostConnected() {}

    hostDisconnected() {
        this._cleanup();
    }

    // Public getters for host to read state
    get isDragging(): boolean {
        return this._isDragging;
    }

    get dragSourceIndex(): number | null {
        return this._dragSourceIndex;
    }

    get targetIndex(): number | null {
        return this._currentTargetIndex;
    }

    get targetSide(): 'left' | 'right' | null {
        return this._currentTargetSide;
    }

    /**
     * Called by host on mousedown on a draggable tab
     */
    startPotentialDrag(e: MouseEvent, index: number) {
        // Only respond to left mouse button
        if (e.button !== 0) return;

        e.preventDefault();
        this._dragSourceIndex = index;
        this._dragStartX = e.clientX;
        this._dragStartY = e.clientY;

        // Add global listeners
        window.addEventListener('mousemove', this._boundMouseMove);
        window.addEventListener('mouseup', this._boundMouseUp);
        window.addEventListener('keydown', this._boundKeyDown);

        console.log('[TabDragController] potential drag started', { index });
    }

    /**
     * Called by host during mousemove over a potential drop target
     */
    updateDropTarget(index: number, element: HTMLElement, clientX: number) {
        if (!this._isDragging) return;

        const rect = element.getBoundingClientRect();
        const mid = rect.left + rect.width / 2;
        const side: 'left' | 'right' = clientX < mid ? 'left' : 'right';

        if (this._currentTargetIndex !== index || this._currentTargetSide !== side) {
            this._currentTargetIndex = index;
            this._currentTargetSide = side;
            this.config.onDragOver?.(index, side);
            this.host.requestUpdate();
            console.log('[TabDragController] dropTarget updated', { index, side });
        }
    }

    /**
     * Called by host when mouse leaves valid drop area
     */
    clearDropTarget() {
        if (this._currentTargetIndex !== null) {
            this._currentTargetIndex = null;
            this._currentTargetSide = null;
            this.config.onDragLeave?.();
            this.host.requestUpdate();
            console.log('[TabDragController] dropTarget cleared');
        }
    }

    private _handleMouseMove(e: MouseEvent) {
        if (this._dragSourceIndex === null) return;

        // Check if we've passed the drag threshold
        if (!this._isDragging) {
            const dx = Math.abs(e.clientX - this._dragStartX);
            const dy = Math.abs(e.clientY - this._dragStartY);
            if (dx > this._dragThreshold || dy > this._dragThreshold) {
                this._isDragging = true;
                this.config.onDragStart?.(this._dragSourceIndex);
                this.host.requestUpdate();
                console.log('[TabDragController] drag started', { sourceIndex: this._dragSourceIndex });
            }
        }

        // Host needs to handle the actual target detection via updateDropTarget
        // This is called from the mousemove handler on the host element
    }

    private _handleMouseUp(_e: MouseEvent) {
        console.log('[TabDragController] mouseup', {
            isDragging: this._isDragging,
            sourceIndex: this._dragSourceIndex,
            targetIndex: this._currentTargetIndex,
            targetSide: this._currentTargetSide
        });

        if (this._isDragging && this._dragSourceIndex !== null) {
            let toIndex: number | null = null;

            if (this._currentTargetIndex !== null && this._currentTargetSide !== null) {
                toIndex = this._currentTargetSide === 'left' ? this._currentTargetIndex : this._currentTargetIndex + 1;
                // Note: Do NOT adjust for source position here.
                // The calling code (main.ts / spreadsheetService) already handles this.
            }

            this.config.onDragEnd?.(this._dragSourceIndex, toIndex);
        }

        this._cleanup();
        this.host.requestUpdate();
    }

    private _handleKeyDown(e: KeyboardEvent) {
        // Cancel drag on Escape
        if (e.key === 'Escape') {
            console.log('[TabDragController] drag cancelled by Escape');
            this._cleanup();
            this.host.requestUpdate();
        }
    }

    private _cleanup() {
        this._isDragging = false;
        this._dragSourceIndex = null;
        this._currentTargetIndex = null;
        this._currentTargetSide = null;

        window.removeEventListener('mousemove', this._boundMouseMove);
        window.removeEventListener('mouseup', this._boundMouseUp);
        window.removeEventListener('keydown', this._boundKeyDown);
    }
}
