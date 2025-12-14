import { html, css, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { LeafNode } from "../types";
import { TableJSON } from "./spreadsheet-table";
import "./spreadsheet-table";

@customElement("pane-view")
export class PaneView extends LitElement {
    static styles = css`
        :host {
            display: flex;
            flex-direction: column;
            width: 100%;
            height: 100%;
            overflow: hidden;
            background-color: var(--vscode-editor-background);
        }
        .tab-bar {
            display: flex;
            background-color: var(--vscode-editorGroupHeader-tabsBackground);
            border-bottom: 1px solid var(--vscode-editorGroup-border);
            overflow-x: auto;
            min-height: 35px; /* VS Code tab height */
        }
        .tab {
            padding: 8px 12px;
            cursor: pointer;
            color: var(--vscode-tab-inactiveForeground);
            background-color: var(--vscode-tab-inactiveBackground);
            border-right: 1px solid var(--vscode-tab-border);
            white-space: nowrap;
            user-select: none;
            display: flex;
            align-items: center;
        }
        .tab.active {
            color: var(--vscode-tab-activeForeground);
            background-color: var(--vscode-tab-activeBackground);
            border-top: 1px solid var(--vscode-tab-activeBorderTop);
        }
        .tab:hover {
            background-color: var(--vscode-tab-hoverBackground);
        }
        .content {
            flex: 1;
            overflow: auto;
            position: relative;
        }
    `;

    @property({ type: Object })
    node!: LeafNode;

    @property({ type: Array })
    tables: TableJSON[] = [];

    @property({ type: Number })
    sheetIndex: number = 0;

    render() {
        if (!this.node || !this.tables.length) return html``;

        // Ensure active index is valid
        const activeLocalIndex = this.node.activeTableIndex || 0;
        const activeGlobalIndex = this.node.tables[activeLocalIndex];
        const activeTable = this.tables[activeGlobalIndex];

        return html`
            <div class="tab-bar">
                ${this.node.tables.map((globalIdx, i) => {
            const table = this.tables[globalIdx];
            const isActive = i === activeLocalIndex;
            return html`
                        <div class="tab ${isActive ? 'active' : ''}" 
                             @click="${() => this._switchTab(i)}">
                            ${table.name || `Table ${globalIdx + 1}`}
                        </div>
                    `;
        })}
            </div>
            <div class="content">
                ${activeTable ? html`
                    <spreadsheet-table 
                        .table="${activeTable}"
                        .sheetIndex="${this.sheetIndex}"
                        .tableIndex="${activeGlobalIndex}"
                    ></spreadsheet-table>
                ` : html`<div>No Table Selected</div>`}
            </div>
        `;
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
        this.dispatchEvent(new CustomEvent('pane-action', {
            detail: {
                type: 'switch-tab',
                paneId: this.node.id,
                index: localIndex
            },
            bubbles: true,
            composed: true
        }));
    }
}
