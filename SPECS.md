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
*   `Typing (Nav Mode)`: Clears existing content, starts entering new text.
*   `F2`: Enters Edit Mode, cursor at end of text.
*   `Double Click`: Enters Edit Mode, cursor at clicked position (or select word).
*   `Enter`: Enters Edit Mode (Excel behavior varies, sometimes moves down. Configurable: "Enter moves down" vs "Enter edits"). *Standard Excel: Enter moves down. F2 edits.*

### 4.3. While in Edit Mode
*   `Arrow Keys`: Move cursor within text.
*   `Home/End`: Move cursor to start/end of text.
*   `Enter`: Commit changes and move down.
*   `Tab`: Commit changes and move right.
*   `Esc`: Cancel changes and revert to Navigation Mode.
*   `Alt + Enter`: Insert newline (Markdown `<br>` or literal newline depending on config).

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
*   **Copy (`Ctrl/Cmd + C`)**:
    *   Copy selected cells.
    *   Format: Tab-separated values (TSV) for pasting into Excel/Sheets.
    *   Internal Format: JSON/Object for smart internal pasting.
*   **Cut (`Ctrl/Cmd + X`)**:
    *   Copy and clear content.
*   **Paste (`Ctrl/Cmd + V`)**:
    *   Paste starting at active cell.
    *   **Smart Expansion**: If clipboard has 2x2 data and 1 cell is selected, expand to 2x2.
    *   **Range Match**: If clipboard has 1 cell and 3x3 range is selected, fill all 3x3 with that value.
    *   **External Data**: Parse TSV/CSV from clipboard (e.g., from Excel) and populate cells.

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

#### Phase 1: Core Editing & Native Markdown (MVP)
*   **Basic Editing**: Cell value editing with real-time Markdown updates.
*   **Navigation**: Arrow keys, Tab/Enter navigation.
*   **Native Formatting**:
    *   **Alignment**: Column alignment (Left/Center/Right) mapped to Markdown syntax.
    *   **Text Style**: Bold, Italic, Strikethrough, Links (rendered and editable).

#### Phase 2: Structural Operations (The "Excel" Feel)
*   **Row/Column Management**:
    *   **Insert/Delete**: Context menu AND Keyboard shortcuts (`Ctrl/Cmd + +/-`).
    *   **Move**: Drag and drop rows/columns.
*   **Selection Model**:
    *   Range selection (Shift + Click/Arrow).
    *   Row/Column selection (Click headers).
*   **Clipboard Operations**:
    *   Copy/Paste ranges (internal JSON format).
    *   Copy/Paste rows (smart insertion).
    *   External Paste (TSV/CSV parsing from Excel).

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

