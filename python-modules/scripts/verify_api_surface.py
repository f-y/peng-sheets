import sys

import md_spreadsheet_editor.api as api

EXPECTED_METHODS = [
    "add_document",
    "add_document_and_get_full_update",
    "add_sheet",
    "add_table",
    "clear_column",
    "clear_columns",
    "delete_column",
    "delete_columns",
    "delete_document",
    "delete_document_and_get_full_update",
    "delete_row",
    "delete_rows",
    "delete_sheet",
    "delete_table",
    "extract_structure",
    "generate_and_get_range",
    "get_document_section_range",
    "get_full_markdown",
    "get_state",
    "get_workbook_range",
    "initialize_workbook",
    "insert_column",
    "insert_row",
    "move_cells",
    "move_columns",
    "move_document_section",
    "move_rows",
    "move_sheet",
    "move_workbook_section",
    "paste_cells",
    "rename_document",
    "rename_sheet",
    "rename_table",
    "sort_rows",
    "update_cell",
    "update_column_align",
    "update_column_filter",
    "update_column_format",
    "update_column_width",
    "update_sheet_metadata",
    "update_table_metadata",
    "update_visual_metadata",
    "update_workbook_tab_order",
]


def verify_api():
    missing = []
    print("Verifying API surface area...")
    for method in EXPECTED_METHODS:
        if not hasattr(api, method):
            missing.append(method)
            print(f"❌ Missing: {method}")
        else:
            print(f"✅ Found: {method}")

    if missing:
        print(f"\nERROR: {len(missing)} methods missing from api.py")
        sys.exit(1)

    print("\nAPI Surface Verification Passed!")
    sys.exit(0)


if __name__ == "__main__":
    verify_api()
