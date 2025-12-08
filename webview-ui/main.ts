import { html, css, LitElement } from "lit";
import { customElement, state } from "lit/decorators.js";
import { provideVSCodeDesignSystem, vsCodePanels, vsCodePanelTab, vsCodePanelView } from "@vscode/webview-ui-toolkit";

import "./components/spreadsheet-toolbar";
import "./components/spreadsheet-table";
import { TableJSON } from "./components/spreadsheet-table";

// Register the VS Code Design System components
provideVSCodeDesignSystem().register(
  vsCodePanels(),
  vsCodePanelTab(),
  vsCodePanelView()
);

declare const loadPyodide: any;

interface SheetJSON {
  name: string;
  tables: TableJSON[];
}

interface WorkbookJSON {
  sheets: SheetJSON[];
}

// Acquire VS Code API
const vscode = acquireVsCodeApi();

@customElement("my-editor")
export class MyEditor extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: 0; /* Removed global padding */
      color: var(--vscode-foreground);
      font-family: var(--vscode-font-family);
    }
    .toolbar-container {
        padding: 0;
        border-bottom: 1px solid var(--vscode-widget-border);
    }
    .sheet-container {
        padding: 0;
        margin-top: 0;
    }
    vscode-panel-view {
        padding: 0;
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

      // Define Python helper functions
      await this.pyodide.runPythonAsync(`
import json
from md_spreadsheet_parser import parse_workbook, MultiTableParsingSchema, generate_table_markdown

workbook = None
schema = None

def update_cell(sheet_idx, table_idx, row_idx, col_idx, new_value):
    global workbook, schema
    if workbook is None:
        return json.dumps({"error": "No workbook loaded"})
    
    try:
        sheet = workbook.sheets[sheet_idx]
        table = sheet.tables[table_idx]
        
        # Update value
        # Ensure row exists (it should)
        if 0 <= row_idx < len(table.rows):
            row = table.rows[row_idx]
            if 0 <= col_idx < len(row):
                row[col_idx] = new_value
            else:
                 # Handle column expansion if needed, but for now strict
                 return json.dumps({"error": "Column index out of range"})
        else:
             return json.dumps({"error": "Row index out of range"})

        # Generate new markdown for the table
        # We assume the schema is still valid
        new_md = generate_table_markdown(table, schema) + "\\n"
        
        return json.dumps({
            "start_line": table.start_line,
            "end_line": table.end_line,
            "markdown": new_md
        })
    except Exception as e:
        return json.dumps({"error": str(e)})
      `);

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
        <spreadsheet-toolbar></spreadsheet-toolbar>
        <vscode-panels>
            ${workbook.sheets.map((sheet, index) => html`
                <vscode-panel-tab id="tab-${index}">${sheet.name}</vscode-panel-tab>
            `)}
            ${workbook.sheets.map((sheet, sheetIndex) => html`
                <vscode-panel-view id="view-${sheetIndex}">
                    <div class="sheet-container">
                        ${sheet.tables.map((table, tableIndex) => html`
                            <spreadsheet-table 
                                .table="${table}" 
                                .sheetIndex="${sheetIndex}" 
                                .tableIndex="${tableIndex}"
                                @cell-edit="${this._onCellEdit}"
                            >
                            </spreadsheet-table>
                        `)}
                    </div>
                </vscode-panel-view>
            `)}
        </vscode-panels>
      `;
  }

  private async _onCellEdit(e: CustomEvent) {
    const { sheetIndex, tableIndex, rowIndex, colIndex, newValue } = e.detail;
    await this._handleCellEdit(sheetIndex, tableIndex, rowIndex, colIndex, newValue);
  }

  private async _handleCellEdit(sheetIdx: number, tableIdx: number, rowIdx: number, colIdx: number, newValue: string) {
    // Optimistic update? Or wait for python?
    // Let's call python
    if (!this.pyodide) return;

    try {
      const resultJson = await this.pyodide.runPythonAsync(`
            update_cell(${sheetIdx}, ${tableIdx}, ${rowIdx}, ${colIdx}, ${JSON.stringify(newValue)})
          `);
      const result = JSON.parse(resultJson);

      if (result.error) {
        console.error("Error updating cell:", result.error);
        return;
      }

      if (result.start_line !== null && result.end_line !== null) {
        vscode.postMessage({
          type: 'updateRange',
          startLine: result.start_line,
          endLine: result.end_line,
          content: result.markdown
        });
      } else {
        console.warn("Cannot update: missing source mapping for table.");
      }

    } catch (err) {
      console.error("Failed to update cell", err);
    }
  }

  private async _parseWorkbook() {
    if (!this.pyodide) return;
    try {
      this.pyodide.globals.set("md_text", this.markdownInput);
      this.pyodide.globals.set("config", JSON.stringify(this.config));
      const result = await this.pyodide.runPythonAsync(`
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

// Add global definition for acquireVsCodeApi
declare function acquireVsCodeApi(): any;
