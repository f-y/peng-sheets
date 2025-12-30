import json
import sys
from pathlib import Path

# Add src to path
current_dir = Path(__file__).parent
src_dir = current_dir.parent / "src"
sys.path.insert(0, str(src_dir))

from md_spreadsheet_editor.types import VisualMetadata
from pydantic import TypeAdapter


def main():
    # Create adapter
    adapter = TypeAdapter(VisualMetadata)

    # Generate schema
    schema = adapter.json_schema()

    # Output path: vscode-md-spreadsheet/schemas/visual-metadata.schema.json
    # Assuming script is run from vscode-md-spreadsheet/python-modules/
    # We want to output to a shared location or directly to the extension?
    # Let's output to standard out or specific file.
    # The user request mentioned "integrate into build process".
    # Let's save to `vscode-md-spreadsheet/schemas/visual-metadata.schema.json`

    # Resolve relative to script location
    # script: .../vscode-md-spreadsheet/python-modules/scripts/generate_schema.py
    # target: .../vscode-md-spreadsheet/schemas/visual-metadata.schema.json

    project_root = current_dir.parent.parent  # vscode-md-spreadsheet
    schema_dir = project_root / "schemas"
    schema_dir.mkdir(exist_ok=True)

    output_file = schema_dir / "visual-metadata.schema.json"

    with open(output_file, "w") as f:
        json.dump(schema, f, indent=2)

    print(f"Schema generated at: {output_file}")


if __name__ == "__main__":
    main()
