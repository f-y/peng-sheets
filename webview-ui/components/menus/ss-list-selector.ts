/**
 * ss-list-selector.ts
 *
 * A list-based selector component for column/table selection.
 * Displays items in a scrollable list with click-to-select functionality.
 */

import { LitElement, css, html, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import sharedStyles from '../../styles/spreadsheet-shared.css?inline';

export interface ListSelectorItem {
    value: string;
    label: string;
    group?: string;
}

/**
 * Event detail for selection change
 */
export interface ListSelectorChangeEvent {
    value: string;
    label: string;
}

@customElement('ss-list-selector')
export class SSListSelector extends LitElement {
    static styles = [
        css`
            :host {
                display: block;
            }

            .list-container {
                background: var(--vscode-input-background);
                border: 1px solid var(--vscode-panel-border);
                border-radius: 6px;
                overflow: hidden;
            }

            .list-header {
                padding: 8px 12px;
                font-size: 11px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                color: var(--vscode-foreground);
                border-bottom: 1px solid var(--vscode-panel-border);
                background: var(--vscode-sideBar-background);
            }

            .list-items {
                max-height: 160px;
                overflow-y: auto;
            }

            .list-item {
                padding: 8px 12px;
                font-size: 13px;
                cursor: pointer;
                border-left: 3px solid transparent;
                transition: all 0.15s ease;
                color: var(--vscode-foreground);
            }

            .list-item:hover {
                background: var(--vscode-list-hoverBackground);
            }

            .list-item.selected {
                background: var(--vscode-list-activeSelectionBackground);
                border-left-color: var(--vscode-textLink-foreground);
                color: var(--vscode-list-activeSelectionForeground);
            }

            .group-header {
                padding: 6px 12px;
                font-size: 10px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                color: var(--vscode-descriptionForeground);
                background: var(--vscode-sideBar-background);
            }

            .empty-message {
                padding: 16px 12px;
                font-size: 12px;
                color: var(--vscode-descriptionForeground);
                text-align: center;
                font-style: italic;
            }
        `,
        unsafeCSS(sharedStyles)
    ];

    @property({ type: String }) header = '';
    @property({ type: Array }) items: ListSelectorItem[] = [];
    @property({ type: String }) selectedValue = '';
    @property({ type: Number }) selectedIndex = -1;
    @property({ type: Boolean }) showGroups = false;

    private _handleItemClick(item: ListSelectorItem, index: number) {
        this.selectedValue = item.value;
        this.selectedIndex = index;
        this.dispatchEvent(
            new CustomEvent<ListSelectorChangeEvent & { index: number }>('change', {
                detail: { value: item.value, label: item.label, index },
                bubbles: true,
                composed: true
            })
        );
    }

    private _renderItems() {
        if (this.items.length === 0) {
            return html`<div class="empty-message">No items available</div>`;
        }

        if (this.showGroups) {
            // Group items by group property, but preserve original indices
            const grouped = new Map<string, { item: ListSelectorItem; index: number }[]>();
            this.items.forEach((item, index) => {
                const group = item.group || '';
                if (!grouped.has(group)) {
                    grouped.set(group, []);
                }
                grouped.get(group)!.push({ item, index });
            });

            return Array.from(grouped.entries()).map(
                ([group, groupItems]) => html`
                    ${group ? html`<div class="group-header">${group}</div>` : ''}
                    ${groupItems.map(({ item, index }) => this._renderItem(item, index))}
                `
            );
        }

        return this.items.map((item, index) => this._renderItem(item, index));
    }

    private _renderItem(item: ListSelectorItem, index: number) {
        // Prefer index-based selection; fall back to value-based if selectedIndex is -1
        const isSelected = this.selectedIndex >= 0 ? index === this.selectedIndex : item.value === this.selectedValue;
        return html`
            <div class="list-item ${isSelected ? 'selected' : ''}" @click="${() => this._handleItemClick(item, index)}">
                ${item.label}
            </div>
        `;
    }

    render() {
        return html`
            <div class="list-container">
                ${this.header ? html`<div class="list-header">${this.header}</div>` : ''}
                <div class="list-items">${this._renderItems()}</div>
            </div>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'ss-list-selector': SSListSelector;
    }
}
