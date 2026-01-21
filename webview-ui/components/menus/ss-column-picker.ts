import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { t } from '../../utils/i18n';

/**
 * Horizontal column picker with drag-to-select functionality.
 * Columns are displayed as chips in a horizontal layout matching spreadsheet headers.
 *
 * Events:
 * - ss-column-selection-change: { columns: string[] }
 */
@customElement('ss-column-picker')
export class SSColumnPicker extends LitElement {
    static styles = css`
        :host {
            display: block;
        }

        .column-container {
            display: flex;
            flex-wrap: wrap;
            user-select: none;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            overflow: hidden;
        }

        .column-chip {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 8px 16px;
            background: var(--vscode-editor-background);
            border-right: 1px solid var(--vscode-panel-border);
            border-bottom: 1px solid var(--vscode-panel-border);
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            transition:
                background-color 0.15s ease,
                color 0.15s ease;
            white-space: nowrap;
            min-width: 60px;
            box-sizing: border-box;
        }

        .column-chip:hover {
            background: var(--vscode-list-hoverBackground);
        }

        .column-chip.selected {
            background: var(--vscode-list-activeSelectionBackground);
            color: var(--vscode-list-activeSelectionForeground);
        }

        .column-chip.selected:hover {
            background: var(--vscode-list-activeSelectionBackground);
            opacity: 0.9;
        }

        .hint {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            margin-top: 8px;
            font-style: italic;
        }
    `;

    @property({ type: Array }) columns: string[] = [];
    @property({ type: Array }) selected: string[] = [];

    @state() private _isDragging = false;
    @state() private _dragStartColumn: string | null = null;
    @state() private _dragMode: 'select' | 'deselect' = 'select';

    private _handleMouseDown(col: string, e: MouseEvent) {
        e.preventDefault();
        this._isDragging = true;
        this._dragStartColumn = col;

        // Determine mode based on initial state
        const isSelected = this.selected.includes(col);
        this._dragMode = isSelected ? 'deselect' : 'select';

        // Toggle this column
        this._toggleColumn(col);

        // Add global listeners
        document.addEventListener('mouseup', this._handleMouseUp);
        document.addEventListener('mouseleave', this._handleMouseUp);
    }

    private _handleMouseEnter(col: string) {
        if (!this._isDragging) return;

        const isSelected = this.selected.includes(col);

        if (this._dragMode === 'select' && !isSelected) {
            this._selectColumn(col);
        } else if (this._dragMode === 'deselect' && isSelected) {
            this._deselectColumn(col);
        }
    }

    private _handleMouseUp = () => {
        this._isDragging = false;
        this._dragStartColumn = null;
        document.removeEventListener('mouseup', this._handleMouseUp);
        document.removeEventListener('mouseleave', this._handleMouseUp);
    };

    private _toggleColumn(col: string) {
        const isSelected = this.selected.includes(col);
        if (isSelected) {
            this._deselectColumn(col);
        } else {
            this._selectColumn(col);
        }
    }

    private _selectColumn(col: string) {
        if (!this.selected.includes(col)) {
            const newSelected = [...this.selected, col];
            this._emitChange(newSelected);
        }
    }

    private _deselectColumn(col: string) {
        const newSelected = this.selected.filter((c) => c !== col);
        this._emitChange(newSelected);
    }

    private _emitChange(columns: string[]) {
        this.dispatchEvent(
            new CustomEvent('ss-column-selection-change', {
                detail: { columns },
                bubbles: true,
                composed: true
            })
        );
    }

    render() {
        return html`
            <div class="column-container">
                ${this.columns.map(
                    (col) => html`
                        <div
                            class="column-chip ${this.selected.includes(col) ? 'selected' : ''} ${this._isDragging
                                ? 'dragging'
                                : ''}"
                            @mousedown="${(e: MouseEvent) => this._handleMouseDown(col, e)}"
                            @mouseenter="${() => this._handleMouseEnter(col)}"
                        >
                            ${col}
                        </div>
                    `
                )}
            </div>
            <div class="hint">${t('columnPickerHint')}</div>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'ss-column-picker': SSColumnPicker;
    }
}
