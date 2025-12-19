# Excel-like UI/UX Specification

This document defines the "Excel-like" user experience targeted for `vscode-md-spreadsheet`. The goal is to provide a seamless, keyboard-centric, and intuitive interface that matches the mental model of users familiar with spreadsheet software (Excel, Google Sheets), while respecting the constraints and features of Markdown.

## 1. Core Philosophy
*   **Keyboard First**: Every action must be performable via keyboard shortcuts.
*   **Mode-Based Editing**: Clear distinction between "Navigation Mode" (selecting cells) and "Edit Mode" (modifying content).
*   **Instant Feedback**: Operations like selection, editing, and resizing must feel instantaneous.
*   **Safe**: Undo/Redo must be robust and reliable.

## 2. Grid Visualization
### 2.1. Basic Layout
*   **Headers**:
    *   **Column Headers**: A, B, C... (Fixed/Sticky at top).
    *   **Row Headers**: 1, 2, 3... (Fixed/Sticky at left).
    *   **Highlighting**: Active row/column headers should be highlighted to indicate cursor position.
*   **Grid Lines**: Subtle but clear separation between cells.
*   **Cell Styling**:
    *   **Padding**: Comfortable whitespace within cells.
    *   **Text Alignment**: Respect Markdown alignment (Left/Center/Right).
    *   **Overflow**: Text should wrap or be truncated with an ellipsis (configurable), expanding on focus.

### 2.2. Visual Feedback
*   **Focus Ring**: A distinct border (usually blue/green) around the currently active cell.
*   **Selection Overlay**: A semi-transparent overlay indicating the selected range(s).
*   **Fill Handle**: A small square at the bottom-right of the active cell/range for drag-to-fill operations.

## 3. Navigation & Selection
### 3.1. Navigation (Navigation Mode)
*   `Arrow Keys`: Move focus one cell in the direction.
*   `Tab`: Move right. If at end of row, move to start of next row (optional).
*   `Shift + Tab`: Move left.
*   `Enter`: Move down.
*   `Shift + Enter`: Move up.
*   `Home`: Move to the first column of the current row.
*   `End`: Move to the last column of the current row (or last data cell).
*   `Ctrl/Cmd + Home`: Move to A1.
*   `Ctrl/Cmd + End`: Move to the last used cell in the sheet.
*   `Ctrl/Cmd + Arrow`: Jump to the edge of the data region.
*   `Page Up / Page Down`: Scroll up/down by one screen height.
*   `Alt + Page Up / Page Down`: Scroll left/right by one screen width.

### 3.2. Selection
*   **Click**: Select single cell.
*   **Shift + Click**: Extend selection from active cell to clicked cell (Range Selection).
*   **Click Row Header**: Select entire row.
*   **Click Column Header**: Select entire column.
*   **Ctrl/Cmd + Click**: Add non-contiguous cells/ranges to selection (Multi-selection).
*   **Shift + Arrow Keys**: Extend selection range by one cell.
*   **Ctrl/Cmd + Shift + Arrow**: Extend selection to edge of data.
*   **Ctrl/Cmd + A**: Select all data. Press again to select entire grid.

## 4. Editing Experience
### 4.1. Modes
*   **Navigation Mode**: Default. Typing replaces cell content immediately.
*   **Edit Mode**: Entered via `Enter`, `F2`, or `Double Click`. Typing inserts at cursor position.

### 4.2. Entering Edit Mode
*   `Typing (Nav Mode)`: **Excel-like Behavior**: Immediately enters Edit Mode and *overwrites* existing cell content with the typed character.
*   `F2`: Enters Edit Mode, cursor at end of text.
*   `Double Click`: Enters Edit Mode, cursor at clicked position (or select word).
*   `Enter`: Moves focus down (Navigation). *Standard Excel behavior.*

### 4.3. While in Edit Mode
*   `Arrow Keys`: Move cursor within text.
*   `Home/End`: Move cursor to start/end of text.
*   `Enter`: Commit changes and move down.
*   `Tab`: Commit changes and move right.
*   `Esc`: Cancel changes and revert to Navigation Mode.
*   `Alt + Enter`: Insert newline.
    *   **Persistence**: Converted to `<br>` tag in Markdown table cells to preserve structure.
    *   **Display**: Rendered as a line break within the cell.

## 5. Structural Manipulation
### 5.1. Rows & Columns
*   **Insert**:
    *   Right-click context menu: "Insert Row Above/Below", "Insert Column Left/Right".
    *   Shortcuts: `Ctrl/Cmd + +` (with row/col selected).
*   **Delete**:
    *   Right-click context menu: "Delete Row", "Delete Column".
    *   Shortcuts: `Ctrl/Cmd + -` (with row/col selected).
*   **Resize**:
    *   Drag boundaries between column headers to resize width.
    *   Double-click boundary to "Auto-fit" width to content.
*   **Move**:
    *   Drag & Drop rows/columns by grabbing the header.

### 5.2. Sorting
*   Clicking a sort icon in the column header (Toggle: Asc -> Desc -> Off).

## 6. Clipboard Operations

### 6.1. Standard Copy (`Ctrl/Cmd + C`)
*   **Source**:
    *   **Range**: Copies TSV data of selected cells.
    *   **Row/Column**: If Headers are selected, copies the entire row/column data.
*   **Format**: Text/Plain (TSV) for maximum compatibility.

### 6.2. Standard Paste (`Ctrl/Cmd + V`)
*   **Behavior**: Overwrites existing content starting from the active cell (Top-Left of selection).
*   **Scenarios**:
    *   **Single Cell Source -> Single Cell Target**: Overwrites target.
    *   **Single Cell Source -> Range Target**: Fills the entire target range with the source value.
    *   **Range Source (NxM) -> Single Cell Target**: Pastes the NxM grid starting at Target. Overwrites existing data. **Expands Selection** to match the pasted range.
    *   **Range Source -> Range Target**:
        *   If Source Size same as Target: 1:1 Paste.
        *   If Source is smaller: Tiles/Repeats source to fill target? (Excel behavior). *MVP: Just paste top-left.*
    *   **Row Source -> Row Target**: Overwrites the target row(s).
    *   **External Table (Excel/Web)**: Parsed as TSV.
*   **Grid Expansion**:
    *   **Rows**: If pasting N rows exceeds current table height, **automatically add new rows**.
    *   **Columns**: If pasting M columns exceeds current table width:
        *   **Automatically add new columns**.
        *   **Header Generation**: New columns need headers. Auto-generate (e.g., `Column 4`, `Column 5` or empty).
        *   **Constraint**: Cannot paste if it breaks valid table structure (rare in Markdown, mostly just expansion).

### 6.3. Insert Paste ("Insert Copied Cells")
*   **Concept**: Analogous to Excel's `Ctrl/Cmd + +` (Insert) when clipboard has content.
*   **Trigger**: Context Menu -> "Insert Copied Cells" or Shortcut (if implemented).
*   **Behavior**:
    *   **Row Mode** (Clipboard is full rows): Inserts N rows *at* the current selection index. Existing rows shift down. Pastes data into new rows.
    *   **Column Mode** (Clipboard is full cols): Inserts N cols *at* current selection. Shift right.
    *   **Range Mode**:
        *   Shift Cells Right vs Shift Cells Down (Dialog or default based on shape).
        *   *MVP*: Only support "Insert Copied Rows" default if full rows copied.

### 6.4. Special Cases
*   **Pasting Full Table into Editor**:
    *   If user copies an entire table (headers + data) from Excel:
    *   **Action**: Paste at cursor.
    *   **Handling**:
        *   If pasted inside existing table: Treat headers as just another data row? Or try to "smart match"?
        *   **Rule**: `Ctrl+V` is raw data paste. If source has headers, they become data in the destination.
    *   **Future**: "Paste as New Table" command (creates new Markdown table structure).

## 7. Undo / Redo
*   **Global History**:
    *   `Ctrl/Cmd + Z`: Undo last action (edit, structure change, paste, etc.).
    *   `Ctrl/Cmd + Shift + Z` / `Ctrl/Cmd + Y`: Redo.
*   **Granularity**: Each "commit" (Enter, Tab, Paste) is one undo step. Typing characters in Edit Mode is *not* separate steps.

## 8. Markdown Specific Features
These features are specific to the Markdown context but should be integrated into the UI.

*   **Alignment Control**:
    *   Toolbar buttons or Context menu to set Column Alignment (Left, Center, Right).
    *   Visual indicator in Column Header (e.g., icon).
*   **Formatting Shortcuts**:
    *   `Ctrl/Cmd + B`: Bold (`**text**`).
    *   `Ctrl/Cmd + I`: Italic (`*text*`).
    *   `Ctrl/Cmd + K`: Insert Link (`[text](url)`).
*   **Escaping**:
    *   Automatically handle pipe `|` characters in text (escape as `\|`).
    *   Handle newlines (escape or `<br>`).

## 9. Advanced / Future
*   **Search & Replace (`Ctrl/Cmd + F`)**: Search within the grid.
*   **Filter**: Excel-like filter dropdowns in headers.
*   **Formulas**: Basic math (Sum, Average) support? (Would need to decide how to persist in Markdown - likely not persisted, just calculated).
*   **Context Menu**: Comprehensive right-click menu.

## 10. Technical Architecture Implications (Separation of Concerns)
To achieve this, the implementation must be modular:

*   **Grid Model**: Pure state management (Cells, Rows, Cols, Selection). Independent of rendering.
*   **Selection Model**: Handles complex selection logic (Ranges, Multi-select).
*   **Command System**: All actions (Edit, Move, Resize) should be Commands to support Undo/Redo easily.
*   **Renderer**: Dumb component that just renders the Model. (Canvas-based or Virtual DOM based for performance).
*   **Input Controller**: Handles keyboard/mouse events and dispatches Commands.
*   **Clipboard Manager**: Handles serialization/deserialization.

## 11. Markdown-Specific Data Structures
Unlike Excel, our data model includes metadata specific to the Markdown context.

*   **Table Name**:
    *   **Concept**: A title for the table (parsed from preceding Header).
    *   **UI**: An editable input field prominently displayed above the grid.
    *   **Behavior**: Optional. If empty, the header is removed from Markdown.
*   **Description**:
    *   **Concept**: Text describing the table (parsed from text between Header and Table).
    *   **UI**: An editable text area or input field between the Table Name and the Grid.
    *   **Behavior**: Optional.

## 12. Table Management
*   **Explicit Creation**:
    *   Tables are not infinite. They are distinct entities.
    *   **UI**: "Add Table" button (e.g., in a toolbar or below the last table).
    *   **Constraints**:
        *   **Header Row Mandatory**: Every table MUST have a header row.
        *   **Strict Boundaries**: Empty lines in the grid do not split the table. The table size is explicit.
        *   **No "Magic" Splitting**: We do not infer multiple tables from a single grid based on empty rows.

## 13. Visual Formatting & Excel Compatibility Roadmap
Excel has a vast array of formatting options. Since Markdown is plain text, we cannot support everything natively. We will implement support in phases, potentially using metadata (HTML comments or YAML frontmatter) to persist non-standard attributes.

### 13.1. Excel Formatting Features (Reference)
*   **Number Formats**: General, Number, Currency, Accounting, Date, Time, Percentage, Fraction, Scientific, Text, Custom.
*   **Font**: Family, Size, Bold, Italic, Underline, Strikethrough, Color, Sub/Superscript.
*   **Fill**: Background Color, Pattern Style/Color, Gradients.
*   **Borders**: Top, Bottom, Left, Right, All, Outside, Thick, Double, Dotted, Dashed, Colors.
*   **Alignment**:
    *   Horizontal: Left, Center, Right, Justify, Fill.
    *   Vertical: Top, Middle, Bottom, Justify.
    *   Control: Wrap Text, Shrink to Fit, Merge Cells.
    *   Orientation: Rotation angles.
    *   Indentation.
*   **Conditional Formatting**: Data Bars, Color Scales, Icon Sets, Rules.
*   **Protection**: Locked, Hidden.

### 13.2. Implementation Roadmap

#### Phase 1: Core Editing & Native Markdown - [Completed]
*   [x] **Hybrid Structure**: Support for Document Tabs (read-only text views) alongside Sheet Tabs.
*   [x] **Onboarding**: Home Screen for creating the initial Workbook structure.
*   [x] **Basic Editing**: Cell value editing with real-time Markdown updates (In-place persistence).
*   [x] **Navigation**: Arrow keys, Tab/Enter navigation.
*   [x] **Line Breaks**: Support for in-cell newlines (persisted as `<br>`).
*   [ ] **Native Formatting UI**:
    *   **Alignment**: Column alignment (Left/Center/Right).
    *   **Text Style**: Bold, Italic, Strikethrough, Links.

#### Phase 2 (MVP): Structural Operations & Excel Feel (Current Focus)
*   **Editing**:
    *   **Excel-like Typing**: Overwrite on type.
*   **Row/Column Management**:
    *   **Selection**: Click headers to select entire row/col.
    *   **Insert/Delete**: Context menu AND shortcuts. Support inserting multiple rows if multiple selected.
    *   **Move**: Drag and drop rows/columns.
*   **Clipboard Operations**:
    *   Copy/Paste ranges (TSV).
    *   **Paste to Add**: Pasting data that overflows grid adds new rows/cols.

#### Phase 3: Layout & Metadata Persistence
*   **Table Metadata**: UI for Table Name and Description.
*   **Column Widths**: Resizable columns, persisted via metadata (e.g., HTML comments or YAML).
*   **Wrap Text**: Toggle wrapping per column/cell.

#### Phase 4: Advanced Visuals & Logic (Conditional Formatting)
*   **Conditional Formatting**:
    *   **Goal**: Visually distinguish rows based on data (e.g., "Status" = "Inactive" -> Gray background).
    *   **Implementation**: Define rules in metadata. Renderer applies styles dynamically.
    *   **Supported Styles**: Background color, Text color, Strikethrough.
*   **Validation**: Visual indicators for invalid data types (if schema is defined).

#### Phase 5: Extended Data Types
*   **Number Formats**: Display masks (e.g., `$1,000`) while keeping raw data (`1000`).
*   **Date/Time**: Date pickers and formatters.

#### Out of Scope
*   **Merge Cells**: Fundamentally incompatible with Markdown tables.
*   **Arbitrary Cell Styling**: Ad-hoc background colors (cell-by-cell painting) are discouraged in favor of rule-based Conditional Formatting to keep Markdown clean.

## 14. App & File Structure Integration
### 14.1. Hybrid Document Model (Sheets + Docs)
The application treats a Markdown file as a collection of "Tabs".
*   **Workbook Section**: A specific top-level header (default `# Tables`) acts as the container for Spreadsheet Sheets.
    *   Sub-headers (default `## SheetName`) within this section are parsed as individual **Sheet Tabs**.
*   **Document Sections**: All *other* top-level headers (e.g., `# Introduction`, `# Appendix`) are treated as **Document Tabs**.
    *   These tabs display the Markdown text content effectively as a "Text Sheet".
    *   Users can switch between Sheet Tabs and Document Tabs seamlessly in the same bottom tab bar.
    *   **Visual Distinction**: Tabs have icons indicating their type (e.g., Grid icon for Sheets, Document icon for Text).

### 14.2. Empty State (Onboarding)
*   **Condition**: If the Markdown file does not contain the Workbook Section (`# Tables`).
*   **UI**: specific "Home" view is displayed instead of a blank grid.
*   **Actions**:
    *   "Create Spreadsheet": Appends the Workbook Section (`# Tables`) and an initial Sheet (`## Sheet 1`) to the file.

### 14.3. Flexible Persistence
*   **Reading**: The parser identifies tables regardless of their location in the file (scanning for Workbook Section).
*   **Writing**:
    *   **In-Place Update**: If a table already exists, edits update the corresponding lines in the file, preserving the table's location relative to other content.
    *   **Append**: New tables are typically appended to the Workbook Section.
*   **Content Preservation**:
    *   When deleting sheets, content before and after the Workbook Section MUST be preserved.
    *   The Workbook Section boundary is determined by the next top-level header (same level as root marker) or end of file.
    *   Example: In a document with `# Tables` followed by `# Appendix`, deleting all sheets removes only the content between these headers.
