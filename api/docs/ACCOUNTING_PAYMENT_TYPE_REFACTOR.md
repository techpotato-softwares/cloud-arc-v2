# Accounting Entries: Payment Type Refactor (Proposal)

## Overview

Refactor the `accounting_entries` table to:

1. Introduce **payment type** (Advance / Part Payment / Credit Note) and use a **single payment amount column** instead of three (`advance_amount`, `payment_amount`, `credit_note_amount`).
2. Use a **single payment date column** instead of three (`advance_date`, `payment_date`, `credit_note_date`).

This simplifies the schema, balance logic, and UI.

---

## 1. Rationale & Benefits

| Current | After refactor |
|--------|-----------------|
| Three amount columns: `advance_amount`, `payment_amount`, `credit_note_amount` — only one is set per payment entry | One column: `payment_amount`; meaning comes from `payment_type` |
| Three date columns: `advance_date`, `payment_date`, `credit_note_date` — only one is set per payment entry | One column: `payment_date`; same date used for all payment types |
| Balance logic branches on "which column is set" | Balance logic: for payment entries use `payment_amount` (+ `tds` when Part Payment) |
| UI infers type from which field is filled | UI reads `payment_type` and shows one amount and one date field |
| Harder to query "all payments" or "total by type" | Easy: `WHERE payment_type = 'Advance'`, single SUM on `payment_amount` |

**Benefits:**

- **Single source of truth** for "how much" per entry (`payment_amount`) and "when" (`payment_date`).
- **Explicit type** (`payment_type`) instead of inferring from nullable columns.
- **Simpler calculations**: amount applied = `payment_amount` (+ `tds` for Part Payment).
- **Cleaner API/UI**: one amount and one date in request/response; type in request/response.
- **Easier reporting**: filter and sum by `payment_type`.

**Note:** `balance_amount` stays as-is (it is the running balance after the entry, not a "payment" amount).

---

## 2. Current vs Proposed Schema

### Current (relevant columns)

```
advance_amount         Decimal?   -- set only for Advance entries
advance_date           DateTime?
payment_date           DateTime?  -- set for Part Payment
payment_due_date       DateTime?
payment_amount         Decimal?   -- set only for Part Payment
tds                    Decimal?
balance_amount         Decimal?
credit_note_ref        String?
credit_note_date       DateTime?
credit_note_amount     Decimal?  -- set only for Credit Note
credit_note_remark     String?
multiple_payment_ref_no String?  -- used for Advance / Part Payment ref
```

### Proposed

**New column:**

| Column (DB)      | Type           | Description |
|------------------|----------------|-------------|
| `payment_type`   | `VarChar(20)?` | `'Advance'` \| `'Part Payment'` \| `'Credit Note'`. Null for **expense-only** rows (dispatch/commissioning). |

**Consolidated amount:**

| Column (DB)   | Role |
|---------------|------|
| `payment_amount` | **Single** amount for all payment entries: Advance amount, Part Payment amount, or Credit Note amount, depending on `payment_type`. |

**Consolidated date:**

| Column (DB)   | Role |
|---------------|------|
| `payment_date` | **Single** date for all payment entries: date of advance, part payment, or credit note (depending on `payment_type`). |

**Removed (amounts):**

- `advance_amount` — value moved to `payment_amount` when `payment_type = 'Advance'`.
- `credit_note_amount` — value moved to `payment_amount` when `payment_type = 'Credit Note'`.

**Removed (dates):**

- `advance_date` — value moved to `payment_date` when `payment_type = 'Advance'`.
- `credit_note_date` — value moved to `payment_date` when `payment_type = 'Credit Note'`.

**Unchanged:**

- `payment_amount` — already used for Part Payment; will also store Advance and Credit Note amounts.
- `payment_date` — already used for Part Payment; will also store Advance and Credit Note dates.
- `balance_amount` — still the running balance after this entry (backend-computed).
- `tds` — still used for Part Payment (0 when not applicable).
- `payment_due_date` — unchanged (used for Part Payment due date where applicable).

**Credit Note–specific (kept):**

- `credit_note_ref`, `credit_note_remark` — remain for Credit Note metadata. Amount and date live in `payment_amount` and `payment_date` when `payment_type = 'Credit Note'`.

---

## 3. Payment Type Values

| Value          | Description | Amount stored in | Date stored in | TDS |
|----------------|-------------|-------------------|----------------|-----|
| `Advance`     | Advance payment | `payment_amount` | `payment_date` | 0  |
| `Part Payment`| Part payment against invoice | `payment_amount` | `payment_date` | Optional |
| `Credit Note` | Credit note / adjustment | `payment_amount` | `payment_date` | 0  |
| *(null)*      | Expense-only entry (dispatch/commissioning) | N/A | N/A | N/A |

**Balance rule (unchanged conceptually):**

- Amount applied = `payment_amount` (+ `tds` for Part Payment).
- `balance_amount` = running balance after applying this entry (computed on backend).

---

## 4. Data Migration (DB)

1. **Add** `payment_type` (nullable). Keep existing amount and date columns for now.
2. **Backfill amount and type:**
   - If `advance_amount` IS NOT NULL → `payment_type = 'Advance'`, copy `advance_amount` → `payment_amount` (where `payment_amount` is null).
   - Else if `credit_note_amount` IS NOT NULL → `payment_type = 'Credit Note'`, copy `credit_note_amount` → `payment_amount` (where null).
   - Else if `payment_amount` IS NOT NULL → `payment_type = 'Part Payment'`.
   - Else (expense-only) → `payment_type` remains NULL.
3. **Backfill date** into single `payment_date` where not already set:
   - For rows with `payment_type = 'Advance'`: set `payment_date = COALESCE(payment_date, advance_date)`.
   - For rows with `payment_type = 'Credit Note'`: set `payment_date = COALESCE(payment_date, credit_note_date)`.
   - (Part Payment already uses `payment_date`.)
4. **Drop** columns: `advance_amount`, `credit_note_amount`, `advance_date`, `credit_note_date` (after API/UI use only `payment_amount`, `payment_date`, and `payment_type`).
5. **Optional:** Add a DB constraint or check so that for non-null `payment_type`, `payment_amount` is expected to be set (application-level validation is also fine).

---

## 5. Impact Summary

| Layer | Changes |
|-------|--------|
| **Prisma schema** | Add `paymentType`; remove `advanceAmount`, `creditNoteAmount`, `advanceDate`, `creditNoteDate`; keep `paymentAmount` and `paymentDate` for all payment types. |
| **API request/response** | Add `paymentType`; single `paymentAmount` and `paymentDate` in request/response. Remove `advanceAmount`, `creditNoteAmount`, `advanceDate`, `creditNoteDate` from DTOs (or keep for backward compatibility during transition). |
| **AccountingEntryService** | `getAmountApplied()`: use `payment_type` + `payment_amount` (and `tds` for Part Payment); no branching on advance/credit note columns. |
| **Repository** | Map `paymentType`, `paymentAmount`, and `paymentDate` only; stop reading/writing old amount and date columns. |
| **UI (PODetails)** | Payments table: type from `paymentType`; amount from `payment_amount`; date from `payment_date`. |
| **UI (AddPaymentModal)** | Form: single amount field, single date field; type selector (Advance / Part Payment / Credit Note); submit `paymentType` + `paymentAmount` + `paymentDate`. |
| **UI (sumOfPaymentMade)** | Sum `payment_amount` (+ `tds` if included) for entries with a payment type; no need to sum three amount columns. |

---

## 6. Optional Follow-ups (Not in This Refactor)

- **Index:** Add index on `payment_type` if you often filter or report by type.

---

## 7. Implementation Order (When You Confirm)

1. **DB migration:** Add `payment_type`; backfill amount/type from `advance_amount` / `payment_amount` / `credit_note_amount`; backfill `payment_date` from `advance_date` / `payment_date` / `credit_note_date`; then drop `advance_amount`, `credit_note_amount`, `advance_date`, `credit_note_date`.
2. **Prisma:** Update `AccountingEntry` model (add `paymentType`; remove `advanceAmount`, `creditNoteAmount`, `advanceDate`, `creditNoteDate`).
3. **API schemas:** Request/response use `paymentType` + `paymentAmount` + `paymentDate` only; remove or deprecate old amount and date fields.
4. **Repository:** Map `paymentType`, `paymentAmount`, and `paymentDate` only; remove mapping for old columns.
5. **Service:** `getAmountApplied(entry)` and create/update logic use `paymentType` + `payment_amount` (+ `tds` for Part Payment).
6. **UI:** AddPaymentModal and PODetails use `paymentType`, `payment_amount`, and `payment_date` only (single amount and single date).

---

## 8. Rollback

- Keep a backup of the table or migrations that restore:
  - `advance_amount` / `credit_note_amount` from `payment_amount` using `payment_type`, and
  - `advance_date` / `credit_note_date` from `payment_date` using `payment_type`
  before dropping columns, so you can revert the schema and re-run old code if needed.

---

Once you confirm this approach (and any tweaks, e.g. exact enum values or column names), implementation can follow the order above.
