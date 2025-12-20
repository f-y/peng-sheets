# Development Guide

This document outlines the development practices, directory structure, and testing philosophy for the `vscode-md-spreadsheet` extension.

## Directory Structure

*   **`src/`**: Extension Host Code (Node.js). Handles VS Code API interactions, file system operations, and communication with the webview.
    *   `extension.ts`: Main entry point.
    *   `test/`: Extension integration tests (using `@vscode/test-electron`).
*   **`webview-ui/`**: Webview Frontend Code (Lit, Vite). Runs inside the webview iframe.
    *   `components/`: UI components (e.g., `spreadsheet-table.ts`).
    *   `tests/`: Unit and Component tests for the webview (using Vitest).
    *   `main.ts`: Webview entry point.

## Development Philosophy

### 1. Test-First Development
We adhere to a Test-Driven Development (TDD) or Test-First approach, especially for bug fixes and complex logic.

*   **Before fixing a bug**: Create a reproduction test case in `webview-ui/tests/` that demonstrates the failure.
*   **Verify failure**: Run the test to confirm it fails as expected.
*   **Implement fix**: Modify the code to pass the test.
*   **Verify success**: Run the test again to ensure the fix works and no regressions are introduced.

### 2. Component Isolation
UI components should be designed to be testable in isolation. Use `webview-ui/tests/` to mount components (using `@open-wc/testing` fixture) and interact with them programmatically.

### 3. Internationalization (i18n)
All user-facing strings in the Webview MUST be internationalized.

*   **Helper**: Use the `t()` function from `webview-ui/utils/i18n.ts`.
*   **Keys**: Add new keys to the `translations` object in `webview-ui/utils/i18n.ts`.
*   **Languages**: Must support at least English (`en`) and Japanese (`ja`). Fallback is English.
*   **Configuration**: The `mdSpreadsheet.language` setting allows users to override the detected language.
*   **Usage**: `${t('key')}` in Lit templates.

## Testing

### Running Webview Tests (Vitest)
These tests run in a JSDOM environment and verify the frontend logic without launching VS Code.

```bash
# Run all webview tests
npm run test:webview

# Run specific test file
npx vitest run webview-ui/tests/spreadsheet-table-header-edit.test.ts
```

### Running Extension Tests
These integration tests launch a VS Code instance.

```bash
npm test
```

## Setup & Commands

*   **Install Dependencies**: `npm install`
*   **Build**: `npm run compile`
*   **Watch**: `npm run watch` (for extension), `npm run dev` (for webview HMR)

### 4. Markdown Rendering in Cells
Cells support basic markdown rendering for display:
*   **Bold**: `**text**` -> `<b>text</b>`
*   **Italic**: `*text*` -> `<i>text</i>`
*   **Strikethrough**: `~~text~~` -> `<s>text</s>`
*   **Line Breaks**: `\n` -> `<br>`

Rendering is handled by `_renderMarkdown()` in `spreadsheet-table.ts`.
Security: Ensure HTML escaping is performed BEFORE markdown replacement to prevent XSS.

### 5. Toolbar Integration
The `<spreadsheet-toolbar>` component dispatches `toolbar-action` events.
These are routed by `main.ts` to the active `SpreadsheetTable` instance via `window.activeSpreadsheetTable`.

### 6. Event Wiring Testing

**Custom events (e.g., `ss-corner-keydown`) can be emitted but silently ignored if not wired in parent components.** TypeScript does NOT type-check event names in Lit templates.

#### The Problem

When a cell component emits an event:
```typescript
// ss-corner-cell.ts
emitCellEvent(this, 'ss-corner-keydown', { originalEvent: e });
```

If the parent doesn't listen:
```html
<!-- No @ss-corner-keydown handler -->
<ss-corner-cell></ss-corner-cell>
```

The event just bubbles up and disappears. No error, no warning.

#### The Solution: Integration Tests with Real UI Interactions

Tests that bypass the event chain (e.g., directly calling `keyboardCtrl.handleKeyDown()`) will NOT catch wiring issues.

**Do this**:
```typescript
// ✅ Good: Test the full UI interaction chain
const cornerCell = queryView(element, '.cell.header-corner');
cornerCell.click();  // Triggers the actual event chain
await awaitView(element);
expect(element.selectionCtrl.selectedRow).toBe(-2);
```

**Avoid this**:
```typescript
// ❌ Incomplete: Bypasses event wiring
element.selectionCtrl.selectedRow = -2;  // Directly set state
```

#### Checklist for New Cell Components

When adding a new cell type (e.g., `ss-foo-cell`):
1. Document all emitted events in the component JSDoc
2. Wire event in View: `@ss-foo-event="${(e) => this._bubbleEvent('view-foo-event', e.detail)}"`
3. Wire event in Container: `@view-foo-event="${this.eventCtrl.handleFooEvent}"`
4. Implement handler in EventController
5. **Write integration test**: Click/interact with the cell → verify state changes
