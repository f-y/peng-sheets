import { LitElement, html, css } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import { t } from '../../utils/i18n';

/**
 * Expression builder component with calculator-style input.
 * Users can click column name buttons and operator buttons to build expressions.
 *
 * Events:
 * - ss-expression-change: { expression: string }
 */
@customElement('ss-expression-builder')
export class SSExpressionBuilder extends LitElement {
    static styles = css`
        :host {
            display: block;
        }

        .expression-input {
            width: 100%;
            padding: 10px 12px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 6px;
            font-size: 13px;
            font-family: var(--vscode-editor-font-family, monospace);
            box-sizing: border-box;
            transition: border-color 0.2s ease;
            margin-bottom: 12px;
        }

        .expression-input:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.5);
        }

        .builder-wrapper {
            padding: 12px 16px;
            border-left: 3px solid var(--vscode-textLink-foreground);
            border-radius: 0 8px 8px 0;
        }

        .builder-header {
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            color: var(--vscode-textLink-foreground);
            margin-bottom: 16px;
        }

        .builder-section {
            margin-top: 10px;
        }

        .builder-section:first-of-type {
            margin-top: 0;
        }

        .section-label {
            font-size: 10px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 6px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .button-row {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
        }

        .column-btn {
            padding: 6px 12px;
            background: var(--vscode-editor-background);
            color: var(--vscode-foreground);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            transition: all 0.15s ease;
        }

        .column-btn:hover {
            background: var(--vscode-list-hoverBackground);
            border-color: var(--vscode-focusBorder);
        }

        .column-btn:active {
            background: var(--vscode-list-activeSelectionBackground);
            color: var(--vscode-list-activeSelectionForeground);
        }

        .operator-btn {
            width: 36px;
            height: 36px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            cursor: pointer;
            font-size: 16px;
            font-weight: 600;
            transition: all 0.15s ease;
        }

        .operator-btn:hover {
            background: var(--vscode-button-secondaryHoverBackground);
            border-color: var(--vscode-focusBorder);
        }

        .operator-btn:active {
            transform: scale(0.95);
        }

        .operator-btn.clear {
            background: var(--vscode-inputValidation-errorBackground);
            color: var(--vscode-inputValidation-errorForeground);
            width: auto;
            padding: 0 12px;
            font-size: 12px;
        }

        .operator-btn.clear:hover {
            opacity: 0.9;
        }
    `;

    @property({ type: Array }) columns: string[] = [];
    @property({ type: String }) expression = '';
    @property({ type: String }) placeholder = '';

    @query('.expression-input') private _inputEl!: HTMLInputElement;

    private _operators = ['+', '-', '*', '/', '(', ')'];

    // Undo/Redo history
    private _undoStack: string[] = [];
    private _redoStack: string[] = [];
    private _lastExpression = '';
    private _boundKeyDown = this._handleKeyDown.bind(this);

    connectedCallback() {
        super.connectedCallback();
        // Initialize history with current expression
        this._lastExpression = this.expression;
        window.addEventListener('keydown', this._boundKeyDown, true);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        window.removeEventListener('keydown', this._boundKeyDown, true);
    }

    private _handleKeyDown(e: KeyboardEvent) {
        const isModifier = e.ctrlKey || e.metaKey;
        const key = e.key.toLowerCase();

        if (isModifier && key === 'z' && !e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            this._undo();
        } else if (isModifier && (key === 'y' || (key === 'z' && e.shiftKey))) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            this._redo();
        }
    }

    private _undo() {
        if (this._undoStack.length === 0) return;
        this._redoStack.push(this._lastExpression);
        const previous = this._undoStack.pop()!;
        this._lastExpression = previous;
        this._emitChange(previous);
    }

    private _redo() {
        if (this._redoStack.length === 0) return;
        this._undoStack.push(this._lastExpression);
        const next = this._redoStack.pop()!;
        this._lastExpression = next;
        this._emitChange(next);
    }

    private _pushHistory(newExpression: string) {
        if (newExpression !== this._lastExpression) {
            this._undoStack.push(this._lastExpression);
            this._redoStack = [];
            this._lastExpression = newExpression;
        }
    }

    private _handleInput(e: Event) {
        const input = e.target as HTMLInputElement;
        this._pushHistory(input.value);
        this._emitChange(input.value);
    }

    private _insertAtCursor(text: string) {
        const input = this._inputEl;
        if (!input) return;

        const start = input.selectionStart ?? this.expression.length;
        const end = input.selectionEnd ?? this.expression.length;
        const before = this.expression.slice(0, start);
        const after = this.expression.slice(end);

        const newExpression = before + text + after;
        this._pushHistory(newExpression);
        this._emitChange(newExpression);

        // Set cursor position after inserted text
        requestAnimationFrame(() => {
            const newPos = start + text.length;
            input.setSelectionRange(newPos, newPos);
            input.focus();
        });
    }

    private _insertColumn(col: string) {
        this._insertAtCursor(`[${col}]`);
    }

    private _insertOperator(op: string) {
        // Add spaces around operators for readability
        const spacedOp = op === '(' || op === ')' ? op : ` ${op} `;
        this._insertAtCursor(spacedOp);
    }

    private _clearExpression() {
        this._pushHistory('');
        this._emitChange('');
        this._inputEl?.focus();
    }

    private _emitChange(expression: string) {
        this.dispatchEvent(
            new CustomEvent('ss-expression-change', {
                detail: { expression },
                bubbles: true,
                composed: true
            })
        );
    }

    render() {
        return html`
            <input
                type="text"
                class="expression-input"
                placeholder="${this.placeholder}"
                .value="${this.expression}"
                @input="${this._handleInput}"
            />

            <div class="builder-wrapper">
                <div class="builder-header">${t('expressionBuilder')}</div>
                <div class="builder-section">
                    <div class="section-label">${t('columns')}</div>
                    <div class="button-row">
                        ${this.columns.map(
                            (col) => html`
                                <button type="button" class="column-btn" @click="${() => this._insertColumn(col)}">
                                    ${col}
                                </button>
                            `
                        )}
                    </div>
                </div>

                <div class="builder-section">
                    <div class="section-label">${t('operators')}</div>
                    <div class="button-row">
                        ${this._operators.map(
                            (op) => html`
                                <button type="button" class="operator-btn" @click="${() => this._insertOperator(op)}">
                                    ${op}
                                </button>
                            `
                        )}
                        <button type="button" class="operator-btn clear" @click="${this._clearExpression}">
                            ${t('clear')}
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'ss-expression-builder': SSExpressionBuilder;
    }
}
