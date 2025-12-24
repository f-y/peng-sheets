import { html, LitElement, unsafeCSS, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { t } from '../utils/i18n';
// @ts-expect-error CSS import
import styles from './styles/bottom-tabs.css?inline';

export interface TabDefinition {
    title: string;
    type: 'sheet' | 'document' | 'add-sheet' | 'onboarding';
    data?: unknown;
    sheetIndex?: number;
    documentIndex?: number;
    index: number;
}

/**
 * Bottom tabs component for sheet/document navigation.
 *
 * @fires tab-select - When a tab is selected { index: number }
 * @fires tab-rename - When a tab is renamed { index: number, newName: string }
 * @fires tab-context-menu - When context menu is requested { x, y, index, tabType }
 * @fires tab-reorder - When tabs are reordered via drag-drop { fromIndex, toIndex }
 * @fires add-sheet-click - When add sheet tab is clicked { x, y }
 */
@customElement('bottom-tabs')
export class BottomTabs extends LitElement {
    static styles = unsafeCSS(styles);

    @property({ type: Array })
    tabs: TabDefinition[] = [];

    @property({ type: Number })
    activeIndex = 0;

    @property({ type: Number })
    editingIndex: number | null = null;

    @state()
    private _isScrollableRight = false;

    @state()
    private _dragOverIndex: number | null = null;

    @state()
    private _dragOverSide: 'left' | 'right' | null = null;

    protected updated(changedProperties: PropertyValues): void {
        super.updated(changedProperties);
        if (changedProperties.has('tabs') || changedProperties.has('activeIndex')) {
            setTimeout(() => this._checkScrollOverflow(), 0);
        }
        if (changedProperties.has('editingIndex') && this.editingIndex !== null) {
            setTimeout(() => this._focusInput(), 0);
        }
    }

    private _focusInput() {
        const input = this.shadowRoot?.querySelector('.tab-input') as HTMLInputElement;
        if (input) {
            input.focus();
            input.select();
        }
    }

    private _checkScrollOverflow() {
        const container = this.shadowRoot?.querySelector('.bottom-tabs') as HTMLElement;
        if (container) {
            const isScrollable = container.scrollWidth > container.clientWidth;
            const atEnd = container.scrollLeft + container.clientWidth >= container.scrollWidth - 2;
            this._isScrollableRight = isScrollable && !atEnd;
        }
    }

    private _handleScroll() {
        this._checkScrollOverflow();
    }

    private _handleTabClick(e: MouseEvent, index: number, tab: TabDefinition) {
        if (tab.type === 'add-sheet') {
            const rect = (e.target as HTMLElement).getBoundingClientRect();
            this.dispatchEvent(
                new CustomEvent('add-sheet-click', {
                    detail: { x: rect.left, y: rect.top },
                    bubbles: true,
                    composed: true
                })
            );
        } else {
            this.dispatchEvent(
                new CustomEvent('tab-select', {
                    detail: { index },
                    bubbles: true,
                    composed: true
                })
            );
        }
    }

    private _handleDoubleClick(index: number, tab: TabDefinition) {
        if (tab.type === 'sheet' || tab.type === 'document') {
            this.dispatchEvent(
                new CustomEvent('tab-edit-start', {
                    detail: { index },
                    bubbles: true,
                    composed: true
                })
            );
        }
    }

    private _handleContextMenu(e: MouseEvent, index: number, tab: TabDefinition) {
        if (tab.type === 'add-sheet') return;
        e.preventDefault();
        this.dispatchEvent(
            new CustomEvent('tab-context-menu', {
                detail: {
                    x: e.clientX,
                    y: e.clientY,
                    index,
                    tabType: tab.type
                },
                bubbles: true,
                composed: true
            })
        );
    }

    private _handleInputKeydown(e: KeyboardEvent) {
        if (e.key === 'Enter' || e.key === 'Escape') {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
        }
    }

    private _handleInputBlur(e: FocusEvent, index: number, tab: TabDefinition) {
        const newName = (e.target as HTMLInputElement).value;
        this.dispatchEvent(
            new CustomEvent('tab-rename', {
                detail: { index, newName, tab },
                bubbles: true,
                composed: true
            })
        );
    }

    // Drag and drop handlers
    private _handleDragStart(e: DragEvent, index: number) {
        if (!e.dataTransfer) return;
        e.dataTransfer.setData('text/plain', index.toString());
        e.dataTransfer.effectAllowed = 'move';
    }

    private _handleDragOver(e: DragEvent, index: number, tab: TabDefinition) {
        if (tab.type === 'add-sheet') return;
        e.preventDefault();
        e.dataTransfer!.dropEffect = 'move';

        const target = e.currentTarget as HTMLElement;
        const rect = target.getBoundingClientRect();
        const mid = rect.left + rect.width / 2;
        this._dragOverIndex = index;
        this._dragOverSide = e.clientX < mid ? 'left' : 'right';
    }

    private _handleDragLeave() {
        this._dragOverIndex = null;
        this._dragOverSide = null;
    }

    private _handleDragEnd() {
        this._dragOverIndex = null;
        this._dragOverSide = null;
    }

    private _handleDrop(e: DragEvent) {
        e.preventDefault();
        const fromIndexStr = e.dataTransfer?.getData('text/plain');
        if (!fromIndexStr) return;
        const fromIndex = parseInt(fromIndexStr);
        if (isNaN(fromIndex)) return;

        let toIndex = -1;

        if (this._dragOverIndex !== null) {
            toIndex = this._dragOverSide === 'left' ? this._dragOverIndex : this._dragOverIndex + 1;
        } else {
            // Dropped on container - append to end
            const addTab = this.tabs.find((t) => t.type === 'add-sheet');
            toIndex = addTab ? addTab.index : this.tabs.length;
        }

        this._handleDragEnd();

        if (toIndex !== -1 && fromIndex !== toIndex) {
            this.dispatchEvent(
                new CustomEvent('tab-reorder', {
                    detail: { fromIndex, toIndex },
                    bubbles: true,
                    composed: true
                })
            );
        }
    }

    private _renderTabIcon(tab: TabDefinition) {
        if (tab.type === 'sheet') {
            return html`<svg
                class="tab-icon"
                width="16"
                height="16"
                viewBox="0 0 16 16"
                xmlns="http://www.w3.org/2000/svg"
                fill="currentColor"
            >
                <path
                    d="M14 1H2a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1zM2 0h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2z"
                />
                <path d="M14 3H2v1h12V3zM2 5h12v1H2V5zM14 7H2v1h12V7zM2 9h12v1H2V9z" />
            </svg>`;
        } else if (tab.type === 'document') {
            return html`<svg
                class="tab-icon"
                width="16"
                height="16"
                viewBox="0 0 16 16"
                xmlns="http://www.w3.org/2000/svg"
                fill="currentColor"
            >
                <path
                    d="M4 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4.5L9.5 0H4zM9 1v3.5A1.5 1.5 0 0 0 10.5 6H14v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h6z"
                />
            </svg>`;
        } else if (tab.type === 'add-sheet') {
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
        }
        return html``;
    }

    render() {
        return html`
            <div class="bottom-tabs-container">
                <div
                    class="bottom-tabs"
                    @scroll="${this._handleScroll}"
                    @dragover="${(e: DragEvent) => {
                        e.preventDefault();
                        e.dataTransfer!.dropEffect = 'move';
                    }}"
                    @drop="${this._handleDrop}"
                    @dragleave="${this._handleDragLeave}"
                >
                    ${this.tabs.map(
                        (tab, index) => html`
                            <div
                                class="tab-item ${this.activeIndex === index ? 'active' : ''} ${tab.type === 'add-sheet'
                                    ? 'add-sheet-tab'
                                    : ''} ${this._dragOverIndex === index && this._dragOverSide === 'left'
                                    ? 'drag-over'
                                    : ''}"
                                draggable="${tab.type !== 'add-sheet' && this.editingIndex !== index}"
                                @click="${(e: MouseEvent) => this._handleTabClick(e, index, tab)}"
                                @dblclick="${() => this._handleDoubleClick(index, tab)}"
                                @contextmenu="${(e: MouseEvent) => this._handleContextMenu(e, index, tab)}"
                                @dragstart="${(e: DragEvent) => this._handleDragStart(e, index)}"
                                @dragover="${(e: DragEvent) => this._handleDragOver(e, index, tab)}"
                                @dragend="${this._handleDragEnd}"
                                title="${tab.type === 'add-sheet' ? t('addNewSheet') : ''}"
                                data-index="${index}"
                            >
                                ${this._renderTabIcon(tab)}
                                ${this.editingIndex === index
                                    ? html`
                                          <input
                                              class="tab-input"
                                              .value="${tab.title}"
                                              @click="${(e: Event) => e.stopPropagation()}"
                                              @dblclick="${(e: Event) => e.stopPropagation()}"
                                              @keydown="${this._handleInputKeydown}"
                                              @blur="${(e: FocusEvent) => this._handleInputBlur(e, index, tab)}"
                                          />
                                      `
                                    : html` ${tab.type !== 'add-sheet' ? tab.title : ''} `}
                            </div>
                        `
                    )}
                </div>
                <div class="scroll-indicator-right ${this._isScrollableRight ? 'visible' : ''}"></div>
            </div>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'bottom-tabs': BottomTabs;
    }
}
