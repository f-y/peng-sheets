import json

from headless_editor import (
    get_state,
    initialize_workbook,
    update_sheet_metadata,
)


def test_sheet_metadata_update():
    md = """# Tables

## Sheet 1

| A |
|---|
| 1 |
"""
    initialize_workbook(md, json.dumps({}))

    # Update sheet metadata
    res = update_sheet_metadata(0, {"layout": "split"})
    assert "content" in res

    # Verify content output contains metadata
    assert (
        '<!-- md-spreadsheet-sheet-metadata: {"layout": "split"} -->' in res["content"]
    )

    # Verify internal state
    state = json.loads(get_state())
    sheets = state["workbook"]["sheets"]
    assert sheets[0]["metadata"] == {"layout": "split"}


def test_sheet_metadata_persistence():
    # Simulate round trip
    md = """# Tables

## Sheet 1
<!-- md-spreadsheet-sheet-metadata: {"foo": "bar"} -->

| A |
|---|
| 1 |
"""
    initialize_workbook(md, json.dumps({}))

    state = json.loads(get_state())
    assert state["workbook"]["sheets"][0]["metadata"]["foo"] == "bar"

    # Update
    res = update_sheet_metadata(0, {"foo": "baz", "new": 1})
    assert (
        '<!-- md-spreadsheet-sheet-metadata: {"foo": "baz", "new": 1} -->'
        in res["content"]
    )
