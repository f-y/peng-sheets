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
    FormulaFunctionType,
    TableMetadata
} from '../../services/types';
import type { WorkbookJSON, TableJSON } from '../../types';
import { evaluateArithmeticFormula, evaluateLookup, buildRowData, NA_VALUE } from '../../utils/formula-evaluator';
import './ss-column-picker';
import './ss-expression-builder';
import './ss-list-selector';
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
                border-radius: 6px;
                width: 650px;
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
                margin-bottom: 20px;
            }

            /* Section labels - larger, bolder for visual hierarchy */
            .form-label {
                display: block;
                margin-bottom: 10px;
                font-size: 13px;
                font-weight: 600;
                color: var(--vscode-foreground);
            }

            /* Field labels - smaller, lighter for subordinate hierarchy */
            .field-label {
                display: block;
                margin-bottom: 4px;
                font-size: 11px;
                font-weight: 400;
                color: var(--vscode-descriptionForeground);
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            /* Form card for grouping related fields - Post-Neumorphism 2025 */
            .form-card {
                background: var(--vscode-input-background);
                border: 1px solid var(--vscode-input-border);
                border-radius: 6px;
                padding: 10px;
                box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);
                transition:
                    box-shadow 0.2s ease,
                    border-color 0.2s ease;
            }

            .form-card:hover {
                border-color: var(--vscode-focusBorder);
                box-shadow:
                    inset 0 1px 3px rgba(0, 0, 0, 0.15),
                    0 0 0 1px rgba(255, 255, 255, 0.05);
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
                padding: 4px 8px;
                border-radius: 4px;
                transition: background-color 0.15s ease;
            }

            .radio-label:hover {
                background-color: var(--vscode-list-hoverBackground);
            }

            /* Select control with micro-interactions */
            .select-control {
                width: 100%;
                padding: 10px 28px 10px 12px;
                background: var(--vscode-input-background);
                color: var(--vscode-input-foreground);
                border: 1px solid var(--vscode-input-border);
                border-radius: 6px;
                transition: all 0.2s ease;
                cursor: pointer;
                font-size: 13px;
                box-sizing: border-box;
            }

            .select-control:hover {
                border-color: var(--vscode-focusBorder);
                background: var(--vscode-list-hoverBackground);
            }

            .select-control:focus {
                outline: none;
                border-color: var(--vscode-focusBorder);
                box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.5);
                background: var(--vscode-input-background);
            }

            .select-control.value-select-highlight {
                width: 80%;
                border: 2px solid var(--vscode-charts-green, #4ade80);
                box-shadow: 0 0 0 2px rgba(74, 222, 128, 0.2);
            }

            .input-control {
                width: 100%;
                padding: 10px 12px;
                background: var(--vscode-input-background);
                color: var(--vscode-input-foreground);
                border: 1px solid var(--vscode-input-border);
                border-radius: 6px;
                font-family: monospace;
                transition: all 0.2s ease;
                box-sizing: border-box;
            }

            .input-control:hover {
                border-color: var(--vscode-focusBorder);
                background: var(--vscode-list-hoverBackground);
            }

            .input-control:focus {
                outline: none;
                border-color: var(--vscode-focusBorder);
                box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.5);
                background: var(--vscode-input-background);
            }

            .checkbox-list {
                max-height: 120px;
                overflow-y: auto;
                border: 1px solid var(--vscode-input-border);
                border-radius: 4px;
                padding: 8px;
            }

            .checkbox-item {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 4px 6px;
                border-radius: 4px;
                transition: background-color 0.15s ease;
            }

            .checkbox-item.disabled {
                opacity: 0.5;
            }

            .checkbox-item:hover:not(.disabled) {
                background-color: var(--vscode-list-hoverBackground);
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

            .preview-section {
                margin-top: 16px;
                padding: 12px;
                background: var(--vscode-input-background);
                border: 1px solid var(--vscode-input-border);
                border-radius: 4px;
            }

            .preview-title {
                font-weight: 600;
                font-size: 12px;
                margin-bottom: 8px;
                color: var(--vscode-descriptionForeground);
            }

            .preview-values {
                display: flex;
                gap: 12px;
                flex-wrap: wrap;
            }

            .preview-item {
                font-size: 12px;
                color: var(--vscode-foreground);
            }

            .preview-item .row-label {
                color: var(--vscode-descriptionForeground);
            }

            .preview-item .value {
                font-weight: 500;
            }

            .preview-item .value.error {
                color: var(--vscode-inputValidation-errorForeground);
            }

            .warning-alert {
                padding: 8px 12px;
                margin-bottom: 12px;
                background-color: var(--vscode-inputValidation-warningBackground, rgba(255, 200, 0, 0.1));
                border: 1px solid var(--vscode-inputValidation-warningBorder, #ccaa00);
                border-radius: 4px;
                color: var(--vscode-inputValidation-warningForeground, var(--vscode-foreground));
                font-size: 12px;
            }

            /* Data Flow Diagram for Lookup Mode - Infographic Style */
            .data-flow {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 8px 16px;
                margin-bottom: 16px;
                background: transparent;
                border-bottom: 1px solid var(--vscode-panel-border);
            }

            .flow-step {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 8px;
                flex: 1;
                padding: 0;
                background: transparent;
                border: none;
            }

            .flow-icon-wrapper {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 44px;
                height: 44px;
                background: var(--vscode-input-background);
                border: 2px solid var(--vscode-panel-border);
                border-radius: 10px;
                transition: all 0.2s ease;
            }

            .flow-step.active .flow-icon-wrapper {
                border-color: var(--vscode-textLink-foreground);
            }

            .flow-icon-wrapper svg {
                width: 20px;
                height: 20px;
                fill: none;
                stroke: var(--vscode-textLink-foreground);
                stroke-width: 1.5;
                stroke-linecap: round;
                stroke-linejoin: round;
            }

            .flow-label {
                font-size: 8px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.6px;
                color: var(--vscode-descriptionForeground);
                text-align: center;
            }

            .flow-arrow {
                display: flex;
                align-items: center;
                margin-bottom: 20px;
            }

            .flow-arrow svg {
                width: 32px;
                height: 16px;
                fill: none;
                stroke: var(--vscode-textLink-foreground);
                stroke-width: 2;
                stroke-linecap: round;
                stroke-linejoin: round;
            }

            /* Key Matching Visual */
            .key-match-visual {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 12px;
                padding: 12px;
                background: linear-gradient(
                    90deg,
                    rgba(59, 130, 246, 0.08) 0%,
                    rgba(59, 130, 246, 0.15) 50%,
                    rgba(59, 130, 246, 0.08) 100%
                );
                border-radius: 8px;
                margin-top: 8px;
            }

            .key-match-equals {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 28px;
                height: 28px;
                flex-shrink: 0;
                margin: 0 8px;
                background: var(--vscode-textLink-foreground);
                color: white;
                border-radius: 50%;
                font-weight: 700;
                font-size: 14px;
                box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4);
            }

            .key-column-box {
                flex: 1;
                padding: 8px 12px;
                background: var(--vscode-input-background);
                border: 1px solid var(--vscode-panel-border);
                border-radius: 6px;
            }

            .key-column-box .field-label {
                margin-bottom: 6px;
            }

            /* VS-style Key Matching Display */
            .key-match-visual.vs-style {
                justify-content: center;
                max-width: 100%;
                overflow: hidden;
            }

            .vs-display-box {
                width: 80px;
                min-width: 0;
                flex-shrink: 0;
                padding: 8px 10px;
                background: var(--vscode-input-background);
                border: 2px solid var(--vscode-textLink-foreground);
                border-radius: 6px;
                text-align: center;
                min-height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: hidden;
            }

            .vs-column-name {
                font-size: 11px;
                font-weight: 600;
                color: var(--vscode-foreground);
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                max-width: 100%;
                display: block;
            }

            .vs-hint {
                font-size: 10px;
                color: var(--vscode-descriptionForeground);
                text-align: center;
                margin-top: 4px;
                margin-bottom: 12px;
            }

            /* Section label (no card) */
            .section-label {
                font-size: 12px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.8px;
                color: var(--vscode-descriptionForeground);
                margin-bottom: 0;
                text-align: center;
            }

            /* Match success highlight */
            .key-match-visual.match-success .key-match-equals {
                background: #22c55e;
            }

            .key-match-visual.match-success .vs-display-box {
                border-color: #22c55e;
            }

            /* Live Preview Chips */
            .preview-chips {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                margin-top: 8px;
            }

            .preview-chip {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 6px 10px;
                background: var(--vscode-badge-background);
                border-radius: 16px;
                font-size: 11px;
            }

            .preview-chip .chip-key {
                color: var(--vscode-descriptionForeground);
            }

            .preview-chip .chip-arrow {
                color: var(--vscode-textLink-foreground);
                font-weight: 600;
            }

            .preview-chip .chip-value {
                color: var(--vscode-badge-foreground);
                font-weight: 500;
            }

            .preview-chip.error {
                background: var(--vscode-inputValidation-errorBackground);
            }

            .preview-chip.error .chip-value {
                color: var(--vscode-inputValidation-errorForeground);
            }

            /* 3-Column Lookup Layout - Fixed widths */
            .lookup-grid {
                display: grid;
                grid-template-columns: 140px 1fr 140px;
                gap: 8px;
                margin-bottom: 16px;
            }

            .lookup-grid .form-group {
                margin-bottom: 0;
                min-width: 0;
                overflow: hidden;
            }

            .lookup-column-header {
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 12px;
                font-weight: 600;
                color: var(--vscode-foreground);
                margin-bottom: 8px;
            }

            .lookup-column-header .icon {
                font-size: 14px;
            }

            /* Center stack layout for KEY MATCHING + VALUE TO RETURN */
            .center-stack {
                display: flex;
                flex-direction: column;
                gap: 12px;
                align-items: center;
            }

            /* Source table header with sheet selector */
            .source-table-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 4px;
                padding: 0 4px;
            }

            .source-table-header .header-label {
                font-size: 10px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.8px;
                color: var(--vscode-descriptionForeground);
            }

            .sheet-select {
                padding: 2px 6px;
                font-size: 11px;
                height: auto;
                min-width: 60px;
            }

            .section-box {
                background: var(--vscode-input-background);
                border: 1px solid var(--vscode-panel-border);
                border-radius: 6px;
                padding: 12px;
            }

            .section-title {
                font-size: 10px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.8px;
                color: var(--vscode-descriptionForeground);
                margin-bottom: 10px;
                text-align: center;
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
    @property({ type: Array }) rows: string[][] = [];

    @state() private _mode: FormulaMode = 'calculation';
    @state() private _functionType: FormulaFunctionType = 'sum';
    @state() private _columnSource: ColumnSourceType = 'this';
    @state() private _expression = '';
    @state() private _selectedColumns: Set<string> = new Set();

    // Lookup mode state
    @state() private _sourceSheetIndex = 0;
    @state() private _sourceTableIndex = 0;
    @state() private _joinKeyLocal = '';
    @state() private _joinKeyLocalIndex = -1;
    @state() private _joinKeyRemote = '';
    @state() private _joinKeyRemoteIndex = -1;
    @state() private _targetField = '';

    // Broken reference warning
    @state() private _brokenReferenceMessage: string | null = null;

    // Bound handler for cleanup
    private _boundBlockUndoRedo = this._blockUndoRedo.bind(this);

    connectedCallback() {
        super.connectedCallback();
        this._initFromCurrentFormula();
        // Block Undo/Redo while dialog is open (capture phase to intercept early)
        window.addEventListener('keydown', this._boundBlockUndoRedo, true);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        window.removeEventListener('keydown', this._boundBlockUndoRedo, true);
    }

    private _blockUndoRedo(e: KeyboardEvent) {
        const isModifier = e.ctrlKey || e.metaKey;
        const key = e.key.toLowerCase();
        if (isModifier && (key === 'z' || key === 'y')) {
            // Allow expression builder to handle its own undo/redo
            if (this._mode === 'calculation' && this._functionType === 'expression') {
                // Don't block - let ss-expression-builder handle it
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
        }
    }

    private _initFromCurrentFormula() {
        this._brokenReferenceMessage = null;

        if (!this.currentFormula) {
            this._mode = 'calculation';
            this._functionType = 'sum';
            this._expression = '';
            this._selectedColumns = new Set();
            this._initLookupDefaults();
            return;
        }

        if (this.currentFormula.type === 'arithmetic') {
            this._mode = 'calculation';
            this._functionType = this.currentFormula.functionType;
            this._expression = this.currentFormula.expression ?? '';
            this._selectedColumns = new Set(this.currentFormula.columns ?? []);
            this._columnSource = this.currentFormula.sourceTableId !== undefined ? 'other' : 'this';

            // Validate source table exists for cross-table aggregates
            if (this.currentFormula.sourceTableId !== undefined) {
                const found = this._findSourceTableLocation(this.currentFormula.sourceTableId);
                if (!found) {
                    this._brokenReferenceMessage = t('brokenReference');
                }
            }

            // Validate selected columns still exist
            const availableHeaders = this._columnSource === 'this' ? this.headers : this._getSourceTableHeaders();
            const missingCols = Array.from(this._selectedColumns).filter((col) => !availableHeaders.includes(col));
            if (missingCols.length > 0) {
                this._brokenReferenceMessage = t('brokenReference');
            }
        } else if (this.currentFormula.type === 'lookup') {
            this._mode = 'lookup';
            this._joinKeyLocal = this.currentFormula.joinKeyLocal;
            this._joinKeyRemote = this.currentFormula.joinKeyRemote;
            this._targetField = this.currentFormula.targetField;

            // Find source table location
            const found = this._findSourceTableLocation(this.currentFormula.sourceTableId);
            if (!found) {
                this._brokenReferenceMessage = t('brokenReference');
            } else {
                // Validate remote columns exist
                const remoteHeaders = this._getSourceTableHeaders();
                if (!remoteHeaders.includes(this._joinKeyRemote) || !remoteHeaders.includes(this._targetField)) {
                    this._brokenReferenceMessage = t('brokenReference');
                }
                // Validate local column exists
                if (!this.headers.includes(this._joinKeyLocal)) {
                    this._brokenReferenceMessage = t('brokenReference');
                }
            }
        }
    }

    private _findSourceTableLocation(tableId: number): boolean {
        if (!this.workbook) return false;
        for (let si = 0; si < this.workbook.sheets.length; si++) {
            const sheet = this.workbook.sheets[si];
            for (let ti = 0; ti < sheet.tables.length; ti++) {
                const table = sheet.tables[ti];
                const meta = table.metadata as TableMetadata | undefined;
                // Check metadata.visual.id (where parser puts custom metadata)
                const visual = meta?.visual;
                const explicitId = visual?.id ?? meta?.id;
                // Also check synthetic ID (sheetIndex * 1000 + tableIndex)
                const syntheticId = si * 1000 + ti;
                if (explicitId === tableId || syntheticId === tableId) {
                    this._sourceSheetIndex = si;
                    this._sourceTableIndex = ti;
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Initialize lookup mode defaults by auto-selecting columns.
     * Priority: 1) Matching column names 2) Priority words (id, key, etc.) 3) First column
     */
    private _initLookupDefaults() {
        // Auto-select first available sheet and table (not current table)
        const availableSheets = this._getAvailableSheets();
        if (availableSheets.length > 0 && !availableSheets.find((s) => s.index === this._sourceSheetIndex)) {
            this._sourceSheetIndex = availableSheets[0].index;
        }
        // Auto-select first available table in selected sheet
        const availableTables = this._getSourceTableItems();
        if (availableTables.length > 0 && !availableTables.find((t) => t.value === String(this._sourceTableIndex))) {
            this._sourceTableIndex = parseInt(availableTables[0].value, 10);
        }

        const sourceHeaders = this._getSourceTableHeaders();
        const localHeaders = this.headers;

        if (localHeaders.length === 0 || sourceHeaders.length === 0) return;

        // Get priority words from i18n
        const priorityWords = t('lookupKeyPriorityWords')
            .split(',')
            .map((w) => w.trim().toLowerCase());

        // 1. First priority: ID-like column names (from priority words)
        let localKey = '';
        let remoteKey = '';
        let localKeyIndex = -1;
        let remoteKeyIndex = -1;
        for (const word of priorityWords) {
            const localIdx = localHeaders.findIndex((h) => h.toLowerCase().includes(word));
            const remoteIdx = sourceHeaders.findIndex((h) => h.toLowerCase().includes(word));
            if (localIdx >= 0 && remoteIdx >= 0) {
                localKey = localHeaders[localIdx];
                localKeyIndex = localIdx;
                remoteKey = sourceHeaders[remoteIdx];
                remoteKeyIndex = remoteIdx;
                break;
            }
        }

        // 2. Fallback: matching column names in both tables
        if (!localKey) {
            for (let i = 0; i < localHeaders.length; i++) {
                const local = localHeaders[i];
                const remoteIndex = sourceHeaders.findIndex((s) => s.toLowerCase() === local.toLowerCase());
                if (remoteIndex >= 0) {
                    localKey = local;
                    localKeyIndex = i;
                    remoteKey = sourceHeaders[remoteIndex];
                    remoteKeyIndex = remoteIndex;
                    break;
                }
            }
        }

        // 3. Fallback to first column
        if (!localKey) {
            localKey = localHeaders[0] || '';
            localKeyIndex = localHeaders.length > 0 ? 0 : -1;
            remoteKey = sourceHeaders[0] || '';
            remoteKeyIndex = sourceHeaders.length > 0 ? 0 : -1;
        }

        this._joinKeyLocal = localKey;
        this._joinKeyLocalIndex = localKeyIndex;
        this._joinKeyRemote = remoteKey;
        this._joinKeyRemoteIndex = remoteKeyIndex;

        // Auto-select value column (first column not used as search key)
        const valueCol = sourceHeaders.find((h) => h !== remoteKey);
        this._targetField = valueCol || sourceHeaders[0] || '';
    }

    private _handleModeChange(mode: FormulaMode) {
        this._mode = mode;
        if (mode === 'lookup') {
            this._initLookupDefaults();
        }
    }

    private _handleFunctionChange(e: Event) {
        const select = e.target as HTMLSelectElement;
        this._functionType = select.value as FormulaFunctionType;
    }

    private _handleExpressionChange(e: Event) {
        const input = e.target as HTMLInputElement;
        this._expression = input.value;
    }

    private _handleExpressionBuilderChange(e: CustomEvent<{ expression: string }>) {
        this._expression = e.detail.expression;
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

    private _handleColumnSelectionChange(e: CustomEvent<{ columns: string[] }>) {
        this._selectedColumns = new Set(e.detail.columns);
    }

    private _handleSourceSheetChange(e: Event) {
        const select = e.target as HTMLSelectElement;
        this._sourceSheetIndex = parseInt(select.value, 10);
        this._sourceTableIndex = 0;
        this._initLookupDefaults();
    }

    private _handleSourceTableChange(e: Event) {
        const select = e.target as HTMLSelectElement;
        this._sourceTableIndex = parseInt(select.value, 10);
        this._initLookupDefaults();
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

    // List selector methods for new layout
    private _getSourceTableItems(): { value: string; label: string; group: string }[] {
        const sheets = this.workbook?.sheets ?? [];
        const items: { value: string; label: string; group: string }[] = [];

        sheets.forEach((sheet, sheetIdx) => {
            (sheet.tables ?? []).forEach((table, tableIdx) => {
                // Exclude current table from source selection
                const isCurrentTable = sheetIdx === this.currentSheetIndex && tableIdx === this.currentTableIndex;
                if (sheetIdx === this._sourceSheetIndex && !isCurrentTable) {
                    items.push({
                        value: String(tableIdx),
                        label: table.name ?? `Table ${tableIdx + 1}`,
                        group: sheet.name ?? `Sheet ${sheetIdx + 1}`
                    });
                }
            });
        });

        return items;
    }

    // Get sheets that have tables other than current table
    private _getAvailableSheets(): { index: number; name: string }[] {
        const sheets = this.workbook?.sheets ?? [];
        const result: { index: number; name: string }[] = [];

        sheets.forEach((sheet, sheetIdx) => {
            const tables = sheet.tables ?? [];
            // Check if sheet has any table other than current table
            const hasOtherTables = tables.some((_, tableIdx) => {
                return !(sheetIdx === this.currentSheetIndex && tableIdx === this.currentTableIndex);
            });
            if (hasOtherTables) {
                result.push({
                    index: sheetIdx,
                    name: sheet.name ?? `Sheet ${sheetIdx + 1}`
                });
            }
        });

        return result;
    }

    private _handleSourceListChange(e: CustomEvent<{ value: string }>) {
        this._sourceTableIndex = parseInt(e.detail.value, 10);
        this._initLookupDefaults();
    }

    private _handleJoinKeyRemoteListChange(e: CustomEvent<{ value: string; index: number }>) {
        this._joinKeyRemote = e.detail.value;
        this._joinKeyRemoteIndex = e.detail.index;
    }

    private _handleThisTableListChange(e: CustomEvent<{ value: string; index: number }>) {
        this._joinKeyLocal = e.detail.value;
        this._joinKeyLocalIndex = e.detail.index;
    }

    private _isKeyMatchValid(): boolean {
        // Show match success when both columns are selected AND at least one value matches
        if (!this._joinKeyLocal || !this._joinKeyRemote) return false;

        // Get local column values
        const localColIndex = this.headers.indexOf(this._joinKeyLocal);
        if (localColIndex < 0) return false;
        const localValues = new Set(this.rows.map((row) => row[localColIndex]?.trim()).filter(Boolean));
        if (localValues.size === 0) return false;

        // Get remote column values
        const sourceTable = this._getSourceTable();
        if (!sourceTable) return false;
        const remoteColIndex = sourceTable.headers?.indexOf(this._joinKeyRemote) ?? -1;
        if (remoteColIndex < 0) return false;
        const remoteValues = new Set(sourceTable.rows.map((row) => row[remoteColIndex]?.trim()).filter(Boolean));
        if (remoteValues.size === 0) return false;

        // Check if any values match
        for (const val of localValues) {
            if (remoteValues.has(val)) return true;
        }
        return false;
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

    /**
     * Get or create a unique ID for the source table.
     * If the table has no ID in metadata, assigns the next available ID (max + 1)
     * and stores it in the table's visual metadata immediately.
     */
    private _getSourceTableId(): number {
        const table = this._getSourceTable();
        if (!table) {
            // No table found - return 0 as fallback
            return 0;
        }

        const meta = table.metadata as TableMetadata | undefined;
        const visual = meta?.visual;

        // Check for existing ID
        if (typeof visual?.id === 'number') return visual.id;
        if (typeof meta?.id === 'number') return meta.id;

        // No ID exists - calculate and assign next available ID
        const nextId = this._getNextAvailableTableId();

        // Persist the ID to the table's metadata immediately
        // This ensures Preview works and the ID is consistent
        this._assignTableId(table, nextId);

        return nextId;
    }

    /**
     * Assign an ID to a table by updating its visual metadata.
     */
    private _assignTableId(table: TableJSON, id: number): void {
        // Ensure metadata exists
        if (!table.metadata) {
            table.metadata = {};
        }

        const meta = table.metadata as Record<string, unknown>;

        // Ensure visual exists
        if (!meta.visual) {
            meta.visual = {};
        }

        const visual = meta.visual as Record<string, unknown>;
        visual.id = id;
    }

    /**
     * Calculate the next available table ID by finding max existing ID + 1.
     */
    private _getNextAvailableTableId(): number {
        if (!this.workbook) return 0;

        let maxId = -1;
        for (const sheet of this.workbook.sheets) {
            for (const table of sheet.tables) {
                const meta = table.metadata as TableMetadata | undefined;
                const visual = meta?.visual;
                const id = visual?.id ?? meta?.id;
                if (typeof id === 'number' && id > maxId) {
                    maxId = id;
                }
            }
        }
        return maxId + 1;
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

    /**
     * Render preview of calculated values for the first 3 rows.
     */
    private _renderPreview() {
        const formula = this._buildFormula();
        if (!formula) {
            return html`
                <div class="preview-section">
                    <div class="preview-title">${t('preview')}</div>
                    <div class="preview-values">
                        <span class="preview-item">
                            <span class="value" style="color: var(--vscode-descriptionForeground)">—</span>
                        </span>
                    </div>
                </div>
            `;
        }

        // Take first 3 rows for preview
        const previewRows = this.rows.slice(0, 3);
        const results: { rowNum: number; value: string; isError: boolean }[] = [];

        for (let i = 0; i < previewRows.length; i++) {
            const row = previewRows[i];
            const rowData = buildRowData(this.headers, row);
            let value: string;
            let isError = false;

            if (formula.type === 'arithmetic') {
                const result = evaluateArithmeticFormula(formula, rowData);
                // Format number with commas if it's a valid number
                const num = parseFloat(result.value);
                value = isNaN(num) ? result.value : num.toLocaleString();
                isError = !result.success;
            } else {
                // Lookup formula
                const joinKeyColIndex = this.headers.indexOf(formula.joinKeyLocal);
                const localKeyValue = joinKeyColIndex >= 0 ? row[joinKeyColIndex] : '';
                if (this.workbook) {
                    const result = evaluateLookup(formula, localKeyValue, this.workbook);
                    value = result.value;
                    isError = !result.success;
                } else {
                    value = NA_VALUE;
                    isError = true;
                }
            }

            results.push({ rowNum: i + 1, value, isError });
        }

        return html`
            <div class="preview-section">
                <div class="preview-title">${t('preview')}</div>
                <div class="preview-values">
                    ${results.map(
                        (r) => html`
                            <span class="preview-item">
                                <span class="row-label">${t('previewRow', r.rowNum.toString())} </span>
                                <span class="value ${r.isError ? 'error' : ''}">${r.value}</span>
                            </span>
                        `
                    )}
                    ${results.length === 0
                        ? html`<span class="preview-item"
                              ><span class="value" style="color: var(--vscode-descriptionForeground)"
                                  >${t('noData')}</span
                              ></span
                          >`
                        : ''}
                </div>
            </div>
        `;
    }

    private _handleApply() {
        const formula = this._buildFormula();

        // For lookup formulas, include source table metadata to persist its ID atomically
        let sourceTableMetadata: {
            sheetIndex: number;
            tableIndex: number;
            visual: unknown;
        } | null = null;

        if (formula && formula.type === 'lookup') {
            const sourceTable = this._getSourceTable();
            if (sourceTable && sourceTable.metadata) {
                const visual = (sourceTable.metadata as Record<string, unknown>).visual;
                if (visual) {
                    sourceTableMetadata = {
                        sheetIndex: this._sourceSheetIndex,
                        tableIndex: this._sourceTableIndex,
                        visual: visual
                    };
                }
            }
        }

        this.dispatchEvent(
            new CustomEvent('ss-formula-update', {
                detail: { colIndex: this.colIndex, formula, sourceTableMetadata },
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
        // Only same-table columns are available (cross-table aggregation not yet implemented)
        return this.headers.filter((_, i) => i !== this.colIndex);
    }

    private _renderCalculationMode() {
        const isExpression = this._functionType === 'expression';
        const availableColumns = this._getAvailableColumnsForCalculation();

        return html`
            <div class="form-group">
                <label class="form-label">${t('functionType')}</label>
                <select class="select-control" @change="${this._handleFunctionChange}">
                    <option value="expression" ?selected="${this._functionType === 'expression'}">
                        ${t('expression')}
                    </option>
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
                          <ss-expression-builder
                              .columns="${availableColumns}"
                              .expression="${this._expression}"
                              .placeholder="${t('expressionPlaceholder')}"
                              @ss-expression-change="${this._handleExpressionBuilderChange}"
                          ></ss-expression-builder>
                      </div>
                  `
                : html`
                      <div class="form-group">
                          <label class="form-label">${t('selectColumns')}</label>
                          <ss-column-picker
                              .columns="${availableColumns}"
                              .selected="${[...this._selectedColumns]}"
                              @ss-column-selection-change="${this._handleColumnSelectionChange}"
                          ></ss-column-picker>
                      </div>
                  `}
        `;
    }

    private _renderLookupMode() {
        const sheets = this.workbook?.sheets ?? [];
        const currentSheet = sheets[this._sourceSheetIndex];
        const tables = currentSheet?.tables ?? [];
        const sourceHeaders = this._getSourceTableHeaders();
        const _sourceTableName = tables[this._sourceTableIndex]?.name ?? '';

        return html`
            <!-- 3-Column Grid Layout -->
            <div class="lookup-grid">
                <!-- LEFT: This Table Column List -->
                <div class="form-group">
                    <ss-list-selector
                        header="${t('thisTable')}"
                        .items="${this.headers.map((h) => ({ value: h, label: h }))}"
                        .selectedValue="${this._joinKeyLocal}"
                        .selectedIndex="${this._joinKeyLocalIndex}"
                        @change="${this._handleThisTableListChange}"
                    ></ss-list-selector>
                </div>

                <!-- CENTER: KEY MATCHING + VALUE TO RETURN (stacked) -->
                <div class="form-group center-stack">
                    <!-- KEY MATCHING Section (VS-style display) -->
                    <div class="section-label">${t('keyMatching').toUpperCase()}</div>
                    <div class="key-match-visual vs-style ${this._isKeyMatchValid() ? 'match-success' : ''}">
                        <div class="vs-display-box">
                            <span class="vs-column-name">${this._joinKeyLocal || '—'}</span>
                        </div>
                        <div class="key-match-equals">=</div>
                        <div class="vs-display-box">
                            <span class="vs-column-name">${this._joinKeyRemote || '—'}</span>
                        </div>
                    </div>
                    <div class="vs-hint">${t('keyMatchingHint')}</div>

                    <!-- VALUE TO RETURN Section -->
                    <div class="section-label" style="margin-top: 4px;">${t('valueColumn').toUpperCase()}</div>
                    <select class="select-control value-select-highlight" @change="${this._handleTargetFieldChange}">
                        ${sourceHeaders.map(
                            (col) => html`
                                <option value="${col}" ?selected="${col === this._targetField}">${col}</option>
                            `
                        )}
                    </select>
                </div>

                <!-- RIGHT: Source Table List -->
                <div class="form-group">
                    <!-- Header with Sheet selector -->
                    <div class="source-table-header">
                        <span class="header-label">${t('sourceTable')}</span>
                        <select class="select-control sheet-select" @change="${this._handleSourceSheetChange}">
                            ${this._getAvailableSheets().map(
                                (sheet) => html`
                                    <option
                                        value="${sheet.index}"
                                        ?selected="${sheet.index === this._sourceSheetIndex}"
                                    >
                                        ${sheet.name}
                                    </option>
                                `
                            )}
                        </select>
                    </div>
                    <ss-list-selector
                        .items="${this._getSourceTableItems()}"
                        .selectedValue="${String(this._sourceTableIndex)}"
                        .showGroups="${false}"
                        @change="${this._handleSourceListChange}"
                    ></ss-list-selector>
                    <ss-list-selector
                        style="margin-top: 8px;"
                        .items="${sourceHeaders.map((h) => ({ value: h, label: h }))}"
                        .selectedValue="${this._joinKeyRemote}"
                        .selectedIndex="${this._joinKeyRemoteIndex}"
                        @change="${this._handleJoinKeyRemoteListChange}"
                    ></ss-list-selector>
                </div>
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
                        ${this._brokenReferenceMessage
                            ? html`<div class="warning-alert">${this._brokenReferenceMessage}</div>`
                            : ''}

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
                        ${this._renderPreview()}
                    </div>

                    <div class="dialog-footer">
                        ${this.currentFormula
                            ? html`<button class="btn btn-danger" @click="${this._handleRemove}">
                                  ${t('remove')}
                              </button>`
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
