# Tables

## Master

### Products

This table contains the product master data. All other tables reference this table by `product_id`.

| product_id | product_name | category | unit_price | Double |
| --- | --- | --- | --- | --- |
| P001 | Wireless Mouse | Accessories | 1000 | 2000 |
| P002 | Mechanical Keyboard | Accessories | 12000 | 24000 |
| P003 | USB-C Hub | Accessories | 4500 | 9000 |
| P004 | 27" Monitor | Display | 45000 | 90000 |
| P005 | Laptop Stand | Accessories | 3500 | 7000 |

<!-- md-spreadsheet-table-metadata: {"id": 0, "columns": {"1": {"width": 171}, "4": {"format": {"numberFormat": {"type": "number", "useThousandsSeparator": true}}}}, "formulas": {"4": {"type": "arithmetic", "functionType": "expression", "expression": "[unit_price] * 2"}}} -->

## Sales

### Monthly Sales

This table tracks monthly sales quantities by product and month.
**Computed Columns (to be implemented):**
- `product_name`: Lookup from Products table using `product_id` → `product_name`
- `unit_price`: Lookup from Products table using `product_id` → `unit_price`
- `subtotal`: Expression `[quantity] * [unit_price]`

| product_id | product_name | unit_price | quantity | subtotal |
| --- | --- | --- | --- | --- |
| P001 | Wireless Mouse | 1000 | 200 | 200000 |
| P002 | Mechanical Keyboard | 12000 | 45 | 540000 |
| P003 | USB-C Hub | 4500 | 80 | 360000 |
| P001 | Wireless Mouse | 1000 | 120 | 120000 |
| P004 | 27" Monitor | 45000 | 12 | 540000 |
| P002 | Mechanical Keyboard | 12000 | 38 | 456000 |
| P005 | Laptop Stand | 3500 | 65 | 227500 |
| P003 | USB-C Hub | 4500 | 95 | 427500 |
| P004 | 27" Monitor | 45000 | 8 | 360000 |
| P001 | Wireless Mouse | 1000 | 200 | 200000 |

<!-- md-spreadsheet-table-metadata: {"id": 1, "formulas": {"1": {"type": "lookup", "sourceTableId": 0, "joinKeyLocal": "product_id", "joinKeyRemote": "product_id", "targetField": "product_name"}, "2": {"type": "lookup", "sourceTableId": 0, "joinKeyLocal": "product_id", "joinKeyRemote": "product_id", "targetField": "unit_price"}, "4": {"type": "arithmetic", "functionType": "expression", "expression": "[quantity] * [unit_price]"}}, "columns": {"1": {"width": 158}, "2": {"format": {"numberFormat": {"type": "number", "useThousandsSeparator": true}}}, "4": {"format": {"numberFormat": {"type": "number", "useThousandsSeparator": true}}}}} -->

### Annual Summary

This table provides yearly aggregated sales data per product.
**Computed Columns (to be implemented):**
- `product_name`: Lookup from Products table using `product_id` → `product_name`
- `total_revenue`: Expression `[total_quantity] * [unit_price]`

| product_id | product_name | unit_price | total_quantity | total_revenue |
| --- | --- | --- | --- | --- |
| P001 | Wireless Mouse | 1000 | 200 | 200000 |
| P002 | Mechanical Keyboard | 12000 | 83 | 996000 |
| P003 | USB-C Hub | 4500 | 175 | 787500 |
| P004 | 27" Monitor | 45000 | 20 | 900000 |
| P005 | Laptop Stand | 3500 | 65 | 227500 |

<!-- md-spreadsheet-table-metadata: {"id": 2, "formulas": {"1": {"type": "lookup", "sourceTableId": 0, "joinKeyLocal": "product_id", "joinKeyRemote": "product_id", "targetField": "product_name"}, "2": {"type": "lookup", "sourceTableId": 0, "joinKeyLocal": "product_id", "joinKeyRemote": "product_id", "targetField": "unit_price"}, "4": {"type": "arithmetic", "functionType": "expression", "expression": "[total_quantity] * [unit_price]"}}, "columns": {"1": {"width": 156}, "2": {"format": {"numberFormat": {"type": "number", "useThousandsSeparator": true}}}, "4": {"format": {"numberFormat": {"type": "number", "useThousandsSeparator": true}}, "width": 124}}} -->

<!-- md-spreadsheet-sheet-metadata: {"layout": {"type": "pane", "id": "root", "tables": [0, 1], "activeTableIndex": 1}} -->

## AggregateTest

### Scores

Test data for aggregate functions (SUM, AVG, COUNT, MIN, MAX) within the same sheet.

| student_id | name | math | science | english | SUM | AVG | MIN | MAX |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| S001 | Alice | 85 | 92 | 78 | 255 | 85 | 78 | 92 |
| S002 | Bob | 72 | 68 | 81 | 221 | 73.67 | 68 | 81 |
| S003 | Carol | 95 | 88 | 92 | 275 | 91.67 | 88 | 95 |
| S004 | David | 60 | 75 | 70 | 205 | 68.33 | 60 | 75 |
| S005 | Eve | 88 | 90 | 85 | 263 | 87.67 | 85 | 90 |

<!-- md-spreadsheet-table-metadata: {"id": 3, "formulas": {"5": {"type": "arithmetic", "functionType": "sum", "columns": ["math", "science", "english"]}, "6": {"type": "arithmetic", "functionType": "avg", "columns": ["math", "science", "english"]}, "7": {"type": "arithmetic", "functionType": "min", "columns": ["math", "science", "english"]}, "8": {"type": "arithmetic", "functionType": "max", "columns": ["math", "science", "english"]}}, "columns": {"6": {"format": {"numberFormat": {"type": "number", "decimals": 2}}}}} -->

<!-- md-spreadsheet-sheet-metadata: {"layout": {"type": "pane", "id": "root", "tables": [0], "activeTableIndex": 0}} -->

<!-- md-spreadsheet-workbook-metadata: {"tab_order": [{"type": "sheet", "index": 0}, {"type": "sheet", "index": 1}, {"type": "sheet", "index": 2}]} -->
