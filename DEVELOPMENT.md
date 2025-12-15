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
