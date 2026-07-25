# Role-Permission Matrix

## Overview

This document defines the role-based access control (RBAC) system for the ArcForge CloudArc application. It specifies which permissions are assigned to each role and how they affect UI visibility and functionality.

> **Last Updated:** December 2024  
> **Related Documents:**
> - [PERMISSION_LIST.MD](./PERMISSION_LIST.MD) - Full permission code list
> - [AUTHORIZATION_IMPLEMENTATION.md](./AUTHORIZATION_IMPLEMENTATION.md) - Technical implementation guide

---

## Table of Contents

1. [Role Definitions](#1-role-definitions)
2. [Permission Categories](#2-permission-categories)
3. [Role-Permission Matrix](#3-role-permission-matrix)
4. [UI Access Rules](#4-ui-access-rules)
5. [SQL Seed Data](#5-sql-seed-data)
6. [Implementation Guidelines](#6-implementation-guidelines)

---

## 1. Role Definitions

### 1.1 Admin

| Attribute | Value |
|-----------|-------|
| **Role Name** | Admin |
| **Description** | Full system access. Can manage users, roles, permissions, and all business data. |
| **Use Case** | System administrators, IT managers |

**Capabilities:**
- Full access to Admin menu (Users, Roles, Permissions, Products, Clients)
- Create, Read, Update, Delete all POs
- View pricing for ALL POs (regardless of creator)
- Full CRUD on Dispatch, Delivery, Documents
- Full CRUD on Pre-Commissioning, Commissioning, Warranty

---

### 1.2 Sales

| Attribute | Value |
|-----------|-------|
| **Role Name** | Sales |
| **Description** | Sales team member responsible for creating and managing Purchase Orders. |
| **Use Case** | Sales executives, account managers |

**Capabilities:**
- NO access to Admin menu
- Create, Read, Update, Delete POs
- View pricing ONLY for their own created POs
- View-only access to Dispatch/Delivery forms
- View-only access to Commissioning forms

---

### 1.3 SupplyChain

| Attribute | Value |
|-----------|-------|
| **Role Name** | SupplyChain |
| **Description** | Supply chain team member responsible for dispatch and delivery operations. |
| **Use Case** | Logistics coordinators, warehouse managers |

**Capabilities:**
- NO access to Admin menu
- View-only access to POs (cannot create/edit/delete)
- NO access to PO pricing information
- Create, Read, Update, Delete Dispatch Details
- Create, Read, Update, Delete Dispatch Documents
- Create, Read, Update, Delete Delivery Confirmation
- View-only access to Commissioning forms

---

### 1.4 Service

| Attribute | Value |
|-----------|-------|
| **Role Name** | Service |
| **Description** | Service team member responsible for commissioning and warranty operations. |
| **Use Case** | Field engineers, service technicians |

**Capabilities:**
- NO access to Admin menu
- View-only access to POs (cannot create/edit/delete)
- NO access to PO pricing information
- View-only access to Dispatch/Delivery forms
- Create, Read, Update, Delete Pre-Commissioning
- Create, Read, Update, Delete Commissioning
- Create, Read, Update, Delete Warranty Certificate

---

## 2. Permission Categories

### 2.1 Admin/User Management Permissions

| Permission Code | Permission Name | Description |
|-----------------|-----------------|-------------|
| `users_create` | Users Management Create | Create users, roles, and permissions |
| `users_read` | Users Management Read | Read users, roles, and permissions |
| `users_update` | Users Management Update | Update users, roles, and permissions |
| `users_delete` | Users Management Delete | Delete users, roles, and permissions |
| `users_view` | Users Management View | View users, roles, and permissions |

### 2.2 Product Management Permissions

| Permission Code | Permission Name | Description |
|-----------------|-----------------|-------------|
| `product_create` | Product Management Create | Create products, OEM, Category, Client |
| `product_read` | Product Management Read | Read products, OEM, Category, Client |
| `product_update` | Product Management Update | Update products, OEM, Category, Client |
| `product_delete` | Product Management Delete | Delete products, OEM, Category, Client |

### 2.3 PO Management Permissions

| Permission Code | Permission Name | Description |
|-----------------|-----------------|-------------|
| `po_create` | PO Management Create | Create Purchase Orders |
| `po_read` | PO Management Read | Read Purchase Orders |
| `po_update` | PO Management Update | Update Purchase Orders |
| `po_delete` | PO Management Delete | Delete Purchase Orders |
| `po_pricing_view_own` | PO Pricing View Own | View pricing of own created POs only |
| `po_pricing_view_all` | PO Pricing View All | View pricing of all POs (Admin) |

### 2.4 Dispatch Management Permissions

| Permission Code | Permission Name | Description |
|-----------------|-----------------|-------------|
| `dispatch_create` | Dispatch Management Create | Create Dispatches, Delivery, Documents |
| `dispatch_read` | Dispatch Management Read | Read Dispatches, Delivery, Documents |
| `dispatch_update` | Dispatch Management Update | Update Dispatches, Delivery, Documents |
| `dispatch_delete` | Dispatch Management Delete | Delete Dispatches, Delivery, Documents |

### 2.5 Commissioning Management Permissions

| Permission Code | Permission Name | Description |
|-----------------|-----------------|-------------|
| `commissioning_create` | Commissioning Management Create | Create Pre-Commissioning, Commissioning, Warranty |
| `commissioning_read` | Commissioning Management Read | Read Pre-Commissioning, Commissioning, Warranty |
| `commissioning_update` | Commissioning Management Update | Update Pre-Commissioning, Commissioning, Warranty |
| `commissioning_delete` | Commissioning Management Delete | Delete Pre-Commissioning, Commissioning, Warranty |

---

## 3. Role-Permission Matrix

### 3.1 Summary Matrix

| Permission | Admin | Sales | SupplyChain | Service |
|------------|:-----:|:-----:|:-----------:|:-------:|
| **Admin Menu** | ✅ | ❌ | ❌ | ❌ |
| **users_create** | ✅ | ❌ | ❌ | ❌ |
| **users_read** | ✅ | ❌ | ❌ | ❌ |
| **users_update** | ✅ | ❌ | ❌ | ❌ |
| **users_delete** | ✅ | ❌ | ❌ | ❌ |
| **users_view** | ✅ | ❌ | ❌ | ❌ |
| **product_create** | ✅ | ❌ | ❌ | ❌ |
| **product_read** | ✅ | ❌ | ❌ | ❌ |
| **product_update** | ✅ | ❌ | ❌ | ❌ |
| **product_delete** | ✅ | ❌ | ❌ | ❌ |
| **po_create** | ✅ | ✅ | ❌ | ❌ |
| **po_read** | ✅ | ✅ | ✅ | ✅ |
| **po_update** | ✅ | ✅ | ❌ | ❌ |
| **po_delete** | ✅ | ✅ | ❌ | ❌ |
| **po_pricing_view_own** | ✅ | ✅ | ❌ | ❌ |
| **po_pricing_view_all** | ✅ | ❌ | ❌ | ❌ |
| **dispatch_create** | ✅ | ❌ | ✅ | ❌ |
| **dispatch_read** | ✅ | ✅ | ✅ | ✅ |
| **dispatch_update** | ✅ | ❌ | ✅ | ❌ |
| **dispatch_delete** | ✅ | ❌ | ✅ | ❌ |
| **commissioning_create** | ✅ | ❌ | ❌ | ✅ |
| **commissioning_read** | ✅ | ✅ | ✅ | ✅ |
| **commissioning_update** | ✅ | ❌ | ❌ | ✅ |
| **commissioning_delete** | ✅ | ❌ | ❌ | ✅ |

### 3.2 Detailed Permission Count

| Role | Total Permissions |
|------|:-----------------:|
| Admin | 23 (all permissions) |
| Sales | 8 permissions |
| SupplyChain | 6 permissions |
| Service | 6 permissions |

---

## 4. UI Access Rules

### 4.1 Sidebar Menu

| Menu Item | Required Permission | Roles with Access |
|-----------|---------------------|-------------------|
| Dashboard | None (always visible) | All |
| Summary Dashboard | None (always visible) | All |
| Admin (parent menu) | `users_read` | Admin |
| User Management | `users_read` | Admin |
| Role Management | `users_read` | Admin |
| Permissions | `users_read` | Admin |
| Product Management | `product_read` | Admin |
| Client Management | `product_read` | Admin |
| Profile | None (always visible) | All |
| Logout | None (always visible) | All |

### 4.2 Dashboard (PO List)

| Element | Permission | Behavior if No Permission |
|---------|------------|---------------------------|
| Create PO button | `po_create` | Hidden |
| View PO button | `po_read` | Always visible |
| Pricing columns | `po_pricing_view_own` or `po_pricing_view_all` | Hidden or show "---" |

### 4.3 PO Details Page

| Section | Create Button | Edit Button | Delete Button | View |
|---------|:-------------:|:-----------:|:-------------:|:----:|
| Dispatch Details | `dispatch_create` | `dispatch_update` | `dispatch_delete` | `dispatch_read` |
| Dispatch Documents | `dispatch_create` | `dispatch_update` | `dispatch_delete` | `dispatch_read` |
| Delivery Confirmation | `dispatch_create` | `dispatch_update` | `dispatch_delete` | `dispatch_read` |
| Pre-Commissioning | `commissioning_create` | `commissioning_update` | `commissioning_delete` | `commissioning_read` |
| Commissioning | `commissioning_create` | `commissioning_update` | `commissioning_delete` | `commissioning_read` |
| Warranty Certificate | `commissioning_create` | `commissioning_update` | `commissioning_delete` | `commissioning_read` |

### 4.4 PO Pricing Visibility

| User Type | Pricing Visibility |
|-----------|-------------------|
| Admin (`po_pricing_view_all`) | Can see pricing for ALL POs |
| Sales (`po_pricing_view_own`) | Can see pricing ONLY for POs they created |
| SupplyChain | Cannot see any pricing (columns hidden) |
| Service | Cannot see any pricing (columns hidden) |

### 4.5 Disabled Field Behavior

When a user doesn't have permission to perform an action:

1. **Buttons**: Show disabled with tooltip explaining the restriction
2. **Form Fields**: Show as read-only/disabled with tooltip
3. **Menu Items**: Hidden completely (not shown)
4. **Table Actions**: Show disabled with tooltip or hide completely

**Tooltip Messages:**
- "You don't have permission to create POs"
- "You don't have permission to edit this record"
- "View only - editing not permitted"
- "Contact administrator for access"

---

## 5. SQL Seed Data

### 5.1 Insert Permissions

```sql
-- New Pricing Permissions (add to existing permissions)
INSERT INTO permissions (permission_code, permission_name, description, created_by, updated_by, is_active) VALUES
('po_pricing_view_own', 'PO Pricing View Own', 'View pricing of own created POs only', 'system', 'system', true),
('po_pricing_view_all', 'PO Pricing View All', 'View pricing of all POs (Admin)', 'system', 'system', true);
```

### 5.2 Insert Roles

```sql
-- Insert Roles
INSERT INTO roles (role_name, description, created_by, updated_by, is_active) VALUES
('Admin', 'Full system access. Can manage users, roles, permissions, and all business data.', 'system', 'system', true),
('Sales', 'Sales team member responsible for creating and managing Purchase Orders.', 'system', 'system', true),
('SupplyChain', 'Supply chain team member responsible for dispatch and delivery operations.', 'system', 'system', true),
('Service', 'Service team member responsible for commissioning and warranty operations.', 'system', 'system', true);
```

### 5.3 Insert Role-Permission Mappings

```sql
-- Get role IDs (assuming auto-increment starts at 1)
-- Admin = 1, Sales = 2, SupplyChain = 3, Service = 4

-- Admin Role Permissions (ALL permissions)
INSERT INTO role_permissions (role_id, permission_id, created_by, updated_by, is_active)
SELECT 1, permission_id, 'system', 'system', true FROM permissions WHERE is_active = true;

-- Sales Role Permissions
INSERT INTO role_permissions (role_id, permission_id, created_by, updated_by, is_active)
SELECT 2, permission_id, 'system', 'system', true 
FROM permissions 
WHERE permission_code IN (
  'po_create', 'po_read', 'po_update', 'po_delete', 'po_pricing_view_own',
  'dispatch_read', 'commissioning_read'
);

-- SupplyChain Role Permissions
INSERT INTO role_permissions (role_id, permission_id, created_by, updated_by, is_active)
SELECT 3, permission_id, 'system', 'system', true 
FROM permissions 
WHERE permission_code IN (
  'po_read',
  'dispatch_create', 'dispatch_read', 'dispatch_update', 'dispatch_delete',
  'commissioning_read'
);

-- Service Role Permissions
INSERT INTO role_permissions (role_id, permission_id, created_by, updated_by, is_active)
SELECT 4, permission_id, 'system', 'system', true 
FROM permissions 
WHERE permission_code IN (
  'po_read', 'dispatch_read',
  'commissioning_create', 'commissioning_read', 'commissioning_update', 'commissioning_delete'
);
```

---

## 6. Implementation Guidelines

### 6.1 Frontend Implementation

**Using Permission Hook:**
```tsx
import { usePermission } from '../hooks/usePermission';
import { PERMISSIONS } from '../constants/permissions';

const MyComponent = () => {
  const canCreatePO = usePermission(PERMISSIONS.PO_CREATE);
  const canViewPricing = usePermission(PERMISSIONS.PO_PRICING_VIEW_OWN);
  
  return (
    <div>
      {canCreatePO && <Button>Create PO</Button>}
      {canViewPricing && <span>₹{price}</span>}
    </div>
  );
};
```

**Using Can Component:**
```tsx
import Can from '../Components/Can';
import { PERMISSIONS } from '../constants/permissions';

const MyComponent = () => (
  <div>
    <Can permission={PERMISSIONS.PO_CREATE}>
      <Button>Create PO</Button>
    </Can>
    
    <Can 
      permission={PERMISSIONS.PO_DELETE}
      fallback={<Tooltip title="No delete permission"><Button disabled>Delete</Button></Tooltip>}
    >
      <Button danger>Delete</Button>
    </Can>
  </div>
);
```

### 6.2 Disabled Button with Tooltip Pattern

```tsx
import { Tooltip, Button } from 'antd';
import { usePermission } from '../hooks/usePermission';
import { PERMISSIONS } from '../constants/permissions';

const ActionButton = () => {
  const canCreate = usePermission(PERMISSIONS.DISPATCH_CREATE);
  
  const button = (
    <Button 
      type="primary" 
      disabled={!canCreate}
      onClick={handleCreate}
    >
      Create Dispatch
    </Button>
  );
  
  if (!canCreate) {
    return (
      <Tooltip title="You don't have permission to create dispatches">
        {button}
      </Tooltip>
    );
  }
  
  return button;
};
```

### 6.3 Pricing Column Visibility

```tsx
const getPricingColumns = (canViewPricing: boolean) => {
  if (!canViewPricing) {
    return []; // Hide pricing columns entirely
  }
  
  return [
    { title: 'Price/Unit', dataIndex: 'pricePerUnit' },
    { title: 'Total Price', dataIndex: 'totalPrice' },
    { title: 'GST %', dataIndex: 'gstPercent' },
    { title: 'Final Price', dataIndex: 'finalPrice' },
  ];
};
```

### 6.4 Backend Pricing Filter (for po_pricing_view_own)

```typescript
// In POService.ts
async getPOById(poId: string, userId: string, permissions: string[]) {
  const po = await this.poRepository.findById(poId);
  
  // Check pricing visibility
  const canViewAllPricing = permissions.includes('po_pricing_view_all');
  const canViewOwnPricing = permissions.includes('po_pricing_view_own');
  const isOwner = po.createdBy === userId;
  
  if (!canViewAllPricing && !(canViewOwnPricing && isOwner)) {
    // Strip pricing information
    po.poItems = po.poItems.map(item => ({
      ...item,
      pricePerUnit: null,
      totalPrice: null,
      gstPercent: null,
      finalPrice: null,
    }));
  }
  
  return po;
}
```

---

## Summary

This role-permission matrix ensures:

1. **Separation of Concerns**: Each role has access only to features relevant to their job function
2. **Data Protection**: Pricing information is protected and only visible to authorized users
3. **Audit Trail**: All actions are tracked with user information
4. **Flexibility**: Permissions can be reassigned without code changes

For questions or changes to this matrix, contact the system administrator.

