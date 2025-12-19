import { html, css, LitElement, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { marked } from 'marked';

@customElement('spreadsheet-document-view')
export class SpreadsheetDocumentView extends LitElement {
    static styles = css`
        :host {
            display: block;
            height: 100%;
            overflow: auto;
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            position: relative;
        }

        .container {
            width: 100%;
            padding: 0.2rem;
            margin-top: 20px;
            height: 100%;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
        }

        /* Rendered output styles */
        .output {
            font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, sans-serif);
            font-size: var(--vscode-font-size, 13px);
            line-height: 1.6;
            cursor: text;
            min-height: 100px;
            border-radius: 4px;
            padding: 0.5rem;
            transition: background-color 0.15s ease;
        }

        .output:hover {
            background: rgba(128, 128, 128, 0.05);
        }

        .output.hidden {
            display: none;
        }

        /* Edit mode container */
        .edit-container {
            display: flex;
            flex-direction: column;
            flex: 1;
            min-height: 0;
        }

        /* Edit mode textarea */
        .editor {
            width: 100%;
            flex: 1;
            min-height: 400px;
            padding: 0.75rem;
            font-family: var(--vscode-editor-font-family, monospace);
            font-size: var(--vscode-editor-font-size, 13px);
            line-height: 1.5;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border, var(--vscode-widget-border));
            border-radius: 4px;
            resize: none;
            box-sizing: border-box;
        }

        .editor:focus {
            outline: 1px solid var(--vscode-focusBorder);
        }

        .editor.hidden {
            display: none;
        }

        /* Edit hint */
        .edit-hint {
            position: absolute;
            top: 6px;
            right: 6px;
            font-size: 0.85em;
            color: var(--vscode-descriptionForeground);
            opacity: 0;
            transition: opacity 0.15s ease;
            pointer-events: none;
        }

        .output:hover ~ .edit-hint,
        .edit-hint.visible {
            opacity: 1;
        }

        /* Floating save button */
        .save-button {
            position: absolute;
            bottom: 24px;
            right: 24px;
            padding: 5px 12px;
            background: rgba(128, 128, 128, 0.3);
            color: var(--vscode-foreground);
            border: 1px solid rgba(128, 128, 128, 0.4);
            border-radius: 4px;
            font-size: 12px;
            font-weight: normal;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 4px;
            transition: background-color 0.15s ease;
            z-index: 10;
        }

        .save-button:hover {
            background: rgba(128, 128, 128, 0.5);
        }

        .save-button:active {
            background: rgba(128, 128, 128, 0.6);
        }

        .save-button .codicon {
            font-size: 12px;
        }

        /* Headings */
        .output h1 {
            font-size: 2em;
            margin-bottom: 0.5em;
            border-bottom: 1px solid var(--vscode-widget-border);
            padding-bottom: 0.3em;
        }

        .output h2 {
            font-size: 1.5em;
            margin-top: 1.5em;
            margin-bottom: 0.5em;
        }

        .output h3 {
            font-size: 1.25em;
            margin-top: 1em;
            margin-bottom: 0.5em;
        }

        /* Paragraphs and lists */
        .output p {
            margin: 0.5em 0;
        }

        .output ul,
        .output ol {
            margin: 0.5em 0;
            padding-left: 2em;
        }

        .output li {
            margin: 0.25em 0;
        }

        /* Text formatting */
        .output strong {
            font-weight: bold;
        }

        .output em {
            font-style: italic;
        }

        .output a {
            color: var(--vscode-textLink-foreground);
        }

        .output a:hover {
            text-decoration: underline;
        }

        /* Code */
        .output code {
            background: var(--vscode-textCodeBlock-background);
            padding: 0.1em 0.3em;
            border-radius: 3px;
            font-family: var(--vscode-editor-font-family, monospace);
            font-size: 0.9em;
        }

        .output pre {
            background: var(--vscode-textCodeBlock-background);
            padding: 1em;
            border-radius: 4px;
            overflow-x: auto;
            margin: 1em 0;
        }

        .output pre code {
            background: none;
            padding: 0;
        }

        /* Blockquotes */
        .output blockquote {
            border-left: 3px solid var(--vscode-textBlockQuote-border);
            padding-left: 1em;
            margin-left: 0;
            margin-right: 0;
            color: var(--vscode-textBlockQuote-foreground);
        }

        /* Horizontal rule */
        .output hr {
            border: none;
            border-top: 1px solid var(--vscode-widget-border);
            margin: 1.5em 0;
        }

        /* Tables */
        .output table {
            border-collapse: collapse;
            width: 100%;
            margin: 1em 0;
        }

        .output th,
        .output td {
            border: 1px solid var(--vscode-widget-border);
            padding: 0.5em 0.75em;
            text-align: left;
        }

        .output th {
            background: var(--vscode-editor-selectionBackground);
            font-weight: bold;
        }

        .output tr:nth-child(even) td {
            background: var(--vscode-list-hoverBackground);
        }

        /* Images */
        .output img {
            max-width: 100%;
            height: auto;
        }
    `;

    @property({ type: String })
    title: string = '';

    @property({ type: String })
    content: string = '';

    @property({ type: Number })
    sectionIndex: number = 0;

    @state()
    private _isEditing: boolean = false;

    @state()
    private _editContent: string = '';

    private _debounceTimer: number | null = null;

    protected updated(changedProperties: PropertyValues): void {
        if (changedProperties.has('content') && !this._isEditing) {
            this._editContent = this.content;
        }
    }

    private _getFullContent(): string {
        // Combine title (h1) with body content
        return `# ${this.title}\n${this.content}`;
    }

    private _getRenderedContent(): string {
        const fullContent = this._getFullContent();
        if (!fullContent.trim()) return '<p><em>Click to edit...</em></p>';

        marked.setOptions({
            gfm: true,
            breaks: false
        });

        try {
            return marked.parse(fullContent) as string;
        } catch (error) {
            console.error('Markdown parsing error:', error);
            return `<pre>${fullContent}</pre>`;
        }
    }

    private _enterEditMode(): void {
        // Include h1 header in edit content
        this._editContent = this._getFullContent();
        this._isEditing = true;

        // Focus the textarea after it renders
        this.updateComplete.then(() => {
            const textarea = this.shadowRoot?.querySelector('textarea');
            if (textarea) {
                textarea.focus();
                textarea.setSelectionRange(0, 0);
            }
        });
    }

    private _exitEditMode(): void {
        this._isEditing = false;

        // Only save if content changed (compare full content including title)
        if (this._editContent !== this._getFullContent()) {
            this._saveContent();
        }
    }

    private _handleInput(e: Event): void {
        const target = e.target as HTMLTextAreaElement;
        this._editContent = target.value;
    }

    private _handleKeyDown(e: KeyboardEvent): void {
        // Escape exits edit mode without saving
        if (e.key === 'Escape') {
            this._editContent = this._getFullContent();
            this._isEditing = false;
        }
    }

    private _extractTitleAndBody(content: string): { title: string; body: string } {
        // Extract h1 header from content
        const lines = content.split('\n');
        let title = this.title; // default to existing title
        let bodyStartIndex = 0;

        // Look for # header at the beginning
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line === '') continue; // skip empty lines
            if (line.startsWith('# ')) {
                title = line.substring(2).trim();
                bodyStartIndex = i + 1;
            }
            break; // stop after first non-empty line
        }

        const body = lines.slice(bodyStartIndex).join('\n');
        return { title, body };
    }

    private _saveContent(): void {
        if (this._debounceTimer) {
            window.clearTimeout(this._debounceTimer);
        }

        this._debounceTimer = window.setTimeout(() => {
            const { title, body } = this._extractTitleAndBody(this._editContent);

            this.dispatchEvent(
                new CustomEvent('document-change', {
                    bubbles: true,
                    composed: true,
                    detail: {
                        sectionIndex: this.sectionIndex,
                        content: body,
                        title: title
                    }
                })
            );
        }, 100);
    }

    render() {
        return html`
            <div class="container">
                ${this._isEditing
                    ? html`
                          <div class="edit-container">
                              <div class="edit-hint visible">Press Escape to cancel</div>
                              <textarea
                                  class="editor"
                                  .value=${this._editContent}
                                  @input=${this._handleInput}
                                  @blur=${this._exitEditMode}
                                  @keydown=${this._handleKeyDown}
                              ></textarea>
                          </div>
                          <button
                              class="save-button"
                              @mousedown=${(e: MouseEvent) => e.preventDefault()}
                              @click=${this._exitEditMode}
                          >
                              <span class="codicon codicon-check"></span>
                              Save
                          </button>
                      `
                    : html`
                          <div class="output" @click=${this._enterEditMode}>
                              ${unsafeHTML(this._getRenderedContent())}
                          </div>
                          <div class="edit-hint">Click to edit</div>
                      `}
            </div>
        `;
    }

    disconnectedCallback(): void {
        super.disconnectedCallback();
        if (this._debounceTimer) {
            window.clearTimeout(this._debounceTimer);
        }
    }
}
