import json
import os
import sys

import pytest

# Add parent dir to path to find headless_editor
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import headless_editor


@pytest.fixture
def setup_editor():
    md = """# Tables

## Sheet 1
| A | B |
|---|---|
| 1 | 2 |

## Sheet 2
| C | D |
|---|---|
| 3 | 4 |

## Sheet 3
| E | F |
|---|---|
| 5 | 6 |
"""
    config = json.dumps({})
    headless_editor.initialize_workbook(md, config)


def test_move_sheet_forward(setup_editor):
    # [Sheet 1, Sheet 2, Sheet 3] -> Move 0 to 1 -> [Sheet 2, Sheet 1, Sheet 3]
    # pop(0) -> [2, 3]. insert(1, 1) -> [2, 1, 3]

    res = headless_editor.move_sheet(0, 1)
    assert "error" not in res

    state = json.loads(headless_editor.get_state())
    sheets = state["workbook"]["sheets"]
    names = [s["name"] for s in sheets]
    assert names == ["Sheet 2", "Sheet 1", "Sheet 3"]


def test_move_sheet_to_end(setup_editor):
    # [1, 2, 3] -> Move 0 to 2 -> [2, 3, 1]
    # pop(0) -> [2, 3]. insert(2, 1) -> [2, 3, 1]

    res = headless_editor.move_sheet(0, 2)
    assert "error" not in res

    state = json.loads(headless_editor.get_state())
    sheets = state["workbook"]["sheets"]
    names = [s["name"] for s in sheets]
    assert names == ["Sheet 2", "Sheet 3", "Sheet 1"]


def test_move_sheet_backward(setup_editor):
    # [1, 2, 3] -> Move 2 to 0 -> [3, 1, 2]
    # pop(2) -> [1, 2]. insert(0, 3) -> [3, 1, 2]

    res = headless_editor.move_sheet(2, 0)
    assert "error" not in res

    state = json.loads(headless_editor.get_state())
    sheets = state["workbook"]["sheets"]
    names = [s["name"] for s in sheets]
    assert names == ["Sheet 3", "Sheet 1", "Sheet 2"]


def test_move_sheet_clamping(setup_editor):
    # Move 0 to 100 -> Should assume end
    res = headless_editor.move_sheet(0, 100)
    assert "error" not in res

    state = json.loads(headless_editor.get_state())
    sheets = state["workbook"]["sheets"]
    names = [s["name"] for s in sheets]
    assert names == ["Sheet 2", "Sheet 3", "Sheet 1"]


def test_move_sheet_invalid_source(setup_editor):
    res = headless_editor.move_sheet(10, 0)
    assert "error" in res
