import { html, css, LitElement } from "lit";
import { customElement } from "lit/decorators.js";
import { provideVSCodeDesignSystem, vsCodeButton, vsCodeDivider } from "@vscode/webview-ui-toolkit";

provideVSCodeDesignSystem().register(vsCodeButton(), vsCodeDivider());

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
              <span class="codicon codicon-bold"></span>
          </vscode-button>
          <vscode-button appearance="icon" aria-label="Italic">
              <span class="codicon codicon-italic"></span>
          </vscode-button>
          <vscode-divider orientation="vertical"></vscode-divider>
          <vscode-button appearance="icon" aria-label="Align Left">
              <span class="codicon codicon-align-left"></span>
          </vscode-button>
          <vscode-button appearance="icon" aria-label="Align Center">
              <span class="codicon codicon-align-center"></span>
          </vscode-button>
          <vscode-button appearance="icon" aria-label="Align Right">
              <span class="codicon codicon-align-right"></span>
          </vscode-button>
      </div>
    `;
  }
}
