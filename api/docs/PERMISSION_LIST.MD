# Permission List

> **Last Updated:** March 2026  
> **Total Permissions:** 45  
> **Source of truth:** `api/scripts/seed-admin.js` and `ui/src/constants/permissions.ts`

## Related Documentation

| Document | Description |
|----------|-------------|
| [ROLE_PERMISSION_MATRIX.md](./ROLE_PERMISSION_MATRIX.md) | Role definitions and permission mappings |
| [AUTHORIZATION_IMPLEMENTATION.md](./AUTHORIZATION_IMPLEMENTATION.md) | Technical implementation guide |

## Validation Notes

- This list is aligned with the currently seeded permissions and frontend constants.
- `po_pricing_view_own` is intentionally **not** in the active list (it exists only in older docs/plans).

---

## Permission Categories

### Product Management (4)

| Permission Name | Permission Code | Description |
|-----------------|-----------------|-------------|
| Product Management Create | `product_create` | Permission to create products, OEM, Category, Client |
| Product Management Read | `product_read` | Permission to read products, OEM, Category, Client |
| Product Management Update | `product_update` | Permission to update products, OEM, Category, Client |
| Product Management Delete | `product_delete` | Permission to delete products, OEM, Category, Client |

### User Management (5)

| Permission Name | Permission Code | Description |
|-----------------|-----------------|-------------|
| Users Management Create | `users_create` | Permission to create users, roles and permissions |
| Users Management Read | `users_read` | Permission to read users, roles and permissions |
| Users Management Update | `users_update` | Permission to update users, roles and permissions |
| Users Management Delete | `users_delete` | Permission to delete users, roles and permissions |
| Users Management View | `users_view` | Permission to view users, roles and permissions |

### PO Management (8)

| Permission Name | Permission Code | Description |
|-----------------|-----------------|-------------|
| PO Management Create | `po_create` | Permission to create POs |
| PO Management Read | `po_read` | Permission to read POs |
| PO Management Update | `po_update` | Permission to update POs |
| PO Management Delete | `po_delete` | Permission to delete POs |
| PO Read All | `po_read_all` | Permission to view all POs (Summary Dashboard) |
| PO Pricing View All | `po_pricing_view_all` | Permission to view pricing of all POs (Admin only) |
| Update Assign Dispatch To | `can_update_assign_dispatch_to` | Permission to update Assign Dispatch To on POs |
| Update Assign Service To | `can_update_assign_service_to` | Permission to update Assign Service To on POs |

### Dispatch Management (4)

| Permission Name | Permission Code | Description |
|-----------------|-----------------|-------------|
| Dispatch Management Create | `dispatch_create` | Permission to create Dispatch details |
| Dispatch Management Read | `dispatch_read` | Permission to read Dispatch details |
| Dispatch Management Update | `dispatch_update` | Permission to update Dispatch details |
| Dispatch Management Delete | `dispatch_delete` | Permission to delete Dispatch details |

### Dispatch Document Management (4)

| Permission Name | Permission Code | Description |
|-----------------|-----------------|-------------|
| Dispatch Document Create | `dispatch_document_create` | Permission to create Dispatch Documents |
| Dispatch Document Read | `dispatch_document_read` | Permission to read Dispatch Documents |
| Dispatch Document Update | `dispatch_document_update` | Permission to update Dispatch Documents |
| Dispatch Document Delete | `dispatch_document_delete` | Permission to delete Dispatch Documents |

### Delivery Management (4)

| Permission Name | Permission Code | Description |
|-----------------|-----------------|-------------|
| Delivery Management Create | `delivery_create` | Permission to create Delivery Confirmations |
| Delivery Management Read | `delivery_read` | Permission to read Delivery Confirmations |
| Delivery Management Update | `delivery_update` | Permission to update Delivery Confirmations |
| Delivery Management Delete | `delivery_delete` | Permission to delete Delivery Confirmations |

### Pre-Commissioning Management (4)

| Permission Name | Permission Code | Description |
|-----------------|-----------------|-------------|
| Pre-Commissioning Create | `pre_commissioning_create` | Permission to create Pre-Commissioning records |
| Pre-Commissioning Read | `pre_commissioning_read` | Permission to read Pre-Commissioning records |
| Pre-Commissioning Update | `pre_commissioning_update` | Permission to update Pre-Commissioning records |
| Pre-Commissioning Delete | `pre_commissioning_delete` | Permission to delete Pre-Commissioning records |

### Commissioning Management (4)

| Permission Name | Permission Code | Description |
|-----------------|-----------------|-------------|
| Commissioning Management Create | `commissioning_create` | Permission to create Final Commissioning records |
| Commissioning Management Read | `commissioning_read` | Permission to read Final Commissioning records |
| Commissioning Management Update | `commissioning_update` | Permission to update Final Commissioning records |
| Commissioning Management Delete | `commissioning_delete` | Permission to delete Final Commissioning records |

### Warranty Management (4)

| Permission Name | Permission Code | Description |
|-----------------|-----------------|-------------|
| Warranty Management Create | `warranty_create` | Permission to create Warranty Certificates |
| Warranty Management Read | `warranty_read` | Permission to read Warranty Certificates |
| Warranty Management Update | `warranty_update` | Permission to update Warranty Certificates |
| Warranty Management Delete | `warranty_delete` | Permission to delete Warranty Certificates |

### Accounting Management (4)

| Permission Name | Permission Code | Description |
|-----------------|-----------------|-------------|
| Accounting Management Create | `accounting_create` | Permission to create Accounting entries (Sales & Invoice, Payment, Dispatch/Commissioning Costs, Credit Notes) |
| Accounting Management Read | `accounting_read` | Permission to read Accounting entries |
| Accounting Management Update | `accounting_update` | Permission to update Accounting entries |
| Accounting Management Delete | `accounting_delete` | Permission to delete Accounting entries |

---

## Quick Count Summary

| Category | Count |
|----------|------:|
| Product Management | 4 |
| User Management | 5 |
| PO Management | 8 |
| Dispatch Management | 4 |
| Dispatch Document Management | 4 |
| Delivery Management | 4 |
| Pre-Commissioning Management | 4 |
| Commissioning Management | 4 |
| Warranty Management | 4 |
| Accounting Management | 4 |
| **Total** | **45** |

## Adding New Permissions

1. Add to seeder list in `api/scripts/seed-admin.js`
2. Add to frontend constants in `ui/src/constants/permissions.ts`
3. Re-run seeder (`--mode=permissions`) in target environment
4. Update this document
5. Update `ROLE_PERMISSION_MATRIX.md` with role assignments
