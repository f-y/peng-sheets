import { html, LitElement, PropertyValues, unsafeCSS } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { provideVSCodeDesignSystem } from '@vscode/webview-ui-toolkit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { t } from './utils/i18n';
import mainStyles from './styles/main.css?inline';

import './components/spreadsheet-toolbar';
import { ToolbarFormatState } from './components/spreadsheet-toolbar';
import './components/spreadsheet-table';
import './components/spreadsheet-onboarding';
import './components/spreadsheet-document-view';
import './components/confirmation-modal';
import './components/tab-context-menu';
import './components/add-tab-dropdown';
import './components/bottom-tabs';
import './components/layout-container';
import { GlobalEventController, GlobalEventHost } from './controllers/global-event-controller';
import {
    SheetJSON,
    DocumentJSON,
    WorkbookJSON,
    TabDefinition,
    StructureItem,
    PostMessageCommand,
    IParseResult,
    isSheetJSON,
    isDocumentJSON,
    isIDocumentSectionRange,
    IMetadataEditDetail,
    IMetadataUpdateDetail,
    ISortRowsDetail,
    IColumnUpdateDetail,
    IVisualMetadataUpdateDetail,
    ISheetMetadataUpdateDetail,
    IRequestAddTableDetail,
    IRequestRenameTableDetail,
    IRequestDeleteTableDetail,
    IPasteCellsDetail,
    IColumnResizeDetail,
    IColumnFilterDetail,
    IValidationUpdateDetail,
    IFormulaUpdateDetail,
    IMoveRowsDetail,
    IMoveColumnsDetail,
    IMoveCellsDetail
} from './types';

// Register the VS Code Design System components
import { SpreadsheetService } from './services/spreadsheet-service';
import {
    IVisualMetadata,
    ValidationMetadata,
    FormulaMetadata,
    FormulaDefinition,
    TableMetadata
} from './services/types';
import { recalculateAllFormulas, calculateAllFormulas } from './services/formula-recalculator';
import { ClipboardStore } from './stores/clipboard-store';

// Register the VS Code Design System components
provideVSCodeDesignSystem().register();

declare global {
    interface Window {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        activeSpreadsheetTable?: any;
        initialContent?: string;
        initialConfig?: Record<string, unknown>;
    }
}

// Acquire VS Code API
const vscode = acquireVsCodeApi();

@customElement('md-spreadsheet-editor')
export class MdSpreadsheetEditor extends LitElement implements GlobalEventHost {
    static styles = [unsafeCSS(mainStyles)];

    public readonly spreadsheetService = new SpreadsheetService(vscode);
    private _globalEventController = new GlobalEventController(this);
    // Promise for service initialization, started early in connectedCallback
    private _initPromise: Promise<unknown> | null = null;

    @state()
    output: string = '';

    @state()
    markdownInput: string = '';

    @state()
    config: Record<string, unknown> = {};

    @state()
    workbook: WorkbookJSON | null = null;

    @state()
    tabs: TabDefinition[] = [];

    @state()
    activeTabIndex = 0;

    @state()
    editingTabIndex: number | null = null;

    @state()
    pendingAddSheet = false;

    @state()
    confirmDeleteIndex: number | null = null;

    @state()
    tabContextMenu: { x: number; y: number; index: number; tabType: 'sheet' | 'document' } | null = null;

    @state()
    isScrollableRight = false;

    @state()
    addTabDropdown: { x: number; y: number } | null = null;

    // Track sheet count for add detection
    private _previousSheetCount = 0;

    // Track pending new tab index for selection after add (original tab index + 1)
    private _pendingNewTabIndex: number | null = null;

    // Track whether initial formula calculation has been done
    private _formulasInitialized: boolean = false;

    @state()
    private _activeToolbarFormat: ToolbarFormatState = {};

    // Track current selection for toolbar format state
    private _currentSelectionInfo: { sheetIndex: number; tableIndex: number; selectedCol: number } | null = null;

    _handleMetadataEdit(detail: IMetadataEditDetail) {
        if (!this.workbook) return;
        const { sheetIndex, tableIndex, name, description } = detail;

        // Optimistic Update: Update local state immediately to avoid UI flicker
        const targetTab = this.tabs.find((t) => t.type === 'sheet' && t.sheetIndex === sheetIndex);
        if (targetTab && isSheetJSON(targetTab.data)) {
            const table = targetTab.data.tables[tableIndex];
            if (table) {
                // Update values directly
                table.name = name;
                table.description = description;

                // Force Lit to re-render with new values
                this.requestUpdate();
            }
        }

        this.spreadsheetService.updateTableMetadata(sheetIndex, tableIndex, name, description);
    }

    /**
     * Handle description-only updates from ss-metadata-editor
     */
    /**
     * Handle description-only updates from ss-metadata-editor
     */
    _handleMetadataUpdate(detail: IMetadataUpdateDetail) {
        if (!this.workbook) return;
        const { sheetIndex, tableIndex, description } = detail;

        // Get current table name from local state
        const targetTab = this.tabs.find((t) => t.type === 'sheet' && t.sheetIndex === sheetIndex);
        let currentName = '';
        if (targetTab && isSheetJSON(targetTab.data)) {
            const table = targetTab.data.tables[tableIndex];
            if (table) {
                currentName = table.name || '';
                // Optimistic update
                table.description = description;
                this.requestUpdate();
            }
        }

        this.spreadsheetService.updateTableMetadata(sheetIndex, tableIndex, currentName, description);
    }

    _handleVisualMetadataUpdate(detail: IVisualMetadataUpdateDetail) {
        const { sheetIndex, tableIndex, visual } = detail;
        this.spreadsheetService.updateVisualMetadata(sheetIndex, tableIndex, visual);
    }

    _handleValidationUpdate(detail: IValidationUpdateDetail) {
        const { sheetIndex, tableIndex, colIndex, rule } = detail;
        // Get current visual metadata and merge validation rule
        const tab = this.tabs.find((t) => t.type === 'sheet' && t.sheetIndex === sheetIndex);
        if (tab && isSheetJSON(tab.data)) {
            const table = tab.data.tables[tableIndex];
            if (table) {
                // Initialize or update validation in visual metadata
                // Treat visual metadata as typed object from the start
                const currentVisual = ((table.metadata as Record<string, unknown>)?.visual as IVisualMetadata) || {};

                // Ensure validation object exists and matches Type
                const currentValidation: ValidationMetadata = currentVisual.validation || {};

                if (rule === null) {
                    // Remove validation for this column
                    delete currentValidation[colIndex.toString()];
                } else {
                    // Set validation rule for this column
                    // We cast rule to 'any' because strict union check is difficult here,
                    // but we trust the UI to pass valid rules.
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    currentValidation[colIndex.toString()] = rule as any;
                }

                const newVisual: IVisualMetadata = {
                    ...currentVisual,
                    validation: Object.keys(currentValidation).length > 0 ? currentValidation : undefined
                };

                // Clean up undefined validation key if spread created one (though explicit undefined above handles it)
                if (newVisual.validation === undefined) {
                    delete newVisual.validation;
                }

                this.spreadsheetService.updateVisualMetadata(sheetIndex, tableIndex, newVisual);
            }
        }
    }

    _handleFormulaUpdate(detail: IFormulaUpdateDetail) {
        const { sheetIndex, tableIndex, colIndex, formula } = detail;
        // Get current visual metadata and merge formula
        const tab = this.tabs.find((t) => t.type === 'sheet' && t.sheetIndex === sheetIndex);
        if (tab && isSheetJSON(tab.data)) {
            const table = tab.data.tables[tableIndex];
            if (table) {
                const currentVisual = ((table.metadata as Record<string, unknown>)?.visual as IVisualMetadata) || {};

                // Ensure formulas object exists
                const currentFormulas: FormulaMetadata = currentVisual.formulas || {};

                if (formula === null) {
                    // Remove formula for this column
                    delete currentFormulas[colIndex.toString()];
                } else {
                    // Set formula for this column
                    currentFormulas[colIndex.toString()] = formula as FormulaDefinition;
                }

                const newVisual: IVisualMetadata = {
                    ...currentVisual,
                    formulas: Object.keys(currentFormulas).length > 0 ? currentFormulas : undefined
                };

                // Clean up undefined formulas key
                if (newVisual.formulas === undefined) {
                    delete newVisual.formulas;
                }

                this.spreadsheetService.updateVisualMetadata(sheetIndex, tableIndex, newVisual);
            }
        }
    }

    _handleSheetMetadataUpdate(detail: ISheetMetadataUpdateDetail) {
        const { sheetIndex, metadata } = detail;
        // Optimistic Update: Update local state immediately
        const targetTab = this.tabs.find((t) => t.type === 'sheet' && t.sheetIndex === sheetIndex);
        if (targetTab && isSheetJSON(targetTab.data)) {
            targetTab.data.metadata = {
                ...(targetTab.data.metadata || {}),
                ...metadata
            };
            this.requestUpdate();
        }

        this.spreadsheetService.updateSheetMetadata(sheetIndex, metadata);
    }

    _handleRequestAddTable(detail: IRequestAddTableDetail) {
        if (!this.workbook || !this.workbook.sheets) return;
        const { sheetIndex } = detail;

        const sheet = this.workbook.sheets[sheetIndex];
        const tableCount = sheet ? sheet.tables.length : 0;
        const newName = t('table', (tableCount + 1).toString());

        this.spreadsheetService.addTable(sheetIndex, newName);
    }

    _handleRequestRenameTable(detail: IRequestRenameTableDetail) {
        if (!this.workbook) return;
        const { sheetIndex, tableIndex, newName } = detail;

        this.spreadsheetService.renameTable(sheetIndex, tableIndex, newName);
    }

    _handleRequestDeleteTable(detail: IRequestDeleteTableDetail) {
        const { sheetIndex, tableIndex } = detail;

        // Optimistic update
        const tab = this.tabs.find((t) => t.type === 'sheet' && t.sheetIndex === sheetIndex);
        if (tab && isSheetJSON(tab.data)) {
            tab.data.tables.splice(tableIndex, 1);
            this.requestUpdate();
        }

        this.spreadsheetService.deleteTable(sheetIndex, tableIndex);
    }

    _handleRangeEdit(
        sheetIdx: number,
        tableIdx: number,
        startRow: number,
        endRow: number,
        startCol: number,
        endCol: number,
        newValue: string
    ) {
        // Check if this is a header cell edit (column rename)
        if (startRow === -1 && endRow === -1) {
            this._handleColumnRename(sheetIdx, tableIdx, startCol, endCol, newValue);
            return;
        }

        // Simply update the range - formula recalculation is handled automatically
        // by the onDataChanged callback in SpreadsheetService._performAction
        this.spreadsheetService.updateRange(sheetIdx, tableIdx, startRow, endRow, startCol, endCol, newValue);
    }

    /**
     * Handle column header rename with formula reference propagation.
     */
    private _handleColumnRename(
        sheetIdx: number,
        tableIdx: number,
        startCol: number,
        endCol: number,
        newValue: string
    ) {
        if (!this.workbook) {
            this.spreadsheetService.updateRange(sheetIdx, tableIdx, -1, -1, startCol, endCol, newValue);
            return;
        }

        const sheet = this.workbook.sheets[sheetIdx];
        if (!sheet) {
            this.spreadsheetService.updateRange(sheetIdx, tableIdx, -1, -1, startCol, endCol, newValue);
            return;
        }

        const table = sheet.tables[tableIdx];
        if (!table) {
            this.spreadsheetService.updateRange(sheetIdx, tableIdx, -1, -1, startCol, endCol, newValue);
            return;
        }

        // Capture old column name before update
        const oldName = table.headers?.[startCol];

        // Perform the header update
        this.spreadsheetService.updateRange(sheetIdx, tableIdx, -1, -1, startCol, endCol, newValue);

        // Propagate column name change to formula references
        if (oldName && oldName !== newValue) {
            this._propagateColumnRename(sheetIdx, tableIdx, oldName, newValue);
        }
    }

    /**
     * Propagate column rename to all formula references.
     * Updates formulas that reference the old column name.
     */
    private _propagateColumnRename(sheetIdx: number, tableIdx: number, oldName: string, newName: string) {
        if (!this.workbook) return;

        const table = this.workbook.sheets[sheetIdx]?.tables[tableIdx];
        if (!table) return;

        const meta = table.metadata as TableMetadata | undefined;
        const visual = meta?.visual;
        const formulas = visual?.formulas;
        if (!formulas || Object.keys(formulas).length === 0) return;

        let updated = false;
        const newFormulas: FormulaMetadata = { ...formulas };

        for (const [colKey, formula] of Object.entries(formulas)) {
            if (!formula || typeof formula !== 'object') continue;

            if (formula.type === 'arithmetic') {
                // Work with ArithmeticFormula type
                let arithmeticCopy = { ...formula };

                // Update expression references
                if (formula.expression && formula.expression.includes(`[${oldName}]`)) {
                    arithmeticCopy = {
                        ...arithmeticCopy,
                        expression: formula.expression.replace(
                            new RegExp(`\\[${this._escapeRegex(oldName)}\\]`, 'g'),
                            `[${newName}]`
                        )
                    };
                    updated = true;
                }

                // Update columns array
                if (formula.columns) {
                    const newColumns = formula.columns.map((col: string) => (col === oldName ? newName : col));
                    if (JSON.stringify(newColumns) !== JSON.stringify(formula.columns)) {
                        arithmeticCopy = { ...arithmeticCopy, columns: newColumns };
                        updated = true;
                    }
                }

                newFormulas[colKey] = arithmeticCopy;
            } else if (formula.type === 'lookup') {
                // Work with LookupFormula type
                let lookupCopy = { ...formula };

                // Update lookup references for local join key
                if (formula.joinKeyLocal === oldName) {
                    lookupCopy = { ...lookupCopy, joinKeyLocal: newName };
                    updated = true;
                }

                newFormulas[colKey] = lookupCopy;
            }
        }

        if (updated) {
            // Update visual metadata with new formulas
            this.spreadsheetService.updateVisualMetadata(sheetIdx, tableIdx, {
                ...visual,
                formulas: newFormulas
            });
        }
    }

    /**
     * Escape special regex characters in a string.
     */
    private _escapeRegex(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    _handleDeleteRow(sheetIdx: number, tableIdx: number, rowIndex: number) {
        this.spreadsheetService.deleteRow(sheetIdx, tableIdx, rowIndex);
    }

    _handleDeleteRows(sheetIdx: number, tableIdx: number, rowIndices: number[]) {
        this.spreadsheetService.deleteRows(sheetIdx, tableIdx, rowIndices);
    }

    public _handleDeleteColumn(sheetIdx: number, tableIdx: number, colIndex: number) {
        if (!this.spreadsheetService) return;
        this.spreadsheetService.deleteColumn(sheetIdx, tableIdx, colIndex);
    }

    public _handleDeleteColumns(sheetIdx: number, tableIdx: number, colIndices: number[]) {
        if (!this.spreadsheetService) return;
        this.spreadsheetService.deleteColumns(sheetIdx, tableIdx, colIndices);
    }

    _handleInsertRow(sheetIdx: number, tableIdx: number, rowIndex: number) {
        this.spreadsheetService.insertRow(sheetIdx, tableIdx, rowIndex);
    }

    _handleInsertColumn(sheetIdx: number, tableIdx: number, colIndex: number) {
        this.spreadsheetService.insertColumn(sheetIdx, tableIdx, colIndex);
    }

    _handleClearColumn(sheetIdx: number, tableIdx: number, colIndex: number) {
        this.spreadsheetService.clearColumn(sheetIdx, tableIdx, colIndex);
    }

    _handleClearColumns(sheetIdx: number, tableIdx: number, colIndices: number[]) {
        this.spreadsheetService.clearColumns(sheetIdx, tableIdx, colIndices);
    }

    _handlePasteCells(detail: IPasteCellsDetail) {
        const { sheetIndex, tableIndex, startRow, startCol, data, includeHeaders } = detail;
        this.spreadsheetService.pasteCells(sheetIndex, tableIndex, startRow, startCol, data, includeHeaders);
    }

    _handleMoveRows(detail: IMoveRowsDetail) {
        const { sheetIndex, tableIndex, rowIndices, targetRowIndex } = detail;
        this.spreadsheetService.moveRows(sheetIndex, tableIndex, rowIndices, targetRowIndex);
    }

    _handleMoveColumns(detail: IMoveColumnsDetail) {
        const { sheetIndex, tableIndex, colIndices, targetColIndex } = detail;
        this.spreadsheetService.moveColumns(sheetIndex, tableIndex, colIndices, targetColIndex);
    }

    _handleMoveCells(detail: IMoveCellsDetail) {
        const { sheetIndex, tableIndex, sourceRange, destRow, destCol } = detail;
        this.spreadsheetService.moveCells(sheetIndex, tableIndex, sourceRange, destRow, destCol);
    }

    _handleInsertRowsAt(detail: { sheetIndex: number; tableIndex: number; targetRow: number; rowsData: string[][] }) {
        const { sheetIndex, tableIndex, targetRow, rowsData } = detail;
        this.spreadsheetService.insertRowsWithData(sheetIndex, tableIndex, targetRow, rowsData);
    }

    _handleInsertColumnsAt(detail: {
        sheetIndex: number;
        tableIndex: number;
        targetCol: number;
        columnsData: string[][];
    }) {
        const { sheetIndex, tableIndex, targetCol, columnsData } = detail;
        this.spreadsheetService.insertColumnsWithData(sheetIndex, tableIndex, targetCol, columnsData);
    }
    private async _handleUpdateColumnFilter(detail: IColumnFilterDetail) {
        const { sheetIndex, tableIndex, colIndex, hiddenValues } = detail;
        this.spreadsheetService.updateColumnFilter(sheetIndex, tableIndex, colIndex, hiddenValues);
    }

    private async _handleSortRows(detail: ISortRowsDetail) {
        const { sheetIndex, tableIndex, colIndex, ascending } = detail;
        this.spreadsheetService.sortRows(sheetIndex, tableIndex, colIndex, ascending ? 'asc' : 'desc');
    }

    private async _handleUpdateColumnAlign(detail: IColumnUpdateDetail) {
        const { sheetIndex, tableIndex, colIndex, alignment } = detail;
        this.spreadsheetService.updateColumnAlign(sheetIndex, tableIndex, colIndex, alignment ?? null);
    }

    private async _handleUpdateColumnFormat(detail: IColumnUpdateDetail) {
        const { sheetIndex, tableIndex, colIndex, format } = detail;
        this.spreadsheetService.updateColumnFormat(sheetIndex, tableIndex, colIndex, format ?? null);
    }

    _handlePostMessage(detail: PostMessageCommand) {
        switch (detail.command) {
            case 'update_config':
                console.log('Main: Updating config', detail.config);
                this.config = { ...this.config, ...detail.config };
                break;
            case 'update_column_filter':
                this._handleUpdateColumnFilter(detail);
                break;
            case 'sort_rows':
                this._handleSortRows(detail);
                break;
            case 'update_column_align':
                this._handleUpdateColumnAlign(detail);
                break;
            case 'update_column_format':
                this._handleUpdateColumnFormat(detail);
                break;
            default:
                console.warn('Unknown post-message command:', (detail as PostMessageCommand).command);
        }
    }

    _handleSelectionChange(e: CustomEvent<{ sheetIndex: number; tableIndex: number; selectedCol: number }>) {
        const { sheetIndex, tableIndex, selectedCol } = e.detail;
        this._currentSelectionInfo = { sheetIndex, tableIndex, selectedCol };
        this._computeToolbarFormat();
    }

    /** Compute toolbar format state from current selection and column metadata. */
    private _computeToolbarFormat() {
        const info = this._currentSelectionInfo;
        if (!info || info.selectedCol < 0) {
            this._activeToolbarFormat = {};
            return;
        }

        // Find tab by sheetIndex, not activeTabIndex
        const matchingTab = this.tabs.find((tab) => tab.type === 'sheet' && tab.sheetIndex === info.sheetIndex);
        if (!matchingTab || !isSheetJSON(matchingTab.data)) {
            this._activeToolbarFormat = {};
            return;
        }

        const table = (matchingTab.data as SheetJSON).tables?.[info.tableIndex];
        if (!table) {
            this._activeToolbarFormat = {};
            return;
        }

        // Alignment is stored at TableJSON.alignments array, NOT in column metadata
        const alignments = table.alignments;
        const align = alignments?.[info.selectedCol];

        // Format info is in visual metadata
        const visual = (table.metadata as Record<string, unknown>)?.visual as Record<string, unknown> | undefined;
        const columns = visual?.columns as Record<string, Record<string, unknown>> | undefined;
        const colMeta = columns?.[String(info.selectedCol)];
        const format = colMeta?.format as Record<string, unknown> | undefined;
        const numberFormat = format?.numberFormat as Record<string, unknown> | undefined;

        this._activeToolbarFormat = {
            alignment: align && align !== 'default' ? (align as 'left' | 'center' | 'right') : undefined,
            hasCommaSeparator: numberFormat?.useThousandsSeparator === true,
            hasPercent: numberFormat?.type === 'percent',
            decimals: typeof numberFormat?.decimals === 'number' ? numberFormat.decimals : undefined
        };
    }

    async _handleDocumentChange(detail: { sectionIndex: number; content: string; title?: string; save?: boolean }) {
        console.log('Document change received:', detail);

        // Find the active document tab
        const activeTab = this.tabs[this.activeTabIndex];
        if (!activeTab || activeTab.type !== 'document') {
            console.warn('Document change event but no active document tab');
            return;
        }

        // Use the docIndex tracked when the tab was created
        const docIndex = activeTab.docIndex;
        if (docIndex === undefined) {
            console.error('Document tab missing docIndex');
            return;
        }

        try {
            // Get the document section range from Python using docIndex
            const range = await this.spreadsheetService.getDocumentSectionRange(docIndex);

            console.log('Python result:', range);

            if (range && isIDocumentSectionRange(range)) {
                if (range.start_line !== undefined && range.end_line !== undefined) {
                    // Use title from event (may have been edited) or fall back to existing
                    const newTitle = detail.title || activeTab.title;
                    const header = `# ${newTitle}`;
                    // Ensure content ends with newline for separation from next section
                    const body = detail.content.endsWith('\n') ? detail.content : detail.content + '\n';
                    const fullContent = header + '\n' + body;

                    // Send update to VS Code
                    vscode.postMessage({
                        type: 'updateRange',
                        startLine: range.start_line,
                        endLine: range.end_line,
                        endCol: range.end_col,
                        content: fullContent
                    });

                    // Update local state including title
                    activeTab.title = newTitle;
                    if (isDocumentJSON(activeTab.data)) {
                        activeTab.data.content = detail.content;
                    } else {
                        // Initialize if missing or wrong type
                        activeTab.data = {
                            type: 'document',
                            title: newTitle,
                            content: detail.content
                        };
                    }
                    this.requestUpdate();

                    console.log('Document updated:', {
                        range,
                        title: newTitle,
                        content: fullContent.substring(0, 50) + '...'
                    });

                    if (detail.save) {
                        this._handleSave();
                    }
                } else if (range.error) {
                    console.error('Python error:', range.error);
                }
            }
        } catch (error) {
            console.error('Failed to update document section:', error);
            // Fallback: just update local state without file save
            if (detail.title) {
                activeTab.title = detail.title;
            }
            if (isDocumentJSON(activeTab.data)) {
                activeTab.data.content = detail.content;
            } else {
                activeTab.data = {
                    type: 'document',
                    title: detail.title || activeTab.title,
                    content: detail.content
                };
            }
            this.requestUpdate();
        }
    }

    private _handleUndo() {
        vscode.postMessage({ type: 'undo' });
        ClipboardStore.clear();
    }

    private _handleRedo() {
        vscode.postMessage({ type: 'redo' });
        ClipboardStore.clear();
    }

    private _saveDebounceTimer: number | null = null;
    _handleSave() {
        // Debounce save requests to prevent duplicate calls
        if (this._saveDebounceTimer !== null) {
            console.log('[Webview] Save already queued, skipping duplicate');
            return;
        }
        console.log('[Webview] _handleSave called, sending save message to extension host');
        vscode.postMessage({ type: 'save' });

        // Prevent another save for 500ms
        this._saveDebounceTimer = window.setTimeout(() => {
            this._saveDebounceTimer = null;
        }, 500);
    }

    connectedCallback() {
        super.connectedCallback();
        // Start service initialization immediately for faster startup
        // Don't await - let it run in parallel with component mounting
        this._initPromise = this.spreadsheetService.initialize();

        // Register callback for automatic formula recalculation after any data change
        // withinBatch: true because updateRange already manages the batch for single undo
        this.spreadsheetService.setOnDataChangedCallback(() => {
            recalculateAllFormulas(this.workbook, this.spreadsheetService, () => this.requestUpdate(), true);
        });

        try {
            const initialContent = window.initialContent;
            if (initialContent) {
                this.markdownInput = initialContent;
            }

            const initialConfig = window.initialConfig;
            if (initialConfig) {
                this.config = initialConfig;
            }
        } catch (e) {
            console.error('Error loading initial content:', e);
        }
        // Event listeners are now managed by GlobalEventController
    }

    async firstUpdated() {
        try {
            // Await the initialization that was started in connectedCallback
            await this._initPromise;
            console.log('Spreadsheet Service initialized.');
            // Event listeners are now managed by GlobalEventController

            console.log('Service initialized. Parsing initial content...');
            await this._parseWorkbook();

            // Remove the loading indicator now that initialization is complete
            // Note: The loader uses position:fixed so content renders behind it
            const loader = document.querySelector('.loading-container');
            if (loader) {
                loader.remove();
            }
        } catch (e: unknown) {
            console.error('Error initializing service:', e);
            let errorMessage = String(e);
            if (e instanceof Error) {
                errorMessage = e.message;
            } else if (typeof e === 'object' && e !== null) {
                errorMessage = JSON.stringify(e, Object.getOwnPropertyNames(e));
            }
            this.output = `Error initializing service: ${errorMessage}`;
        }
    }

    willUpdate(changedProperties: PropertyValues<this>) {
        // Reset toolbar format when switching tabs (no selection info for new tab yet)
        if (changedProperties.has('activeTabIndex')) {
            this._currentSelectionInfo = null;
            this._activeToolbarFormat = {};
        }

        // Update toolbar format when tabs change (e.g., after format applied via toolbar)
        if (changedProperties.has('tabs') && this._currentSelectionInfo) {
            this._computeToolbarFormat();
        }

        if (changedProperties.has('tabs')) {
            const tabs = this.tabs;
            const currentSheetCount = tabs.filter((t) => t.type === 'sheet').length;
            const sheetWasAdded = currentSheetCount === this._previousSheetCount + 1;

            // Handle Add Sheet Selection
            // STRICTLY require sheet count increase to avoid premature updates
            // (e.g. willUpdate triggering before tabs are fully updated)
            if (sheetWasAdded && (this.pendingAddSheet || this._previousSheetCount > 0)) {
                // If _pendingNewTabIndex is set, use it directly
                if (this._pendingNewTabIndex !== null) {
                    const maxValidIndex = tabs.length - 1;
                    const targetIndex = Math.min(this._pendingNewTabIndex, maxValidIndex);
                    // Skip add-sheet button
                    if (tabs[targetIndex]?.type !== 'add-sheet') {
                        this.activeTabIndex = targetIndex;
                        this._pendingNewTabIndex = null;
                    }
                } else {
                    // Fall back to finding the tab before add-sheet button
                    const addSheetIndex = tabs.findIndex((tab) => tab.type === 'add-sheet');
                    if (addSheetIndex > 0) {
                        this.activeTabIndex = addSheetIndex - 1;
                    } else if (addSheetIndex === 0) {
                        this.activeTabIndex = 0;
                    } else {
                        const lastSheetIndex =
                            tabs
                                .map((t, i) => ({ t, i }))
                                .filter((x) => x.t.type === 'sheet')
                                .pop()?.i ?? 0;
                        this.activeTabIndex = lastSheetIndex;
                    }
                }
                this.pendingAddSheet = false;
            }
            // Sanitize activeTabIndex (fallback)
            else if (this.activeTabIndex >= tabs.length) {
                if (tabs.length > 0) {
                    this.activeTabIndex = tabs.length - 1;
                } else {
                    this.activeTabIndex = 0;
                }
            }

            // If active tab is "add-sheet" (+), try to select previous one
            // (This handles deletion case where index points to +)
            const activeTab = tabs[this.activeTabIndex];
            if (activeTab && activeTab.type === 'add-sheet') {
                if (this.activeTabIndex > 0) {
                    this.activeTabIndex = this.activeTabIndex - 1;
                }
            }

            // Update previous sheet count for next comparison
            this._previousSheetCount = currentSheetCount;
        }
    }

    render() {
        // Show nothing during initialization (extension.ts provides loading indicator)
        if (!this.tabs.length && !this.output) {
            return html``;
        }

        return this._renderContent();
    }

    private _renderContent() {
        if (this.tabs.length === 0) {
            return this.output ? html`<div class="output">${this.output}</div>` : html``;
        }

        let activeTab = this.tabs[this.activeTabIndex];
        if (!activeTab && this.tabs.length > 0) {
            activeTab = this.tabs[0];
        }

        if (!activeTab) return html``;

        return html`
            ${activeTab.type !== 'document' && activeTab.type !== 'onboarding'
                ? html`
                      <spreadsheet-toolbar
                          .activeFormat="${this._activeToolbarFormat}"
                          @toolbar-action="${this._handleToolbarAction}"
                      ></spreadsheet-toolbar>
                  `
                : html``}
            <div class="content-area">
                ${activeTab.type === 'sheet' && isSheetJSON(activeTab.data)
                    ? html`
                          <div class="sheet-container" style="height: 100%">
                              <layout-container
                                  .layout="${(activeTab.data as SheetJSON).metadata?.layout}"
                                  .tables="${(activeTab.data as SheetJSON).tables}"
                                  .sheetIndex="${activeTab.sheetIndex}"
                                  .workbook="${this.workbook}"
                                  .dateFormat="${((this.config?.validation as Record<string, unknown>)
                                      ?.dateFormat as string) || 'YYYY-MM-DD'}"
                                  @save-requested="${this._handleSave}"
                                  @selection-change="${this._handleSelectionChange}"
                              ></layout-container>
                          </div>
                      `
                    : activeTab.type === 'document' && isDocumentJSON(activeTab.data)
                      ? html`
                            <spreadsheet-document-view
                                .title="${activeTab.title}"
                                .content="${(activeTab.data as DocumentJSON).content}"
                                @toolbar-action="${this._handleToolbarAction}"
                            ></spreadsheet-document-view>
                        `
                      : html``}
                ${activeTab.type === 'onboarding'
                    ? html`
                          <spreadsheet-onboarding
                              @create-spreadsheet="${this._onCreateSpreadsheet}"
                          ></spreadsheet-onboarding>
                      `
                    : html``}
            </div>

            <bottom-tabs
                .tabs="${this.tabs}"
                .activeIndex="${this.activeTabIndex}"
                .editingIndex="${this.editingTabIndex}"
                @tab-select="${(e: CustomEvent) => (this.activeTabIndex = e.detail.index)}"
                @tab-edit-start="${(e: CustomEvent) =>
                    this._handleTabDoubleClick(e.detail.index, this.tabs[e.detail.index])}"
                @tab-rename="${(e: CustomEvent) =>
                    this._handleTabRename(e.detail.index, e.detail.tab, e.detail.newName)}"
                @tab-context-menu="${(e: CustomEvent) => {
                    this.tabContextMenu = {
                        x: e.detail.x,
                        y: e.detail.y,
                        index: e.detail.index,
                        tabType: e.detail.tabType
                    };
                }}"
                @tab-reorder="${(e: CustomEvent) => this._handleTabReorder(e.detail.fromIndex, e.detail.toIndex)}"
                @add-sheet-click="${this._handleAddSheet}"
            ></bottom-tabs>

            <tab-context-menu
                .open="${this.tabContextMenu !== null}"
                .x="${this.tabContextMenu?.x ?? 0}"
                .y="${this.tabContextMenu?.y ?? 0}"
                .tabType="${this.tabContextMenu?.tabType ?? 'sheet'}"
                @rename="${() => this._renameTab(this.tabContextMenu!.index)}"
                @delete="${() => {
                    if (this.tabContextMenu?.tabType === 'sheet') {
                        this._deleteSheet(this.tabContextMenu.index);
                    } else {
                        this._deleteDocument(this.tabContextMenu!.index);
                    }
                }}"
                @add-document="${this._addDocumentFromMenu}"
                @add-sheet="${this._addSheetFromMenu}"
                @close="${() => (this.tabContextMenu = null)}"
            ></tab-context-menu>

            <!-- Delete Confirmation Modal -->
            <confirmation-modal
                .open="${this.confirmDeleteIndex !== null}"
                title="${this.confirmDeleteIndex !== null && this.tabs[this.confirmDeleteIndex]?.type === 'document'
                    ? t('deleteDocument')
                    : t('deleteSheet')}"
                confirmLabel="${t('delete')}"
                cancelLabel="${t('cancel')}"
                @confirm="${this._performDelete}"
                @cancel="${this._cancelDelete}"
            >
                ${unsafeHTML(
                    t(
                        this.confirmDeleteIndex !== null && this.tabs[this.confirmDeleteIndex]?.type === 'document'
                            ? 'deleteDocumentConfirm'
                            : 'deleteSheetConfirm',
                        `<span style="color: var(--vscode-textPreformat-foreground);">${
                            this.confirmDeleteIndex !== null
                                ? this.tabs[this.confirmDeleteIndex]?.title?.replace(/</g, '&lt;')
                                : ''
                        }</span>`
                    )
                )}
            </confirmation-modal>

            <add-tab-dropdown
                .open="${this.addTabDropdown !== null}"
                .x="${this.addTabDropdown?.x ?? 0}"
                .y="${this.addTabDropdown?.y ?? 0}"
                @add-sheet="${() => this._addSheet()}"
                @add-document="${() => this._addDocument()}"
                @close="${() => (this.addTabDropdown = null)}"
            ></add-tab-dropdown>
        `;
    }

    private _handleTabDoubleClick(index: number, tab: TabDefinition) {
        if (tab.type === 'sheet' || tab.type === 'document') {
            this.editingTabIndex = index;
            // Focus input after render
            setTimeout(() => {
                const input = this.shadowRoot?.querySelector('.tab-input') as HTMLInputElement;
                if (input) {
                    input.focus();
                    input.select();
                }
            }, 0);
        }
    }

    private _renameTab(index: number) {
        this.tabContextMenu = null;
        const tab = this.tabs[index];
        if (tab) this._handleTabDoubleClick(index, tab);
    }

    private _deleteSheet(index: number) {
        this.tabContextMenu = null;
        const tab = this.tabs[index];
        if (tab && tab.type === 'sheet' && typeof tab.sheetIndex === 'number') {
            // Trigger modal instead of confirm()
            this.confirmDeleteIndex = index;
        }
    }

    private _deleteDocument(index: number) {
        this.tabContextMenu = null;
        const tab = this.tabs[index];
        if (tab && tab.type === 'document' && typeof tab.docIndex === 'number') {
            // Trigger modal for document deletion
            this.confirmDeleteIndex = index;
        }
    }

    private _addDocumentFromMenu() {
        const targetTabOrderIndex = this.tabContextMenu!.index + 1;
        this.tabContextMenu = null;
        this._addDocumentAtPosition(targetTabOrderIndex);
    }

    private _addSheetFromMenu() {
        const targetTabOrderIndex = this.tabContextMenu!.index + 1;
        this.tabContextMenu = null;
        this._addSheetAtPosition(targetTabOrderIndex);
    }

    /**
     * Add a new Document at a specific tab order position.
     * Calculates the physical afterDocIndex based on Documents before targetTabOrderIndex.
     */
    private _addDocumentAtPosition(targetTabOrderIndex: number) {
        // Count Document items in tabs before the target position (excluding add-sheet)
        let docsBeforeTarget = 0;
        for (let i = 0; i < Math.min(targetTabOrderIndex, this.tabs.length); i++) {
            if (this.tabs[i].type === 'document') {
                docsBeforeTarget++;
            }
        }

        // Determine physical insertion position
        let afterDocIndex = docsBeforeTarget - 1; // Insert after this document index
        let afterWorkbook = false;

        // If no documents before target, check if there are sheets before
        // (meaning we're inserting after/within the workbook area)
        if (docsBeforeTarget === 0) {
            // Check if there are any sheets before target position
            const sheetsBeforeTarget =
                this.tabs
                    .slice(0, Math.min(targetTabOrderIndex, this.tabs.length))
                    .filter((t) => t.type === 'sheet' || t.type === 'add-sheet').length > 0;
            if (sheetsBeforeTarget) {
                afterWorkbook = true;
            } else {
                afterDocIndex = -1; // Insert at beginning
            }
        }

        // Generate default document name
        const docCount = this.tabs.filter((t) => t.type === 'document').length;
        const newDocName = `${t('documentNamePrefix')} ${docCount + 1}`;

        // Store pending new tab index
        this._pendingNewTabIndex = targetTabOrderIndex;

        this.spreadsheetService.addDocument(newDocName, afterDocIndex, afterWorkbook, targetTabOrderIndex - 1);
    }

    /**
     * Add a new Sheet at a specific tab order position.
     * Calculates the physical afterSheetIndex based on Sheets before targetTabOrderIndex.
     */
    private _addSheetAtPosition(targetTabOrderIndex: number) {
        // Count Sheet items in tabs before the target position
        let sheetsBeforeTarget = 0;
        for (let i = 0; i < Math.min(targetTabOrderIndex, this.tabs.length); i++) {
            if (this.tabs[i].type === 'sheet') {
                sheetsBeforeTarget++;
            }
        }

        // The new sheet will be inserted at this sheet index position
        const afterSheetIndex = sheetsBeforeTarget;

        // Generate default sheet name
        let newSheetName = `${t('sheetNamePrefix')} 1`;
        if (this.workbook && this.workbook.sheets) {
            newSheetName = `${t('sheetNamePrefix')} ${this.workbook.sheets.length + 1}`;
        }

        // Store pending add state
        this.pendingAddSheet = true;
        this._pendingNewTabIndex = targetTabOrderIndex;

        // Call service with the calculated position
        this.spreadsheetService.addSheet(newSheetName, afterSheetIndex, targetTabOrderIndex);
    }

    private _cancelDelete() {
        this.confirmDeleteIndex = null;
    }

    private _performDelete() {
        const index = this.confirmDeleteIndex;
        if (index === null) return;

        // Close modal immediately
        this.confirmDeleteIndex = null;

        const tab = this.tabs[index];
        if (tab && tab.type === 'sheet' && typeof tab.sheetIndex === 'number') {
            this.spreadsheetService.deleteSheet(tab.sheetIndex);
        } else if (tab && tab.type === 'document' && typeof tab.docIndex === 'number') {
            this.spreadsheetService.deleteDocument(tab.docIndex);
        }
    }

    private async _handleTabRename(index: number, tab: TabDefinition, newName: string) {
        if (this.editingTabIndex !== index) return;
        this.editingTabIndex = null; // Exit edit mode

        if (!newName || newName === tab.title) return;

        if (tab.type === 'sheet' && typeof tab.sheetIndex === 'number') {
            this.spreadsheetService.renameSheet(tab.sheetIndex, newName);
        } else if (tab.type === 'document' && typeof tab.docIndex === 'number') {
            this.spreadsheetService.renameDocument(tab.docIndex, newName);
        }
    }

    private async _handleAddSheet(e?: CustomEvent<{ x: number; y: number }>) {
        // Show dropdown menu for choosing what to add
        if (e?.detail) {
            // Use coordinates from bottom-tabs component event
            this.addTabDropdown = { x: e.detail.x, y: e.detail.y - 80 }; // Position above the button
        } else if (e) {
            // Fallback: use target element position
            const target = e.target as HTMLElement;
            const rect = target.getBoundingClientRect();
            this.addTabDropdown = { x: rect.left, y: rect.top - 80 };
        } else {
            // Fallback: add sheet directly if no event
            this._addSheet();
        }
    }

    private async _addSheet() {
        this.addTabDropdown = null;
        this.pendingAddSheet = true;
        // NOTE: Do NOT set _pendingNewTabIndex here - the willUpdate fallback logic
        // (selecting tab before add-sheet button) handles append-at-end correctly.
        // Setting _pendingNewTabIndex would point to the add-sheet button position,
        // which breaks selection.

        // Calculate the sheet name
        let newSheetName = `${t('sheetNamePrefix')} 1`;
        if (this.workbook && this.workbook.sheets) {
            newSheetName = `${t('sheetNamePrefix')} ${this.workbook.sheets.length + 1}`;
        }

        // Calculate append indices (same as _addSheetAtPosition for end-of-list)
        const validTabs = this.tabs.filter((t) => t.type === 'sheet' || t.type === 'document');
        const targetTabOrderIndex = validTabs.length;

        // Count sheets to append after the last one
        const sheetsBeforeTarget = this.tabs.filter((t) => t.type === 'sheet').length;
        const afterSheetIndex = sheetsBeforeTarget; // Append after last sheet

        this.spreadsheetService.addSheet(newSheetName, afterSheetIndex, targetTabOrderIndex);
    }

    public addSheet(newSheetName: string) {
        if (this.spreadsheetService) {
            // Default public method also appends
            this.spreadsheetService.addSheet(newSheetName);
        }
    }

    private async _addDocument() {
        this.addTabDropdown = null;
        // Delegate to _addDocumentAtPosition for consistent behavior with context menu
        const validTabs = this.tabs.filter((t) => t.type === 'sheet' || t.type === 'document');
        const targetTabOrderIndex = validTabs.length;
        this._addDocumentAtPosition(targetTabOrderIndex);
    }

    private _onCreateSpreadsheet() {
        this.spreadsheetService.createSpreadsheet();
    }

    async _parseWorkbook() {
        try {
            // 2. Initialization Phase
            const result = (await this.spreadsheetService.initializeWorkbook(
                this.markdownInput,
                this.config
            )) as unknown as IParseResult;

            if (!result) return;

            this.workbook = result.workbook;

            const structure: StructureItem[] = result.structure as unknown as StructureItem[];
            const newTabs: TabDefinition[] = [];
            let workbookFound = false;
            let docIndex = 0; // Track document section index separately

            // Reconstruct Tabs from Structure
            for (const section of structure) {
                if (section.type === 'document') {
                    newTabs.push({
                        type: 'document',
                        title: section.title!,
                        index: newTabs.length,
                        docIndex: docIndex++, // Store document section index
                        data: section
                    });
                } else if (section.type === 'workbook') {
                    workbookFound = true;
                    if (this.workbook && this.workbook.sheets.length > 0) {
                        this.workbook.sheets.forEach((sheet, shIdx: number) => {
                            newTabs.push({
                                type: 'sheet',
                                title: sheet.name || `Sheet ${shIdx + 1}`,
                                index: newTabs.length,
                                sheetIndex: shIdx,
                                data: sheet
                            });
                        });
                        // Note: Add-sheet button is added at the very end after all tabs are collected
                    } else {
                        // Empty workbook placeholder
                        newTabs.push({
                            type: 'onboarding',
                            title: t('newSpreadsheet'),
                            index: newTabs.length
                        });
                    }
                }
            }

            if (!workbookFound) {
                // If no workbook marker found, add empty placeholder at end
                newTabs.push({
                    type: 'onboarding',
                    title: t('newSpreadsheet'),
                    index: newTabs.length
                });
            }

            // Add "Add Sheet" button - this will be placed at the very end after reordering
            const hasSheets = newTabs.some((t) => t.type === 'sheet');
            if (hasSheets) {
                newTabs.push({
                    type: 'add-sheet',
                    title: '+',
                    index: newTabs.length
                });
            }

            // Reorder tabs based on tab_order metadata if available
            const tabOrder = this.workbook?.metadata?.tab_order as Array<{ type: string; index: number }> | undefined;
            if (tabOrder && tabOrder.length > 0) {
                const reorderedTabs: TabDefinition[] = [];

                for (const orderItem of tabOrder) {
                    let matchedTab: TabDefinition | undefined;

                    if (orderItem.type === 'sheet') {
                        matchedTab = newTabs.find((t) => t.type === 'sheet' && t.sheetIndex === orderItem.index);
                    } else if (orderItem.type === 'document') {
                        matchedTab = newTabs.find((t) => t.type === 'document' && t.docIndex === orderItem.index);
                    }

                    if (matchedTab) {
                        reorderedTabs.push(matchedTab);
                    }
                }

                // Add any tabs not in tab_order (onboarding, etc.) at the end
                // EXCEPT add-sheet which should always be last
                let addSheetTab: TabDefinition | undefined;
                for (const tab of newTabs) {
                    if (!reorderedTabs.includes(tab)) {
                        if (tab.type === 'add-sheet') {
                            addSheetTab = tab;
                        } else {
                            reorderedTabs.push(tab);
                        }
                    }
                }
                // Always add add-sheet at the very end
                if (addSheetTab) {
                    reorderedTabs.push(addSheetTab);
                }

                // Reassign indices
                reorderedTabs.forEach((tab, idx) => {
                    tab.index = idx;
                });

                this.tabs = reorderedTabs;
            } else {
                this.tabs = newTabs;
            }
            // Select newly added document tab if pending
            // Skip if pendingAddSheet - willUpdate handles Sheet add selection
            if (this._pendingNewTabIndex !== null && !this.pendingAddSheet) {
                // Simple rule: select the tab at the pending index
                // Clamp to valid range (in case tabs were reordered)
                const maxValidIndex = this.tabs.length - 1;
                const targetIndex = Math.min(this._pendingNewTabIndex, maxValidIndex);
                // Skip if target is add-sheet button - wait for next parse when new tab exists
                if (this.tabs[targetIndex]?.type !== 'add-sheet') {
                    this.activeTabIndex = targetIndex;
                    // Only reset when selection is successful
                    this._pendingNewTabIndex = null;
                }
                // If target is add-sheet, keep pending for next parse cycle
            }

            this.requestUpdate();

            // Calculate all formula column values on initial load only
            if (!this._formulasInitialized) {
                this._formulasInitialized = true;
                calculateAllFormulas(this.workbook, this.spreadsheetService, () => this.requestUpdate());
            }

            // Update output message if successful
            this.output = 'Parsed successfully!';
        } catch (err: unknown) {
            console.error(err);
            this.output = `Error parsing: ${(err as Error).message}`;
            this.workbook = null;
            this.tabs = [];
        }
    }

    /**
     * Handle tab reorder from bottom-tabs component drag-drop
     *
     * Reordering follows SPECS.md section 8.4:
     * - Document↔Document: Physical move in Markdown
     * - Sheet↔Sheet: Physical move within Workbook
     * - Document↔Workbook boundary: Physical move in Markdown
     * - Sheet↔Document (cross-type within UI): Metadata-only update
     */
    private async _handleTabReorder(fromIndex: number, toIndex: number) {
        if (fromIndex === toIndex) return;

        const fromTab = this.tabs[fromIndex];
        const toTab = toIndex < this.tabs.length ? this.tabs[toIndex] : null;

        // Determine the boundary context: is the target at a Workbook boundary?
        // Find the first and last sheet tab indices to determine Workbook boundaries
        const firstSheetIdx = this.tabs.findIndex((t) => t.type === 'sheet');
        const lastSheetIdx = this.tabs.reduce((acc, t, i) => (t.type === 'sheet' ? i : acc), -1);
        const hasWorkbook = firstSheetIdx !== -1;

        if (fromTab.type === 'sheet') {
            // Check if there are documents after the workbook (last doc index > last sheet index)
            const lastDocIdx = this.tabs.reduce((acc, t, i) => (t.type === 'document' ? i : acc), -1);
            const hasDocsAfterWorkbook = lastDocIdx > lastSheetIdx;
            const sheetCount = this.tabs.filter((t) => t.type === 'sheet').length;

            // Helper: Compute what the new tab order would look like after this move
            const computeNewTabOrder = (): typeof this.tabs => {
                const newTabs = [...this.tabs];
                const [moved] = newTabs.splice(fromIndex, 1);
                const insertIdx = fromIndex < toIndex ? toIndex - 1 : toIndex;
                newTabs.splice(insertIdx, 0, moved);
                return newTabs;
            };

            // Helper: Check if a Document should be before Workbook based on new tab order
            const shouldDocumentBeBeforeWorkbook = (
                newTabs: typeof this.tabs
            ): { needed: boolean; docIndex?: number; targetTabOrderIndex?: number } => {
                const newFirstSheetIdx = newTabs.findIndex((t) => t.type === 'sheet');
                if (newFirstSheetIdx <= 0) return { needed: false };

                // Check if there's a document before the first sheet
                for (let i = 0; i < newFirstSheetIdx; i++) {
                    if (newTabs[i].type === 'document') {
                        // Check if currently this doc is after workbook in file
                        const currentDocIdx = this.tabs.findIndex((t) => t === newTabs[i]);
                        if (currentDocIdx > firstSheetIdx) {
                            return { needed: true, docIndex: newTabs[i].docIndex!, targetTabOrderIndex: i };
                        }
                    }
                }
                return { needed: false };
            };

            // Helper: Check if Workbook should be before a Document based on new tab order
            const shouldWorkbookBeBeforeDocument = (
                newTabs: typeof this.tabs
            ): { needed: boolean; toDocIndex?: number; targetTabOrderIndex?: number } => {
                const newFirstSheetIdx = newTabs.findIndex((t) => t.type === 'sheet');
                // If no sheets or sheet is NOT first, no need to move workbook
                if (newFirstSheetIdx !== 0) return { needed: false };

                // Sheet is first in new tab_order. Check if currently a Document is before Workbook in file.
                if (firstSheetIdx > 0) {
                    for (let i = 0; i < firstSheetIdx; i++) {
                        if (this.tabs[i].type === 'document') {
                            return { needed: true, toDocIndex: this.tabs[i].docIndex!, targetTabOrderIndex: 0 };
                        }
                    }
                }
                return { needed: false };
            };

            // FIRST: For multi-sheet workbooks, check if this move requires physical adjustment
            // This takes precedence over Sheet→Sheet reorder
            if (sheetCount > 1) {
                const newTabs = computeNewTabOrder();

                // Check if a Document needs to move before Workbook
                const docAdjustment = shouldDocumentBeBeforeWorkbook(newTabs);
                if (docAdjustment.needed) {
                    this.spreadsheetService.moveDocumentSection(
                        docAdjustment.docIndex!,
                        null,
                        false,
                        true,
                        docAdjustment.targetTabOrderIndex!
                    );
                    return;
                }

                // Check if Workbook needs to move before a Document
                const wbAdjustment = shouldWorkbookBeBeforeDocument(newTabs);
                if (wbAdjustment.needed) {
                    this.spreadsheetService.moveWorkbookSection(
                        wbAdjustment.toDocIndex!,
                        false,
                        wbAdjustment.targetTabOrderIndex!
                    );
                    return;
                }
            }

            if (toTab?.type === 'sheet') {
                // Sheet → Sheet: Physical reorder within workbook
                const fromSheetIndex = fromTab.sheetIndex!;
                const toSheetIndex = toTab.sheetIndex!;
                this._moveSheet(fromSheetIndex, toSheetIndex, toIndex);
            } else if (toTab?.type === 'document') {
                // Sheet → Document position
                if (sheetCount === 1) {
                    // Single sheet = Workbook crosses Document boundary (physical move)
                    // Python handles metadata (including sheetIndex recalculation)
                    const toDocIndex = toTab.docIndex!;
                    this.spreadsheetService.moveWorkbookSection(toDocIndex, false, toIndex);
                    // Note: Do NOT call _updateTabOrder here - Python handles metadata correctly
                } else {
                    // Multiple sheets = Metadata-only (cross-type display order)
                    this._reorderTabsArray(fromIndex, toIndex);
                    this._updateTabOrder();
                }
            } else if ((toTab?.type === 'add-sheet' || !toTab) && hasDocsAfterWorkbook) {
                // Sheet → End of tabs (after last Document)
                if (sheetCount === 1) {
                    // Single sheet = Move Workbook to file end
                    // Python handles metadata
                    const docCount = this.tabs.filter((t) => t.type === 'document').length;
                    this.spreadsheetService.moveWorkbookSection(docCount, false, toIndex);
                    // Note: Do NOT call _updateTabOrder here - Python handles metadata correctly
                } else {
                    // Multiple sheets = Metadata-only
                    this._reorderTabsArray(fromIndex, toIndex);
                    this._updateTabOrder();
                }
            } else if (toTab?.type === 'add-sheet' || !toTab) {
                // Sheet → add-sheet (no docs after): Just reorder within workbook
                const fromSheetIndex = fromTab.sheetIndex!;
                const toSheetIndex = sheetCount;
                this._moveSheet(fromSheetIndex, toSheetIndex, toIndex);
            } else {
                // Fallback: metadata-only
                this._reorderTabsArray(fromIndex, toIndex);
                this._updateTabOrder();
            }
        } else if (fromTab.type === 'document') {
            const fromDocIndex = fromTab.docIndex!;

            if (toTab?.type === 'document') {
                // Document → Document: Physical reorder in file
                // Python updates both file content and metadata (including docIndex recalculation)
                const toDocIndex = toTab.docIndex!;
                this.spreadsheetService.moveDocumentSection(fromDocIndex, toDocIndex, false, false, toIndex);
                // Note: Do NOT call _updateTabOrder here - it would overwrite Python's correct metadata
                // with stale local docIndex values. Wait for server response to refresh tabs.
            } else if (!hasWorkbook) {
                // No workbook exists - just reorder metadata
                this._reorderTabsArray(fromIndex, toIndex);
                this._updateTabOrder();
            } else if (toIndex <= firstSheetIdx) {
                // Document → Before Workbook: Physical move
                // Python updates both file content and metadata (including docIndex recalculation)
                this.spreadsheetService.moveDocumentSection(fromDocIndex, null, false, true, toIndex);
                // Note: Do NOT call _updateTabOrder here - Python handles metadata correctly
            } else if (toIndex > lastSheetIdx || toTab?.type === 'add-sheet' || !toTab) {
                // Document → After Workbook: Physical move
                // Python updates both file content and metadata (including docIndex recalculation)
                this.spreadsheetService.moveDocumentSection(fromDocIndex, null, true, false, toIndex);
                // Note: Do NOT call _updateTabOrder here - Python handles metadata correctly
            } else {
                // Document → Between sheets (inside Workbook UI): Metadata-only
                this._reorderTabsArray(fromIndex, toIndex);
                this._updateTabOrder();
            }
        }

        // Calculate final position and select the moved tab
        // When moving from left to right: newIndex = toIndex - 1 (because original was removed first)
        // When moving from right to left: newIndex = toIndex
        const newIndex = fromIndex < toIndex ? toIndex - 1 : toIndex;
        this.activeTabIndex = newIndex;
    }

    /**
     * Reorder the tabs array by moving element from fromIndex to toIndex.
     * This is used for cross-type moves where only metadata needs updating.
     */
    private _reorderTabsArray(fromIndex: number, toIndex: number) {
        const moved = this.tabs.splice(fromIndex, 1)[0];
        // Adjust toIndex after splice
        const insertAt = fromIndex < toIndex ? toIndex - 1 : toIndex;
        this.tabs.splice(insertAt, 0, moved);
        // Re-index tabs
        this.tabs.forEach((t, i) => {
            t.index = i;
        });
    }

    private async _moveSheet(from: number, to: number, targetTabOrderIndex: number) {
        if (from === to) return;

        if (from < to) {
            to -= 1;
        }

        this.spreadsheetService.moveSheet(from, to, targetTabOrderIndex);
    }

    /**
     * Update tab order in workbook metadata for cross-type display changes.
     * This is called when a tab is moved to a position among different types
     * (e.g., Sheet displayed between Documents, or Document displayed between Sheets).
     */
    private _updateTabOrder() {
        const tabOrder = this.tabs
            .filter((t) => t.type === 'sheet' || t.type === 'document')
            .map((t) => ({
                type: t.type,
                index: t.type === 'sheet' ? t.sheetIndex! : t.docIndex!
            }));

        this.spreadsheetService.updateWorkbookTabOrder(tabOrder);
    }

    async _handleColumnResize(detail: IColumnResizeDetail) {
        const { sheetIndex, tableIndex, col, width } = detail;
        this.spreadsheetService.updateColumnWidth(sheetIndex, tableIndex, col, width);
    }

    private _handleToolbarAction(e: CustomEvent) {
        console.log('Main: _handleToolbarAction', e.detail);
        const action = e.detail.action;

        // Handle undo/redo/save at main.ts level (not delegated to table)
        if (action === 'save') {
            this._handleSave();
            return;
        }
        if (action === 'undo') {
            this._handleUndo();
            return;
        }
        if (action === 'redo') {
            this._handleRedo();
            return;
        }

        // Delegate other actions to active table
        const table = window.activeSpreadsheetTable;
        if (table && table.handleToolbarAction) {
            table.handleToolbarAction(action);
        } else {
            console.warn('Main: No active table found to handle action');
        }
    }

    updated(changedProperties: PropertyValues<this>) {
        if (changedProperties.has('tabs') || changedProperties.has('activeTabIndex')) {
            // Defer to ensure layout is complete
            setTimeout(() => this._checkScrollOverflow(), 0);
        }
        // Position adjustment for context menu is now handled by tab-context-menu component
    }

    private _handleTabScroll() {
        this._checkScrollOverflow();
    }

    private _checkScrollOverflow() {
        const container = this.shadowRoot?.querySelector('.bottom-tabs') as HTMLElement;
        if (container) {
            // Tolerance of 2px
            const isScrollable = container.scrollWidth > container.clientWidth;
            const isAtEnd = Math.abs(container.scrollWidth - container.clientWidth - container.scrollLeft) < 2;

            const shouldShow = isScrollable && !isAtEnd;

            if (this.isScrollableRight !== shouldShow) {
                this.isScrollableRight = shouldShow;
            }
        }
    }
}

// Add global definition for acquireVsCodeApi
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare function acquireVsCodeApi(): any;
