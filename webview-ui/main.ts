import { html, LitElement, PropertyValues } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { provideVSCodeDesignSystem } from '@vscode/webview-ui-toolkit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { t } from './utils/i18n';
import { mainStyles } from './styles/main-styles';

import './components/spreadsheet-toolbar';
import './components/spreadsheet-table';
import './components/spreadsheet-onboarding';
import './components/spreadsheet-document-view';
import './components/confirmation-modal';
import './components/layout-container';
import './components/layout-container';
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
    ICellEditDetail,
    IRangeEditDetail,
    IRowOperationDetail,
    IColumnOperationDetail,
    IColumnResizeDetail,
    IColumnFilterDetail
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
export class MyEditor extends LitElement {
    static styles = [mainStyles];

    private spreadsheetService = new SpreadsheetService(pythonCore, vscode);

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

    private async _handleMetadataEdit(detail: IMetadataEditDetail) {
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
    private async _handleMetadataUpdate(detail: IMetadataUpdateDetail) {
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

    private async _handleVisualMetadataUpdate(detail: IVisualMetadataUpdateDetail) {
        const { sheetIndex, tableIndex, visual } = detail;
        this.spreadsheetService.updateVisualMetadata(sheetIndex, tableIndex, visual);
    }

    private async _handleSheetMetadataUpdate(detail: ISheetMetadataUpdateDetail) {
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

    private async _handleRequestAddTable(detail: IRequestAddTableDetail) {
        const { sheetIndex } = detail;
        this.spreadsheetService.addTable(sheetIndex, t('newTable'));
    }

    private async _handleRequestRenameTable(detail: IRequestRenameTableDetail) {
        if (!this.workbook) return;
        const { sheetIndex, tableIndex, newName } = detail;

        this.spreadsheetService.renameTable(sheetIndex, tableIndex, newName);
    }

    private async _handleRequestDeleteTable(detail: IRequestDeleteTableDetail) {
        const { sheetIndex, tableIndex } = detail;

        // Optimistic update
        const tab = this.tabs.find((t) => t.type === 'sheet' && t.sheetIndex === sheetIndex);
        if (tab && isSheetJSON(tab.data)) {
            tab.data.tables.splice(tableIndex, 1);
            this.requestUpdate();
        }

        this.spreadsheetService.deleteTable(sheetIndex, tableIndex);
    }

    private _onMetadataChange(e: CustomEvent) {
        this._handleVisualMetadataUpdate(e.detail);
    }

    private async _onCellEdit(e: CustomEvent) {
        const { sheetIndex, tableIndex, rowIndex, colIndex, newValue } = e.detail;
        await this._handleRangeEdit(sheetIndex, tableIndex, rowIndex, rowIndex, colIndex, colIndex, newValue);
    }

    private async _onRangeEdit(e: CustomEvent) {
        const { sheetIndex, tableIndex, startRow, endRow, startCol, endCol, newValue } = e.detail;
        await this._handleRangeEdit(sheetIndex, tableIndex, startRow, endRow, startCol, endCol, newValue);
    }

    private async _handleRangeEdit(
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

    private async _handleDeleteRow(sheetIdx: number, tableIdx: number, rowIndex: number) {
        this.spreadsheetService.deleteRow(sheetIdx, tableIdx, rowIndex);
    }

    private async _handleDeleteRows(sheetIdx: number, tableIdx: number, rowIndices: number[]) {
        this.spreadsheetService.deleteRows(sheetIdx, tableIdx, rowIndices);
    }

    private async _handleDeleteColumn(sheetIdx: number, tableIdx: number, colIndex: number) {
        this.spreadsheetService.deleteColumn(sheetIdx, tableIdx, colIndex);
    }

    private async _handleInsertRow(sheetIdx: number, tableIdx: number, rowIndex: number) {
        this.spreadsheetService.insertRow(sheetIdx, tableIdx, rowIndex);
    }

    private async _handleInsertColumn(sheetIdx: number, tableIdx: number, colIndex: number) {
        this.spreadsheetService.insertColumn(sheetIdx, tableIdx, colIndex);
    }

    private async _handleClearColumn(sheetIdx: number, tableIdx: number, colIndex: number) {
        this.spreadsheetService.clearColumn(sheetIdx, tableIdx, colIndex);
    }

    private async _handlePasteCells(detail: IPasteCellsDetail) {
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

    private _handlePostMessage(detail: PostMessageCommand) {
        switch (detail.command) {
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

    private async _handleDocumentChange(detail: {
        sectionIndex: number;
        content: string;
        title?: string;
        save?: boolean;
    }) {
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
    private _handleSave() {
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
        window.addEventListener('keydown', this._boundHandleKeyDown, true);

        window.addEventListener('rows-delete', (e: Event) => {
            const detail = (e as CustomEvent).detail;
            this._handleDeleteRows(detail.sheetIndex, detail.tableIndex, detail.rowIndices);
        });
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        window.removeEventListener('keydown', this._boundHandleKeyDown, true);
    }

    private _boundHandleKeyDown = this._handleGlobalKeyDown.bind(this);

    private _handleGlobalKeyDown(e: KeyboardEvent) {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
            e.preventDefault();
            this._handleSave();
        }
    }

    async firstUpdated() {
        try {
            await this.spreadsheetService.initialize();
            console.log('Spreadsheet Service initialized.');

            window.addEventListener('cell-edit', (e: Event) => {
                const detail = (e as CustomEvent<ICellEditDetail>).detail;
                this._handleRangeEdit(
                    detail.sheetIndex,
                    detail.tableIndex,
                    detail.rowIndex,
                    detail.rowIndex,
                    detail.colIndex,
                    detail.colIndex,
                    detail.newValue
                );
            });

            window.addEventListener('range-edit', (e: Event) => {
                const detail = (e as CustomEvent<IRangeEditDetail>).detail;
                this._handleRangeEdit(
                    detail.sheetIndex,
                    detail.tableIndex,
                    detail.startRow,
                    detail.endRow,
                    detail.startCol,
                    detail.endCol,
                    detail.newValue
                );
            });

            window.addEventListener('row-delete', (e: Event) => {
                const detail = (e as CustomEvent<IRowOperationDetail>).detail;
                this._handleDeleteRow(detail.sheetIndex, detail.tableIndex, detail.rowIndex);
            });

            window.addEventListener('row-insert', (e: Event) => {
                const detail = (e as CustomEvent<IRowOperationDetail>).detail;
                this._handleInsertRow(detail.sheetIndex, detail.tableIndex, detail.rowIndex);
            });

            window.addEventListener('column-delete', (e: Event) => {
                const detail = (e as CustomEvent<IColumnOperationDetail>).detail;
                this._handleDeleteColumn(detail.sheetIndex, detail.tableIndex, detail.colIndex);
            });

            window.addEventListener('column-insert', (e: Event) => {
                const detail = (e as CustomEvent<IColumnOperationDetail>).detail;
                this._handleInsertColumn(detail.sheetIndex, detail.tableIndex, detail.colIndex);
            });

            window.addEventListener('column-clear', (e: Event) => {
                const detail = (e as CustomEvent<IColumnOperationDetail>).detail;
                this._handleClearColumn(detail.sheetIndex, detail.tableIndex, detail.colIndex);
            });

            window.addEventListener('column-resize', (e: Event) =>
                this._handleColumnResize((e as CustomEvent<IColumnResizeDetail>).detail)
            );
            window.addEventListener('metadata-edit', (e: Event) =>
                this._handleMetadataEdit((e as CustomEvent<IMetadataEditDetail>).detail)
            );
            window.addEventListener('metadata-update', (e: Event) =>
                this._handleMetadataUpdate((e as CustomEvent<IMetadataUpdateDetail>).detail)
            );
            window.addEventListener('request-add-table', (e: Event) =>
                this._handleRequestAddTable((e as CustomEvent<IRequestAddTableDetail>).detail)
            );
            window.addEventListener('request-rename-table', (e: Event) =>
                this._handleRequestRenameTable((e as CustomEvent<IRequestRenameTableDetail>).detail)
            );
            window.addEventListener('request-delete-table', (e: Event) =>
                this._handleRequestDeleteTable((e as CustomEvent<IRequestDeleteTableDetail>).detail)
            );
            window.addEventListener('metadata-change', (e: Event) =>
                this._handleVisualMetadataUpdate((e as CustomEvent<IVisualMetadataUpdateDetail>).detail)
            );
            window.addEventListener('sheet-metadata-update', (e: Event) =>
                this._handleSheetMetadataUpdate((e as CustomEvent<ISheetMetadataUpdateDetail>).detail)
            );
            window.addEventListener('paste-cells', (e: Event) =>
                this._handlePasteCells((e as CustomEvent<IPasteCellsDetail>).detail)
            );
            window.addEventListener('post-message', (e: Event) =>
                this._handlePostMessage((e as CustomEvent<PostMessageCommand>).detail)
            );
            window.addEventListener('document-change', (e: Event) =>
                this._handleDocumentChange(
                    (
                        e as CustomEvent<{
                            sectionIndex: number;
                            content: string;
                            title?: string;
                            save?: boolean;
                        }>
                    ).detail
                )
            );

            window.addEventListener('message', async (event) => {
                const message = event.data;
                switch (message.type) {
                    case 'update':
                        this.markdownInput = message.content;
                        await this._parseWorkbook();
                        this.spreadsheetService.notifyUpdateReceived();
                        break;
                    case 'configUpdate':
                        this.config = message.config;
                        await this._parseWorkbook();
                        break;
                    case 'sync-failed':
                        // Error recovery
                        console.warn('Sync failed, resetting queue state.');
                        this.spreadsheetService.notifyUpdateReceived();
                        break;
                }
            });

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

            <div class="bottom-tabs-container">
                <div
                    class="bottom-tabs"
                    @scroll="${this._handleTabScroll}"
                    @dragover="${this._handleSheetDragOver}"
                    @drop="${this._handleSheetDrop}"
                    @dragleave="${this._handleSheetDragLeave}"
                >
                    ${this.tabs.map(
                        (tab, index) => html`
                            <div
                                class="tab-item ${this.activeTabIndex === index ? 'active' : ''} ${tab.type ===
                                'add-sheet'
                                    ? 'add-sheet-tab'
                                    : ''}"
                                draggable="${tab.type !== 'add-sheet' && this.editingTabIndex !== index}"
                                @click="${(e: MouseEvent) =>
                                    tab.type === 'add-sheet' ? this._handleAddSheet(e) : (this.activeTabIndex = index)}"
                                @dblclick="${() => this._handleTabDoubleClick(index, tab)}"
                                @contextmenu="${(e: MouseEvent) => this._handleTabContextMenu(e, index, tab)}"
                                @dragstart="${(e: DragEvent) => this._handleSheetDragStart(e, index)}"
                                @dragend="${this._handleSheetDragEnd}"
                                title="${tab.type === 'add-sheet' ? t('addNewSheet') : ''}"
                                data-index="${index}"
                            >
                                ${this._renderTabIcon(tab)}
                                ${this.editingTabIndex === index
                                    ? html`
                                          <input
                                              class="tab-input"
                                              .value="${tab.title}"
                                              @click="${(e: Event) => e.stopPropagation()}"
                                              @dblclick="${(e: Event) => e.stopPropagation()}"
                                              @keydown="${(e: KeyboardEvent) => this._handleTabInputKey(e)}"
                                              @blur="${(e: Event) =>
                                                  this._handleTabRename(
                                                      index,
                                                      tab,
                                                      (e.target as HTMLInputElement).value
                                                  )}"
                                          />
                                      `
                                    : html` ${tab.type !== 'add-sheet' ? tab.title : ''} `}
                            </div>
                        `
                    )}
                </div>
                <div class="scroll-indicator-right ${this.isScrollableRight ? 'visible' : ''}"></div>
            </div>

            ${this.tabContextMenu
                ? html`
                      <div
                          style="position: fixed; top: ${this.tabContextMenu.y}px; left: ${this.tabContextMenu
                              .x}px; background: var(--vscode-textBlockQuote-background); color: var(--vscode-foreground); border: 1px solid var(--vscode-textBlockQuote-border); border-radius: 8px; box-shadow: 0 8px 32px rgba(0,0,0,0.5); z-index: 10000; padding: 6px 0; min-width: 220px;"
                      >
                          ${this.tabContextMenu.tabType === 'sheet'
                              ? html`
                                    <div
                                        class="context-menu-item"
                                        style="padding: 6px 12px; cursor: pointer; color: var(--vscode-foreground); font-family: var(--vscode-font-family); font-size: 13px;"
                                        @mouseover="${(e: MouseEvent) =>
                                            ((e.target as HTMLElement).style.background =
                                                'var(--vscode-list-hoverBackground)')}"
                                        @mouseout="${(e: MouseEvent) =>
                                            ((e.target as HTMLElement).style.background = 'transparent')}"
                                        @click="${() => this._renameTab(this.tabContextMenu!.index)}"
                                    >
                                        ${t('renameSheet')}
                                    </div>
                                    <div
                                        class="context-menu-item"
                                        style="padding: 6px 12px; cursor: pointer; color: var(--vscode-foreground); font-family: var(--vscode-font-family); font-size: 13px;"
                                        @mouseover="${(e: MouseEvent) =>
                                            ((e.target as HTMLElement).style.background =
                                                'var(--vscode-list-hoverBackground)')}"
                                        @mouseout="${(e: MouseEvent) =>
                                            ((e.target as HTMLElement).style.background = 'transparent')}"
                                        @click="${() => this._deleteSheet(this.tabContextMenu!.index)}"
                                    >
                                        ${t('deleteSheet')}
                                    </div>
                                `
                              : html`
                                    <div
                                        class="context-menu-item"
                                        style="padding: 6px 12px; cursor: pointer; color: var(--vscode-foreground); font-family: var(--vscode-font-family); font-size: 13px;"
                                        @mouseover="${(e: MouseEvent) =>
                                            ((e.target as HTMLElement).style.background =
                                                'var(--vscode-list-hoverBackground)')}"
                                        @mouseout="${(e: MouseEvent) =>
                                            ((e.target as HTMLElement).style.background = 'transparent')}"
                                        @click="${() => this._renameTab(this.tabContextMenu!.index)}"
                                    >
                                        ${t('renameDocument')}
                                    </div>
                                    <div
                                        class="context-menu-item"
                                        style="padding: 6px 12px; cursor: pointer; color: var(--vscode-foreground); font-family: var(--vscode-font-family); font-size: 13px;"
                                        @mouseover="${(e: MouseEvent) =>
                                            ((e.target as HTMLElement).style.background =
                                                'var(--vscode-list-hoverBackground)')}"
                                        @mouseout="${(e: MouseEvent) =>
                                            ((e.target as HTMLElement).style.background = 'transparent')}"
                                        @click="${() => this._deleteDocument(this.tabContextMenu!.index)}"
                                    >
                                        ${t('deleteDocument')}
                                    </div>
                                `}
                          <div
                              style="border-top: 1px solid var(--vscode-textBlockQuote-border); margin: 4px 12px;"
                          ></div>
                          <div
                              class="context-menu-item"
                              style="padding: 6px 12px; cursor: pointer; color: var(--vscode-foreground); font-family: var(--vscode-font-family); font-size: 13px;"
                              @mouseover="${(e: MouseEvent) =>
                                  ((e.target as HTMLElement).style.background = 'var(--vscode-list-hoverBackground)')}"
                              @mouseout="${(e: MouseEvent) =>
                                  ((e.target as HTMLElement).style.background = 'transparent')}"
                              @click="${() => this._addDocumentFromMenu()}"
                          >
                              ${t('addNewDocument')}
                          </div>
                          <div
                              class="context-menu-item"
                              style="padding: 6px 12px; cursor: pointer; color: var(--vscode-foreground); font-family: var(--vscode-font-family); font-size: 13px;"
                              @mouseover="${(e: MouseEvent) =>
                                  ((e.target as HTMLElement).style.background = 'var(--vscode-list-hoverBackground)')}"
                              @mouseout="${(e: MouseEvent) =>
                                  ((e.target as HTMLElement).style.background = 'transparent')}"
                              @click="${() => this._addSheetFromMenu()}"
                          >
                              ${t('addNewSheet')}
                          </div>
                      </div>
                      <!-- Overlay to close menu on click outside -->
                      <div
                          style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 999;"
                          @click="${() => (this.tabContextMenu = null)}"
                      ></div>
                  `
                : ''}

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

            ${this.addTabDropdown
                ? html`
                      <div
                          style="position: fixed; top: ${this.addTabDropdown.y}px; left: ${this.addTabDropdown
                              .x}px; background: var(--vscode-editor-background); border: 1px solid var(--vscode-widget-border); box-shadow: 0 2px 8px rgba(0,0,0,0.15); z-index: 1000; padding: 4px 0; min-width: 150px;"
                      >
                          <div
                              style="padding: 6px 12px; cursor: pointer; color: var(--vscode-foreground); font-family: var(--vscode-font-family); font-size: 13px;"
                              @mouseover="${(e: MouseEvent) =>
                                  ((e.target as HTMLElement).style.background = 'var(--vscode-list-hoverBackground)')}"
                              @mouseout="${(e: MouseEvent) =>
                                  ((e.target as HTMLElement).style.background = 'transparent')}"
                              @click="${() => this._addSheet()}"
                          >
                              ${t('addNewSheet')}
                          </div>
                          <div
                              style="padding: 6px 12px; cursor: pointer; color: var(--vscode-foreground); font-family: var(--vscode-font-family); font-size: 13px;"
                              @mouseover="${(e: MouseEvent) =>
                                  ((e.target as HTMLElement).style.background = 'var(--vscode-list-hoverBackground)')}"
                              @mouseout="${(e: MouseEvent) =>
                                  ((e.target as HTMLElement).style.background = 'transparent')}"
                              @click="${() => this._addDocument()}"
                          >
                              ${t('addNewDocument')}
                          </div>
                      </div>
                      <!-- Overlay to close menu on click outside -->
                      <div
                          style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 999;"
                          @click="${() => (this.addTabDropdown = null)}"
                      ></div>
                  `
                : ''}
        `;
    }

    private _renderTabIcon(tab: TabDefinition) {
        if (tab.type === 'sheet') {
            return html`<svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                xmlns="http://www.w3.org/2000/svg"
                fill="currentColor"
            >
                <path d="M3 3h10v10H3V3zm1 1v3h3V4H4zm4 0v3h3V4H8zm-4 4v3h3V8H4zm4 0v3h3V8H4zm4 0v3h3V8H8z" />
            </svg>`;
        } else if (tab.type === 'document') {
            return html``;
        } else if (tab.type === 'add-sheet') {
            // Using the text content '+' in render loop, so maybe no icon needed?
            // Or return a plus icon SVG. Title is '+' in definition.
            // Let's use SVG for better look.
            return html`<svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                xmlns="http://www.w3.org/2000/svg"
                fill="currentColor"
            >
                <path
                    d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"
                />
            </svg>`;
        } else {
            return html`<svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                xmlns="http://www.w3.org/2000/svg"
                fill="currentColor"
            >
                <path d="M14 7H9V2H7v5H2v2h5v5h2V9h5V7z" />
            </svg>`;
        }
    }

    private _handleTabDoubleClick(index: number, tab: TabDefinition) {
        if (tab.type === 'sheet') {
            this.editingTabIndex = index;
            // Focus input after render? Lit handles it if we use ref, or simple timeout
            setTimeout(() => {
                const input = this.shadowRoot?.querySelector('.tab-input') as HTMLInputElement;
                if (input) {
                    input.focus();
                    input.select();
                }
            }, 0);
        }
    }

    private _handleTabInputKey(e: KeyboardEvent) {
        if (e.key === 'Enter') {
            (e.target as HTMLInputElement).blur(); // Trigger blur handler
        } else if (e.key === 'Escape') {
            this.editingTabIndex = null;
        }
    }

    private _handleTabContextMenu(e: MouseEvent, index: number, tab: TabDefinition) {
        // Prevent default context menu for all tab types
        e.preventDefault();

        // Show custom context menu for sheet and document tabs
        if (tab.type !== 'sheet' && tab.type !== 'document') return;

        // Position menu at click point; dynamic adjustment happens in updated() lifecycle
        this.tabContextMenu = {
            x: e.clientX,
            y: e.clientY,
            index: index,
            tabType: tab.type
        };
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
        this._handleAddSheet(new MouseEvent('click'));
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

    private async _handleAddSheet(e?: Event) {
        // Show dropdown menu for choosing what to add
        if (e) {
            const target = e.target as HTMLElement;
            const rect = target.getBoundingClientRect();
            this.addTabDropdown = { x: rect.left, y: rect.top - 80 }; // Position above the button
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

    private async _parseWorkbook() {
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

    private _handleSheetDragStart(e: DragEvent, index: number) {
        if (!e.dataTransfer) return;
        e.dataTransfer.setData('text/plain', index.toString());
        e.dataTransfer.effectAllowed = 'move';
    }

    private _handleSheetDragOver(e: DragEvent) {
        e.preventDefault();
        e.dataTransfer!.dropEffect = 'move';

        const tabs = this.shadowRoot?.querySelectorAll('.tab-item');
        tabs?.forEach((t) => t.classList.remove('drag-over-left', 'drag-over-right'));

        const target = e
            .composedPath()
            .find(
                (n) => (n as HTMLElement).classList && (n as HTMLElement).classList.contains('tab-item')
            ) as HTMLElement;
        if (target && !target.classList.contains('add-sheet-tab')) {
            const rect = target.getBoundingClientRect();
            const mid = rect.left + rect.width / 2;
            if (e.clientX < mid) target.classList.add('drag-over-left');
            else target.classList.add('drag-over-right');
        }
    }

    private _handleSheetDragLeave() {
        // Optional cleanup
    }

    private _handleSheetDragEnd() {
        const tabs = this.shadowRoot?.querySelectorAll('.tab-item');
        tabs?.forEach((t) => t.classList.remove('drag-over-left', 'drag-over-right'));
    }

    private async _handleSheetDrop(e: DragEvent) {
        e.preventDefault();
        this._handleSheetDragEnd();

        const fromIndexStr = e.dataTransfer?.getData('text/plain');
        if (!fromIndexStr) return;
        const fromIndex = parseInt(fromIndexStr);
        if (isNaN(fromIndex)) return;

        const target = e
            .composedPath()
            .find(
                (n) => (n as HTMLElement).classList && (n as HTMLElement).classList.contains('tab-item')
            ) as HTMLElement;
        let toIndex = -1;

        if (target) {
            const indexAttr = target.getAttribute('data-index');
            if (indexAttr) {
                const initialIndex = parseInt(indexAttr);
                if (!isNaN(initialIndex)) {
                    const rect = target.getBoundingClientRect();
                    const mid = rect.left + rect.width / 2;
                    toIndex = e.clientX < mid ? initialIndex : initialIndex + 1;
                }
            }
        } else if ((e.target as HTMLElement).classList.contains('bottom-tabs')) {
            const addTab = this.tabs.find((t) => t.type === 'add-sheet');
            if (addTab) {
                toIndex = addTab.index;
            } else {
                toIndex = this.tabs.length;
            }
        }

        if (toIndex !== -1 && fromIndex !== toIndex) {
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
                    // Reorder tabs array first, then update backend
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
                    // Reorder tabs array first, then update backend
                    this._reorderTabsArray(fromIndex, toIndex);
                    this._updateTabOrder();
                }
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

    private async _handleColumnResize(detail: IColumnResizeDetail) {
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

        // Adjust context menu position after render using actual measured height
        if (changedProperties.has('tabContextMenu') && this.tabContextMenu) {
            setTimeout(() => {
                const menuEl = this.shadowRoot?.querySelector('[style*="position: fixed"]') as HTMLElement;
                if (menuEl) {
                    const rect = menuEl.getBoundingClientRect();
                    const viewportHeight = window.innerHeight;
                    if (rect.bottom > viewportHeight) {
                        // Menu extends below viewport, reposition above click point
                        const newY = this.tabContextMenu!.y - rect.height;
                        this.tabContextMenu = { ...this.tabContextMenu!, y: newY };
                    }
                }
            }, 0);
        }
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
