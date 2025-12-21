import json

from headless_editor import get_state, initialize_workbook


def test_ignore_headers_in_code_blocks():
    md_text = """# Tables

## Sheet 1
| A | B |
|---|---|
| 1 | 2 |

# Real Document

Here is some code:

```python
# Fake Header
def foo():
    pass
```

# Another Real Document
"""
    config = json.dumps({"rootMarker": "# Tables", "sheetHeaderLevel": 2})

    initialize_workbook(md_text, config)
    state_json = get_state()
    state = json.loads(state_json)

    structure = state["structure"]

    # Debug print
    print(json.dumps(structure, indent=2))

    # Expected structure:
    # 1. Workbook
    # 2. Document "Real Document"
    # 3. Document "Another Real Document"

    titles = [s.get("title") for s in structure if s.get("type") == "document"]

    assert "Real Document" in titles
    assert "Another Real Document" in titles
    assert "Fake Header" not in titles

    # Verify content of Real Document contains the code block
    real_doc = next(s for s in structure if s.get("title") == "Real Document")
    assert "```python" in real_doc["content"]
    assert "# Fake Header" in real_doc["content"]


def test_ignore_headers_in_code_blocks_nested():
    # Test with standard markdown code block syntax
    md_text = """# Tables

## Sheet 1
| A | B |
|---|---|
| 1 | 2 |

# Doc

```
# Not a header
```
"""
    config = json.dumps({"rootMarker": "# Tables", "sheetHeaderLevel": 2})

    initialize_workbook(md_text, config)
    state = json.loads(get_state())
    structure = state["structure"]
    titles = [s.get("title") for s in structure if s.get("type") == "document"]

    assert "Doc" in titles
    assert "Not a header" not in titles
