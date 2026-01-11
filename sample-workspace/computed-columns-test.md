# Tables

## Master

### Products

This table contains the product master data. All other tables reference this table by `product_id`.

| product_id | product_name | category | unit_price |
| --- | --- | --- | --- |
| P001 | Wireless Mouse | Accessories | 2000 |
| P002 | Mechanical Keyboard | Accessories | 12000 |
| P003 | USB-C Hub | Accessories | 4500 |
| P004 | 27" Monitor | Display | 45000 |
| P005 | Laptop Stand | Accessories | 3500 |

<!-- md-spreadsheet-table-metadata: {"id": 0, "columns": {"1": {"width": 171}}} -->

## Sales

### Monthly Sales

This table tracks monthly sales quantities by product and month.
**Computed Columns (to be implemented):**
- `product_name`: Lookup from Products table using `product_id` → `product_name`
- `unit_price`: Lookup from Products table using `product_id` → `unit_price`
- `subtotal`: Expression `[quantity] * [unit_price]`

| product_id | product_name | unit_price | quantity | subtotal |
| --- | --- | --- | --- | --- |
| P001 | Wireless Mouse | 2000 | 200 | 400000 |
| P002 | Mechanical Keyboard | 12000 | 45 | 540000 |
| P003 | USB-C Hub | 4500 | 80 | 360000 |
| P001 | Wireless Mouse | 2000 | 120 | 240000 |
| P004 | 27" Monitor | 45000 | 12 | 540000 |
| P002 | Mechanical Keyboard | 12000 | 38 | 456000 |
| P005 | Laptop Stand | 3500 | 65 | 227500 |
| P003 | USB-C Hub | 4500 | 95 | 427500 |
| P004 | 27" Monitor | 45000 | 8 | 360000 |
| P001 | Wireless Mouse | 2000 | 200 | 400000 |

<!-- md-spreadsheet-table-metadata: {"id": 1, "formulas": {"1": {"type": "lookup", "sourceTableId": 0, "joinKeyLocal": "product_id", "joinKeyRemote": "product_id", "targetField": "product_name"}, "2": {"type": "lookup", "sourceTableId": 0, "joinKeyLocal": "product_id", "joinKeyRemote": "product_id", "targetField": "unit_price"}, "4": {"type": "arithmetic", "functionType": "expression", "expression": "[quantity] * [unit_price]"}}, "columns": {"1": {"width": 158}, "2": {"format": {"numberFormat": {"type": "number", "useThousandsSeparator": true}}}, "4": {"format": {"numberFormat": {"type": "number", "useThousandsSeparator": true}}}}} -->

### Annual Summary

This table provides yearly aggregated sales data per product.
**Computed Columns (to be implemented):**
- `product_name`: Lookup from Products table using `product_id` → `product_name`
- `total_revenue`: Expression `[total_quantity] * [unit_price]`

| product_id | product_name | unit_price | total_quantity | total_revenue |
| --- | --- | --- | --- | --- |
| P001 | Wireless Mouse | 2000 | 200 | 400000 |
| P002 | Mechanical Keyboard | 12000 | 83 | 996000 |
| P003 | USB-C Hub | 4500 | 175 | 787500 |
| P004 | 27" Monitor | 45000 | 20 | 900000 |
| P005 | Laptop Stand | 3500 | 65 | 227500 |

<!-- md-spreadsheet-table-metadata: {"id": 2, "formulas": {"1": {"type": "lookup", "sourceTableId": 0, "joinKeyLocal": "product_id", "joinKeyRemote": "product_id", "targetField": "product_name"}, "2": {"type": "lookup", "sourceTableId": 0, "joinKeyLocal": "product_id", "joinKeyRemote": "product_id", "targetField": "unit_price"}, "4": {"type": "arithmetic", "functionType": "expression", "expression": "[total_quantity] * [unit_price]"}}, "columns": {"1": {"width": 156}, "2": {"format": {"numberFormat": {"type": "number", "useThousandsSeparator": true}}}, "4": {"format": {"numberFormat": {"type": "number", "useThousandsSeparator": true}}, "width": 124}}} -->

<!-- md-spreadsheet-sheet-metadata: {"layout": {"type": "pane", "id": "root", "tables": [0, 1], "activeTableIndex": 1}} -->

## AggregateTest

### Scores

Test data for aggregate functions (SUM, AVG, COUNT, MIN, MAX) within the same sheet.

| student_id | name | math | science | english | New Column | New Column |
| --- | --- | --- | --- | --- | --- | --- |
| S001 | Alice | 85 | 92 | 78 | 255 | 85 |
| S002 | Bob | 72 | 68 | 81 | 221 | 73.67 |
| S003 | Carol | 95 | 88 | 92 | 275 | 91.67 |
| S004 | David | 60 | 75 | 70 | 205 | 68.33 |
| S005 | Eve | 88 | 90 | 85 | 263 | 87.67 |

<!-- md-spreadsheet-table-metadata: {"id": 3, "formulas": {"5": {"type": "arithmetic", "functionType": "sum", "columns": ["math", "science", "english"]}, "6": {"type": "arithmetic", "functionType": "avg", "columns": ["math", "science", "english"]}}} -->

### ScoreSummary

Summary table for same-sheet aggregate testing.
**Expected Computed Columns:**
- `math_sum`: SUM of math column from Scores
- `math_avg`: AVG of math column from Scores
- `math_count`: COUNT of math column from Scores
- `math_min`: MIN of math column from Scores
- `math_max`: MAX of math column from Scores

| subject | math_sum | math_avg | math_count | math_min | math_max |
| --- | --- | --- | --- | --- | --- |
| Math Stats | N/A | N/A | N/A | N/A | N/A |

<!-- md-spreadsheet-table-metadata: {"id": 4, "formulas": {"1": {"type": "arithmetic", "functionType": "sum", "columns": ["math"], "sourceTableId": 3}, "2": {"type": "arithmetic", "functionType": "avg", "columns": ["math"], "sourceTableId": 3}, "3": {"type": "arithmetic", "functionType": "count", "columns": ["math"], "sourceTableId": 3}, "4": {"type": "arithmetic", "functionType": "min", "columns": ["math"], "sourceTableId": 3}, "5": {"type": "arithmetic", "functionType": "max", "columns": ["math"], "sourceTableId": 3}}, "columns": {"3": {"width": 139}}} -->

<!-- md-spreadsheet-sheet-metadata: {"layout": {"type": "pane", "id": "root", "tables": [0, 1], "activeTableIndex": 1}} -->

## CrossSheetAgg

### OrderData

Source data for cross-sheet aggregate function testing.

| order_id | region | amount | quantity |
| --- | --- | --- | --- |
| O001 | North | 15000 | 3 |
| O002 | South | 8500 | 2 |
| O003 | North | 22000 | 5 |
| O004 | East | 12000 | 4 |
| O005 | South | 9500 | 2 |
| O006 | West | 18000 | 6 |
| O007 | North | 5000 | 1 |
| O008 | East | 25000 | 8 |
| O009 | West | 11000 | 3 |
| O010 | South | 7000 | 2 |

<!-- md-spreadsheet-table-metadata: {"id": 5} -->

### RegionSummary

Summary table for cross-sheet aggregate testing (source: OrderData in this sheet).
**Expected Computed Columns:**
- `total_amount`: SUM of amount from OrderData
- `avg_amount`: AVG of amount from OrderData
- `order_count`: COUNT of amount from OrderData
- `min_amount`: MIN of amount from OrderData
- `max_amount`: MAX of amount from OrderData

| region | total_amount | avg_amount | order_count | min_amount | max_amount |
| --- | --- | --- | --- | --- | --- |
| All Regions | - | - | - | - | - |

<!-- md-spreadsheet-table-metadata: {"id": 6} -->

<!-- md-spreadsheet-sheet-metadata: {"layout": {"type": "pane", "id": "root", "tables": [0, 1], "activeTableIndex": 0}} -->

<!-- md-spreadsheet-workbook-metadata: {"tab_order": [{"type": "sheet", "index": 0}, {"type": "sheet", "index": 1}, {"type": "sheet", "index": 2}, {"type": "sheet", "index": 3}]} -->
