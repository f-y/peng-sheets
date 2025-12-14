import { html, css, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { SplitNode } from "../types";
import { TableJSON } from "./spreadsheet-table";
import "./pane-view";
// Circular dependency: layout-container imports split-view/pane-view. 
// split-view imports pane-view (and recursive split-view?).
// Yes, recursive. 
// Lit handles this if we just use tag names, but we need import for side effects (registration).
// Since they are registered globally, it should be fine as long as they are imported once.
// LayoutContainer imports both, so they are registered.
// But to be safe, I import them here too?
// Recursion: SplitView needs to render child nodes which can be SplitView or PaneView.
// So SplitView renders... `layout-container`'s logic?
// No, `renderNode` logic needs to be reused or SplitView iterates children.

@customElement("split-view")
export class SplitView extends LitElement {
    static styles = css`
        :host {
            display: flex;
            width: 100%;
            height: 100%;
            overflow: hidden;
        }
        :host([direction="vertical"]) {
            flex-direction: column;
        }
        :host([direction="horizontal"]) {
            flex-direction: row;
        }
        .child-wrapper {
            position: relative;
            overflow: hidden;
        }
        .resizer {
            background-color: var(--vscode-widget-border);
            z-index: 10;
        }
        :host([direction="horizontal"]) .resizer {
            width: 4px;
            cursor: col-resize;
        }
        :host([direction="vertical"]) .resizer {
            height: 4px;
            cursor: row-resize;
        }
    `;

    @property({ type: Object })
    node!: SplitNode;

    @property({ type: Array })
    tables: TableJSON[] = [];

    @property({ type: Number })
    sheetIndex: number = 0;

    render() {
        if (!this.node) return html``;
        this.setAttribute('direction', this.node.direction);

        return html`
            ${this.node.children.map((child, index) => {
            const size = this.node.sizes[index] || (100 / this.node.children.length);
            const style = `flex: ${size} 1 0%;`; // simple flex basis

            // Render Resizer if not first
            const resizer = index > 0
                ? html`<div class="resizer"></div>`
                : html``;

            const content = child.type === 'split'
                ? html`<split-view 
                        .node="${child}" 
                        .tables="${this.tables}"
                        .sheetIndex="${this.sheetIndex}"
                      ></split-view>`
                : html`<pane-view 
                        .node="${child}" 
                        .tables="${this.tables}"
                        .sheetIndex="${this.sheetIndex}"
                      ></pane-view>`;

            return html`${resizer}<div class="child-wrapper" style="${style}">${content}</div>`;
        })}
        `;
    }
}
