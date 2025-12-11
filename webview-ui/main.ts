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
  header_line?: number;
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
  type: 'sheet' | 'document' | 'onboarding' | 'add-sheet';
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

    .tab-item.add-sheet-tab {
      min-width: 30px;
      padding: 5px;
      justify-content: center;
    }

    }

    .tab-input {
        font-family: inherit;
        font-size: inherit;
        color: inherit;
        background: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        border: 1px solid var(--vscode-input-border);
        padding: 2px 4px;
        border-radius: 2px;
        width: 100px;
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
  activeTabIndex = 0;

  @state()
  editingTabIndex: number | null = null;

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
      console.log("Loading micropip...");
      await this.pyodide.loadPackage("micropip");
      console.log("Micropip loaded.");
      const micropip = this.pyodide.pyimport("micropip");
      const wheelUri = (window as any).wheelUri;
      console.log("Installing wheel from:", wheelUri);
      try {
        await micropip.install(wheelUri);
        console.log("Wheel installed successfully.");
      } catch (err) {
        console.error("Micropip install failed:", err);
        throw err;
      }


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
        return json.dumps({ "error": str(e) })
      `);

      window.addEventListener('cell-edit', (e: any) => this._onCellEdit(e.detail));
      window.addEventListener('range-edit', (e: any) => this._onRangeEdit(e.detail));
      window.addEventListener('metadata-edit', (e: any) => this._handleMetadataEdit(e.detail));

      // Handle messages from the extension
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


      // Valid initialization - Parsing initial content
      console.log("Pyodide initialized. Parsing initial content...");
      await this._parseWorkbook();

    } catch (e: any) {
      this.output = `Error initializing Pyodide: ${e.message} `;
      console.error(e);
    }
  }

  render() {
    if (!this.tabs.length && !this.output) {
      return html`< div class="output" > Loading...</div>`;
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
                    class="tab-item ${this.activeTabIndex === index ? 'active' : ''} ${tab.type === 'add-sheet' ? 'add-sheet-tab' : ''}"
                    @click="${() => tab.type === 'add-sheet' ? this._handleAddSheet() : this.activeTabIndex = index}"
                    @dblclick="${() => this._handleTabDoubleClick(index, tab)}"
                    title="${tab.type === 'add-sheet' ? 'Add New Sheet' : ''}"
                >
                     ${this._renderTabIcon(tab)}
                     ${this.editingTabIndex === index ? html`
                        <input 
                            class="tab-input" 
                            .value="${tab.title}" 
                            @click="${(e: Event) => e.stopPropagation()}"
                            @dblclick="${(e: Event) => e.stopPropagation()}"
                            @keydown="${(e: KeyboardEvent) => this._handleTabInputKey(e, index, tab)}"
                            @blur="${(e: Event) => this._handleTabRename(index, tab, (e.target as HTMLInputElement).value)}"
                        />
                     ` : html`
                        ${tab.type !== 'add-sheet' ? tab.title : ''}
                     `}
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
    } else if (tab.type === 'add-sheet') {
      // Using the text content '+' in render loop, so maybe no icon needed? 
      // Or return a plus icon SVG. Title is '+' in definition.
      // Let's use SVG for better look.
      return html`<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/></svg>`;
    } else {
      return html`<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M14 7H9V2H7v5H2v2h5v5h2V9h5V7z"/></svg>`;
    }
  }



  private _handleTabDoubleClick(index: number, tab: TabDefinition) {
    if (tab.type === 'sheet') {
      this.editingTabIndex = index;
      // Focus input after render? Lit handles it if we use ref, or simple timeout
      setTimeout(() => {
        const input = this.shadowRoot?.querySelector('.tab-input') as HTMLInputElement;
        if (input) {
          input.focus();
          input.select();
        }
      }, 0);
    }
  }

  private _handleTabInputKey(e: KeyboardEvent, index: number, tab: TabDefinition) {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur(); // Trigger blur handler
    } else if (e.key === 'Escape') {
      this.editingTabIndex = null;
    }
  }

  private _handleTabRename(index: number, tab: TabDefinition, newName: string) {
    if (this.editingTabIndex !== index) return;
    this.editingTabIndex = null; // Exit edit mode

    if (!newName || newName === tab.title) return;

    // Commit change
    if (tab.type === 'sheet' && tab.data && typeof tab.data.header_line === 'number') {
      const headerLevel = (this.config as any)?.sheetHeaderLevel || 2;
      const headerHashes = '#'.repeat(headerLevel);
      const newHeader = `${headerHashes} ${newName}`;

      vscode.postMessage({
        type: 'updateRange',
        startLine: tab.data.header_line,
        endLine: tab.data.header_line,
        content: newHeader
      });
    }
  }

  private _handleAddSheet() {
    if (!this.workbook) return; // Should not happen if add-sheet is visible? Actually it can if workbook structure exists but empty.

    // Determine where to insert.
    // We want to insert after the last table in the workbook.
    // If no tables, we insert after the workbook header marker? 
    // How do we know the specific line?
    // Our parser returns `start_line` and `end_line` for each table.

    let insertLine = -1;
    let newSheetName = "Sheet 1";

    if (this.workbook.sheets && this.workbook.sheets.length > 0) {
      const lastSheet = this.workbook.sheets[this.workbook.sheets.length - 1];
      // Assuming lastSheet corresponds to last table in file? 
      // Not necessarily if tables are interspersed with text, but in "Workbook" mode they are usually contiguous.
      // However, the `workbook` object aggregates ALL tables found in the workbook section.
      // So the "last sheet" in the list generally corresponds to the last table in that section.

      // Last sheet has tables
      if (lastSheet.tables && lastSheet.tables.length > 0) {
        const lastTable = lastSheet.tables[lastSheet.tables.length - 1];
        if (lastTable.end_line !== null) {
          insertLine = lastTable.end_line + 1;
        }
      } else {
        // Fallback if sheet has no tables? (Empty sheet?)
        // Not sure if end_line exists on sheet itself.
      }
      newSheetName = `Sheet ${this.workbook.sheets.length + 1}`;
    } else {
      // No sheets. We need to find the line of the Root Marker.
      // We don't have that easily available in `this.workbook`.
      // But `extract_structure` found it. 
      // Maybe we can append to End of File if workbook section is the only thing or last thing?
      // For safety, let's append to the end of document if we can't find a better place.
      // Or search for the marker in `this.markdownInput`?

      insertLine = this.markdownInput.split('\n').length;
    }

    // Construct Empty Table Markdown
    // Name: newSheetName
    // Header: A | B | C
    // Row 1: | | |

    // Get sheet header level from config (default to 2)
    const headerLevel = (this.config as any)?.sheetHeaderLevel || 2;
    const headerHashes = '#'.repeat(headerLevel);

    // We create a new Sheet section.
    // The table follows immediately. Explicit table header is omitted (anonymous table in sheet).
    const newTableMd = `\n\n${headerHashes} ${newSheetName}\n\n| A | B | C |\n|---|---|---|\n|   |   |   |\n`;

    // Use updateRange with startLine = insertLine, endLine = insertLine (Insert)
    vscode.postMessage({
      type: 'updateRange',
      startLine: insertLine,
      endLine: insertLine,
      content: newTableMd
    });
  }

  private _onCreateSpreadsheet() {
    vscode.postMessage({ type: 'createSpreadsheet' });
  }


  private async _handleMetadataEdit(detail: any) {
    if (!this.pyodide || !this.workbook) return;

    const { sheetIndex, tableIndex, name, description } = detail;

    // Calculate update range using Python
    const result = await this.pyodide.runPythonAsync(`
        import json
        res = calculate_metadata_update(
            ${sheetIndex}, 
            ${tableIndex}, 
            ${JSON.stringify(name)}, 
            ${JSON.stringify(description)}, 
            workbook_json, 
            md_text, 
            config_dict.get("tableHeaderLevel", 3)
        )
        json.dumps(res) if res else "null"
      `);

    const updateSpec = JSON.parse(result);

    if (updateSpec) {
      vscode.postMessage({
        type: 'updateRange',
        startLine: updateSpec.startLine,
        endLine: updateSpec.endLine, // Python calculated exclusive end (start_line of table)
        content: updateSpec.content
      });
    }
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


def augment_workbook_metadata(workbook_dict, md_text, root_marker, sheet_header_level):
    lines = md_text.split('\\n')
    
    # Find root marker first to replicate parse_workbook skip logic
    start_index = 0
    if root_marker:
        for i, line in enumerate(lines):
            if line.strip() == root_marker:
                start_index = i + 1
                break
                
    header_prefix = "#" * sheet_header_level + " "
    
    current_sheet_idx = 0
    
    # Simple scan for sheet headers
    # We assume parse_workbook found them in order.
    for idx, line in enumerate(lines[start_index:], start=start_index):
        stripped = line.strip()
        
        # Check for higher-level headers that would break workbook parsing
        if stripped.startswith("#"):
             level = 0
             for char in stripped:
                 if char == "#":
                     level += 1
                 else:
                     break
             if level < sheet_header_level:
                 break

        if stripped.startswith(header_prefix):
            if current_sheet_idx < len(workbook_dict['sheets']):
                workbook_dict['sheets'][current_sheet_idx]['header_line'] = idx
                current_sheet_idx += 1
            else:
                break
                
    return workbook_dict

def calculate_metadata_update(sheet_idx, table_idx, new_name, new_desc, workbook_dict, md_text, header_level):
    try:
        sheet = workbook_dict['sheets'][sheet_idx]
        table = sheet['tables'][table_idx]
        start_line = table['start_line']
    except Exception as e:
        return None
        
    lines = md_text.split('\\n')
    current_idx = start_line - 1
    metadata_start = start_line
    
    header_prefix = '#' * header_level + ' '
    
    # 1. Has Name? Search for header
    if table.get('name'):
        for i in range(current_idx, -1, -1):
            line = lines[i].strip()
            if line.startswith(header_prefix) and table['name'] in line:
               metadata_start = i
               break
            if line.startswith('#') and not line.startswith(header_prefix):
               break
    # 2. No Name? Search for description start if exists
    elif table.get('description'):
        for i in range(current_idx, -1, -1):
            if not lines[i].strip():
                metadata_start = i + 1
                break
            if lines[i].startswith('#'):
                metadata_start = i + 1
                break
        else:
            metadata_start = 0

    new_content_lines = []
    if new_name:
        new_content_lines.append(f"{header_prefix}{new_name}")
    if new_desc:
        new_content_lines.append(new_desc)
    
    # Always ensure a newline if we have content, so it sits on its own lines
    new_content = '\\n'.join(new_content_lines)
    if new_content:
        new_content += '\\n'

    return {
        'startLine': metadata_start,
        'endLine': start_line, 
        'content': new_content
    }


workbook = parse_workbook(md_text, schema)
workbook_json = workbook.json
augment_workbook_metadata(workbook_json, md_text, config_dict.get("rootMarker", "# Tables"), config_dict.get("sheetHeaderLevel", 2))

structure_json = extract_structure(md_text, config_dict.get("rootMarker", "# Tables"))

json.dumps({
    "workbook": workbook_json,
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
            // Add "Add Sheet" button at the end of the sheets
            newTabs.push({
              type: 'add-sheet',
              title: '+',
              index: newTabs.length
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
