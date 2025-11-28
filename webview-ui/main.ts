import { html, css, LitElement } from "lit";
import { customElement, state } from "lit/decorators.js";
import { provideVSCodeDesignSystem, vsCodeDataGrid, vsCodeDataGridCell, vsCodeDataGridRow, vsCodePanels, vsCodePanelTab, vsCodePanelView } from "@vscode/webview-ui-toolkit";

// Register the VS Code Design System components
provideVSCodeDesignSystem().register(

  vsCodeDataGrid(),
  vsCodeDataGridRow(),
  vsCodeDataGridCell(),

  vsCodePanels(),
  vsCodePanelTab(),
  vsCodePanelView()
);

declare const loadPyodide: any;

interface TableJSON {
  name: string | null;
  description: string | null;
  headers: string[] | null;
  rows: string[][];
  metadata: any;
}

interface SheetJSON {
  name: string;
  tables: TableJSON[];
}

interface WorkbookJSON {
  sheets: SheetJSON[];
}

@customElement("my-editor")
export class MyEditor extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: 1rem;
      color: var(--vscode-foreground);
      font-family: var(--vscode-font-family);
    }
    .toolbar {
      margin-bottom: 1rem;
      display: flex;
      gap: 0.5rem;
    }
    .output {
        margin-top: 1rem;
        white-space: pre-wrap;
        font-family: monospace;
        background: var(--vscode-editor-background);
        padding: 0.5rem;
        border: 1px solid var(--vscode-widget-border);
    }
    .sheet-container {
        margin-top: 1rem;
    }
    .table-container {
        margin-bottom: 2rem;
    }
    h3 {
        margin-bottom: 0.5rem;
    }
  `;

  @state()
  pyodide: any = null;

  @state()
  output: string = "Initializing Pyodide...";

  @state()
  markdownInput: string = "";

  @state()
  config: any = {};

  @state()
  workbook: WorkbookJSON | null = null;

  async firstUpdated() {
    try {
      const initialContent = (window as any).initialContent;
      if (initialContent) {
        this.markdownInput = initialContent;
      }

      const initialConfig = (window as any).initialConfig;
      if (initialConfig) {
        this.config = initialConfig;
      }

      this.pyodide = await loadPyodide();
      await this.pyodide.loadPackage("micropip");
      const micropip = this.pyodide.pyimport("micropip");
      const wheelUri = (window as any).wheelUri;
      await micropip.install(wheelUri);

      if (this.markdownInput) {
        await this._parseWorkbook();
      } else {
        this.output = "Ready. No content to parse.";
      }

      window.addEventListener('message', async (event) => {
        const message = event.data;
        switch (message.type) {
          case 'update':
            this.markdownInput = message.content;
            await this._parseWorkbook();
            break;
          case 'configUpdate':
            this.config = message.config;
            await this._parseWorkbook();
            break;
        }
      });
    } catch (e: any) {
      this.output = `Error initializing Pyodide: ${e.message}`;
      console.error(e);
    }
  }

  render() {
    if (!this.workbook) {
      return html`
            <div class="output">${this.output}</div>
        `;
    }

    return html`
      ${this._renderWorkbook(this.workbook)}
    `;
  }

  private _renderWorkbook(workbook: WorkbookJSON) {
    if (workbook.sheets.length === 0) return html`<p>No sheets found.</p>`;

    return html`
        <vscode-panels>
            ${workbook.sheets.map((sheet, index) => html`
                <vscode-panel-tab id="tab-${index}">${sheet.name}</vscode-panel-tab>
            `)}
            ${workbook.sheets.map((sheet, index) => html`
                <vscode-panel-view id="view-${index}">
                    <div class="sheet-container">
                        ${sheet.tables.map(table => this._renderTable(table))}
                    </div>
                </vscode-panel-view>
            `)}
        </vscode-panels>
      `;
  }

  private _renderTable(table: TableJSON) {
    return html`
        <div class="table-container">
            ${table.name ? html`<h3>${table.name}</h3>` : ''}
            ${table.description ? html`<p>${table.description}</p>` : ''}
            <vscode-data-grid aria-label="${table.name || 'Table'}">
                ${table.headers ? html`
                    <vscode-data-grid-row row-type="header">
                        ${table.headers.map((header, i) => html`
                            <vscode-data-grid-cell cell-type="columnheader" grid-column="${i + 1}">
                                ${header}
                            </vscode-data-grid-cell>
                        `)}
                    </vscode-data-grid-row>
                ` : ''}
                ${table.rows.map(row => html`
                    <vscode-data-grid-row>
                        ${row.map((cell, i) => html`
                            <vscode-data-grid-cell grid-column="${i + 1}">${cell}</vscode-data-grid-cell>
                        `)}
                    </vscode-data-grid-row>
                `)}
            </vscode-data-grid>
        </div>
      `;
  }



  private async _parseWorkbook() {
    if (!this.pyodide) return;
    try {
      this.pyodide.globals.set("md_text", this.markdownInput);
      this.pyodide.globals.set("config", JSON.stringify(this.config));
      const result = await this.pyodide.runPythonAsync(`
import json
from md_spreadsheet_parser import parse_workbook, MultiTableParsingSchema

config_dict = json.loads(config)
schema = MultiTableParsingSchema(
    root_marker=config_dict.get("rootMarker", "# Tables"),
    sheet_header_level=config_dict.get("sheetHeaderLevel", 2),
    table_header_level=config_dict.get("tableHeaderLevel"),
    capture_description=config_dict.get("captureDescription", False),
    column_separator=config_dict.get("columnSeparator", "|"),
    header_separator_char=config_dict.get("headerSeparatorChar", "-"),
    require_outer_pipes=config_dict.get("requireOuterPipes", True),
    strip_whitespace=config_dict.get("stripWhitespace", True)
)

workbook = parse_workbook(md_text, schema)
json.dumps(workbook.json, indent=2)
          `);
      this.output = "Parsed successfully!";
      this.workbook = JSON.parse(result);
    } catch (e: any) {
      this.output = `Error parsing: ${e.message}`;
      this.workbook = null;
    }
  }
}
