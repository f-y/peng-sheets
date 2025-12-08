import { html, css, LitElement } from "lit";
import { customElement } from "lit/decorators.js";
import { provideVSCodeDesignSystem, vsCodeButton, vsCodeDivider } from "@vscode/webview-ui-toolkit";

provideVSCodeDesignSystem().register(vsCodeButton(), vsCodeDivider());

const iconBold = html`<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M4 2h4.5a3.5 3.5 0 0 1 3.5 3.5c0 1.388-.813 2.6-2.028 3.167A3.501 3.501 0 0 1 12 12.5a3.5 3.5 0 0 1-3.5 3.5H4a.5.5 0 0 1-.5-.5v-13a.5.5 0 0 1 .5-.5zm1 1v5.5h3.5a2.5 2.5 0 1 0 0-5H5zm0 6.5V15h3.5a2.5 2.5 0 1 0 0-5H5z"/></svg>`;
const iconItalic = html`<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M6 2a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1H10.4l-4 11H9a.5.5 0 0 1 0 1H4a.5.5 0 0 1 0-1h2.2l4-11H7.5a.5.5 0 0 1-.5-.5z"/></svg>`;
const iconAlignLeft = html`<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M2.5 3a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0 4a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0 4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm.5 3.5a.5.5 0 0 0 0 1h7a.5.5 0 0 0 0-1H3z"/></svg>`;
const iconAlignCenter = html`<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M3 2.5a.5.5 0 0 0 0 1h10a.5.5 0 0 0 0-1H3zm3.5 4a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3zm-3.5 4a.5.5 0 0 0 0 1h10a.5.5 0 0 0 0-1H3zm3.5 4a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3z"/></svg>`;
const iconAlignRight = html`<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M3 2.5a.5.5 0 0 0 0 1h10a.5.5 0 0 0 0-1H3zm3.5 4a.5.5 0 0 0 0 1h6.5a.5.5 0 0 0 0-1H6.5zm-3.5 4a.5.5 0 0 0 0 1h10a.5.5 0 0 0 0-1H3zm3.5 4a.5.5 0 0 0 0 1h6.5a.5.5 0 0 0 0-1H6.5z"/></svg>`;

@customElement("spreadsheet-toolbar")
export class SpreadsheetToolbar extends LitElement {
  static styles = css`
    :host {
      display: block;
      margin-bottom: 0;
      background: var(--vscode-editor-background);
      padding: 0.25rem;
      border-bottom: 1px solid var(--vscode-widget-border);
    }
    .toolbar {
      display: flex;
      gap: 0.25rem;
      align-items: center;
    }
  `;

  render() {
    return html`
      <div class="toolbar">
          <vscode-button appearance="icon" aria-label="Bold">
              ${iconBold}
          </vscode-button>
          <vscode-button appearance="icon" aria-label="Italic">
              ${iconItalic}
          </vscode-button>
          <vscode-button appearance="icon" aria-label="Align Left">
              ${iconAlignLeft}
          </vscode-button>
          <vscode-button appearance="icon" aria-label="Align Center">
              ${iconAlignCenter}
          </vscode-button>
          <vscode-button appearance="icon" aria-label="Align Right">
              ${iconAlignRight}
          </vscode-button>
      </div>
    `;
  }
}
