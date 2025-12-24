import { html, LitElement, unsafeCSS } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { TableJSON, LeafNode } from '../types';
import paneViewStyles from './styles/pane-view.css?inline';
import './spreadsheet-table';
import { t } from '../utils/i18n';

@customElement('pane-view')
export class PaneView extends LitElement {
    static styles = unsafeCSS(paneViewStyles);

    @property({ type: Object })
    node!: LeafNode;

    @property({ type: Array })
    tables: TableJSON[] = [];

    @property({ type: Number })
    sheetIndex: number = 0;

    @property({ type: String })
    activeDropZone: 'top' | 'bottom' | 'left' | 'right' | 'center' | null = null;

    @state()
    private _editingTabGlobalIndex: number | null = null;

    @state()
    private _editingName: string = '';

    @state()
    private _tabContextMenu: { x: number; y: number; index: number; globalIndex: number } | null = null;

    render() {
        if (!this.node || !this.tables.length) return html``;

        // Ensure active index is valid
        const activeLocalIndex = this.node.activeTableIndex || 0;
        const activeGlobalIndex = this.node.tables[activeLocalIndex];
        const activeTable = this.tables[activeGlobalIndex];

        return html`
            <div
                class="tab-bar"
                @dragover="${this._handleTabBarDragOver}"
                @drop="${this._handleTabBarDrop}"
                @dragleave="${this._handleTabBarDragLeave}"
            >
                ${this.node.tables.map((globalIdx, i) => {
                    const table = this.tables[globalIdx];
                    const isActive = i === activeLocalIndex;
                    const isEditing = this._editingTabGlobalIndex === globalIdx;

                    return html`
                        <div
                            class="tab ${isActive ? 'active' : ''}"
                            draggable="${!isEditing}"
                            @dragstart="${(e: DragEvent) => this._handleDragStart(e, i, globalIdx)}"
                            @click="${() => this._switchTab(i)}"
                            @contextmenu="${(e: MouseEvent) => this._handleTabContextMenu(e, i, globalIdx)}"
                            @dblclick="${() => this._startRenaming(globalIdx, table.name || undefined)}"
                        >
                            ${isEditing
                                ? html`
                                      <input
                                          class="tab-input"
                                          .value="${this._editingName}"
                                          @input="${this._handleRenameInput}"
                                          @keydown="${this._handleRenameKeydown}"
                                          @blur="${this._handleRenameBlur}"
                                          @click="${(e: Event) => e.stopPropagation()}"
                                          @dblclick="${(e: Event) => e.stopPropagation()}"
                                      />
                                  `
                                : table.name || t('table', (globalIdx + 1).toString())}
                        </div>
                    `;
                })}
                <div class="tab-add" @click="${this._handleAddTable}" title="${t('addTable')}">+</div>
            </div>
            <div
                class="content"
                @dragover="${this._handleContentDragOver}"
                @dragleave="${this._handleContentDragLeave}"
                @drop="${this._handleContentDrop}"
            >
                ${activeTable
                    ? html`
                          <spreadsheet-table
                              style="flex: 1; min-height: 0;"
                              .table="${activeTable}"
                              .sheetIndex="${this.sheetIndex}"
                              .tableIndex="${activeGlobalIndex}"
                          ></spreadsheet-table>
                      `
                    : html`<div>${t('noTableSelected')}</div>`}
                ${this._renderDropOverlay()}
            </div>
            ${this._renderContextMenu()}
        `;
    }

    connectedCallback() {
        super.connectedCallback();
        window.addEventListener('click', this._handleGlobalClick);
        window.addEventListener('contextmenu', this._handleGlobalClick); // Close on right click elsewhere
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        window.removeEventListener('click', this._handleGlobalClick);
        window.removeEventListener('contextmenu', this._handleGlobalClick);
    }

    private _handleGlobalClick = (_e: Event) => {
        // If sticky menu behavior is desired, check target. But standard is click-outside closes.
        if (this._tabContextMenu) {
            this._tabContextMenu = null;
            this.requestUpdate();
        }
    };

    // ... existing overlay methods ...

    private _startRenaming(globalIndex: number, currentName: string | undefined) {
        this._editingTabGlobalIndex = globalIndex;
        this._editingName = currentName || t('table', (globalIndex + 1).toString());
        setTimeout(() => {
            const input = this.shadowRoot?.querySelector('.tab-input') as HTMLInputElement;
            if (input) {
                input.focus();
                input.select();
            }
        }, 0);
    }

    private _handleRenameInput(e: Event) {
        this._editingName = (e.target as HTMLInputElement).value;
    }

    private _handleRenameKeydown(e: KeyboardEvent) {
        if (e.key === 'Enter') {
            this._finishRenaming();
        } else if (e.key === 'Escape') {
            this._cancelRenaming();
        }
    }

    private _handleRenameBlur() {
        this._finishRenaming();
    }

    private _finishRenaming() {
        if (this._editingTabGlobalIndex !== null) {
            this.dispatchEvent(
                new CustomEvent('pane-action', {
                    detail: {
                        type: 'rename-table',
                        tableIndex: this._editingTabGlobalIndex,
                        newName: this._editingName
                    },
                    bubbles: true,
                    composed: true
                })
            );
        }
        this._editingTabGlobalIndex = null;
        this._editingName = '';
    }

    private _cancelRenaming() {
        this._editingTabGlobalIndex = null;
        this._editingName = '';
    }

    private _handleAddTable(e: Event) {
        e.stopPropagation();
        this.dispatchEvent(
            new CustomEvent('pane-action', {
                detail: {
                    type: 'add-table',
                    paneId: this.node.id
                },
                bubbles: true,
                composed: true
            })
        );
    }
    private _renderDropOverlay() {
        if (!this.activeDropZone) return html``;

        let style = '';
        switch (this.activeDropZone) {
            case 'top':
                style = 'top: 0; left: 0; right: 0; height: 50%;';
                break;
            case 'bottom':
                style = 'bottom: 0; left: 0; right: 0; height: 50%;';
                break;
            case 'left':
                style = 'top: 0; left: 0; bottom: 0; width: 50%;';
                break;
            case 'right':
                style = 'top: 0; right: 0; bottom: 0; width: 50%;';
                break;
            case 'center':
                style = 'inset: 0;';
                break; // Could be used for full pane drop? But tab bar handles that usually.
        }
        return html`<div class="drop-overlay active" style="${style}"></div>`;
    }

    private _handleDragEnter = (_e: DragEvent) => {}; // Added this method as per instruction, assuming an empty body for now.

    private _handleDragStart(_e: DragEvent, localIndex: number, globalIndex: number) {
        if (!_e.dataTransfer) return;

        const data = {
            type: 'tab-drag',
            paneId: this.node.id,
            tableIndex: globalIndex, // Use global index for identification
            localIndex: localIndex
        };
        _e.dataTransfer.setData('application/json', JSON.stringify(data));
        _e.dataTransfer.effectAllowed = 'move';
    }

    private _handleTabBarDragOver(e: DragEvent) {
        e.preventDefault();
        e.dataTransfer!.dropEffect = 'move';
        (e.currentTarget as HTMLElement).classList.add('drag-over');

        // Optional: show insertion marker?
        // For now, minimal change to enable functionality.
    }

    private _handleTabBarDragLeave(e: DragEvent) {
        (e.currentTarget as HTMLElement).classList.remove('drag-over');
    }

    private _handleTabBarDrop(e: DragEvent) {
        e.preventDefault();
        (e.currentTarget as HTMLElement).classList.remove('drag-over');

        const data = this._parseDragData(e);
        if (!data || data.type !== 'tab-drag') return;

        // Calculate target index
        let targetIndex = this.node.tables.length; // Default to append

        const tabs = this.shadowRoot?.querySelectorAll('.tab');
        if (tabs) {
            // Find which tab is hovered
            let found = false;
            tabs.forEach((tab, i) => {
                if (found) return;
                const rect = tab.getBoundingClientRect();
                if (e.clientX >= rect.left && e.clientX <= rect.right) {
                    // Inside this tab horizontally.
                    // Check if left or right half
                    const mid = rect.left + rect.width / 2;
                    if (e.clientX < mid) {
                        targetIndex = i; // Insert before
                    } else {
                        targetIndex = i + 1; // Insert after
                    }
                    found = true;
                }
            });

            // If not found (e.g. empty space), append.
        }

        this.dispatchEvent(
            new CustomEvent('pane-action', {
                detail: {
                    type: 'move-tab',
                    targetPaneId: this.node.id,
                    sourcePaneId: data.paneId,
                    tableIndex: data.tableIndex,
                    index: targetIndex
                },
                bubbles: true,
                composed: true
            })
        );
    }

    private _handleContentDragOver(e: DragEvent) {
        e.preventDefault();
        e.dataTransfer!.dropEffect = 'move';

        // Calculate drop zone
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const width = rect.width;
        const height = rect.height;

        // User Request Logic:
        // 1. Right 30% is ALWAYS Right split.
        // 2. Center to Bottom is Bottom split.
        // 3. Remove Deadzone (Strictness issue).

        const rightThreshold = width * 0.7; // Right 30%
        const leftThreshold = width * 0.2; // Left 20% (Conservative default)

        if (x >= rightThreshold) {
            this.activeDropZone = 'right';
        } else if (x <= leftThreshold) {
            this.activeDropZone = 'left';
        } else {
            // Middle section: Split Top/Bottom
            if (y >= height / 2) {
                this.activeDropZone = 'bottom';
            } else {
                this.activeDropZone = 'top';
            }
        }

        this.requestUpdate();
    }

    private _handleContentDragLeave(_e: DragEvent) {
        // Only clear if leaving the component, not entering a child?
        // Since overlay is pointer-events: none, it shouldn't trigger leave.
        this.activeDropZone = null;
        this.requestUpdate();
    }

    private _handleContentDrop(e: DragEvent) {
        e.preventDefault();
        const zone = this.activeDropZone;
        this.activeDropZone = null;
        this.requestUpdate();

        const data = this._parseDragData(e);
        if (!data || data.type !== 'tab-drag') return;

        if (!zone) return;

        this.dispatchEvent(
            new CustomEvent('pane-action', {
                detail: {
                    type: 'split-pane',
                    targetPaneId: this.node.id,
                    sourcePaneId: data.paneId,
                    tableIndex: data.tableIndex,
                    direction: zone === 'left' || zone === 'right' ? 'horizontal' : 'vertical',
                    placement: zone === 'left' || zone === 'top' ? 'before' : 'after'
                },
                bubbles: true,
                composed: true
            })
        );
    }

    private _parseDragData(e: DragEvent) {
        try {
            const raw = e.dataTransfer?.getData('application/json');
            if (!raw) return null;
            return JSON.parse(raw);
        } catch {
            return null;
        }
    }

    private _switchTab(localIndex: number) {
        // Dispatch layout update
        // We modify the NODE and dispatch the root layout update?
        // Wait, 'node' property is likely immutable or passed down.
        // We shouldn't mutate props directly in Lit if we want to bubble up changes cleanly in a "controlled" manner?
        // But for local state, we can dispatch event.

        // Construct new layout state is hard from deep down.
        // Better: Dispatch "pane-update" event with { nodeId, newActiveIndex }
        // And let LayoutContainer handle it?
        // Or if we mutable update the object tree (be careful) and request update at root.

        // For MVP: Dispatch 'layout-action' -> { type: 'switch-tab', paneId: ..., index: ... }
        // For now, let's assume we can dispatch an event that LayoutContainer understands.

        // Actually, LayoutContainer just handles "layout-update" with the NEW complete layout.
        // So I need to find 'myself' in the tree? That is hard.

        // Alternative: Pass a callback? No.

        // Let's dispatch a custom event 'pane-action'
        this.dispatchEvent(
            new CustomEvent('pane-action', {
                detail: {
                    type: 'switch-tab',
                    paneId: this.node.id,
                    index: localIndex
                },
                bubbles: true,
                composed: true
            })
        );
    }

    private _handleTabContextMenu(e: MouseEvent, index: number, globalIndex: number) {
        e.preventDefault();
        e.stopPropagation();
        this._tabContextMenu = {
            x: e.clientX,
            y: e.clientY,
            index: index,
            globalIndex: globalIndex
        };
    }

    private _renderContextMenu() {
        if (!this._tabContextMenu) return html``;
        return html`
            <div class="context-menu" style="top: ${this._tabContextMenu.y}px; left: ${this._tabContextMenu.x}px;">
                <div class="context-menu-item" @click="${this._triggerRenameFromMenu}">${t('renameTable')}</div>
                <div class="context-menu-item" @click="${this._triggerDeleteFromMenu}">${t('deleteTable')}</div>
            </div>
        `;
    }

    private _triggerRenameFromMenu(e: Event) {
        e.stopPropagation();
        if (this._tabContextMenu) {
            const globalIndex = this._tabContextMenu.globalIndex;
            const table = this.tables[globalIndex];
            this._startRenaming(globalIndex, table?.name || undefined);
            this._tabContextMenu = null;
        }
    }

    private _triggerDeleteFromMenu(e: Event) {
        e.stopPropagation();
        if (this._tabContextMenu) {
            this.dispatchEvent(
                new CustomEvent('pane-action', {
                    detail: {
                        type: 'delete-table',
                        paneId: this.node.id,
                        tableIndex: this._tabContextMenu.globalIndex
                    },
                    bubbles: true,
                    composed: true
                })
            );
            this._tabContextMenu = null;
        }
    }
}
