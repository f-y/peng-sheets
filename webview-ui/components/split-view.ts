import { html, LitElement, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SplitNode, TableJSON, WorkbookJSON } from '../types';
import splitViewStyles from './styles/split-view.css?inline';
import './pane-view';

@customElement('split-view')
export class SplitView extends LitElement {
    static styles = unsafeCSS(splitViewStyles);

    @property({ type: Object })
    node!: SplitNode;

    @property({ type: Array })
    tables: TableJSON[] = [];

    @property({ type: Number })
    sheetIndex: number = 0;

    @property({ type: String })
    dateFormat: string = 'YYYY-MM-DD';

    @property({ type: Object })
    workbook: WorkbookJSON | null = null;

    // Resizing state
    private _isResizing = false;
    private _dragStartIndex = -1;
    private _startX = 0;
    private _startY = 0;
    private _startSizes: number[] = [];
    private _resizeFrame: number | null = null;
    private _tempSizes: number[] | null = null; // Local optimistically updated sizes

    disconnectedCallback() {
        super.disconnectedCallback();
        this._stopResize();
    }

    render() {
        if (!this.node) return html``;
        this.setAttribute('direction', this.node.direction);

        const sizes = this._tempSizes || this.node.sizes;
        // Normalize sizes if missing or incorrect length
        const displaySizes = this._normalizeSizes(sizes, this.node.children.length);

        return html`
            ${this.node.children.map((child, index) => {
                const size = displaySizes[index];
                const style = `flex: ${size} 1 0%;`; // simple flex basis

                // Render Resizer if not first
                const resizer =
                    index > 0
                        ? html`<div
                              class="resizer"
                              @mousedown="${(e: MouseEvent) => this._startResize(e, index)}"
                          ></div>`
                        : html``;

                const content =
                    child.type === 'split'
                        ? html`<split-view
                              .node="${child}"
                              .tables="${this.tables}"
                              .sheetIndex="${this.sheetIndex}"
                              .dateFormat="${this.dateFormat}"
                              .workbook="${this.workbook}"
                          ></split-view>`
                        : html`<pane-view
                              .node="${child}"
                              .tables="${this.tables}"
                              .sheetIndex="${this.sheetIndex}"
                              .dateFormat="${this.dateFormat}"
                              .workbook="${this.workbook}"
                          ></pane-view>`;

                return html`${resizer}
                    <div class="child-wrapper" style="${style}">${content}</div>`;
            })}
        `;
    }

    private _normalizeSizes(sizes: number[], count: number): number[] {
        if (!sizes || sizes.length !== count) {
            return Array(count).fill(100 / count);
        }
        return sizes;
    }

    private _startResize(e: MouseEvent, index: number) {
        e.preventDefault();
        this._isResizing = true;
        this._dragStartIndex = index; // The resizer is BEFORE this element. So we are resizing element [index-1] vs [index].
        this._startX = e.clientX;
        this._startY = e.clientY;

        const currentSizes =
            this._tempSizes ||
            this.node.sizes ||
            Array(this.node.children.length).fill(100 / this.node.children.length);
        this._startSizes = [...currentSizes];

        window.addEventListener('mousemove', this._handleMouseMove);
        window.addEventListener('mouseup', this._handleMouseUp);
        document.body.style.cursor = this.node.direction === 'horizontal' ? 'col-resize' : 'row-resize';
    }

    private _handleDragOver = (_e: DragEvent) => {
        if (!this._isResizing) return;
        if (this._resizeFrame) cancelAnimationFrame(this._resizeFrame);

        this._resizeFrame = requestAnimationFrame(() => {
            // The original instruction had `e.clientX` here, but the parameter was `_e`.
            // Assuming the intent was to use the event object passed to the handler,
            // and that this method is intended to be a drag handler, we use `_e`.
            // If this was meant to replace `_handleMouseMove`, the event type should be `MouseEvent`.
            // Given the instruction "Fix unused variable warning" and the `_e` parameter,
            // we'll assume `_e` is the intended event object to use.
            const dx = _e.clientX - this._startX;
            const dy = _e.clientY - this._startY;
            const deltaPx = this.node.direction === 'horizontal' ? dx : dy;

            // Convert pixels to percentage logic
            const rect = this.getBoundingClientRect();
            const totalSize = this.node.direction === 'horizontal' ? rect.width : rect.height;
            if (totalSize === 0) return;

            const deltaPercent = (deltaPx / totalSize) * 100;

            const leftIndex = this._dragStartIndex - 1;
            const rightIndex = this._dragStartIndex;

            const newSizes = [...this._startSizes];
            // Adjust sizes
            newSizes[leftIndex] = Math.max(5, this._startSizes[leftIndex] + deltaPercent); // Min 5%
            newSizes[rightIndex] = Math.max(5, this._startSizes[rightIndex] - deltaPercent);

            // Re-normalize if clamping happened?
            // Better to simpler clamp delta so neither goes below 5.

            this._tempSizes = newSizes;
            this.requestUpdate();
        });
    };

    private _handleMouseMove = (e: MouseEvent) => {
        if (!this._isResizing) return;
        if (this._resizeFrame) cancelAnimationFrame(this._resizeFrame);

        this._resizeFrame = requestAnimationFrame(() => {
            const dx = e.clientX - this._startX;
            const dy = e.clientY - this._startY;
            const deltaPx = this.node.direction === 'horizontal' ? dx : dy;

            // Convert pixels to percentage logic
            const rect = this.getBoundingClientRect();
            const totalSize = this.node.direction === 'horizontal' ? rect.width : rect.height;
            if (totalSize === 0) return;

            const deltaPercent = (deltaPx / totalSize) * 100;

            const leftIndex = this._dragStartIndex - 1;
            const rightIndex = this._dragStartIndex;

            const newSizes = [...this._startSizes];
            // Adjust sizes
            newSizes[leftIndex] = Math.max(5, this._startSizes[leftIndex] + deltaPercent); // Min 5%
            newSizes[rightIndex] = Math.max(5, this._startSizes[rightIndex] - deltaPercent);

            // Re-normalize if clamping happened?
            // Better to simpler clamp delta so neither goes below 5.

            this._tempSizes = newSizes;
            this.requestUpdate();
        });
    };

    private _handleMouseUp = (_e: MouseEvent) => {
        if (!this._isResizing) return;

        const finalSizes = this._tempSizes;
        this._stopResize();

        // Dispatch update
        if (finalSizes && this.node.id) {
            this.dispatchEvent(
                new CustomEvent('pane-action', {
                    detail: {
                        type: 'resize-split',
                        nodeId: this.node.id,
                        newSizes: finalSizes
                    },
                    bubbles: true,
                    composed: true
                })
            );
        }
    };

    private _stopResize() {
        this._isResizing = false;
        this._resizeFrame = null;
        window.removeEventListener('mousemove', this._handleMouseMove);
        window.removeEventListener('mouseup', this._handleMouseUp);
        document.body.style.cursor = '';
        // Note: we don't clear _tempSizes immediately to prevent flicker until persist comes back?
        // Actually LayoutContainer will update 'node' prop, which will override _tempSizes if we logic correctly.
        // Or we should clear it?
        // LayoutContainer updates 'node'. render() uses _tempSizes || node.sizes.
        // We should clear _tempSizes once we finish drag?
        // If we clear it, it jumps back to old size until parent updates.
        // Optimistic UI means we keep it or rely on parent being fast.
        // LayoutContainer updates _currentLayout immediately, so prop update is immediate.
        this._tempSizes = null;
    }
}
