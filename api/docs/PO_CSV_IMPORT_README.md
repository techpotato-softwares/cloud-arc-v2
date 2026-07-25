# PO CSV Data Preparation Guide

This guide explains how to prepare a CSV file for bulk-creating Purchase Orders (PO) and PO Items.

## Important Notes

- Do **not** provide `poId` in the CSV. The system generates it automatically in the format `OSG-<fiscal-year>-<sequence>` (e.g. `OSG-2025-26-00000001`).
- You can optionally provide a `fiscalYear` column (e.g. `2023-24`) to import historical POs under a past financial year. If left empty, the current fiscal year is used.
- **One row = one PO item**. If a PO has 3 items, use 3 rows with the same PO header details.
- The importer processes each PO independently. If some rows have errors, those POs are skipped but all valid POs are still created. A detailed error report is returned.

## How Multiple Rows Become One PO

Rows are grouped into one PO by the combination of `clientPoNo` + `clientPoDate`.

For rows in the same PO group, all PO-level fields (everything except item fields) **must be identical**. If any mismatch is found, that entire PO group is skipped with a clear error.

**Example:** 1 PO with 2 items

| salesPersonUsername | fiscalYear | clientPoNo | clientPoDate | ... (same PO fields) | categoryName | productName | quantity | ... |
|---|---|---|---|---|---|---|---|---|
| john.doe | 2024-25 | PO-ACME-4501 | 2025-03-14 | ... | UPS | UPS 10kVA | 2 | ... |
| john.doe | 2024-25 | PO-ACME-4501 | 2025-03-14 | ... | Battery | VRLA 100Ah | 8 | ... |

## Auto-Created Entities

If any of these do not already exist in the system, they are created automatically using the names provided:

- **Client** -- matched by `clientName` (case-insensitive)
- **Category** -- matched by `categoryName` (case-insensitive)
- **OEM** -- matched by `oemName` (case-insensitive)
- **Product** -- matched by the combination of `productName` + `categoryName` + `oemName`

## Required CSV Columns

All columns listed below **must be present** in the CSV header row. Columns marked "optional value" can be left empty but the column header must still exist.

### PO Header Fields (same for all rows in one PO)

| Column | Required | Description |
|---|---|---|
| `salesPersonUsername` | Yes | Username of the sales person who owns this PO (must exist in system). This sets the "created by" on the PO. |
| `fiscalYear` | Optional value | Financial year for PO ID generation in `YYYY-YY` format (e.g. `2023-24`). If left empty, the current fiscal year is used automatically. Useful for importing historical data from past financial years. |
| `clientName` | Yes | Client / company name |
| `clientAddress` | Yes | Full address of the client |
| `clientContact` | Yes | Phone number or contact info |
| `clientGST` | Optional value | GST registration number |
| `osgPiNo` | Yes | OSG Proforma Invoice number |
| `osgPiDate` | Yes | OSG PI date |
| `clientPoNo` | Yes | Client's PO number (used to group rows) |
| `clientPoDate` | Yes | Client's PO date (used to group rows) |
| `poStatus` | Yes | See allowed values below |
| `noOfDispatch` | Yes | See allowed values below |
| `dispatchPlanDate` | Yes | Planned dispatch date |
| `siteLocation` | Yes | Delivery site / location name |
| `oscSupport` | Yes | See allowed values below |
| `paymentStatus` | Yes | See allowed values below |
| `assignDispatchToUsername` | Optional value | Username of person assigned for dispatch (must exist in system) |
| `assignServiceToUsername` | Optional value | Username of person assigned for service (must exist in system) |
| `remarks` | Optional value | Any additional notes |

### PO Item Fields (unique per row)

| Column | Required | Description |
|---|---|---|
| `categoryName` | Yes | Product category name (e.g. UPS, Battery, Stabilizer) |
| `oemName` | Yes | Manufacturer / OEM name (e.g. Schneider, Exide) |
| `productName` | Yes | Product name / model (e.g. UPS 10kVA) |
| `quantity` | Yes | Order quantity (integer, minimum 1) |
| `spareQuantity` | Optional value | Spare quantity (integer, default 0) |
| `pricePerUnit` | Yes | Price per unit (number, minimum 0) |
| `gstPercent` | Yes | GST percentage (see allowed values) |
| `warranty` | Yes | Warranty period (see allowed values) |

## Allowed Values

### Date Fields

Accepted formats (all three date columns):
- **`YYYY-MM-DD`** (preferred) -- e.g. `2026-03-15`
- **`DD/MM/YYYY`** -- e.g. `15/03/2026`
- **`DD-MM-YYYY`** -- e.g. `15-03-2026`

### `fiscalYear`

Indian financial year runs April to March. Format is `YYYY-YY` where `YYYY` is the starting year.

| Value | Financial Year |
|---|---|
| `2023-24` | April 2023 – March 2024 |
| `2024-25` | April 2024 – March 2025 |
| `2025-26` | April 2025 – March 2026 |

When left empty, the system uses the current financial year based on today's date.

The generated PO ID includes this fiscal year, e.g. `OSG-2024-25-00000001`.

### `poStatus`

| Value | Meaning |
|---|---|
| `po_received` | PO received |
| `po_confirmed_phone` | PO confirmed on phone |
| `on_whatsapp` | On WhatsApp |
| `on_mail` | On mail |

### `noOfDispatch`

| Value | Meaning |
|---|---|
| `single` | Single dispatch |
| `multiple` | Multiple dispatches |

### `oscSupport`

| Value | Meaning |
|---|---|
| `yes` | Yes |
| `no` | No |
| `maybe` | Maybe |

### `paymentStatus`

| Value | Meaning |
|---|---|
| `advanced` | Advanced |
| `received` | Received |
| `pending` | Pending |
| `cancelled` | Cancelled |
| `15_dc` | 15 DC |
| `30_dc` | 30 DC |
| `45_dc` | 45 DC |
| `60_dc` | 60 DC |
| `15_lc` | 15 LC |
| `30_lc` | 30 LC |
| `45_lc` | 45 LC |
| `60_lc` | 60 LC |
| `pdc_15` | PDC 15 |
| `pdc_30` | PDC 30 |
| `pdc_45` | PDC 45 |
| `pdc_60` | PDC 60 |

### `gstPercent`

Only these values are accepted: `5`, `9`, `12`, `15`, `18`

### `warranty`

| Value | Meaning |
|---|---|
| `1_year` | 1 Year |
| `2_years` | 2 Years |
| `3_years` | 3 Years |
| `4_years` | 4 Years |
| `5_years` | 5 Years |
| `6_years` | 6 Years |
| `7_years` | 7 Years |
| `8_years` | 8 Years |
| `9_years` | 9 Years |
| `10_years` | 10 Years |
| `11_years` | 11 Years |
| `12_years` | 12 Years |

## Automatically Calculated Fields

These are computed by the system -- do **not** include them in the CSV:

- `totalQuantity = quantity + spareQuantity`
- `totalPrice = quantity x pricePerUnit`
- `finalPrice = totalPrice + (totalPrice x gstPercent / 100)`

## How Errors Are Handled

- The importer does **not** stop on the first error.
- Each PO group (rows sharing the same `clientPoNo` + `clientPoDate`) is processed independently.
- If a PO group has any validation errors, that entire group is skipped but all other valid POs are still created.
- The response includes a detailed error report showing exactly which row, field, and value caused each problem.

## General Rules for Preparing the CSV

1. Save as **plain text CSV** with **UTF-8** encoding and **comma** separator.
2. Keep the header row exactly as shown in the template -- do not rename, reorder, or remove columns.
3. One row per product/item. Repeat PO header fields on every row for the same PO.
4. Avoid extra spaces before or after values.
5. If a text value contains commas, wrap it in double quotes (e.g. `"Tower 4, Sector 62, Noida"`).
6. Leave optional fields empty (do not write `N/A` or `null`).
7. `salesPersonUsername` **must** match an existing username in the system — this is the sales person who owns the PO.
8. `assignDispatchToUsername` and `assignServiceToUsername` must match existing usernames in the system. If unsure, leave them blank.

## Sample CSV

See the template file: [`po_items_import_sample.csv`](po_items_import_sample.csv)
