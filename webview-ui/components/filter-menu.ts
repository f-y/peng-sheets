import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

@customElement('filter-menu')
export class FilterMenu extends LitElement {
    static override styles = css`
        :host {
            display: block;
            position: fixed;
            background: var(--vscode-dropdown-background);
            color: var(--vscode-dropdown-foreground);
            border: 1px solid var(--vscode-dropdown-border);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
            z-index: 1000;
            width: 200px;
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            user-select: none;
        }

        .header {
            padding: 8px;
            border-bottom: 1px solid var(--vscode-dropdown-border);
            font-weight: bold;
        }

        .actions {
            display: flex;
            flex-direction: column;
            padding: 4px 0;
            border-bottom: 1px solid var(--vscode-dropdown-border);
        }

        .action-btn {
            background: none;
            border: none;
            color: inherit;
            cursor: pointer;
            padding: 6px 12px;
            text-align: left;
            font-family: inherit;
        }

        .action-btn:hover {
            background: var(--vscode-list-hoverBackground);
        }

        .search-box {
            padding: 8px;
            border-bottom: 1px solid var(--vscode-dropdown-border);
        }

        .search-input {
            width: 100%;
            padding: 4px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            box-sizing: border-box;
        }

        .value-list {
            max-height: 200px;
            overflow-y: auto;
            padding: 4px 0;
        }

        .value-item {
            display: flex;
            align-items: center;
            padding: 4px 12px;
            cursor: pointer;
        }

        .value-item:hover {
            background: var(--vscode-list-hoverBackground);
        }

        .value-item input {
            margin-right: 8px;
        }
    `;

    @property({ type: String })
    columnName = '';

    @property({ type: Array })
    values: string[] = [];

    @property({ type: Array })
    hiddenValues: string[] = [];

    @property({ type: Number })
    x = 0;

    @property({ type: Number })
    y = 0;

    override updated(changedProperties: Map<string, unknown>) {
        super.updated(changedProperties);
        if (changedProperties.has('x') || changedProperties.has('y')) {
            this.style.left = `${this.x}px`;
            this.style.top = `${this.y}px`;
        }
    }

    @state()
    private _searchValue = '';

    private _handleSortAsc() {
        this.dispatchEvent(
            new CustomEvent('sort', {
                detail: { direction: 'asc', column: this.columnName },
                bubbles: true,
                composed: true
            })
        );
    }

    private _handleSortDesc() {
        this.dispatchEvent(
            new CustomEvent('sort', {
                detail: { direction: 'desc', column: this.columnName },
                bubbles: true,
                composed: true
            })
        );
    }

    private _handleClearFilter() {
        this.dispatchEvent(
            new CustomEvent('clear-filter', {
                detail: { column: this.columnName },
                bubbles: true,
                composed: true
            })
        );
    }

    private _handleSearchInput(e: InputEvent) {
        this._searchValue = (e.target as HTMLInputElement).value;
    }

    private _toggleValue(value: string, checked: boolean) {
        let newHidden = [...this.hiddenValues];
        if (checked) {
            // Unhide (remove from hidden list)
            newHidden = newHidden.filter((v) => v !== value);
        } else {
            // Hide (add to hidden list)
            if (!newHidden.includes(value)) {
                newHidden.push(value);
            }
        }

        this.dispatchEvent(
            new CustomEvent('filter-change', {
                detail: { column: this.columnName, hiddenValues: newHidden },
                bubbles: true,
                composed: true
            })
        );
    }

    private _toggleSelectAll(checked: boolean, filteredValues: string[]) {
        const newHidden = new Set(this.hiddenValues);

        if (checked) {
            filteredValues.forEach((v) => newHidden.delete(v));
        } else {
            filteredValues.forEach((v) => newHidden.add(v));
        }

        this.dispatchEvent(
            new CustomEvent('filter-change', {
                detail: { column: this.columnName, hiddenValues: Array.from(newHidden) },
                bubbles: true,
                composed: true
            })
        );
    }

    override render() {
        const filteredValues = this.values.filter((v) => v.toLowerCase().includes(this._searchValue.toLowerCase()));

        const allFilteredVisible =
            filteredValues.length > 0 && filteredValues.every((v) => !this.hiddenValues.includes(v));
        const allFilteredHidden =
            filteredValues.length > 0 && filteredValues.every((v) => this.hiddenValues.includes(v));
        // If some are hidden and some are visible, it's indeterminate
        // OR if NO filtered values exist, disable?
        const isIndeterminate = !allFilteredVisible && !allFilteredHidden && filteredValues.length > 0;
        const isSelectAllChecked = allFilteredVisible && filteredValues.length > 0;

        return html`
            <div class="actions">
                <button class="action-btn" @click=${this._handleSortAsc}>Sort A to Z</button>
                <button class="action-btn" @click=${this._handleSortDesc}>Sort Z to A</button>
                <button
                    class="action-btn"
                    @click=${this._handleClearFilter}
                    ?disabled=${this.hiddenValues.length === 0}
                >
                    Clear Filter
                </button>
            </div>

            <div class="search-box">
                <input
                    class="search-input"
                    type="text"
                    placeholder="Search"
                    .value=${this._searchValue}
                    @input=${this._handleSearchInput}
                />
            </div>

            <div class="value-list">
                <label
                    class="value-item"
                    style="border-bottom: 1px solid var(--vscode-dropdown-border); padding-bottom: 4px; margin-bottom: 4px;"
                >
                    <input
                        type="checkbox"
                        .checked=${isSelectAllChecked}
                        .indeterminate=${isIndeterminate}
                        @change=${(e: Event) =>
                            this._toggleSelectAll((e.target as HTMLInputElement).checked, filteredValues)}
                        ?disabled=${filteredValues.length === 0}
                    />
                    <span>(Select All)</span>
                </label>
                ${filteredValues.map(
                    (value) => html`
                        <label class="value-item">
                            <input
                                type="checkbox"
                                .checked=${!this.hiddenValues.includes(value)}
                                @change=${(e: Event) =>
                                    this._toggleValue(value, (e.target as HTMLInputElement).checked)}
                            />
                            <span>${value === '' ? '(Blanks)' : value}</span>
                        </label>
                    `
                )}
                ${filteredValues.length === 0 ? html`<div style="padding: 8px;">No matches</div>` : nothing}
            </div>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'filter-menu': FilterMenu;
    }
}
