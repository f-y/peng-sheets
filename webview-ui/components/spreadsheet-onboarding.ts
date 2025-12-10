import { html, css, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { provideVSCodeDesignSystem } from "@vscode/webview-ui-toolkit";

provideVSCodeDesignSystem().register();

@customElement("spreadsheet-onboarding")
export class SpreadsheetOnboarding extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      gap: 1.5rem;
      color: var(--vscode-foreground);
      font-family: var(--vscode-font-family);
    }

    h2 {
      margin: 0;
      font-weight: 500;
      font-size: 1.5em;
    }

    p {
      margin: 0;
      opacity: 0.8;
      max-width: 400px;
      text-align: center;
      line-height: 1.5;
    }

    .icon-container {
      font-size: 4rem;
      opacity: 0.5;
    }
  `;

  render() {
    return html`
      <div class="icon-container">
        <svg width="64" height="64" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
           <path d="M3 3h10v10H3V3zm1 1v3h3V4H4zm4 0v3h3V4H8zm-4 4v3h3V8H4zm4 0v3h3V8H4zm4 0v3h3V8H8z"/>
        </svg>
      </div>
      <h2>No Spreadsheet Found</h2>
      <p>This document does not contain a workbook section yet. Create one to start editing tables.</p>
      <vscode-button @click="${this._handleCreate}">
        Create Spreadsheet
      </vscode-button>
    `;
  }

  private _handleCreate() {
    this.dispatchEvent(new CustomEvent("create-spreadsheet", {
      bubbles: true,
      composed: true
    }));
  }
}
