# Tables

## Master

### Products

This table contains the product master data. All other tables reference this table by `product_id`.

| product_id | product_name | category | unit_price |
| --- | --- | --- | --- |
| P001 | Wireless<br> Mouse | Accessories | 2500 |
| P002 | Mechanical Keyboard | Accessories | 12000 |
| P003 | USB-C Hub | Accessories | 4500 |
| P004 | 27" Monitor | Display | 45000 |
| P005 | Laptop Stand | Accessories | 3500 |

<!-- md-spreadsheet-table-metadata: {"id": 0} -->

## Sales

### Monthly Sales

This table tracks monthly sales quantities by product and month.
**Computed Columns (to be implemented):**
- `product_name`: Lookup from Products table using `product_id` → `product_name`
- `unit_price`: Lookup from Products table using `product_id` → `unit_price`
- `subtotal`: Expression `[quantity] * [unit_price]`

| product_id | product_name | unit_price | quantity | subtotal |
| --- | --- | --- | --- | --- |
| P001 | Wireless<br> Mouse | 2500 | 150 | 375000 |
| P002 | Mechanical Keyboard | 12000 | 45 | 540000 |
| P003 | USB-C Hub | 4500 | 80 | 360000 |
| P001 | Wireless<br> Mouse | 2500 | 120 | 300000 |
| P004 | 27" Monitor | 45000 | 12 | 540000 |
| P002 | Mechanical Keyboard | 12000 | 38 | 456000 |
| P005 | Laptop Stand | 3500 | 65 | 227500 |
| P003 | USB-C Hub | 4500 | 95 | 427500 |
| P004 | 27" Monitor | 45000 | 8 | 360000 |
| P001 | Wireless<br> Mouse | 2500 | 200 | 500000 |

<!-- md-spreadsheet-table-metadata: {"id": 1, "formulas": {"1": {"type": "lookup", "sourceTableId": 0, "joinKeyLocal": "product_id", "joinKeyRemote": "product_id", "targetField": "product_name"}, "2": {"type": "lookup", "sourceTableId": 0, "joinKeyLocal": "product_id", "joinKeyRemote": "product_id", "targetField": "unit_price"}, "4": {"type": "arithmetic", "functionType": "expression", "expression": "[quantity] * [unit_price]"}}} -->

### Annual Summary

This table provides yearly aggregated sales data per product.
**Computed Columns (to be implemented):**
- `product_name`: Lookup from Products table using `product_id` → `product_name`
- `total_revenue`: Expression `[total_quantity] * [unit_price]`

| product_id | product_name | unit_price | total_quantity | total_revenue |
| --- | --- | --- | --- | --- |
| P001 | Wireless<br> Mouse | 2500 | 470 | 1175000 |
| P002 | Mechanical Keyboard | 12000 | 83 | 996000 |
| P003 | USB-C Hub | 4500 | 175 | 787500 |
| P004 | 27" Monitor | 45000 | 20 | 900000 |
| P005 | Laptop Stand | 3500 | 65 |  |

<!-- md-spreadsheet-table-metadata: {"id": 2, "formulas": {"1": {"type": "lookup", "sourceTableId": 0, "joinKeyLocal": "product_id", "joinKeyRemote": "product_id", "targetField": "product_name"}, "4": {"type": "arithmetic", "functionType": "expression", "expression": "[total_quantity] * [unit_price]"}}} -->

<!-- md-spreadsheet-workbook-metadata: {"tab_order": [{"type": "sheet", "index": 0}, {"type": "sheet", "index": 1}]} -->
