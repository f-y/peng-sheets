import json
from dataclasses import dataclass
from typing import Any, Optional

from md_spreadsheet_parser import MultiTableParsingSchema, Workbook

from .utils_structure import augment_workbook_metadata, extract_structure


@dataclass
class EditorState:
    workbook: Optional[Workbook] = None
    schema: Optional[MultiTableParsingSchema] = None
    md_text: str = ""
    config: Any = None


class EditorContext:
    _instance = None
    _state = EditorState()

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = EditorContext()
        return cls._instance

    @property
    def workbook(self) -> Optional[Workbook]:
        return self._state.workbook

    @workbook.setter
    def workbook(self, value: Optional[Workbook]):
        self._state.workbook = value

    @property
    def schema(self) -> Optional[MultiTableParsingSchema]:
        return self._state.schema

    @schema.setter
    def schema(self, value: Optional[MultiTableParsingSchema]):
        self._state.schema = value

    @property
    def md_text(self) -> str:
        return self._state.md_text

    @md_text.setter
    def md_text(self, value: str):
        self._state.md_text = value

    @property
    def config(self) -> Any:
        return self._state.config

    @config.setter
    def config(self, value: Any):
        self._state.config = value

    def update_state(
        self,
        workbook: Optional[Workbook] = None,
        schema: Optional[MultiTableParsingSchema] = None,
        md_text: Optional[str] = None,
        config: Any = None,
    ):
        """Update any part of the state."""
        if workbook is not None:
            self._state.workbook = workbook
        if schema is not None:
            self._state.schema = schema
        if md_text is not None:
            self._state.md_text = md_text
        if config is not None:
            self._state.config = config

    def get_full_state_dict(self) -> str:
        """Return the full state as a JSON string for the frontend."""
        if not self._state.workbook:
            return json.dumps({"workbook": None, "structure": None})

        workbook_json = self._state.workbook.json
        structure = None

        if self._state.schema:
            # Augment workbook with line numbers
            workbook_json = augment_workbook_metadata(
                workbook_json,
                self._state.md_text,
                self._state.schema.root_marker,
                self._state.schema.sheet_header_level,
            )
            # Extract structure
            structure_json = extract_structure(
                self._state.md_text, self._state.schema.root_marker
            )
            structure = json.loads(structure_json)

        return json.dumps(
            {
                "workbook": workbook_json,
                "structure": structure,
            }
        )

    def update_workbook(self, new_workbook: Workbook):
        self._state.workbook = new_workbook

    def reset(self):
        self._state = EditorState()

    def get_state(self):
        return self.get_full_state_dict()

    def initialize_workbook(self, md_text: str, config_json: str):
        self._state.md_text = md_text
        self._state.config = config_json
        config_dict = json.loads(config_json) if config_json else {}

        from md_spreadsheet_parser import parse_workbook

        self._state.schema = MultiTableParsingSchema(
            root_marker=config_dict.get("rootMarker", "# Tables"),
            sheet_header_level=config_dict.get("sheetHeaderLevel", 2),
            table_header_level=config_dict.get("tableHeaderLevel", 3),
            capture_description=config_dict.get("captureDescription", True),
            column_separator=config_dict.get("columnSeparator", "|"),
            header_separator_char=config_dict.get("headerSeparatorChar", "-"),
            require_outer_pipes=config_dict.get("requireOuterPipes", True),
            strip_whitespace=config_dict.get("stripWhitespace", True),
        )

        self._state.workbook = parse_workbook(self._state.md_text, self._state.schema)
