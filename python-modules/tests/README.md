# Test Structure

## `unit/`
Tests for `md_spreadsheet_editor.services` and pure logic. These tests do not rely on `headless_editor` global state and test the internal services directly.

## `legacy/`
Tests that rely on `headless_editor.py` shims and global state. These act as integration tests for the VSIX interface, verifying that the shims correctly bridge the legacy API to the new Services architecture.
