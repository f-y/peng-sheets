# Python Modules Development Guide

This directory contains the core logic for the Markdown Spreadsheet extension (`md_spreadsheet_editor`), designed to run in a Pyodide (WASM) environment.

## 1. Setup

We use **[uv](https://github.com/astral-sh/uv)** for high-performance dependency management and building.

### Prerequisites
- `uv` installed.
- Python 3.12+ (recommended).

### Installation
```bash
cd python-modules
uv sync
```

## 2. Directory Structure

```
python-modules/
├── src/
│   └── md_spreadsheet_editor/   # Main Package
│       ├── services/            # Business Logic (Document, Sheet, Table)
│       ├── context.py           # State Management
│       └── ...
├── tests/
│   ├── unit/                    # Primary Tests (Mocked Context)

│   └── conftest.py              # Test Fixtures

├── pyproject.toml               # Build & Dependency Config
└── DEVELOPMENT.md               # This File
```

## 3. Workflow & Testing

### Running Tests
Unit tests are the primary method for verification.

```bash
uv run pytest
```

### Type Checking
Strict type checking via Pyright is enforced.

```bash
uv run pyright
```

### Coverage Policy (Strict C1)
We enforce a **"No Regression" policy** on Branch Coverage (C1).
- **Target**: > 90%
- **Action**: If you add logic, you **MUST** add tests covering all branches.
- **Check**:
  ```bash
  uv run pytest --cov=python-modules/src/md_spreadsheet_editor --cov-branch
  ```

## 4. Architecture Standards

1.  **Separation of Concerns**:
    - **API Layer (`src/md_spreadsheet_editor/api.py`)**: Handles JSON I/O and exception catching. **Logic-free**.
    - **Services Layer**: Pure Python logic. Receives Domain Objects, returns results. **UI-agnostic**.
    - **Context**: Manages ephemeral state.

2.  **Exception Safety**:
    - **Never Crash**: The API layer must catch *all* `Exception`s and return a standard error object: `{"error": str(e)}`.
    - **Defensive Coding**: Validate inputs early (e.g., `doc_index` bounds).

3.  **State Management**:
    - Changes to `Workbook` (which is immutable) must be done via `dataclasses.replace` and committed to `EditorContext.update_workbook()`.

## 5. Build & Release (Versioning)

The Python code is distributed as a **Wheel** (`.whl`) bundled into the VS Code extension.

### Critical: Versioning & Caching
Pyodide **caches packages by version**. If you modify Python code without bumping the version, **changes will not be reflected** in the extension (it will load the cached wheel).

### Update Workflow
When you make changes to Python logic:

1.  **Implement & Verify**:
    - Edit code.
    - Run `uv run pytest`.
2.  **Bump Version**:
    - Open `pyproject.toml`.
    - Increment `version` (e.g., `0.1.0` -> `0.1.1`).
3.  **Build Wheel**:
    ```bash
    uv build
    ```
    This creates a `.whl` file in `dist/`.
4.  **Integrate**:
    - Copy the new wheel to the extension's resource folder.
    - (See `vscode-md-spreadsheet/DEVELOPMENT.md` for the full full-stack build process).
