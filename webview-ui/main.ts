import { html, css, LitElement } from "lit";
import { customElement, state } from "lit/decorators.js";
import { provideVSCodeDesignSystem } from "@vscode/webview-ui-toolkit";

import "./components/spreadsheet-toolbar";
import "./components/spreadsheet-table";
import { TableJSON } from "./components/spreadsheet-table";

// Register the VS Code Design System components
// Register the VS Code Design System components
provideVSCodeDesignSystem().register();

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
      display: flex;
      flex-direction: column;
      height: 100vh;
      color: var(--vscode-foreground);
      font-family: var(--vscode-font-family);
      background: var(--vscode-editor-background);
    }

    /* Toolbar Section */
    spreadsheet-toolbar {
      flex: 0 0 auto;
    }

    /* Content Section (Grow) */
    .content-area {
      flex: 1 1 auto;
      overflow: auto;
      position: relative;
    }

    .sheet-view {
      height: 100%;
      display: none;
    }
    
    .sheet-view.active {
      display: block;
    }

    .sheet-container {
      padding: 0;
    }

    /* Bottom Tabs Section */
    .bottom-tabs {
      flex: 0 0 auto;
      display: flex;
      background: var(--vscode-editor-background); /* Or slightly darker/lighter */
      border-top: 1px solid var(--vscode-widget-border);
      overflow-x: auto;
    }

    .tab-item {
      padding: 5px 10px;
      cursor: pointer;
      border-right: 1px solid var(--vscode-widget-border);
      background: var(--vscode-editor-background);
      color: var(--vscode-foreground);
      font-size: 13px;
      user-select: none;
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 60px;
    }

    .tab-item:hover {
      background: var(--vscode-list-hoverBackground);
    }

    .tab-item.active {
      background: var(--vscode-list-activeSelectionBackground);
      color: var(--vscode-list-activeSelectionForeground);
      font-weight: bold;
    }

    .output {
        margin: 1rem;
        white-space: pre-wrap;
        font-family: monospace;
        background: var(--vscode-editor-background);
        padding: 0.5rem;
        border: 1px solid var(--vscode-widget-border);
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

  @state()
  activeSheetIndex: number = 0;

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
        
        if row_idx < 0:
            # Update Header
            if table.headers is not None and 0 <= col_idx < len(table.headers):
                table.headers[col_idx] = new_value
            else:
                 return json.dumps({"error": "Header column index out of range or headers missing"})
        elif row_idx == len(table.rows):
            # Add New Row
            width = 0
            if table.headers:
                width = len(table.headers)
            elif len(table.rows) > 0:
                width = len(table.rows[0])
            else:
                return json.dumps({"error": "Cannot determine table width for new row"})
            
            if col_idx >= width:
                 return json.dumps({"error": "Column index out of range for new row"})

            new_row = [""] * width
            new_row[col_idx] = new_value
            table.rows.append(new_row)
        elif 0 <= row_idx < len(table.rows):
            # Update Body Row
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
        <div class="content-area">
            ${this.workbook && this.workbook.sheets.length > 0 ? html`
                 <div class="sheet-container">
                    ${this.workbook.sheets[this.activeSheetIndex].tables.map((table, tableIndex) => html`
                        <spreadsheet-table 
                            .table="${table}" 
                            .sheetIndex="${this.activeSheetIndex}" 
                            .tableIndex="${tableIndex}"
                            @cell-edit="${this._onCellEdit}"
                        ></spreadsheet-table>
                    `)}
                 </div>
            ` : html``}
        </div>

        <div class="bottom-tabs">
            ${workbook.sheets.map((sheet, index) => html`
                <div 
                    class="tab-item ${this.activeSheetIndex === index ? 'active' : ''}"
                    @click="${() => this.activeSheetIndex = index}"
                >
                    ${sheet.name || `Sheet ${index + 1}`}
                </div>
            `)}
        </div>
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
  root_marker = config_dict.get("rootMarker", "# Tables"),
  sheet_header_level = config_dict.get("sheetHeaderLevel", 2),
  table_header_level = config_dict.get("tableHeaderLevel", 3),
  capture_description = config_dict.get("captureDescription", True),
  column_separator = config_dict.get("columnSeparator", "|"),
  header_separator_char = config_dict.get("headerSeparatorChar", "-"),
  require_outer_pipes = config_dict.get("requireOuterPipes", True),
  strip_whitespace = config_dict.get("stripWhitespace", True)
)

workbook = parse_workbook(md_text, schema)
json.dumps(workbook.json, indent = 2)
          `);
      this.output = "Parsed successfully!";
      this.workbook = JSON.parse(result);
    } catch (e: any) {
      this.output = `Error parsing: ${e.message} `;
      this.workbook = null;
    }
  }
}

// Add global definition for acquireVsCodeApi
declare function acquireVsCodeApi(): any;
