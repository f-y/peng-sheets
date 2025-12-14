import { html, css, LitElement, PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { LayoutNode, SplitNode, LeafNode } from "../types";
import { TableJSON } from "./spreadsheet-table";
import "./pane-view";
import "./split-view";

@customElement("layout-container")
export class LayoutContainer extends LitElement {
    static styles = css`
        :host {
            display: block;
            width: 100%;
            height: 100%;
            overflow: hidden;
        }
    `;

    @property({ type: Object })
    layout?: LayoutNode;

    @property({ type: Array })
    tables: TableJSON[] = [];

    @property({ type: Number })
    sheetIndex: number = 0;

    // Internal state to handle optimistic updates during drag/drop
    @state()
    private _currentLayout: LayoutNode | null = null;

    updated(changedProperties: PropertyValues) {
        if (changedProperties.has('layout') || changedProperties.has('tables')) {
            this._initializeLayout();
        }
    }

    private _initializeLayout() {
        if (this.layout) {
            this._currentLayout = this.layout;
        } else {
            // Default: All tables in one pane
            this._currentLayout = {
                type: 'pane',
                id: 'root',
                tables: this.tables.map((_, i) => i),
                activeTableIndex: 0
            };
        }
    }

    render() {
        if (!this._currentLayout) return html``;
        return html`
            <div @pane-action="${this._handlePaneAction}" style="width:100%;height:100%">
                ${this._renderNode(this._currentLayout)}
            </div>
        `;
    }

    private _renderNode(node: LayoutNode) {
        if (node.type === 'split') {
            return html`<split-view 
                .node="${node}" 
                .tables="${this.tables}"
                .sheetIndex="${this.sheetIndex}"
            ></split-view>`;
        } else {
            return html`<pane-view 
                .node="${node}" 
                .tables="${this.tables}"
                .sheetIndex="${this.sheetIndex}"
            ></pane-view>`;
        }
    }

    private _handlePaneAction(e: CustomEvent) {
        e.stopPropagation();
        const { type, paneId, index } = e.detail;

        if (type === 'switch-tab') {
            const newLayout = this._updateNode(this._currentLayout!, paneId, (node: LeafNode) => {
                return { ...node, activeTableIndex: index };
            });

            if (newLayout) {
                this._currentLayout = newLayout;
                this._dispatchPersistence();
            }
        }
    }

    private _updateNode(root: LayoutNode, targetId: string, updateFn: (n: LeafNode) => LeafNode): LayoutNode | null {
        if (root.type === 'pane') {
            if (root.id === targetId) {
                return updateFn(root);
            }
            return root;
        } else {
            const newChildren = root.children.map(child => this._updateNode(child, targetId, updateFn));
            // Optimization: if no children changed, return root? (Ref equality)
            // For now, mapping always creates new array, so simplistic approach.
            // But we need to check if ANY child actually changed to handle null returns? 
            // My helper returns LayoutNode, not null on no-change.
            // If I want to be efficient, I check identity.

            return {
                ...root,
                children: newChildren as LayoutNode[]
            };
        }
    }

    private _dispatchPersistence() {
        this.dispatchEvent(new CustomEvent('sheet-metadata-update', {
            detail: {
                sheetIndex: this.sheetIndex,
                metadata: { layout: this._currentLayout }
            },
            bubbles: true,
            composed: true
        }));
    }
}
