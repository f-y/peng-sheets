# Tables

## Master

### Products

This table contains the product master data. All other tables reference this table by `product_id`.

| product_id | product_name        | category    | unit_price |
|------------|---------------------|-------------|------------|
| P001       | Wireless Mouse      | Accessories | 2500       |
| P002       | Mechanical Keyboard | Accessories | 12000      |
| P003       | USB-C Hub           | Accessories | 4500       |
| P004       | 27" Monitor         | Display     | 45000      |
| P005       | Laptop Stand        | Accessories | 3500       |

<!-- metadata: {"id": 0} -->

---

## Sales

### Monthly Sales

This table tracks monthly sales quantities by product and month.

**Computed Columns (to be implemented):**
- `product_name`: Lookup from Products table using `product_id` → `product_name`
- `unit_price`: Lookup from Products table using `product_id` → `unit_price`
- `subtotal`: Expression `[quantity] * [unit_price]`

| product_id | product_name | unit_price | quantity | subtotal |
|------------|--------------|------------|----------|----------|
| P001       |              |            | 150      |          |
| P002       |              |            | 45       |          |
| P003       |              |            | 80       |          |
| P001       |              |            | 120      |          |
| P004       |              |            | 12       |          |
| P002       |              |            | 38       |          |
| P005       |              |            | 65       |          |
| P003       |              |            | 95       |          |
| P004       |              |            | 8        |          |
| P001       |              |            | 200      |          |

<!-- metadata: {"id": 1, "visual": {"formulas": {"1": {"type": "lookup", "sourceTableId": 0, "joinKeyLocal": "product_id", "joinKeyRemote": "product_id", "targetField": "product_name"}, "2": {"type": "lookup", "sourceTableId": 0, "joinKeyLocal": "product_id", "joinKeyRemote": "product_id", "targetField": "unit_price"}, "4": {"type": "arithmetic", "functionType": "expression", "expression": "[quantity] * [unit_price]"}}}} -->

### Annual Summary

This table provides yearly aggregated sales data per product.

**Computed Columns (to be implemented):**
- `product_name`: Lookup from Products table using `product_id` → `product_name`
- `total_revenue`: Expression `[total_quantity] * [unit_price]`

| product_id | product_name | unit_price | total_quantity | total_revenue |
|------------|--------------|------------|----------------|---------------|
| P001       |              | 2500       | 470            |               |
| P002       |              | 12000      | 83             |               |
| P003       |              | 4500       | 175            |               |
| P004       |              | 45000      | 20             |               |
| P005       |              | 3500       | 65             |               |

<!-- metadata: {"id": 2, "visual": {"formulas": {"1": {"type": "lookup", "sourceTableId": 0, "joinKeyLocal": "product_id", "joinKeyRemote": "product_id", "targetField": "product_name"}, "4": {"type": "arithmetic", "functionType": "expression", "expression": "[total_quantity] * [unit_price]"}}}} -->
