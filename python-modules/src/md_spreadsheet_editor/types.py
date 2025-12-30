try:
    from typing_extensions import TypedDict
except ImportError:
    from typing import TypedDict

from typing import Dict, List, Literal, Union


# Number Format
class NumberFormat(TypedDict, total=False):
    type: Literal["number", "currency", "percent"]
    decimals: int
    useThousandsSeparator: bool
    currencySymbol: str


# Column Format
class ColumnFormat(TypedDict, total=False):
    wordWrap: bool
    numberFormat: NumberFormat


# Column Metadata
class ColumnMetadata(TypedDict, total=False):
    width: int
    format: ColumnFormat
    align: Literal["left", "center", "right"]
    hidden: bool


ColumnsMetadata = Dict[str, ColumnMetadata]


# Validation Rules
class ListValidationRule(TypedDict):
    type: Literal["list"]
    values: List[str]


class DateValidationRule(TypedDict):
    type: Literal["date"]


class IntegerValidationRule(TypedDict, total=False):
    type: Literal["integer"]
    min: int
    max: int


class EmailValidationRule(TypedDict):
    type: Literal["email"]


class UrlValidationRule(TypedDict):
    type: Literal["url"]


ValidationRule = Union[
    ListValidationRule,
    DateValidationRule,
    IntegerValidationRule,
    EmailValidationRule,
    UrlValidationRule,
]

# Validation Metadata: key is col index
ValidationMetadata = Dict[str, ValidationRule]

# Filter Metadata
FiltersMetadata = Dict[str, List[str]]


# Root Visual Metadata
class VisualMetadata(TypedDict, total=False):
    columns: ColumnsMetadata
    validation: ValidationMetadata
    filters: FiltersMetadata
    # Legacy support
    column_widths: Union[Dict[str, int], List[int]]
