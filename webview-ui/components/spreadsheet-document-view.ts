import { html, css, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('spreadsheet-document-view')
export class SpreadsheetDocumentView extends LitElement {
    static styles = css`
        :host {
            display: block;
            height: 100%;
            overflow: auto;
            padding: 1rem;
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
        }

        .output {
            white-space: pre-wrap;
            font-family: var(--vscode-editor-font-family, monospace);
            font-size: var(--vscode-editor-font-size, 13px);
            line-height: 1.5;
            max-width: 800px;
            margin: 0 auto;
        }

        h1 {
            font-size: 2em;
            margin-bottom: 0.5em;
            border-bottom: 1px solid var(--vscode-widget-border);
            padding-bottom: 0.3em;
        }
    `;

    @property({ type: String })
    title: string = '';

    @property({ type: String })
    content: string = '';

    render() {
        return html`
            <div class="output">
                <h1>${this.title}</h1>
                <div>${this.content}</div>
            </div>
        `;
    }
}
