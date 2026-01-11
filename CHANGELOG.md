# Changelog

All notable changes to the "PengSheets" extension will be documented in this file.

## [1.0.5] - 2026-01-11

### Fixed
- Fix context menu and add-tab dropdown being clipped when displayed near viewport edges.
- Fix + button "Add New Document" inserting document at wrong position in hybrid notebooks.
- Fix certain UI operations (e.g., toolbar formatting, column drag-and-drop) not updating immediately when document is unsaved.

## [1.0.4] - 2026-01-10

### Fixed
- Fix multiline text deletion in edit mode: Delete/Backspace now correctly removes selected text spanning newlines in contenteditable cells.
- Fix split-view layout corruption when deleting tables: Table indices in layout metadata are now properly updated after table deletion.
- Fix visual flicker when pressing Delete key on selected cells: Skip re-parsing workbook during synchronous updates to preserve optimistic UI changes.

### Added
- Add Selection/Range API mock for comprehensive JSDOM testing of contenteditable behavior.
- Add "Delete Pane" button (×) to empty split-view panes with improved empty state UI.

### Improved
- Significantly improved startup speed by replacing Pyodide with native WASM integration.

## [1.0.3] - 2026-01-07

### Fixed
- Fix document edit mode not being cancelled when clicking on bottom tabs.

### Improved
- Add scroll spacer at the end of document view for better scrolling experience.

## [1.0.2] - 2026-01-05

### Fixed
- Eliminate the blank period during extension startup by optimizing the loading indicator's CSS positioning (`position: fixed`).
- Update the underlying `md-spreadsheet-parser` to v1.1.0, improving performance and stability.

## [1.0.1] - 2026-01-05

### Added
- Add context menu item "Edit Table Description" to table tabs.
- Implement metadata editor for editing table descriptions.

### Fixed
- Fix loading timing issues where the extension could hang on initialization.

## [1.0.0] - 2026-01-03

### Added
- Initial release of PengSheets.
- Provides a spreadsheet-like GUI for editing Markdown tables.
- Supports validation, formatting, and rich editing features.
- Powered by `md-spreadsheet-parser` and Pyodide.
