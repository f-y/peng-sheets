/**
 * ss-formula-dialog - A modal dialog for configuring formula columns.
 *
 * Supports two formula types:
 * - Calculation: Expression or aggregate function (SUM, AVG, etc.)
 * - Table Lookup: VLOOKUP-style cross-table reference
 *
 * Events Emitted:
 * - ss-formula-update: { colIndex, formula: FormulaDefinition | null }
 * - ss-formula-cancel: {}
 */
import { LitElement, html, css, unsafeCSS, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { t } from '../../utils/i18n';
import sharedStyles from '../../styles/spreadsheet-shared.css?inline';
import type {
    FormulaDefinition,
    ArithmeticFormula,
    LookupFormula,
    FormulaFunctionType
} from '../../services/types';
import type { WorkbookJSON, SheetJSON, TableJSON } from '../../types';

type FormulaMode = 'calculation' | 'lookup';
type ColumnSourceType = 'this' | 'other';

@customElement('ss-formula-dialog')
export class SSFormulaDialog extends LitElement {
    static styles = [
        css`
            :host {
                display: block;
            }

            .dialog-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000;
            }

            .dialog {
                background: var(--vscode-editor-background);
                border: 1px solid var(--vscode-panel-border);
                border-radius: 4px;
                min-width: 400px;
                max-width: 500px;
                max-height: 80vh;
                overflow-y: auto;
            }

            .dialog-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px 16px;
                border-bottom: 1px solid var(--vscode-panel-border);
            }

            .dialog-title {
                font-weight: 600;
                font-size: 14px;
            }

            .close-button {
                background: none;
                border: none;
                cursor: pointer;
                padding: 4px;
                color: var(--vscode-foreground);
            }

            .dialog-body {
                padding: 16px;
            }

            .form-group {
                margin-bottom: 16px;
            }

            .form-label {
                display: block;
                margin-bottom: 6px;
                font-size: 12px;
                color: var(--vscode-descriptionForeground);
            }

            .radio-group {
                display: flex;
                gap: 16px;
            }

            .radio-label {
                display: flex;
                align-items: center;
                gap: 6px;
                cursor: pointer;
            }

            .select-control {
                width: 100%;
                padding: 6px 8px;
                background: var(--vscode-input-background);
                color: var(--vscode-input-foreground);
                border: 1px solid var(--vscode-input-border);
                border-radius: 2px;
            }

            .input-control {
                width: 100%;
                padding: 6px 8px;
                background: var(--vscode-input-background);
                color: var(--vscode-input-foreground);
                border: 1px solid var(--vscode-input-border);
                border-radius: 2px;
                font-family: monospace;
            }

            .checkbox-list {
                max-height: 120px;
                overflow-y: auto;
                border: 1px solid var(--vscode-input-border);
                border-radius: 2px;
                padding: 8px;
            }

            .checkbox-item {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 2px 0;
            }

            .checkbox-item.disabled {
                opacity: 0.5;
            }

            .picker-row {
                display: flex;
                gap: 8px;
                margin-top: 8px;
            }

            .picker-row select {
                flex: 1;
            }

            .preview-section {
                margin-top: 16px;
                padding: 8px;
                background: var(--vscode-textBlockQuote-background);
                border-radius: 2px;
                font-size: 12px;
            }

            .preview-label {
                font-weight: 600;
                margin-bottom: 4px;
            }

            .preview-values {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
            }

            .preview-value {
                padding: 2px 6px;
                background: var(--vscode-badge-background);
                color: var(--vscode-badge-foreground);
                border-radius: 2px;
            }

            .dialog-footer {
                display: flex;
                justify-content: flex-end;
                gap: 8px;
                padding: 12px 16px;
                border-top: 1px solid var(--vscode-panel-border);
            }

            .btn {
                padding: 6px 12px;
                border: none;
                border-radius: 2px;
                cursor: pointer;
            }

            .btn-primary {
                background: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
            }

            .btn-primary:hover {
                background: var(--vscode-button-hoverBackground);
            }

            .btn-secondary {
                background: var(--vscode-button-secondaryBackground);
                color: var(--vscode-button-secondaryForeground);
            }

            .btn-danger {
                background: var(--vscode-inputValidation-errorBackground);
                color: var(--vscode-inputValidation-errorForeground);
            }
        `,
        unsafeCSS(sharedStyles)
    ];

    @property({ type: Number }) colIndex = 0;
    @property({ type: Object }) currentFormula: FormulaDefinition | null = null;
    @property({ type: Object }) workbook: WorkbookJSON | null = null;
    @property({ type: Number }) currentSheetIndex = 0;
    @property({ type: Number }) currentTableIndex = 0;
    @property({ type: Array }) headers: string[] = [];

    @state() private _mode: FormulaMode = 'calculation';
    @state() private _functionType: FormulaFunctionType = 'expression';
    @state() private _columnSource: ColumnSourceType = 'this';
    @state() private _expression = '';
    @state() private _selectedColumns: Set<string> = new Set();

    // Lookup mode state
    @state() private _sourceSheetIndex = 0;
    @state() private _sourceTableIndex = 0;
    @state() private _joinKeyLocal = '';
    @state() private _joinKeyRemote = '';
    @state() private _targetField = '';

    connectedCallback() {
        super.connectedCallback();
        this._initFromCurrentFormula();
    }

    private _initFromCurrentFormula() {
        if (!this.currentFormula) {
            this._mode = 'calculation';
            this._functionType = 'expression';
            this._expression = '';
            this._selectedColumns = new Set();
            return;
        }

        if (this.currentFormula.type === 'arithmetic') {
            this._mode = 'calculation';
            this._functionType = this.currentFormula.functionType;
            this._expression = this.currentFormula.expression ?? '';
            this._selectedColumns = new Set(this.currentFormula.columns ?? []);
            this._columnSource = this.currentFormula.sourceTableId !== undefined ? 'other' : 'this';
        } else if (this.currentFormula.type === 'lookup') {
            this._mode = 'lookup';
            this._joinKeyLocal = this.currentFormula.joinKeyLocal;
            this._joinKeyRemote = this.currentFormula.joinKeyRemote;
            this._targetField = this.currentFormula.targetField;
            // Find source table location
            this._findSourceTableLocation(this.currentFormula.sourceTableId);
        }
    }

    private _findSourceTableLocation(tableId: number) {
        if (!this.workbook) return;
        for (let si = 0; si < this.workbook.sheets.length; si++) {
            const sheet = this.workbook.sheets[si];
            for (let ti = 0; ti < sheet.tables.length; ti++) {
                const table = sheet.tables[ti];
                const meta = table.metadata as Record<string, unknown> | undefined;
                if (meta?.id === tableId) {
                    this._sourceSheetIndex = si;
                    this._sourceTableIndex = ti;
                    return;
                }
            }
        }
    }

    private _handleModeChange(mode: FormulaMode) {
        this._mode = mode;
    }

    private _handleFunctionChange(e: Event) {
        const select = e.target as HTMLSelectElement;
        this._functionType = select.value as FormulaFunctionType;
    }

    private _handleExpressionChange(e: Event) {
        const input = e.target as HTMLInputElement;
        this._expression = input.value;
    }

    private _handleColumnToggle(colName: string) {
        const newSet = new Set(this._selectedColumns);
        if (newSet.has(colName)) {
            newSet.delete(colName);
        } else {
            newSet.add(colName);
        }
        this._selectedColumns = newSet;
    }

    private _handleSourceSheetChange(e: Event) {
        const select = e.target as HTMLSelectElement;
        this._sourceSheetIndex = parseInt(select.value, 10);
        this._sourceTableIndex = 0;
    }

    private _handleSourceTableChange(e: Event) {
        const select = e.target as HTMLSelectElement;
        this._sourceTableIndex = parseInt(select.value, 10);
    }

    private _handleJoinKeyLocalChange(e: Event) {
        this._joinKeyLocal = (e.target as HTMLSelectElement).value;
    }

    private _handleJoinKeyRemoteChange(e: Event) {
        this._joinKeyRemote = (e.target as HTMLSelectElement).value;
    }

    private _handleTargetFieldChange(e: Event) {
        this._targetField = (e.target as HTMLSelectElement).value;
    }

    private _getSourceTable(): TableJSON | null {
        if (!this.workbook) return null;
        const sheet = this.workbook.sheets[this._sourceSheetIndex];
        if (!sheet) return null;
        return sheet.tables[this._sourceTableIndex] ?? null;
    }

    private _getSourceTableHeaders(): string[] {
        const table = this._getSourceTable();
        return table?.headers ?? [];
    }

    private _getSourceTableId(): number | undefined {
        const table = this._getSourceTable();
        if (!table) return undefined;
        const meta = table.metadata as Record<string, unknown> | undefined;
        return typeof meta?.id === 'number' ? meta.id : undefined;
    }

    private _buildFormula(): FormulaDefinition | null {
        if (this._mode === 'calculation') {
            const formula: ArithmeticFormula = {
                type: 'arithmetic',
                functionType: this._functionType
            };

            if (this._functionType === 'expression') {
                if (!this._expression.trim()) return null;
                formula.expression = this._expression;
            } else {
                if (this._selectedColumns.size === 0) return null;
                formula.columns = Array.from(this._selectedColumns);

                // Include sourceTableId if referencing another table
                if (this._columnSource === 'other') {
                    const sourceTableId = this._getSourceTableId();
                    if (sourceTableId !== undefined) {
                        formula.sourceTableId = sourceTableId;
                    }
                }
            }

            return formula;
        } else {
            const sourceTableId = this._getSourceTableId();
            if (sourceTableId === undefined) return null;
            if (!this._joinKeyLocal || !this._joinKeyRemote || !this._targetField) return null;

            const formula: LookupFormula = {
                type: 'lookup',
                sourceTableId,
                joinKeyLocal: this._joinKeyLocal,
                joinKeyRemote: this._joinKeyRemote,
                targetField: this._targetField
            };

            return formula;
        }
    }

    private _handleApply() {
        const formula = this._buildFormula();
        this.dispatchEvent(
            new CustomEvent('ss-formula-update', {
                detail: { colIndex: this.colIndex, formula },
                bubbles: true,
                composed: true
            })
        );
    }

    private _handleRemove() {
        this.dispatchEvent(
            new CustomEvent('ss-formula-update', {
                detail: { colIndex: this.colIndex, formula: null },
                bubbles: true,
                composed: true
            })
        );
    }

    private _handleCancel() {
        this.dispatchEvent(
            new CustomEvent('ss-formula-cancel', {
                bubbles: true,
                composed: true
            })
        );
    }

    private _handleColumnSourceChange(source: ColumnSourceType) {
        this._columnSource = source;
        // Reset column selection when changing source
        this._selectedColumns = new Set();
    }

    private _getAvailableColumnsForCalculation(): string[] {
        if (this._columnSource === 'this') {
            return this.headers.filter((_, i) => i !== this.colIndex);
        } else {
            return this._getSourceTableHeaders();
        }
    }

    private _renderCalculationMode() {
        const isExpression = this._functionType === 'expression';
        const availableColumns = this._getAvailableColumnsForCalculation();
        const sheets = this.workbook?.sheets ?? [];
        const currentSheet = sheets[this._sourceSheetIndex];
        const tables = currentSheet?.tables ?? [];

        return html`
            <div class="form-group">
                <label class="form-label">${t('functionType')}</label>
                <select class="select-control" @change="${this._handleFunctionChange}">
                    <option value="expression" ?selected="${this._functionType === 'expression'}">${t('expression')}</option>
                    <option value="sum" ?selected="${this._functionType === 'sum'}">SUM</option>
                    <option value="avg" ?selected="${this._functionType === 'avg'}">AVG</option>
                    <option value="count" ?selected="${this._functionType === 'count'}">COUNT</option>
                    <option value="min" ?selected="${this._functionType === 'min'}">MIN</option>
                    <option value="max" ?selected="${this._functionType === 'max'}">MAX</option>
                </select>
            </div>

            ${isExpression
                ? html`
                      <div class="form-group">
                          <label class="form-label">${t('expression')}</label>
                          <input
                              type="text"
                              class="input-control"
                              placeholder="[Quantity] * [Price]"
                              .value="${this._expression}"
                              @input="${this._handleExpressionChange}"
                          />
                      </div>
                  `
                : html`
                      <div class="form-group">
                          <label class="form-label">${t('columnSource')}</label>
                          <div class="radio-group">
                              <label class="radio-label">
                                  <input
                                      type="radio"
                                      name="columnSource"
                                      ?checked="${this._columnSource === 'this'}"
                                      @change="${() => this._handleColumnSourceChange('this')}"
                                  />
                                  ${t('thisTable')}
                              </label>
                              <label class="radio-label">
                                  <input
                                      type="radio"
                                      name="columnSource"
                                      ?checked="${this._columnSource === 'other'}"
                                      @change="${() => this._handleColumnSourceChange('other')}"
                                  />
                                  ${t('otherTable')}
                              </label>
                          </div>
                      </div>

                      ${this._columnSource === 'other'
                        ? html`
                                <div class="form-group">
                                    <label class="form-label">${t('sourceTable')}</label>
                                    <div class="picker-row">
                                        <select class="select-control" @change="${this._handleSourceSheetChange}">
                                            ${sheets.map(
                            (sheet, i) => html`
                                                    <option value="${i}" ?selected="${i === this._sourceSheetIndex}">${sheet.name}</option>
                                                `
                        )}
                                        </select>
                                        <select class="select-control" @change="${this._handleSourceTableChange}">
                                            ${tables.map(
                            (table, i) => html`
                                                    <option value="${i}" ?selected="${i === this._sourceTableIndex}">${table.name}</option>
                                                `
                        )}
                                        </select>
                                    </div>
                                </div>
                            `
                        : nothing}

                      <div class="form-group">
                          <label class="form-label">${t('selectColumns')}</label>
                          <div class="checkbox-list">
                              ${availableColumns.map(
                            (col) => html`
                                      <label class="checkbox-item">
                                          <input
                                              type="checkbox"
                                              ?checked="${this._selectedColumns.has(col)}"
                                              @change="${() => this._handleColumnToggle(col)}"
                                          />
                                          ${col}
                                      </label>
                                  `
                        )}
                          </div>
                      </div>
                  `}
        `;
    }

    private _renderLookupMode() {
        const sheets = this.workbook?.sheets ?? [];
        const currentSheet = sheets[this._sourceSheetIndex];
        const tables = currentSheet?.tables ?? [];
        const sourceHeaders = this._getSourceTableHeaders();

        return html`
            <div class="form-group">
                <label class="form-label">${t('sourceTable')}</label>
                <div class="picker-row">
                    <select class="select-control" @change="${this._handleSourceSheetChange}">
                        ${sheets.map(
            (sheet, i) => html`
                                <option value="${i}" ?selected="${i === this._sourceSheetIndex}">${sheet.name}</option>
                            `
        )}
                    </select>
                    <select class="select-control" @change="${this._handleSourceTableChange}">
                        ${tables.map(
            (table, i) => html`
                                <option value="${i}" ?selected="${i === this._sourceTableIndex}">${table.name}</option>
                            `
        )}
                    </select>
                </div>
            </div>

            <div class="form-group">
                <label class="form-label">${t('joinKey')}</label>
                <div class="picker-row">
                    <select class="select-control" @change="${this._handleJoinKeyLocalChange}">
                        <option value="">${t('thisTable')}</option>
                        ${this.headers.map(
            (col) => html`
                                <option value="${col}" ?selected="${col === this._joinKeyLocal}">${col}</option>
                            `
        )}
                    </select>
                    <span>→</span>
                    <select class="select-control" @change="${this._handleJoinKeyRemoteChange}">
                        <option value="">${t('sourceTable')}</option>
                        ${sourceHeaders.map(
            (col) => html`
                                <option value="${col}" ?selected="${col === this._joinKeyRemote}">${col}</option>
                            `
        )}
                    </select>
                </div>
            </div>

            <div class="form-group">
                <label class="form-label">${t('returnColumn')}</label>
                <select class="select-control" @change="${this._handleTargetFieldChange}">
                    <option value="">--</option>
                    ${sourceHeaders.map(
            (col) => html`
                            <option value="${col}" ?selected="${col === this._targetField}">${col}</option>
                        `
        )}
                </select>
            </div>
        `;
    }

    render() {
        return html`
            <div class="dialog-overlay" @click="${this._handleCancel}">
                <div class="dialog" @click="${(e: Event) => e.stopPropagation()}">
                    <div class="dialog-header">
                        <span class="dialog-title">${t('formulaColumnTitle')}</span>
                        <button class="close-button" @click="${this._handleCancel}">✕</button>
                    </div>

                    <div class="dialog-body">
                        <div class="form-group">
                            <label class="form-label">${t('formulaType')}</label>
                            <div class="radio-group">
                                <label class="radio-label">
                                    <input
                                        type="radio"
                                        name="mode"
                                        ?checked="${this._mode === 'calculation'}"
                                        @change="${() => this._handleModeChange('calculation')}"
                                    />
                                    ${t('calculation')}
                                </label>
                                <label class="radio-label">
                                    <input
                                        type="radio"
                                        name="mode"
                                        ?checked="${this._mode === 'lookup'}"
                                        @change="${() => this._handleModeChange('lookup')}"
                                    />
                                    ${t('tableLookup')}
                                </label>
                            </div>
                        </div>

                        ${this._mode === 'calculation' ? this._renderCalculationMode() : this._renderLookupMode()}
                    </div>

                    <div class="dialog-footer">
                        ${this.currentFormula
                ? html`<button class="btn btn-danger" @click="${this._handleRemove}">${t('remove')}</button>`
                : nothing}
                        <button class="btn btn-secondary" @click="${this._handleCancel}">${t('cancel')}</button>
                        <button class="btn btn-primary" @click="${this._handleApply}">${t('apply')}</button>
                    </div>
                </div>
            </div>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'ss-formula-dialog': SSFormulaDialog;
    }
}
