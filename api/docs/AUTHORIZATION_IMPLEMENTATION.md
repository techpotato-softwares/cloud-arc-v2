# Authorization Implementation Guide

## Role-Based Access Control (RBAC) with Permission-Based UI

> **For:** Junior Developers  
> **Last Updated:** December 2024  
> **Status:** Implementation Guide  
> **Prerequisites:** [SECURITY_IMPLEMENTATION.md](./SECURITY_IMPLEMENTATION.md) (JWT Authentication)

### Related Documentation

| Document | Description |
|----------|-------------|
| [ROLE_PERMISSION_MATRIX.md](./ROLE_PERMISSION_MATRIX.md) | Role definitions, permission mappings, SQL seed data |
| [PERMISSION_LIST.MD](./PERMISSION_LIST.MD) | Complete list of all permission codes |
| [PROJECT_CONTEXT.md](../../PROJECT_CONTEXT.md) | Permission usage patterns and examples |

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Authorization Concepts & Theory](#2-authorization-concepts--theory)
3. [Database Model](#3-database-model)
4. [Architecture Overview](#4-architecture-overview)
5. [Backend Implementation](#5-backend-implementation)
6. [Frontend Implementation](#6-frontend-implementation)
7. [Usage Examples](#7-usage-examples)
8. [Best Practices](#8-best-practices)
9. [Troubleshooting](#9-troubleshooting)
10. [Checklist](#10-checklist)

---

## 1. Introduction

### 1.1 What We're Building

We are implementing a **permission-based UI authorization system** that:

- Receives permissions (as permission codes) directly from the login API response
- Stores permissions in Redux for quick access
- Shows/hides UI components based on user permission codes
- Provides both a wrapper component and hook for flexibility

### 1.2 Authentication vs Authorization

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 AUTHENTICATION vs AUTHORIZATION                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   AUTHENTICATION (Already Implemented)                                       │
│   ════════════════════════════════════                                       │
│   "WHO are you?"                                                             │
│                                                                              │
│   • Verifies user identity (username/password)                               │
│   • Issues JWT tokens                                                        │
│   • Protects endpoints with @Authenticated decorator                         │
│   • Result: User is logged in or not                                         │
│                                                                              │
│   ─────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│   AUTHORIZATION (This Document)                                              │
│   ═════════════════════════════                                              │
│   "WHAT are you allowed to do?"                                              │
│                                                                              │
│   • Checks user's roles and permissions                                      │
│   • Shows/hides UI components                                                │
│   • Controls access to features                                              │
│   • Result: User can or cannot perform action                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Our Approach

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        AUTHORIZATION FLOW                                    │
│                                                                              │
│   1. User logs in successfully                                               │
│          │                                                                   │
│          ▼                                                                   │
│   2. Login API response includes:                                            │
│      • user.roleName (role name)                                             │
│      • user.roleId (role ID)                                                 │
│      • user.permissions (array of permission codes)                          │
│          │                                                                   │
│          ▼                                                                   │
│   3. Permissions (permission codes) stored in Redux                          │
│          │                                                                   │
│          ▼                                                                   │
│   4. UI components use hook/wrapper to check permission codes                │
│          │                                                                   │
│          ▼                                                                   │
│   5. Components show/hide based on permission code check                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Authorization Concepts & Theory

### 2.1 RBAC (Role-Based Access Control)

RBAC is a security model where permissions are assigned to roles, and roles are assigned to users.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              RBAC MODEL                                      │
│                                                                              │
│   ┌──────────┐         ┌──────────┐         ┌──────────────┐                │
│   │   USER   │────────▶│   ROLE   │────────▶│  PERMISSION  │                │
│   └──────────┘   has   └──────────┘   has   └──────────────┘                │
│                                                                              │
│   Examples:                                                                  │
│   ─────────                                                                  │
│                                                                              │
│   User: John                                                                 │
│     └── Role: Admin                                                          │
│           ├── Permission: users_create                                       │
│           ├── Permission: users_delete                                        │
│           ├── Permission: po_read                                            │
│           └── Permission: po_create                                          │
│                                                                              │
│   User: Jane                                                                 │
│     └── Role: Viewer                                                         │
│           ├── Permission: po_read                                            │
│           └── Permission: users_read                                        │
│                                                                              │
│   User: Mike                                                                 │
│     └── Role: Sales                                                          │
│           ├── Permission: po_create                                          │
│           └── Permission: po_read                                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key Benefits of RBAC:**
- **Simplified management**: Assign roles to users, not individual permissions
- **Consistency**: All users with same role have same permissions
- **Scalability**: Easy to add new users or modify role permissions
- **Audit trail**: Clear visibility of who can do what

### 2.2 Permission Code Convention

We use **permission codes** (stored in `permission_code` column) for authorization. Permission codes follow the **Resource:Action** format:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      PERMISSION CODE FORMAT                                  │
│                                                                              │
│   Format:  resource:action                                                   │
│                                                                              │
│   ┌────────────┬─────────────────────────────────────────────────────────┐  │
│   │  Resource  │  The entity or feature being accessed                   │  │
│   ├────────────┼─────────────────────────────────────────────────────────┤  │
│   │  Action    │  The operation being performed                          │  │
│   └────────────┴─────────────────────────────────────────────────────────┘  │
│                                                                              │
│   Common Actions:                                                            │
│   ───────────────                                                            │
│   • view    - Read/list resources                                            │
│   • create  - Create new resources                                           │
│   • update  - Modify existing resources                                      │
│   • delete  - Remove resources                                               │
│   • manage  - Full control (often used for admin)                            │
│   • export  - Download/export data                                           │
│   • approve - Approve workflow items                                         │
│                                                                              │
│   Examples (Permission Codes):                                              │
│   ───────────────────────────────                                            │
│   • users_create     - Can create users                                      │
│   • users_read       - Can view users                                        │
│   • users_update     - Can update users                                      │
│   • users_delete     - Can delete users                                      │
│   • po_create        - Can create purchase orders                            │
│   • po_read          - Can view purchase orders                              │
│   • po_update        - Can update purchase orders                             │
│   • po_delete        - Can delete purchase orders                             │
│   • product_create   - Can create products                                   │
│   • dispatch_create  - Can create dispatches                                 │
│                                                                              │
│   Note: Permission codes are stored in the database and returned in the       │
│   login response as an array of strings.                                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Your Database Model

Based on your Prisma schema, you have a simple and effective permission model:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         YOUR DATABASE MODEL                                  │
│                                                                              │
│   ┌──────────┐      ┌──────────────┐      ┌────────────────────────┐        │
│   │   User   │──────│    Role      │──────│   RolePermission       │        │
│   │          │ n  1 │              │ 1  n │                        │        │
│   │ userId   │      │ roleId       │      │ rolePermissionId       │        │
│   │ username │      │ roleName     │      │ roleId                 │        │
│   │ email    │      │ description  │      │ permissionId           │        │
│   │ roleId   │      │ isActive     │      │ isActive               │        │
│   │ isActive │      └──────────────┘      └───────────┬────────────┘        │
│   └──────────┘                                        │                      │
│                                                       │ n                    │
│                                                       │                      │
│                                           ┌───────────▼────────────┐        │
│                                           │     Permission         │        │
│                                           │                        │        │
│                                           │ permissionId           │        │
│                                           │ permissionCode         │        │
│                                           │ permissionName         │        │
│                                           │ description            │        │
│                                           │ isActive               │        │
│                                           └────────────────────────┘        │
│                                                                              │
│   This model allows:                                                         │
│   • A user has ONE role (1-to-1 relationship via roleId)                     │
│   • A role can have MANY permissions (via RolePermission junction table)     │
│   • Many-to-many between Role and Permission                                 │
│   • Soft delete with isActive flags                                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.4 Permission Resolution

When a user logs in, the backend automatically collects ALL their permissions:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      PERMISSION RESOLUTION                                   │
│                                                                              │
│   User: John (userId: 1)                                                     │
│                                                                              │
│   Step 1: Find user's role (1-to-1 relationship)                              │
│   ─────────────────────────────────────────────────────────────────────────  │
│   SELECT * FROM users                                                         │
│   WHERE user_id = 1 AND is_active = true                                     │
│                                                                              │
│   Result:                                                                    │
│   ┌────────────────────────────────────────────────────────────────────┐    │
│   │ userId: 1  │  username: "john"  │  roleId: 2 (Admin)            │    │
│   └────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│   Step 2: Find all permissions for the user's role                           │
│   ─────────────────────────────────────────────────────────────────────────  │
│   SELECT p.permission_code FROM role_permissions rp                          │
│   JOIN permissions p ON rp.permission_id = p.permission_id                   │
│   WHERE rp.role_id = 2                                                       │
│   AND rp.is_active = true AND p.is_active = true                            │
│                                                                              │
│   Result:                                                                    │
│   ┌────────────────────────────────────────────────────────────────────┐    │
│   │ "users_create", "users_read", "users_update", "users_delete",      │    │
│   │ "po_create", "po_read", "po_update", "po_delete"                   │    │
│   └────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│   Step 3: Return in login response                                            │
│   ─────────────────────────────────────────────────────────────────────────  │
│   Login API Response:                                                         │
│   {                                                                           │
│     "success": true,                                                         │
│     "accessToken": "...",                                                     │
│     "user": {                                                                 │
│       "username": "john",                                                     │
│       "email": "john@example.com",                                            │
│       "roleName": "Admin",                                                    │
│       "roleId": 2,                                                            │
│       "permissions": [                                                        │
│         "users_create", "users_read", "users_update", "users_delete",        │
│         "po_create", "po_read", "po_update", "po_delete"                      │
│       ]                                                                       │
│     }                                                                         │
│   }                                                                           │
│                                                                              │
│   Step 4: Frontend stores permissions in Redux                               │
│   ─────────────────────────────────────────────────────────────────────────  │
│   Permissions array (stored in Redux):                                       │
│   ["users_create", "users_read", "users_update", "users_delete",            │
│    "po_create", "po_read", "po_update", "po_delete"]                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Database Model

### 3.1 Current Schema (Already Exists)

Your Prisma schema has the following models:

```prisma
// User model (1-to-1 with Role)
model User {
  userId      Int      @id @default(autoincrement())
  username    String   @unique
  email       String   @unique
  password    String
  roleId      Int?     // Foreign key to roles table (1-to-1 relationship)
  role        Role?    @relation(fields: [roleId], references: [roleId])
  isActive    Boolean  @default(true)
  // ... other fields
}

// Role model
model Role {
  roleId          Int             @id @default(autoincrement())
  roleName        String
  description     String
  isActive        Boolean         @default(true)
  users           User[]          // Users with this role (1-to-1)
  rolePermissions RolePermission[] // A role can have multiple permissions
  // ... other fields
}

// Role-Permission mapping (junction table for many-to-many)
model RolePermission {
  rolePermissionId Int        @id @default(autoincrement())
  roleId            Int
  permissionId     Int
  role             Role       @relation(fields: [roleId], references: [roleId])
  permission       Permission @relation(fields: [permissionId], references: [permissionId])
  isActive         Boolean    @default(true)
  // ... other fields
}

// Permission model
model Permission {
  permissionId   Int             @id @default(autoincrement())
  permissionCode String          @unique // e.g., "users_create", "po_read"
  permissionName String          // e.g., "Users management Create"
  description    String
  isActive       Boolean         @default(true)
  rolePermissions RolePermission[] // A permission can belong to multiple roles
  // ... other fields
}
```

### 3.2 Example Data

Here's example data to understand the relationships:

```sql
-- Permissions table
INSERT INTO permissions (permission_code, permission_name, description) VALUES
('users_create', 'Users management Create', 'Permission to Create users, roles and permissions'),
('users_read', 'Users management Read', 'Permission to Read users, roles and permissions'),
('users_update', 'Users management Update', 'Permission to Update users, roles and permissions'),
('users_delete', 'Users management Delete', 'Permission to Delete users, roles and permissions'),
('po_create', 'PO management Create', 'Permission to Create POs'),
('po_read', 'PO management Read', 'Permission to Read POs'),
('po_update', 'PO management Update', 'Permission to Update POs'),
('po_delete', 'PO management Delete', 'Permission to Delete POs'),
('product_create', 'Product Management Create', 'Permission to create products, OEM, Category, Client');

-- Roles table
INSERT INTO roles (role_name, description) VALUES
(1, 'Admin', 'Full system access'),
(2, 'Sales', 'Sales team member'),
(3, 'Viewer', 'Read-only access');

-- Users table
INSERT INTO users (username, email, role_id) VALUES
('admin', 'admin@company.com', 1),      -- admin has Admin role (roleId: 1)
('john.sales', 'john@company.com', 2),  -- john has Sales role (roleId: 2)
('jane.viewer', 'jane@company.com', 3); -- jane has Viewer role (roleId: 3)

-- Role-Permission mappings (many-to-many)
-- Admin role (roleId: 1) permissions
INSERT INTO role_permissions (role_id, permission_id) VALUES
(1, 1), (1, 2), (1, 3), (1, 4),  -- users_create, users_read, users_update, users_delete
(1, 5), (1, 6), (1, 7), (1, 8);  -- po_create, po_read, po_update, po_delete

-- Sales role (roleId: 2) permissions
INSERT INTO role_permissions (role_id, permission_id) VALUES
(2, 5), (2, 6);  -- po_create, po_read

-- Viewer role (roleId: 3) permissions
INSERT INTO role_permissions (role_id, permission_id) VALUES
(3, 2), (3, 6);  -- users_read, po_read
```

---

## 4. Architecture Overview

### 4.1 System Components

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      AUTHORIZATION ARCHITECTURE                              │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                           REACT FRONTEND                                │ │
│  │                                                                         │ │
│  │  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────┐ │ │
│  │  │                 │    │                 │    │                     │ │ │
│  │  │   Redux Store   │◀───│   authSlice     │◀───│ POST /api/login     │ │ │
│  │  │                 │    │                 │    │ (includes perms)    │ │ │
│  │  │ auth: {         │    │ - username      │    │                     │ │ │
│  │  │   permissions   │    │ - permissions   │    └─────────────────────┘ │ │
│  │  │ }               │    │ - roleName      │                            │ │
│  │  └────────┬────────┘    │                 │                            │ │
│  │           │             └─────────────────┘                            │ │
│  │           │                                                            │ │
│  │           ▼                                                            │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │ │
│  │  │                     Permission Utilities                         │  │ │
│  │  │                                                                  │  │ │
│  │  │  ┌─────────────────┐         ┌─────────────────────────────┐    │  │ │
│  │  │  │ usePermission() │         │ <Can permission="...">     │    │  │ │
│  │  │  │                 │         │   <ProtectedComponent />   │    │  │ │
│  │  │  │ Hook for logic  │         │ </Can>                     │    │  │ │
│  │  │  │                 │         │                             │    │  │ │
│  │  │  │ Returns boolean │         │ Wrapper for JSX             │    │  │ │
│  │  │  └─────────────────┘         └─────────────────────────────┘    │  │ │
│  │  └─────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                         │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                           BACKEND (Lambda)                              │ │
│  │                                                                         │ │
│  │  POST /api/login (includes permissions in response)                     │ │
│  │        │                                                                │ │
│  │        ▼                                                                │ │
│  │  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────┐ │ │
│  │  │ AuthController  │───▶│  AuthService    │───▶│  AuthRepository     │ │ │
│  │  │ .login()        │    │  .login()       │    │ (includes role &    │ │ │
│  │  └─────────────────┘    └─────────────────┘    │  permissions)       │ │ │
│  │                                                └──────────┬──────────┘ │ │
│  │                                                            │            │ │
│  │                                                            ▼            │ │
│  │                                               ┌─────────────────────┐   │ │
│  │                                               │     Database        │   │ │
│  │                                               │  (Prisma Query)     │   │ │
│  │                                               └─────────────────────┘   │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 File Structure

```
api/
├── src/
│   ├── controllers/
│   │   └── AuthController.ts        # ✅ Already includes login endpoint
│   ├── services/
│   │   └── AuthService.ts           # ✅ Already extracts permissions in login
│   ├── repositories/
│   │   └── AuthRepository.ts        # ✅ Already includes role & permissions in query
│   └── schemas/
│       └── response/
│           └── AuthResponse.ts      # ✅ UserInfo includes permissions

ui/
├── src/
│   ├── store/
│   │   ├── authSlice.ts             # ✅ Already stores permissions from login
│   │   ├── api/
│   │   │   └── authApi.ts           # ✅ Already has login mutation
│   │   └── hooks.ts                 # ✅ Has useAppSelector, useAppDispatch
│   ├── hooks/
│   │   ├── index.ts                 # Export all hooks
│   │   └── usePermission.ts         # NEW: Permission check hooks
│   ├── Components/
│   │   ├── Can.tsx                  # NEW: Permission wrapper component
│   │   └── Cannot.tsx               # NEW: Inverse permission wrapper (optional)
│   ├── constants/
│   │   └── permissions.ts           # NEW: Permission code constants
│   └── types/
│       └── orianaTypes.ts           # ✅ Re-exports types from api schemas
```

### 4.3 Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PERMISSION DATA FLOW                                 │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ 1. USER LOGS IN - PERMISSIONS INCLUDED IN LOGIN RESPONSE                 ││
│  │                                                                          ││
│  │    Login.tsx                                                             ││
│  │        │                                                                 ││
│  │        ├── 1a. Call login mutation: useLoginMutation()                   ││
│  │        │                                                                 ││
│  │        ├── 1b. POST /api/login                                           ││
│  │        │       Response includes: user.permissions = [...]               ││
│  │        │                                                                 ││
│  │        ├── 1c. dispatch(addAuth({ ...user, permissions }))               ││
│  │        │                                                                 ││
│  │        └── 1d. dispatch(setIsLoggedIn(true))                             ││
│  │                                                                          ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                      │                                       │
│                                      ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ 2. PERMISSIONS STORED IN REDUX (authSlice)                               ││
│  │                                                                          ││
│  │    authSlice.ts                                                          ││
│  │        │                                                                 ││
│  │        └── State:                                                        ││
│  │            {                                                             ││
│  │              auth: {                                                     ││
│  │                username: "john",                                         ││
│  │                email: "john@example.com",                                ││
│  │                roleName: "Admin",                                        ││
│  │                roleId: 1,                                                ││
│  │                permissions: ["users_create", "users_read", ...]          ││
│  │              },                                                          ││
│  │              isLoggedIn: true                                            ││
│  │            }                                                             ││
│  │                                                                          ││
│  │    Note: redux-persist keeps this state across page refreshes            ││
│  │                                                                          ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                      │                                       │
│                                      ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ 3. USE IN COMPONENTS                                                     ││
│  │                                                                          ││
│  │    // Using hook                                                         ││
│  │    const canCreate = usePermission('users_create');                      ││
│  │    if (canCreate) { /* show create button */ }                           ││
│  │                                                                          ││
│  │    // Using wrapper                                                      ││
│  │    <Can permission="users_create">                                       ││
│  │      <Button>Create User</Button>                                        ││
│  │    </Can>                                                                ││
│  │                                                                          ││
│  │    // Using constants (recommended)                                      ││
│  │    import { PERMISSIONS } from '../constants/permissions';               ││
│  │    <Can permission={PERMISSIONS.USERS_CREATE}>                           ││
│  │      <Button>Create User</Button>                                        ││
│  │    </Can>                                                                ││
│  │                                                                          ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Backend Implementation

### 5.1 Update AuthRepository to Include Permissions in Login Query

**File:** `api/src/repositories/AuthRepository.ts`

The `findByUsernameOrEmail` method should include role and permissions:

```typescript
import { injectable, inject } from 'inversify';
import { TYPES } from '../types/types';
import { PrismaClient, User } from '@prisma/client';
import bcrypt from 'bcryptjs';

@injectable()
export class AuthRepository implements IAuthRepository {
  constructor(
    @inject(TYPES.PrismaClient)
    private prisma: PrismaClient
  ) {}

  /**
   * Find user by username or email, including role and permissions
   * 
   * This query:
   * 1. Finds the user by username or email
   * 2. Includes the user's role (1-to-1 relationship)
   * 3. Includes all active role permissions
   * 4. Includes permission details (permission codes)
   * 
   * @param usernameOrEmail - Username or email to search for
   * @returns User with role and permissions, or null if not found
   */
  async findByUsernameOrEmail(usernameOrEmail: string): Promise<User | null> {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ username: usernameOrEmail }, { email: usernameOrEmail }],
        isActive: true,
      },
      include: {
        role: {
          include: {
            rolePermissions: {
              where: { isActive: true },
              include: {
                permission: true, // Includes permissionCode
              },
            },
          },
        },
      },
    });

    return user;
  }

  // ... other existing methods ...
}
```

### 5.2 Update AuthService to Extract Permissions in Login

**File:** `api/src/services/AuthService.ts`

The `login` method should extract permission codes from the user's role:

```typescript
import { injectable, inject } from 'inversify';
import { TYPES } from '../types/types';
import { IAuthRepository } from '../repositories/AuthRepository';
import { LoginRequest, LoginResponse } from '../schemas/request/AuthRequest';
import { generateTokens } from '../utils/jwt';

@injectable()
export class AuthService implements IAuthService {
  constructor(
    @inject(TYPES.AuthRepository) private authRepository: IAuthRepository
  ) {}

  /**
   * Login user and return tokens with user info including permissions
   * 
   * @param data - Login credentials
   * @returns LoginResponse with accessToken, refreshToken, and user info
   */
  async login(data: LoginRequest): Promise<LoginResponse> {
    // Find user with role and permissions
    const user = await this.authRepository.findByUsernameOrEmail(
      data.usernameOrEmail
    );

    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Validate password
    const isValid = await this.authRepository.validatePassword(
      user,
      data.password
    );

    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    // Extract permission codes from role
    const permissionCodes: string[] = 
      user.role?.rolePermissions
        ?.filter((rp) => rp.permission?.isActive)
        .map((rp) => rp.permission.permissionCode) || [];

    // Generate JWT tokens
    const tokenPayload: JWTPayload = {
      username: user.username,
      email: user.email,
      roleId: user.role?.roleId,
      roleName: user.role?.roleName,
      permissions: permissionCodes,
    };

    const tokens = await generateTokens(tokenPayload);

    // Return login response with permissions
    return {
      success: true,
      message: 'Login successful',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      refreshExpiresIn: tokens.refreshExpiresIn,
      user: {
        username: user.username,
        email: user.email,
        roleName: user.role?.roleName || null,
        roleId: user.role?.roleId || null,
        permissions: permissionCodes, // Array of permission codes
      },
    };
  }

  // ... other existing methods ...
}
```

### 5.3 Login API Response Format

The login endpoint (`POST /api/login`) returns permissions in the response:

```json
{
  "success": true,
  "message": "Login successful",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 3600,
  "refreshExpiresIn": 86400,
  "user": {
    "username": "john",
    "email": "john@example.com",
    "roleName": "Admin",
    "roleId": 1,
    "permissions": [
      "users_create",
      "users_read",
      "users_update",
      "users_delete",
      "po_create",
      "po_read",
      "po_update",
      "po_delete"
    ]
  }
}
```

**Key Points:**
- `user.permissions` is an array of **permission codes** (strings)
- Permission codes come from the `permission_code` column in the database
- Permissions are automatically included in the login response
- No separate API call needed to fetch permissions

---

## 6. Frontend Implementation

### 6.1 Update AuthSlice to Store Permissions

**File:** `ui/src/store/authSlice.ts`

The `authSlice` should store permissions from the login response:

```typescript
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { RootState } from ".";

export interface Auth {
  username: string;
  email?: string;
  roleName?: string | null;
  roleId?: number | null;
  permissions?: string[]; // Array of permission codes
}

export interface AuthState {
  auth: Auth;
  isLoggedIn: boolean;
}

const initialState: AuthState = {
  auth: {
    username: "",
    email: "",
    roleName: null,
    roleId: null,
    permissions: [],
  },
  isLoggedIn: false,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    /**
     * Set auth data including permissions from login response
     */
    addAuth: (state, action: PayloadAction<Auth>) => {
      state.auth = action.payload;
    },

    /**
     * Clear auth data on logout
     */
    logout: (state) => {
      state.auth = {
        username: "",
        email: "",
        roleName: null,
        roleId: null,
        permissions: [],
      };
      state.isLoggedIn = false;
    },

    setIsLoggedIn: (state, action: PayloadAction<boolean>) => {
      state.isLoggedIn = action.payload;
    },
  },
});

// ============================================================================
// SELECTORS
// ============================================================================

/**
 * Select auth state
 */
export const selectAuth = (state: RootState) => state.auth.auth;

/**
 * Select isLoggedIn state
 */
export const selectIsLoggedIn = (state: RootState) => state.auth.isLoggedIn;

/**
 * Select all permissions (permission codes)
 */
export const selectPermissions = (state: RootState): string[] =>
  state.auth.auth.permissions || [];

/**
 * Check if user has a specific permission code
 * 
 * @example
 * const canCreate = useSelector((state) => selectHasPermission(state, 'users_create'));
 */
export const selectHasPermission = (
  state: RootState,
  permissionCode: string
): boolean => {
  const permissions = state.auth.auth.permissions || [];
  return permissions.includes(permissionCode);
};

/**
 * Check if user has ALL of the specified permission codes
 */
export const selectHasAllPermissions = (
  state: RootState,
  permissionCodes: string[]
): boolean => {
  const permissions = state.auth.auth.permissions || [];
  return permissionCodes.every((code) => permissions.includes(code));
};

/**
 * Check if user has ANY of the specified permission codes
 */
export const selectHasAnyPermission = (
  state: RootState,
  permissionCodes: string[]
): boolean => {
  const permissions = state.auth.auth.permissions || [];
  return permissionCodes.some((code) => permissions.includes(code));
};

// Export actions and reducer
export const { addAuth, logout, setIsLoggedIn } = authSlice.actions;
export default authSlice.reducer;
```

### 6.2 Create usePermission Hook

**File:** `ui/src/hooks/usePermission.ts`

```typescript
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import {
  selectPermissions,
  selectHasPermission,
  selectHasAllPermissions,
  selectHasAnyPermission,
} from '../store/authSlice';

/**
 * Hook to check a single permission code
 * 
 * @param permissionCode - The permission code to check (e.g., 'users_create')
 * @returns boolean - Whether the user has the permission
 * 
 * @example
 * const UserActions = () => {
 *   const canCreate = usePermission('users_create');
 *   const canDelete = usePermission('users_delete');
 * 
 *   return (
 *     <div>
 *       {canCreate && <Button>Create User</Button>}
 *       {canDelete && <Button danger>Delete User</Button>}
 *     </div>
 *   );
 * };
 */
export function usePermission(permissionCode: string): boolean {
  return useSelector((state: RootState) => selectHasPermission(state, permissionCode));
}

/**
 * Hook to check multiple permission codes (ALL required)
 * 
 * @param permissionCodes - Array of permission codes that ALL must be present
 * @returns boolean - Whether the user has ALL permission codes
 * 
 * @example
 * const canFullyManageUsers = usePermissions(['users_create', 'users_update', 'users_delete']);
 */
export function usePermissions(permissionCodes: string[]): boolean {
  return useSelector((state: RootState) => selectHasAllPermissions(state, permissionCodes));
}

/**
 * Hook to check multiple permission codes (ANY required)
 * 
 * @param permissionCodes - Array of permission codes where at least ONE must be present
 * @returns boolean - Whether the user has ANY of the permission codes
 * 
 * @example
 * const canModifyUsers = useAnyPermission(['users_create', 'users_update']);
 */
export function useAnyPermission(permissionCodes: string[]): boolean {
  return useSelector((state: RootState) => selectHasAnyPermission(state, permissionCodes));
}

/**
 * Hook to get all user permission codes
 * 
 * @returns string[] - Array of all permission codes
 * 
 * @example
 * const allPermissions = useAllPermissions();
 * console.log('User has permissions:', allPermissions);
 */
export function useAllPermissions(): string[] {
  return useSelector(selectPermissions);
}

/**
 * Comprehensive permission hook with all utilities
 * 
 * @example
 * const { hasPermission, hasAll, hasAny, permissions } = usePermissionUtils();
 * 
 * if (hasPermission('users_create')) { ... }
 * if (hasAll(['users_create', 'users_delete'])) { ... }
 * if (hasAny(['users_read', 'users_update'])) { ... }
 */
export function usePermissionUtils() {
  const permissions = useSelector(selectPermissions);

  return {
    /** All permission codes the user has */
    permissions,
    
    /** Check if user has a specific permission code */
    hasPermission: (permissionCode: string): boolean =>
      permissions.includes(permissionCode),
    
    /** Check if user has ALL specified permission codes */
    hasAll: (codes: string[]): boolean =>
      codes.every((code) => permissions.includes(code)),
    
    /** Check if user has ANY of the specified permission codes */
    hasAny: (codes: string[]): boolean =>
      codes.some((code) => permissions.includes(code)),
  };
}
```

### 6.3 Create Can Wrapper Component

**File:** `ui/src/components/Can.tsx`

```tsx
import React, { ReactNode } from 'react';
import { usePermission, usePermissions, useAnyPermission } from '../hooks/usePermission';

/**
 * Props for the Can component
 */
interface CanProps {
  /**
   * Single permission to check
   * Use this OR `permissions`, not both
   */
  permission?: string;

  /**
   * Multiple permissions to check
   * Use this OR `permission`, not both
   */
  permissions?: string[];

  /**
   * If true, user must have ALL permissions
   * If false, user must have ANY of the permissions
   * Only applies when using `permissions` prop
   * Default: false (ANY)
   */
  requireAll?: boolean;

  /**
   * Content to render if user has permission
   */
  children: ReactNode;

  /**
   * Content to render if user does NOT have permission
   * If not provided, nothing is rendered
   */
  fallback?: ReactNode;
}

/**
 * Permission-based conditional rendering component
 * 
 * Renders children only if the user has the required permission(s).
 * This is a declarative alternative to using the usePermission hook.
 * 
 * @example
 * // Single permission code
 * <Can permission="users_create">
 *   <Button>Create User</Button>
 * </Can>
 * 
 * @example
 * // Multiple permission codes (ANY)
 * <Can permissions={['users_create', 'users_update']}>
 *   <Button>Modify User</Button>
 * </Can>
 * 
 * @example
 * // Multiple permission codes (ALL required)
 * <Can permissions={['users_create', 'users_delete']} requireAll>
 *   <Button>Full User Management</Button>
 * </Can>
 * 
 * @example
 * // With fallback
 * <Can permission="report_export" fallback={<Text>No export access</Text>}>
 *   <Button>Export Report</Button>
 * </Can>
 */
const Can: React.FC<CanProps> = ({
  permission,
  permissions,
  requireAll = false,
  children,
  fallback = null,
}) => {
  // Determine which check to use
  let hasAccess = false;

  if (permission) {
    // Single permission check
    hasAccess = usePermission(permission);
  } else if (permissions && permissions.length > 0) {
    // Multiple permissions check
    if (requireAll) {
      hasAccess = usePermissions(permissions);
    } else {
      hasAccess = useAnyPermission(permissions);
    }
  } else {
    // No permission specified - deny by default
    console.warn('Can component used without permission or permissions prop');
    hasAccess = false;
  }

  // Render based on access
  if (hasAccess) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
};

export default Can;
```

### 6.4 Create Cannot Component (Inverse of Can)

**File:** `ui/src/components/Cannot.tsx`

```tsx
import React, { ReactNode } from 'react';
import { usePermission, usePermissions, useAnyPermission } from '../hooks/usePermission';

interface CannotProps {
  permission?: string;
  permissions?: string[];
  requireAll?: boolean;
  children: ReactNode;
}

/**
 * Inverse of Can component - renders when user DOES NOT have permission
 * 
 * Useful for showing messages or alternative content for unauthorized users.
 * 
 * @example
 * <Cannot permission="report_export">
 *   <Alert>You don't have permission to export reports. Contact admin.</Alert>
 * </Cannot>
 */
const Cannot: React.FC<CannotProps> = ({
  permission,
  permissions,
  requireAll = false,
  children,
}) => {
  let hasAccess = false;

  if (permission) {
    hasAccess = usePermission(permission);
  } else if (permissions && permissions.length > 0) {
    if (requireAll) {
      hasAccess = usePermissions(permissions);
    } else {
      hasAccess = useAnyPermission(permissions);
    }
  }

  // Render when user does NOT have access
  if (!hasAccess) {
    return <>{children}</>;
  }

  return null;
};

export default Cannot;
```

### 6.5 Update Login to Store Permissions from Response

**File:** `ui/src/pages/Login.tsx`

```tsx
import React from "react";
import { Form, Input, Button } from "antd";
import { useNavigate, useLocation } from "react-router-dom";
import { useLoginMutation } from "../store/api/authApi";
import { addAuth, setIsLoggedIn } from "../store/authSlice";
import { useDispatch } from "react-redux";
import { useToast } from "../hooks/useToast";

interface LoginData {
  username: string;
  password: string;
}

const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const toast = useToast();
  
  const [login, { isLoading: isLoginLoading }] = useLoginMutation();

  const from = (location.state as any)?.from?.pathname || "/dashboard";

  const onFinish = async (values: LoginData) => {
    try {
      // Login - response includes permissions
      const response = await login({
        username: values.username,
        password: values.password,
      }).unwrap();

      // Store the access token in sessionStorage
      if (response.accessToken) {
        sessionStorage.setItem("authToken", response.accessToken);
      }

      // Store user info including permissions in Redux state
      dispatch(
        addAuth({
          username: response.user.username,
          email: response.user.email,
          roleName: response.user.roleName || null,
          roleId: response.user.roleId || null,
          permissions: response.user.permissions || [], // Permission codes from login response
        })
      );
      dispatch(setIsLoggedIn(true));

      toast.success("Login Successful!");
      navigate(from, { replace: true });
      
    } catch (error: any) {
      const errorMessage =
        error?.data?.error?.message ||
        error?.data?.message ||
        error?.message ||
        "Invalid credentials. Please try again.";
      toast.error(errorMessage);
    }
  };

  return (
    <div>
      {/* Login form UI */}
      <Form onFinish={onFinish}>
        {/* Form fields */}
        <Button 
          type="primary" 
          htmlType="submit" 
          loading={isLoginLoading}
        >
          Login
        </Button>
      </Form>
    </div>
  );
};

export default Login;
```

**Key Points:**
- Permissions come directly from `response.user.permissions` in the login response
- No separate API call needed to fetch permissions
- Permissions are stored in `authSlice` along with other user info
- Permission codes are ready to use immediately after login

### 6.6 Clear Permissions on Logout

**File:** Update your logout logic

```tsx
import { useLogoutMutation } from '../store/api/authApi';
import { logout as logoutAction } from '../store/authSlice';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';

const LogoutButton: React.FC = () => {
  const [logout, { isLoading }] = useLogoutMutation();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout().unwrap();
    } catch (error) {
      console.error('Logout API failed:', error);
    }
    
    // Clear Redux state (includes permissions)
    dispatch(logoutAction()); // This clears all auth data including permissions
    
    // Redirect to login
    navigate('/');
  };

  return (
    <Button onClick={handleLogout} loading={isLoading}>
      Logout
    </Button>
  );
};
```

### 6.7 Export All Permission Utilities

**File:** `ui/src/hooks/index.ts`

```typescript
// Permission hooks
export {
  usePermission,
  usePermissions,
  useAnyPermission,
  useAllPermissions,
  usePermissionsLoaded,
  usePermissionUtils,
} from './usePermission';
```

**File:** `ui/src/components/index.ts`

```typescript
// Permission components
export { default as Can } from './Can';
export { default as Cannot } from './Cannot';
```

---

## 7. Usage Examples

### 7.1 Basic Button Visibility

```tsx
import React from 'react';
import { Button, Space } from 'antd';
import { usePermission } from '../hooks/usePermission';
import Can from '../components/Can';

/**
 * Example: User management actions
 */
const UserActions: React.FC = () => {
  // Method 1: Using hook
  const canCreate = usePermission('users_create');
  const canDelete = usePermission('users_delete');

  return (
    <Space>
      {/* Hook approach */}
      {canCreate && (
        <Button type="primary">Create User</Button>
      )}
      
      {canDelete && (
        <Button danger>Delete User</Button>
      )}
      
      {/* Wrapper approach */}
      <Can permission="users_update">
        <Button>Edit User</Button>
      </Can>
    </Space>
  );
};
```

### 7.2 Table Action Column

```tsx
import React from 'react';
import { Table, Button, Space, Popconfirm } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { usePermission } from '../hooks/usePermission';

interface User {
  id: string;
  username: string;
  email: string;
}

const UserTable: React.FC<{ users: User[] }> = ({ users }) => {
  const canView = usePermission('users_read');
  const canEdit = usePermission('users_update');
  const canDelete = usePermission('users_delete');

  const columns = [
    { title: 'Username', dataIndex: 'username' },
    { title: 'Email', dataIndex: 'email' },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: User) => (
        <Space>
          {canView && (
            <Button 
              icon={<EyeOutlined />} 
              onClick={() => viewUser(record.id)}
            />
          )}
          
          {canEdit && (
            <Button 
              icon={<EditOutlined />} 
              onClick={() => editUser(record.id)}
            />
          )}
          
          {canDelete && (
            <Popconfirm
              title="Delete this user?"
              onConfirm={() => deleteUser(record.id)}
            >
              <Button danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return <Table dataSource={users} columns={columns} />;
};
```

### 7.3 Sidebar Menu Filtering

```tsx
import React from 'react';
import { Menu } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  DashboardOutlined,
  UserOutlined,
  ShoppingCartOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { usePermission } from '../hooks/usePermission';

interface MenuItem {
  key: string;
  icon: React.ReactNode;
  label: string;
  path: string;
  permission?: string;  // Optional - if not set, always visible
}

const allMenuItems: MenuItem[] = [
  {
    key: 'dashboard',
    icon: <DashboardOutlined />,
    label: 'Dashboard',
    path: '/dashboard',
    permission: 'dashboard_read',
  },
  {
    key: 'users',
    icon: <UserOutlined />,
    label: 'User Management',
    path: '/user-management',
    permission: 'users_read',
  },
  {
    key: 'orders',
    icon: <ShoppingCartOutlined />,
    label: 'Purchase Orders',
    path: '/create-po',
    permission: 'po_read',
  },
  {
    key: 'settings',
    icon: <SettingOutlined />,
    label: 'Settings',
    path: '/settings',
    permission: 'settings_read',
  },
];

const SidebarMenu: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermission } = usePermissionUtils();

  // Filter menu items based on permissions
  const visibleMenuItems = allMenuItems.filter((item) => {
    // If no permission required, always show
    if (!item.permission) return true;
    
    // Check if user has the required permission
    return hasPermission(item.permission);
  });

  const menuItems = visibleMenuItems.map((item) => ({
    key: item.key,
    icon: item.icon,
    label: item.label,
    onClick: () => navigate(item.path),
  }));

  return (
    <Menu
      mode="inline"
      items={menuItems}
      style={{ height: '100%' }}
    />
  );
};

export default SidebarMenu;
```

### 7.4 Form Field Visibility

```tsx
import React from 'react';
import { Form, Input, Select, Button } from 'antd';
import Can from '../components/Can';
import { usePermission } from '../hooks/usePermission';

const UserForm: React.FC = () => {
  const canAssignRoles = usePermission('role_assign');
  const canSetAdmin = usePermission('user_set_admin');

  return (
    <Form layout="vertical">
      <Form.Item label="Username" name="username" rules={[{ required: true }]}>
        <Input />
      </Form.Item>

      <Form.Item label="Email" name="email" rules={[{ required: true }]}>
        <Input type="email" />
      </Form.Item>

      {/* Only show role selector if user can assign roles */}
      <Can permission="role_assign">
        <Form.Item label="Role" name="roleId">
          <Select placeholder="Select role">
            <Select.Option value="role-1">Admin</Select.Option>
            <Select.Option value="role-2">User</Select.Option>
            <Select.Option value="role-3">Viewer</Select.Option>
          </Select>
        </Form.Item>
      </Can>

      {/* Only show admin checkbox if user has special permission */}
      {canSetAdmin && (
        <Form.Item name="isAdmin" valuePropName="checked">
          <Checkbox>Grant admin privileges</Checkbox>
        </Form.Item>
      )}

      <Button type="primary" htmlType="submit">
        Save User
      </Button>
    </Form>
  );
};
```

### 7.5 Page-Level Access Control

```tsx
import React from 'react';
import { Result, Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import { usePermission, usePermissionsLoaded } from '../hooks/usePermission';
import Can from '../components/Can';

/**
 * Higher-order component for page-level permission check
 */
interface RequirePermissionProps {
  permission: string;
  children: React.ReactNode;
}

const RequirePermission: React.FC<RequirePermissionProps> = ({ 
  permission, 
  children 
}) => {
  const hasPermission = usePermission(permission);
  const isLoggedIn = useSelector(selectIsLoggedIn);
  const navigate = useNavigate();

  // Wait for login to complete
  if (!isLoggedIn) {
    return <div>Loading...</div>;  // Or a spinner
  }

  // If no permission, show access denied
  if (!hasPermission) {
    return (
      <Result
        status="403"
        title="Access Denied"
        subTitle="You don't have permission to access this page."
        extra={
          <Button type="primary" onClick={() => navigate('/dashboard')}>
            Go to Dashboard
          </Button>
        }
      />
    );
  }

  return <>{children}</>;
};

// Usage in a page component
const AdminSettingsPage: React.FC = () => {
  return (
    <RequirePermission permission="settings_admin">
      <div>
        <h1>Admin Settings</h1>
        {/* Admin settings content */}
      </div>
    </RequirePermission>
  );
};
```

### 7.6 Conditional Form Submission

```tsx
import React from 'react';
import { Form, Input, Button, message } from 'antd';
import { usePermission } from '../hooks/usePermission';

const OrderForm: React.FC = () => {
  const canCreate = usePermission('po_create');
  const canApprove = usePermission('po_approve');

  const onFinish = async (values: any) => {
    if (!canCreate) {
      message.error('You do not have permission to create orders');
      return;
    }

    // Create order logic...
  };

  const onApprove = async () => {
    if (!canApprove) {
      message.error('You do not have permission to approve orders');
      return;
    }

    // Approve order logic...
  };

  return (
    <Form onFinish={onFinish}>
      {/* Form fields */}
      
      <div style={{ display: 'flex', gap: 8 }}>
        <Can permission="po_create">
          <Button type="primary" htmlType="submit">
            Create Order
          </Button>
        </Can>
        
        <Can permission="po_approve">
          <Button onClick={onApprove}>
            Create & Approve
          </Button>
        </Can>
      </div>
    </Form>
  );
};
```

### 7.7 Debug Component (Development Only)

```tsx
import React from 'react';
import { Card, Tag, Typography } from 'antd';
import { useAllPermissions, usePermissionUtils } from '../hooks/usePermission';
import { useSelector } from 'react-redux';
import { selectAuth } from '../store/authSlice';

const { Title, Text } = Typography;

/**
 * Debug component to show current user permissions
 * Only use in development!
 */
const PermissionDebugger: React.FC = () => {
  const permissions = useAllPermissions();
  const auth = useSelector(selectAuth);

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <Card 
      title="Permission Debugger" 
      size="small"
      style={{ 
        position: 'fixed', 
        bottom: 16, 
        right: 16, 
        width: 300,
        maxHeight: 400,
        overflow: 'auto',
        zIndex: 9999,
      }}
    >
      <Title level={5}>Roles:</Title>
      <div style={{ marginBottom: 16 }}>
        {roles.map((role) => (
          <Tag color="blue" key={role}>{role}</Tag>
        ))}
      </div>

      <Title level={5}>Permissions ({permissions.length}):</Title>
      <div>
        {permissions.map((perm) => (
          <Tag key={perm} style={{ marginBottom: 4 }}>{perm}</Tag>
        ))}
      </div>
    </Card>
  );
};

export default PermissionDebugger;
```

---

## 8. Best Practices

### 8.1 Permission Naming Conventions

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PERMISSION NAMING BEST PRACTICES                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ✅ DO:                                                                      │
│  ─────                                                                       │
│  • Use lowercase with underscores: users_create, po_read                     │
│  • Be consistent: always resource_action format                              │
│  • Use common actions: read, create, update, delete, manage                  │
│  • Group related permissions: users_*, po_*, report_*                        │
│  • Document each permission's purpose                                        │
│                                                                              │
│  ❌ DON'T:                                                                   │
│  ───────                                                                     │
│  • Mix formats: createUser, USER_CREATE, user.create                         │
│  • Use vague names: access, admin, full                                      │
│  • Create too granular permissions: user:view:name:only                      │
│  • Hardcode permission strings in multiple places                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Create Permission Constants

**File:** `ui/src/constants/permissions.ts`

```typescript
/**
 * Permission constants
 * 
 * Define all permissions here to:
 * 1. Avoid typos in permission strings
 * 2. Get autocomplete in IDE
 * 3. Single source of truth
 * 
 * These match the permission_code values in the database.
 * See: api/docs/PERMISSION_LIST.MD for full descriptions.
 */
export const PERMISSIONS = {
  // ═══════════════════════════════════════════════════════════════════════════
  // PRODUCT MANAGEMENT
  // Covers: Products, OEM, Category, Client
  // ═══════════════════════════════════════════════════════════════════════════
  PRODUCT_CREATE: 'product_create',
  PRODUCT_READ: 'product_read',
  PRODUCT_UPDATE: 'product_update',
  PRODUCT_DELETE: 'product_delete',

  // ═══════════════════════════════════════════════════════════════════════════
  // USER MANAGEMENT
  // Covers: Users, Roles, Permissions
  // ═══════════════════════════════════════════════════════════════════════════
  USERS_CREATE: 'users_create',
  USERS_READ: 'users_read',
  USERS_UPDATE: 'users_update',
  USERS_DELETE: 'users_delete',
  USERS_VIEW: 'users_view',

  // ═══════════════════════════════════════════════════════════════════════════
  // PO (PURCHASE ORDER) MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════
  PO_CREATE: 'po_create',
  PO_READ: 'po_read',
  PO_UPDATE: 'po_update',
  PO_DELETE: 'po_delete',

  // ═══════════════════════════════════════════════════════════════════════════
  // DISPATCH MANAGEMENT
  // Covers: Dispatches, Delivery, Documents
  // ═══════════════════════════════════════════════════════════════════════════
  DISPATCH_CREATE: 'dispatch_create',
  DISPATCH_READ: 'dispatch_read',
  DISPATCH_UPDATE: 'dispatch_update',
  DISPATCH_DELETE: 'dispatch_delete',

  // ═══════════════════════════════════════════════════════════════════════════
  // COMMISSIONING MANAGEMENT
  // Covers: Pre-Commissioning, Commissioning, Warranty
  // ═══════════════════════════════════════════════════════════════════════════
  COMMISSIONING_CREATE: 'commissioning_create',
  COMMISSIONING_READ: 'commissioning_read',
  COMMISSIONING_UPDATE: 'commissioning_update',
  COMMISSIONING_DELETE: 'commissioning_delete',
} as const;

// Type for permission values
export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

// ═══════════════════════════════════════════════════════════════════════════════
// PERMISSION GROUPS (for convenience)
// ═══════════════════════════════════════════════════════════════════════════════

/** All product management permissions */
export const PRODUCT_PERMISSIONS = [
  PERMISSIONS.PRODUCT_CREATE,
  PERMISSIONS.PRODUCT_READ,
  PERMISSIONS.PRODUCT_UPDATE,
  PERMISSIONS.PRODUCT_DELETE,
] as const;

/** All user management permissions */
export const USERS_PERMISSIONS = [
  PERMISSIONS.USERS_CREATE,
  PERMISSIONS.USERS_READ,
  PERMISSIONS.USERS_UPDATE,
  PERMISSIONS.USERS_DELETE,
  PERMISSIONS.USERS_VIEW,
] as const;

/** All PO management permissions */
export const PO_PERMISSIONS = [
  PERMISSIONS.PO_CREATE,
  PERMISSIONS.PO_READ,
  PERMISSIONS.PO_UPDATE,
  PERMISSIONS.PO_DELETE,
] as const;

/** All dispatch management permissions */
export const DISPATCH_PERMISSIONS = [
  PERMISSIONS.DISPATCH_CREATE,
  PERMISSIONS.DISPATCH_READ,
  PERMISSIONS.DISPATCH_UPDATE,
  PERMISSIONS.DISPATCH_DELETE,
] as const;

/** All commissioning management permissions */
export const COMMISSIONING_PERMISSIONS = [
  PERMISSIONS.COMMISSIONING_CREATE,
  PERMISSIONS.COMMISSIONING_READ,
  PERMISSIONS.COMMISSIONING_UPDATE,
  PERMISSIONS.COMMISSIONING_DELETE,
] as const;
```

**Usage:**

```tsx
import { PERMISSIONS } from '../constants/permissions';
import { usePermission } from '../hooks/usePermission';
import Can from '../components/Can';

// With hook
const canCreate = usePermission(PERMISSIONS.USER_CREATE);

// With component
<Can permission={PERMISSIONS.USER_DELETE}>
  <Button danger>Delete</Button>
</Can>
```

### 8.3 Performance Considerations

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       PERFORMANCE BEST PRACTICES                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. PERMISSION LOOKUP IS O(n)                                                │
│     • permissions.includes(permissionCode) scans the array                    │
│     • For 10-50 permissions, this is negligible                              │
│     • If you have 100+ permissions, consider using a Set                     │
│                                                                              │
│  2. PERMISSIONS COME FROM LOGIN RESPONSE                                    │
│     • Permissions are included in login API response                         │
│     • No separate API call needed                                            │
│     • Store in Redux (authSlice), check from Redux                           │
│     • Permissions are available immediately after login                       │
│                                                                              │
│  3. MEMOIZE COMPLEX PERMISSION LOGIC                                         │
│     ```tsx                                                                   │
│     const canManageUsers = useMemo(                                          │
│       () => hasAll(['users_create', 'users_update', 'users_delete']),        │
│       [permissions]                                                          │
│     );                                                                       │
│     ```                                                                      │
│                                                                              │
│  4. AVOID PERMISSION CHECKS IN LOOPS                                         │
│     ```tsx                                                                   │
│     // ❌ Bad - checks permission on every render of every row               │
│     {items.map(item => (                                                     │
│       <Can permission="item_delete"><DeleteBtn /></Can>                      │
│     ))}                                                                      │
│                                                                              │
│     // ✅ Good - check once, use the result                                  │
│     const canDelete = usePermission('item_delete');                          │
│     {items.map(item => (                                                     │
│       canDelete && <DeleteBtn />                                             │
│     ))}                                                                      │
│     ```                                                                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.4 Security Reminders

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SECURITY REMINDERS                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ⚠️ IMPORTANT: UI PERMISSION CHECKS ARE NOT SECURITY                         │
│                                                                              │
│  Frontend permission checks only improve USER EXPERIENCE by:                 │
│  • Hiding buttons users can't use                                            │
│  • Reducing confusion                                                        │
│  • Preventing unnecessary API calls                                          │
│                                                                              │
│  A malicious user CAN:                                                       │
│  • Inspect the DOM and find hidden elements                                  │
│  • Modify Redux state to add permissions                                     │
│  • Call API endpoints directly                                               │
│                                                                              │
│  REAL SECURITY must be enforced on the BACKEND:                              │
│  • @Authenticated decorator ensures user is logged in                        │
│  • For sensitive operations, consider adding @RequirePermission              │
│    decorator in the future                                                   │
│  • Always validate permissions server-side for critical actions              │
│                                                                              │
│  Current approach (UI-only) is suitable for:                                 │
│  • Internal business applications                                            │
│  • Trusted user environments                                                 │
│  • When combined with @Authenticated backend checks                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Troubleshooting

### 9.1 Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Permissions not loading | API call fails | Check network tab, verify endpoint exists |
| User sees everything | Permissions array empty | Check if permissions were fetched after login |
| Can component always hidden | Wrong permission string | Check for typos, use constants |
| Permissions reset on refresh | Not persisted | Consider localStorage or re-fetch on mount |
| Hook returns false always | Permissions not in Redux | Verify login flow sets permissions |

### 9.2 Debugging Steps

**Step 1: Check if permissions are in Redux**

```tsx
// Add this to any component temporarily
import { useSelector } from 'react-redux';
import { selectPermissions } from '../store/authSlice';

const Component = () => {
  const permissions = useSelector(selectPermissions);
  console.log('Current permissions:', permissions);
  // ...
};
```

**Step 2: Check Login API response**

1. Open DevTools → Network tab
2. Look for `POST /api/login` request
3. Check response body has `user.permissions` array

**Step 3: Verify permission string matches**

```tsx
// If this returns false unexpectedly:
const canCreate = usePermission('users_create');

// Check what permissions are actually stored:
const allPermissions = useAllPermissions();
console.log('All permissions:', allPermissions);
console.log('Looking for: users_create');
console.log('Includes?:', allPermissions.includes('users_create'));
```

### 9.3 Handling Permission Loading State

```tsx
import React from 'react';
import { Spin } from 'antd';
import { usePermissionsLoaded } from '../hooks/usePermission';
import Can from '../components/Can';

const ProtectedContent: React.FC = () => {
  const isLoaded = usePermissionsLoaded();

  // Show loading while permissions are being fetched
  if (!isLoaded) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" />
        <p>Loading permissions...</p>
      </div>
    );
  }

  // Once loaded, show permission-based content
  return (
    <div>
      <Can permission="dashboard_read">
        <Dashboard />
      </Can>
    </div>
  );
};
```

---

## 10. Checklist

### 10.1 Implementation Checklist

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       IMPLEMENTATION CHECKLIST                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Backend (Already Implemented ✅)                                            │
│  ────────────────────────────────                                            │
│  ✅ AuthRepository includes role & permissions in findByUsernameOrEmail     │
│  ✅ AuthService extracts permission codes in login method                    │
│  ✅ AuthResponse.ts includes permissions in UserInfo interface              │
│  ✅ Login endpoint returns permissions array in response                     │
│                                                                              │
│  Frontend - Store (Already Implemented ✅)                                   │
│  ──────────────────────────────────────────                                  │
│  ✅ authSlice.ts has permissions field in Auth interface                    │
│  ✅ Login.tsx stores permissions from login response                         │
│  ✅ logout action clears permissions                                         │
│  ✅ redux-persist keeps auth state across refreshes                          │
│                                                                              │
│  Frontend - Selectors (To Add)                                               │
│  ─────────────────────────────                                               │
│  □ Add selectPermissions selector to authSlice.ts                            │
│  □ Add selectHasPermission selector to authSlice.ts                          │
│  □ Add selectHasAllPermissions selector to authSlice.ts                      │
│  □ Add selectHasAnyPermission selector to authSlice.ts                       │
│                                                                              │
│  Frontend - Hooks & Components (To Create)                                   │
│  ─────────────────────────────────────────                                   │
│  □ Create hooks/usePermission.ts                                             │
│  □ Create Components/Can.tsx                                                 │
│  □ Create Components/Cannot.tsx (optional)                                   │
│  □ Create constants/permissions.ts                                           │
│  □ Update hooks/index.ts to export permission hooks                          │
│                                                                              │
│  Testing                                                                     │
│  ───────                                                                     │
│  □ Test login response includes permissions                                  │
│  □ Test permissions are stored in Redux after login                          │
│  □ Test Can component hides/shows correctly                                  │
│  □ Test usePermission hook returns correct values                            │
│  □ Test logout clears permissions                                            │
│  □ Test with different user roles                                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 10.2 Files to Create/Modify Summary

| File | Action | Purpose |
|------|--------|---------|
| `api/src/repositories/AuthRepository.ts` | ✅ Done | Include role & permissions in `findByUsernameOrEmail` |
| `api/src/services/AuthService.ts` | ✅ Done | Extract permission codes in `login` method |
| `api/src/schemas/response/AuthResponse.ts` | ✅ Done | Add `permissions` to `UserInfo` interface |
| `ui/src/store/authSlice.ts` | Modify | Add permission selectors |
| `ui/src/hooks/usePermission.ts` | Create | Permission check hooks |
| `ui/src/Components/Can.tsx` | Create | Permission wrapper component |
| `ui/src/Components/Cannot.tsx` | Create | Inverse permission wrapper |
| `ui/src/constants/permissions.ts` | Create | Permission constants (all 21 permissions) |
| `ui/src/hooks/index.ts` | Modify | Export permission hooks |
| `ui/src/pages/Login.tsx` | ✅ Done | Already stores permissions from login response |

---

## 11. Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     AUTHORIZATION SYSTEM SUMMARY                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  What We Built                                                               │
│  ═════════════                                                               │
│  • Backend login endpoint includes permissions in response                   │
│  • Redux authSlice stores permissions from login                              │
│  • Hooks for permission checks in logic                                      │
│  • Wrapper components for declarative permission checks                      │
│                                                                              │
│  How It Works                                                                │
│  ════════════                                                                │
│  1. User logs in successfully                                                │
│  2. Login API response includes permissions (permission codes)               │
│  3. Permissions stored in Redux (authSlice) as string array                  │
│  4. Components use usePermission() or <Can> to check                        │
│  5. UI shows/hides based on permission codes                                  │
│                                                                              │
│  Key Components                                                              │
│  ══════════════                                                              │
│  • usePermission('users_create')     → returns boolean                      │
│  • usePermissions(['a', 'b'])       → all required                           │
│  • useAnyPermission(['a', 'b'])     → any required                           │
│  • <Can permission="...">           → wrapper component                      │
│  • PERMISSIONS.USER_CREATE          → type-safe constant                     │
│                                                                              │
│  Remember                                                                    │
│  ════════                                                                    │
│  • Permissions come from login response (no separate API call)               │
│  • Permission codes are stored in database (permission_code column)          │
│  • UI checks are for UX, not security                                        │
│  • Backend @Authenticated is the real protection                             │
│  • Use permission constants to avoid typos                                   │
│  • Clear permissions on logout                                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

**Questions?** Refer to:
- [SECURITY_IMPLEMENTATION.md](./SECURITY_IMPLEMENTATION.md) - JWT Authentication (prerequisite)
- [OWASP Authorization Cheatsheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- [React Redux Documentation](https://react-redux.js.org/)

