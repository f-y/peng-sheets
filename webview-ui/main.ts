import { html, LitElement, PropertyValues, unsafeCSS } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { provideVSCodeDesignSystem } from '@vscode/webview-ui-toolkit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { t } from './utils/i18n';
import mainStyles from './styles/main.css?inline';

import './components/spreadsheet-toolbar';
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
    IValidationUpdateDetail
} from './types';

// Register the VS Code Design System components
import { SpreadsheetService } from './services/spreadsheet-service';

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

// declare const loadPyodide: any; // Moved to service usage

// Acquire VS Code API
const vscode = acquireVsCodeApi();

// @ts-expect-error Vite raw import for Python module
import pythonCore from '../python-modules/headless_editor.py?raw';

@customElement('md-spreadsheet-editor')
export class MdSpreadsheetEditor extends LitElement implements GlobalEventHost {
    static styles = [unsafeCSS(mainStyles)];

    public readonly spreadsheetService = new SpreadsheetService(pythonCore, vscode);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private _globalEventController = new GlobalEventController(this);
    // Promise for Pyodide initialization, started early in connectedCallback
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
                const currentVisual =
                    ((table.metadata as Record<string, unknown>)?.visual as Record<string, unknown>) || {};
                const currentValidation = (currentVisual.validation as Record<string, unknown>) || {};

                if (rule === null) {
                    // Remove validation for this column
                    delete currentValidation[colIndex.toString()];
                } else {
                    // Set validation rule for this column
                    currentValidation[colIndex.toString()] = rule;
                }

                const newVisual = {
                    ...currentVisual,
                    validation: Object.keys(currentValidation).length > 0 ? currentValidation : undefined
                };

                // Clean up undefined validation key
                if (newVisual.validation === undefined) {
                    delete newVisual.validation;
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
        const { sheetIndex } = detail;
        this.spreadsheetService.addTable(sheetIndex, t('newTable'));
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
        this.spreadsheetService.updateRange(sheetIdx, tableIdx, startRow, endRow, startCol, endCol, newValue);
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
    }

    private _handleRedo() {
        vscode.postMessage({ type: 'redo' });
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
        // Start Pyodide initialization immediately for faster startup
        // Don't await - let it run in parallel with component mounting
        this._initPromise = this.spreadsheetService.initialize();

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

            console.log('Pyodide initialized. Parsing initial content...');
            await this._parseWorkbook();
        } catch (e: unknown) {
            console.error('Error initializing Pyodide:', e);
            let errorMessage = String(e);
            if (e instanceof Error) {
                errorMessage = e.message;
            } else if (typeof e === 'object' && e !== null) {
                errorMessage = JSON.stringify(e, Object.getOwnPropertyNames(e));
            }
            this.output = `Error initializing Pyodide: ${errorMessage}`;
        }
    }

    willUpdate(changedProperties: PropertyValues<this>) {
        if (changedProperties.has('tabs')) {
            const tabs = this.tabs;
            const currentSheetCount = tabs.filter((t) => t.type === 'sheet').length;
            const sheetWasAdded = currentSheetCount === this._previousSheetCount + 1;

            // Handle Add Sheet Selection
            // Use pendingAddSheet flag OR detect sheet count increase as fallback
            if (this.pendingAddSheet || (sheetWasAdded && this._previousSheetCount > 0)) {
                // Find the 'add-sheet' button and select the tab immediately before it
                // (which is the newly added sheet). This handles cases where Documents
                // appear after the Workbook in the tabs array.
                const addSheetIndex = tabs.findIndex((tab) => tab.type === 'add-sheet');
                if (addSheetIndex > 0) {
                    // Select the tab before the add-sheet button (the new sheet)
                    this.activeTabIndex = addSheetIndex - 1;
                } else if (addSheetIndex === 0) {
                    // Edge case: add-sheet is first (shouldn't happen normally)
                    this.activeTabIndex = 0;
                } else {
                    // No add-sheet button found, fallback to last sheet tab
                    const lastSheetIndex =
                        tabs
                            .map((t, i) => ({ t, i }))
                            .filter((x) => x.t.type === 'sheet')
                            .pop()?.i ?? 0;
                    this.activeTabIndex = lastSheetIndex;
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
                ? html` <spreadsheet-toolbar @toolbar-action="${this._handleToolbarAction}"></spreadsheet-toolbar> `
                : html``}
            <div class="content-area">
                ${activeTab.type === 'sheet' && isSheetJSON(activeTab.data)
                    ? html`
                          <div class="sheet-container" style="height: 100%">
                              <layout-container
                                  .layout="${(activeTab.data as SheetJSON).metadata?.layout}"
                                  .tables="${(activeTab.data as SheetJSON).tables}"
                                  .sheetIndex="${activeTab.sheetIndex}"
                                  .dateFormat="${(this.config?.validation as any)?.dateFormat || 'YYYY-MM-DD'}"
                                  @save-requested="${this._handleSave}"
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
        this.tabContextMenu = null;
        this._addDocument();
    }

    private _addSheetFromMenu() {
        this.tabContextMenu = null;
        this._addSheet();
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

        let newSheetName = 'Sheet 1';
        if (this.workbook && this.workbook.sheets) {
            newSheetName = `Sheet ${this.workbook.sheets.length + 1}`;
        }
        this.spreadsheetService.addSheet(newSheetName);
    }

    public addSheet(newSheetName: string) {
        if (this.spreadsheetService) {
            this.spreadsheetService.addSheet(newSheetName);
        }
    }

    private async _addDocument() {
        this.addTabDropdown = null;

        // Get current active tab to determine insertion position
        const activeTab = this.tabs[this.activeTabIndex];
        let afterDocIndex = -1;
        let afterWorkbook = false;
        // Use activeTabIndex for tab_order position (UI ordering)
        const insertAfterTabOrderIndex = this.activeTabIndex;

        if (activeTab?.type === 'document' && typeof activeTab.docIndex === 'number') {
            // Document tab selected - add after this document
            afterDocIndex = activeTab.docIndex;
        } else if (activeTab?.type === 'sheet' || activeTab?.type === 'add-sheet') {
            // Sheet tab selected - add after the LAST document (at file end)
            // Find the highest document index to insert after it
            const docTabs = this.tabs.filter((t) => t.type === 'document');
            if (docTabs.length > 0) {
                const maxDocIndex = Math.max(...docTabs.map((t) => t.docIndex!));
                afterDocIndex = maxDocIndex;
            } else {
                // No documents exist - add after workbook
                afterWorkbook = true;
            }
        } else {
            // No valid tab or fallback - add after last document or at end
            const docTabs = this.tabs.filter((t) => t.type === 'document');
            if (docTabs.length > 0) {
                afterDocIndex = Math.max(...docTabs.map((t) => t.docIndex!));
            } else {
                afterWorkbook = true;
            }
        }

        // Generate default document name
        const docCount = this.tabs.filter((t) => t.type === 'document').length;
        const newDocName = `Document ${docCount + 1}`;

        // Store pending new tab index to select after update
        // Simple rule: new tab will be at the position after current selection
        this._pendingNewTabIndex = this.activeTabIndex + 1;

        this.spreadsheetService.addDocument(newDocName, afterDocIndex, afterWorkbook, insertAfterTabOrderIndex);
    }

    private _onCreateSpreadsheet() {
        vscode.postMessage({ type: 'createSpreadsheet' });
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
                        // Add "Add Sheet" button
                        newTabs.push({
                            type: 'add-sheet',
                            title: '+',
                            index: newTabs.length
                        });
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
            if (this._pendingNewTabIndex !== null) {
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
     */
    private async _handleTabReorder(fromIndex: number, toIndex: number) {
        if (fromIndex === toIndex) return;

        const fromTab = this.tabs[fromIndex];
        const toTab = toIndex < this.tabs.length ? this.tabs[toIndex] : null;

        // Handle different move scenarios
        if (fromTab.type === 'sheet') {
            if (toTab?.type === 'sheet' || toTab?.type === 'add-sheet' || !toTab) {
                // Sheet → Sheet: Physical reorder within workbook
                const fromSheetIndex = fromTab.sheetIndex!;
                let toSheetIndex = 0;

                if (toTab?.type === 'sheet') {
                    toSheetIndex = toTab.sheetIndex!;
                } else {
                    const sheets = this.tabs.filter((t) => t.type === 'sheet');
                    toSheetIndex = sheets.length;
                }

                this._moveSheet(fromSheetIndex, toSheetIndex, toIndex);
            } else {
                // Sheet → Document position: Metadata-only (cross-type display)
                this._reorderTabsArray(fromIndex, toIndex);
                this._updateTabOrder();
            }
        } else if (fromTab.type === 'document') {
            if (toTab?.type === 'document') {
                // Document → Document: Physical reorder in file
                const fromDocIndex = fromTab.docIndex!;
                const toDocIndex = toTab.docIndex!;
                this.spreadsheetService.moveDocumentSection(fromDocIndex, toDocIndex, false, false, toIndex);
            } else {
                // Document → Sheet position: Metadata-only (cross-type display)
                this._reorderTabsArray(fromIndex, toIndex);
                this._updateTabOrder();
            }
        }
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
