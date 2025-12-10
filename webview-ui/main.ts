import { html, css, LitElement } from "lit";
import { customElement, state } from "lit/decorators.js";
import { provideVSCodeDesignSystem } from "@vscode/webview-ui-toolkit";

import "./components/spreadsheet-toolbar";
import "./components/spreadsheet-table";
import "./components/spreadsheet-onboarding";
import "./components/spreadsheet-document-view";
import { TableJSON } from "./components/spreadsheet-table";

// Register the VS Code Design System components
provideVSCodeDesignSystem().register();

declare const loadPyodide: any;

interface SheetJSON {
  name: string;
  tables: TableJSON[];
}

interface DocumentJSON {
  type: 'document';
  title: string;
  content: string;
}

interface WorkbookJSON {
  sheets: SheetJSON[];
}

interface TabDefinition {
  type: 'sheet' | 'document' | 'onboarding';
  title: string;
  index: number;
  sheetIndex?: number;
  data?: any;
}

interface StructureItem {
  type: 'workbook' | 'document';
  title?: string;
  content?: string;
}

// Acquire VS Code API
const vscode = acquireVsCodeApi();

@customElement("md-spreadsheet-editor")
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
      gap: 6px;
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
  tabs: TabDefinition[] = [];

  @state()
  activeTabIndex: number = 0;

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


      // ... Python Helper Functions
      await this.pyodide.runPythonAsync(`
import json
from dataclasses import replace
from md_spreadsheet_parser import parse_workbook, MultiTableParsingSchema, generate_table_markdown

workbook = None
schema = None
# ... (existing extract_structure)

def extract_structure(md_text, root_marker):
    sections = []
    lines = md_text.split('\\n')
    current_type = None
    current_title = None
    current_lines = []
    
    for line in lines:
        if line.startswith('# ') and not line.startswith('##'):
            if current_title and current_type == 'document':
                 sections.append({"type": "document", "title": current_title, "content": "\\n".join(current_lines)})
            
            stripped = line.strip()
            if stripped == root_marker:
                sections.append({"type": "workbook"})
                current_title = None
                current_type = 'workbook'
            else:
                current_title = line[2:].strip()
                current_type = 'document'
            
            current_lines = []
        else:
            if current_type == 'document':
                current_lines.append(line)
                
    if current_title and current_type == 'document':
        sections.append({"type": "document", "title": current_title, "content": "\\n".join(current_lines)})
        
    return json.dumps(sections)

def update_cell(sheet_idx, table_idx, row_idx, col_idx, new_value):
    # Wrapper for single cell update using range logic for consistency?
    # Or keep separate. Let's keep separate or call generic update.
    return delete_range(sheet_idx, table_idx, row_idx, row_idx, col_idx, col_idx, new_value)

def delete_range(sheet_idx, table_idx, start_row, end_row, start_col, end_col, value):
    global workbook, schema, md_text
    if workbook is None:
        return json.dumps({"error": "No workbook loaded"})
    
    try:
        sheet = workbook.sheets[sheet_idx]
        table = sheet.tables[table_idx]
        
        # Validate table dimensions
        row_count = len(table.rows)
        col_count = len(table.headers) if table.headers else (len(table.rows[0]) if row_count > 0 else 0)

        # Bounds clamping
        r_start = max(-1, start_row)
        r_end = min(row_count - 1, end_row) # inclusive
        body_r_start = max(0, start_row)
        body_r_end = min(row_count - 1, end_row)
        
        # Check for Last Row Deletion (Special Case)
        is_full_row = (start_col <= 0 and end_col >= col_count - 1)
        # Logic: If deleting last row(s) fully -> Remove rows. Else -> Clear content.
        
        # Robust check for full row selection (UI sends MAX_SAFE_INTEGER or starts at 0 and covers all)
        is_full_row_selection = (end_col >= 1000000) or (start_col <= 0 and end_col >= col_count - 1)
        is_targeting_last_row = (body_r_end == row_count - 1)
        
        if is_full_row_selection and is_targeting_last_row and r_start >= 0:
             # Case 1: Delete/Slice Last Row(s)
             # Table is frozen dataclass, so we must mutate list in place
             del table.rows[body_r_start:]
             
        elif start_row == row_count:
             # Case 2: Append New Row (Ghost Row)
             # Ensure we have width
             width = len(table.headers) if table.headers else (len(table.rows[0]) if len(table.rows) > 0 else 0)
             if width == 0: width = 1 
                 
             if start_col < width:
                 new_row = [""] * width
                 new_row[start_col] = value
                 table.rows.append(new_row)
                 
        else:
             # Case 3: Clear Content (Standard Delete / Middle Rows / Partial)
             # This block must run for ANY non-slicing, non-appending update.
             
             # Headers
             if r_start == -1:
                 c_start = max(0, start_col)
                 c_end = min(col_count - 1, end_col)
                 if table.headers:
                     for c in range(c_start, c_end + 1):
                         table.headers[c] = value
             
             # Body
             if body_r_start <= body_r_end:
                for r in range(body_r_start, body_r_end + 1):
                    # Safety check for row existence not needed due to bounds clamping, but good hygiene
                    if r < len(table.rows):
                        row = table.rows[r]
                        c_start = max(0, start_col)
                        c_end = min(len(row) - 1, end_col)
                        for c in range(c_start, c_end + 1):
                            row[c] = value

        # Generate new markdown for the table
        grid_schema = replace(schema, table_header_level=None, capture_description=False)
        new_md = generate_table_markdown(table, grid_schema) + "\\n"
        
        # Ensure empty line after table
        lines = md_text.split('\\n')
        has_spacing = False
        if table.end_line < len(lines):
             if not lines[table.end_line].strip():
                 has_spacing = True
        
        if not has_spacing:
             new_md += "\\n"
        
        return json.dumps({
            "start_line": table.start_line,
            "end_line": table.end_line,
            "markdown": new_md,
            "debug": f"rc={row_count} full_sel={is_full_row_selection} last_row={is_targeting_last_row}"
        })
    except Exception as e:
        return json.dumps({"error": str(e)})
      `);

      await this._parseWorkbook();

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
    if (!this.tabs.length && !this.output) {
      return html`<div class="output">Loading...</div>`;
    }

    return this._renderContent();
  }

  private _renderContent() {
    if (this.tabs.length === 0) {
      return html`
            <div class="output">${this.output}</div>
        `;
    }

    let activeTab = this.tabs[this.activeTabIndex];
    if (!activeTab) {
      this.activeTabIndex = 0;
      activeTab = this.tabs[0];
    }

    if (!activeTab) return html``;

    return html`
        <div class="content-area">
            ${activeTab.type === 'sheet' ? html`
                 <div class="sheet-container">
                    ${activeTab.data.tables.map((table: any, tableIndex: number) => html`
                        <spreadsheet-table 
                            .table="${table}" 
                            .sheetIndex="${activeTab.sheetIndex}" 
                            .tableIndex="${tableIndex}"
                            @cell-edit="${this._onCellEdit}"
                            @range-edit="${this._onRangeEdit}"
                        ></spreadsheet-table>
                    `)}
                 </div>
            ` : html``}
            
            ${activeTab.type === 'document' ? html`
                <spreadsheet-document-view
                    .title="${activeTab.title}"
                    .content="${activeTab.data.content}"
                ></spreadsheet-document-view>
            ` : html``}
            
            ${activeTab.type === 'onboarding' ? html`
                <spreadsheet-onboarding @create-spreadsheet="${this._onCreateSpreadsheet}"></spreadsheet-onboarding>
            ` : html``}
        </div>

        <div class="bottom-tabs">
            ${this.tabs.map((tab, index) => html`
                <div 
                    class="tab-item ${this.activeTabIndex === index ? 'active' : ''}"
                    @click="${() => this.activeTabIndex = index}"
                >
                     ${this._renderTabIcon(tab)}
                    ${tab.title}
                </div>
            `)}
        </div>
    `;
  }

  private _renderTabIcon(tab: TabDefinition) {
    if (tab.type === 'sheet') {
      return html`<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M3 3h10v10H3V3zm1 1v3h3V4H4zm4 0v3h3V4H8zm-4 4v3h3V8H4zm4 0v3h3V8H4zm4 0v3h3V8H8z"/></svg>`;
    } else if (tab.type === 'document') {
      return html``;
    } else {
      return html`<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M14 7H9V2H7v5H2v2h5v5h2V9h5V7z"/></svg>`;
    }
  }

  private _onCreateSpreadsheet() {
    vscode.postMessage({ type: 'createSpreadsheet' });
  }

  private async _onCellEdit(e: CustomEvent) {
    const { sheetIndex, tableIndex, rowIndex, colIndex, newValue } = e.detail;
    // Redirect to Range Edit for consistency?
    // Or just wrap
    await this._handleRangeEdit(sheetIndex, tableIndex, rowIndex, rowIndex, colIndex, colIndex, newValue);
  }

  private async _onRangeEdit(e: CustomEvent) {
    const { sheetIndex, tableIndex, startRow, endRow, startCol, endCol, newValue } = e.detail;
    await this._handleRangeEdit(sheetIndex, tableIndex, startRow, endRow, startCol, endCol, newValue);
  }

  private async _handleRangeEdit(sheetIdx: number, tableIdx: number, startRow: number, endRow: number, startCol: number, endCol: number, newValue: string) {
    if (!this.pyodide) return;

    try {
      const resultJson = await this.pyodide.runPythonAsync(`
delete_range(${sheetIdx}, ${tableIdx}, ${startRow}, ${endRow}, ${startCol}, ${endCol}, ${JSON.stringify(newValue)})
  `);
      const result = JSON.parse(resultJson);

      if (result.error) {
        console.error("Error updating range:", result.error);
        return;
      }

      // console.log("Delete Range Debug:", result.debug);

      if (result.start_line !== null && result.end_line !== null) {
        // console.log("Sending updateRange:", result.start_line, result.end_line, result.markdown);
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
      console.error("Failed to update range", err);
    }
  }

  private async _parseWorkbook() {
    if (!this.pyodide) return;
    try {
      this.pyodide.globals.set("md_text", this.markdownInput);
      this.pyodide.globals.set("config", JSON.stringify(this.config));
      const resultJson = await this.pyodide.runPythonAsync(`
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
structure_json = extract_structure(md_text, config_dict.get("rootMarker", "# Tables"))

json.dumps({
    "workbook": workbook.json,
    "structure": json.loads(structure_json)
})
      `);
      this.output = "Parsed successfully!";
      const result = JSON.parse(resultJson);
      this.workbook = result.workbook;

      const structure: StructureItem[] = result.structure;
      const newTabs: TabDefinition[] = [];
      let workbookFound = false;

      for (const section of structure) {
        if (section.type === 'document') {
          newTabs.push({
            type: 'document',
            title: section.title!,
            index: newTabs.length,
            data: section
          });
        } else if (section.type === 'workbook') {
          workbookFound = true;
          if (this.workbook && this.workbook.sheets.length > 0) {
            this.workbook.sheets.forEach((sheet, shIdx) => {
              newTabs.push({
                type: 'sheet',
                title: sheet.name || `Sheet ${shIdx + 1}`,
                index: newTabs.length,
                sheetIndex: shIdx,
                data: sheet
              });
            });
          } else {
            // Empty workbook section
            newTabs.push({
              type: 'onboarding',
              title: 'New Spreadsheet',
              index: newTabs.length
            });
          }
        }
      }

      if (!workbookFound) {
        newTabs.push({
          type: 'onboarding',
          title: 'New Spreadsheet',
          index: newTabs.length
        });
      }

      this.tabs = newTabs;

    } catch (e: any) {
      this.output = `Error parsing: ${e.message} `;
      this.workbook = null;
      this.tabs = [];
    }
  }
}

// Add global definition for acquireVsCodeApi
declare function acquireVsCodeApi(): any;
