# Redux Toolkit - Comprehensive Guide for Beginners

This guide is designed for developers who are new to Redux and Redux Toolkit. It covers the fundamental concepts, terminology, and patterns you need to understand for managing state in the ArcForge CloudArc application.

---

## Table of Contents

1. [What is Redux?](#what-is-redux)
2. [Why Use Redux Toolkit?](#why-use-redux-toolkit)
3. [Core Concepts](#core-concepts)
4. [Creating Slices](#creating-slices)
5. [Store Configuration](#store-configuration)
6. [Typed Hooks](#typed-hooks)
7. [Using Redux in Components](#using-redux-in-components)
8. [Redux Persist Integration](#redux-persist-integration)
9. [Redux Slices vs RTK Query](#redux-slices-vs-rtk-query)
10. [Project Examples](#project-examples)
11. [Best Practices](#best-practices)
12. [Common Pitfalls](#common-pitfalls)
13. [Glossary](#glossary)

---

## What is Redux?

**Redux** is a predictable state management library for JavaScript applications. Think of it as a centralized "database" for your frontend application where all your app's data lives in one place.

### The Problem Redux Solves

Without Redux, passing data between components becomes messy:

```
┌─────────────────────────────────────────────────────────────┐
│              WITHOUT CENTRALIZED STATE                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│                      ┌─────────┐                             │
│                      │   App   │                             │
│                      └────┬────┘                             │
│               ┌───────────┼───────────┐                      │
│               ▼           ▼           ▼                      │
│         ┌─────────┐ ┌─────────┐ ┌─────────┐                  │
│         │ Header  │ │ Sidebar │ │ Content │                  │
│         │(needs   │ │(needs   │ │(needs   │                  │
│         │ user)   │ │ user)   │ │ user)   │                  │
│         └─────────┘ └────┬────┘ └────┬────┘                  │
│                          ▼           ▼                       │
│                    ┌─────────┐ ┌─────────┐                   │
│                    │ NavItem │ │ POList  │                   │
│                    │(needs   │ │(needs   │                   │
│                    │ user)   │ │ user)   │                   │
│                    └─────────┘ └─────────┘                   │
│                                                              │
│   Problem: User data must be passed through every level!     │
│   This is called "prop drilling" - it's tedious and error-   │
│   prone.                                                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

With Redux:

```
┌─────────────────────────────────────────────────────────────┐
│                 WITH REDUX STORE                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│         ┌───────────────────────────────────────┐            │
│         │            REDUX STORE                │            │
│         │  ┌─────────────────────────────────┐  │            │
│         │  │ auth: { currentUser, roles }    │  │            │
│         │  │ po: { poList, dispatchDetails } │  │            │
│         │  └─────────────────────────────────┘  │            │
│         └───────────────────┬───────────────────┘            │
│                             │                                │
│     ┌───────────┬───────────┼───────────┬───────────┐        │
│     ▼           ▼           ▼           ▼           ▼        │
│ ┌───────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌───────┐     │
│ │Header │ │ Sidebar │ │ NavItem │ │ Content │ │POList │     │
│ └───────┘ └─────────┘ └─────────┘ └─────────┘ └───────┘     │
│                                                              │
│   Solution: Any component can directly access the store!     │
│   No more prop drilling.                                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Three Principles of Redux

1. **Single Source of Truth**: The entire application state is stored in one object (the store)
2. **State is Read-Only**: You can't modify state directly; you must dispatch actions
3. **Changes via Pure Functions**: Reducers are pure functions that take state + action and return new state

---

## Why Use Redux Toolkit?

**Redux Toolkit (RTK)** is the official, recommended way to write Redux logic. It simplifies Redux development significantly.

### Before Redux Toolkit (Painful!)

```typescript
// 1. Define action types (lots of string constants)
const ADD_USER = 'users/ADD_USER';
const UPDATE_USER = 'users/UPDATE_USER';
const DELETE_USER = 'users/DELETE_USER';

// 2. Define action creators (boilerplate functions)
const addUser = (user) => ({ type: ADD_USER, payload: user });
const updateUser = (user) => ({ type: UPDATE_USER, payload: user });
const deleteUser = (id) => ({ type: DELETE_USER, payload: id });

// 3. Write reducer with switch statement
const usersReducer = (state = { users: [] }, action) => {
  switch (action.type) {
    case ADD_USER:
      return {
        ...state,
        users: [...state.users, action.payload],
      };
    case UPDATE_USER:
      return {
        ...state,
        users: state.users.map((user) =>
          user.id === action.payload.id ? action.payload : user
        ),
      };
    case DELETE_USER:
      return {
        ...state,
        users: state.users.filter((user) => user.id !== action.payload),
      };
    default:
      return state;
  }
};

// 4. Set up store manually
import { createStore, combineReducers, applyMiddleware } from 'redux';
import thunk from 'redux-thunk';

const store = createStore(
  combineReducers({ users: usersReducer }),
  applyMiddleware(thunk)
);
```

### With Redux Toolkit (Clean!)

```typescript
import { createSlice, configureStore } from '@reduxjs/toolkit';

// Everything in ONE place!
const usersSlice = createSlice({
  name: 'users',
  initialState: { users: [] },
  reducers: {
    addUser: (state, action) => {
      state.users.push(action.payload); // Direct mutation is OK!
    },
    updateUser: (state, action) => {
      const index = state.users.findIndex((u) => u.id === action.payload.id);
      if (index !== -1) state.users[index] = action.payload;
    },
    deleteUser: (state, action) => {
      state.users = state.users.filter((u) => u.id !== action.payload);
    },
  },
});

// Actions are auto-generated!
export const { addUser, updateUser, deleteUser } = usersSlice.actions;

// Store setup is simple
const store = configureStore({
  reducer: { users: usersSlice.reducer },
});
```

**Result:** 70% less code, same functionality!

### Key Benefits of Redux Toolkit

| Feature | Plain Redux | Redux Toolkit |
|---------|-------------|---------------|
| Action Types | Define manually | Auto-generated |
| Action Creators | Write manually | Auto-generated |
| Immutable Updates | Spread operator required | Direct mutation (Immer) |
| Store Setup | Manual configuration | `configureStore()` |
| DevTools | Manual setup | Automatic |
| TypeScript | Complex types needed | Great inference |
| Middleware | Manual setup | Pre-configured |

---

## Core Concepts

### 1. Store

The **Store** is a JavaScript object that holds your entire application state. There is only ONE store in a Redux application.

```typescript
// Our store contains:
{
  auth: {
    currentUser: { id: 'user-1', username: 'admin', ... },
    isAuthenticated: true,
    users: [...],
    roles: [...],
    permissions: [...]
  },
  po: {
    poList: [...],
    dispatchDetails: [...]
  },
  api: { ... } // RTK Query cache (separate from slices)
}
```

### 2. Actions

**Actions** are plain JavaScript objects that describe "what happened." They must have a `type` property.

```typescript
// Action structure
{
  type: 'auth/login',           // What happened
  payload: { id: 'user-1', ... } // Data associated with the action
}

// Redux Toolkit generates these automatically when you call action creators
dispatch(login(userData));
// This creates: { type: 'auth/login', payload: userData }
```

### 3. Reducers

**Reducers** are pure functions that specify how state changes in response to actions.

```
┌─────────────────────────────────────────────────────────────┐
│                    REDUCER FLOW                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   Current State          Action              New State       │
│   ┌──────────┐       ┌──────────┐        ┌──────────┐       │
│   │ users:   │       │ type:    │        │ users:   │       │
│   │  [A, B]  │  +    │ 'addUser'│   =    │ [A, B, C]│       │
│   └──────────┘       │ payload: │        └──────────┘       │
│                      │  C       │                            │
│                      └──────────┘                            │
│                                                              │
│   Reducer: (state, action) => newState                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 4. Slices

A **Slice** is a collection of Redux reducer logic and actions for a single feature. It's the Redux Toolkit way of organizing your code.

```typescript
// A slice contains:
// - name: unique identifier
// - initialState: starting state
// - reducers: functions that modify state
const authSlice = createSlice({
  name: 'auth',        // Slice name
  initialState: {...}, // Initial state
  reducers: {          // All reducers for this feature
    login: (state, action) => {...},
    logout: (state) => {...},
    addUser: (state, action) => {...},
  },
});
```

### 5. Dispatch

**Dispatch** is a function that sends actions to the store. It's the ONLY way to update state.

```typescript
// In a component:
const dispatch = useAppDispatch();

// Dispatching an action
dispatch(login(userData));      // Updates auth state
dispatch(addPO(newPOData));     // Updates po state
```

### 6. Selectors

**Selectors** are functions that extract specific pieces of state. They help components get exactly what they need.

```typescript
// Using selector with useAppSelector
const currentUser = useAppSelector((state) => state.auth.currentUser);
const poList = useAppSelector((state) => state.po.poList);
const roles = useAppSelector((state) => state.auth.roles);
```

---

## Creating Slices

Slices are created using `createSlice()` from Redux Toolkit. Here's the anatomy of a slice:

### Basic Slice Structure

```typescript
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// 1. Define types for your state
interface MyState {
  items: Item[];
  selectedItem: Item | null;
}

// 2. Define initial state
const initialState: MyState = {
  items: [],
  selectedItem: null,
};

// 3. Create the slice
const mySlice = createSlice({
  name: 'myFeature',      // Unique name - used in action types
  initialState,           // Starting state
  reducers: {
    // Each function here becomes an action creator
    
    // Simple action (no payload)
    clearSelection: (state) => {
      state.selectedItem = null;
    },
    
    // Action with payload (use PayloadAction<Type> for TypeScript)
    addItem: (state, action: PayloadAction<Item>) => {
      state.items.push(action.payload);
    },
    
    // Action with complex logic
    updateItem: (state, action: PayloadAction<Item>) => {
      const index = state.items.findIndex(i => i.id === action.payload.id);
      if (index !== -1) {
        state.items[index] = action.payload;
      }
    },
  },
});

// 4. Export actions (auto-generated)
export const { clearSelection, addItem, updateItem } = mySlice.actions;

// 5. Export reducer (used in store)
export default mySlice.reducer;
```

### Immer and "Mutating" State

Redux Toolkit uses **Immer** under the hood, which lets you write code that looks like it's mutating state, but actually produces immutable updates.

```typescript
// This looks like mutation, but Immer handles it safely
addUser: (state, action: PayloadAction<User>) => {
  state.users.push(action.payload); // Looks like mutation!
},

// Behind the scenes, Immer converts this to:
addUser: (state, action) => {
  return {
    ...state,
    users: [...state.users, action.payload],
  };
},
```

**Important Rules:**
- You can either mutate `state` directly OR return a new state object, but NOT both
- Always mutate `state` for objects/arrays, don't return new ones unless replacing entirely

```typescript
// ✅ CORRECT - Mutating state
addItem: (state, action) => {
  state.items.push(action.payload);
},

// ✅ CORRECT - Returning new state (for complete replacement)
resetItems: (state) => {
  state.items = []; // Assigning a new array is fine
},

// ❌ WRONG - Mixing mutation and return
addItem: (state, action) => {
  state.items.push(action.payload);
  return state; // Don't do this!
},
```

---

## Store Configuration

The store is configured in `ui/src/store/index.ts`. Let's understand each part:

### Store Setup Explained

```typescript
import { configureStore, combineReducers } from "@reduxjs/toolkit";
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from "redux-persist";
import storage from "redux-persist/lib/storage";
import poReducer from "./poSlice";
import authReducer from "./authSlice";
import { baseApi } from "./api";

// Redux Persist configuration
const persistConfig = {
  key: "root",
  version: 1,
  storage,                              // Use localStorage
  whitelist: ["po", "auth"],            // Only persist these slices
  blacklist: [baseApi.reducerPath],     // Don't persist API cache
};

// Combine all reducers into one root reducer
const rootReducer = combineReducers({
  po: poReducer,                        // Purchase order slice
  auth: authReducer,                    // Authentication slice
  [baseApi.reducerPath]: baseApi.reducer, // RTK Query API
});

// Wrap with persist reducer
const persistedReducer = persistReducer(persistConfig, rootReducer);

// Create the store
export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      // Ignore redux-persist actions in serializable check
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(baseApi.middleware), // Add RTK Query middleware
});

// Create persistor for redux-persist
export const persistor = persistStore(store);

// TypeScript types for use throughout the app
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

### Store Structure Visualization

```
┌─────────────────────────────────────────────────────────────┐
│                      REDUX STORE                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  auth (from authSlice)                              │    │
│  │  ├── currentUser: User | null                       │    │
│  │  ├── isAuthenticated: boolean                       │    │
│  │  ├── loginTimestamp: string | null                  │    │
│  │  ├── users: User[]                                  │    │
│  │  ├── roles: Role[]                                  │    │
│  │  └── permissions: Permission[]                      │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  po (from poSlice)                                  │    │
│  │  ├── poList: POData[]                               │    │
│  │  └── dispatchDetails: DispatchDetail[]              │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  api (from RTK Query - for server data)             │    │
│  │  ├── queries: { ... cached query results }          │    │
│  │  └── mutations: { ... mutation states }             │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Typed Hooks

TypeScript requires special typed hooks for proper type inference. These are defined in `ui/src/store/hook.ts`:

```typescript
import { TypedUseSelectorHook, useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "./index";

// Typed dispatch hook - knows all possible actions
export const useAppDispatch = () => useDispatch<AppDispatch>();

// Typed selector hook - knows the shape of the entire state
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
```

### Why Use Typed Hooks?

```typescript
// ❌ Without typed hooks - no autocomplete, no type safety
import { useSelector, useDispatch } from 'react-redux';

const Component = () => {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.currentUser); // 'state' is 'unknown'
  // No autocomplete for state.auth.currentUser
  // No error if you typo state.auth.curentUser
};

// ✅ With typed hooks - full type safety
import { useAppSelector, useAppDispatch } from '../store/hook';

const Component = () => {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.currentUser);
  // ✓ Autocomplete works
  // ✓ TypeScript catches typos
  // ✓ 'user' is correctly typed as User | null
};
```

---

## Using Redux in Components

### Reading State (useAppSelector)

```typescript
import { useAppSelector } from '../../store/hook';

const MyComponent = () => {
  // Select specific pieces of state
  const currentUser = useAppSelector((state) => state.auth.currentUser);
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const poList = useAppSelector((state) => state.po.poList);
  const roles = useAppSelector((state) => state.auth.roles);
  
  // You can also compute derived data
  const activeUsers = useAppSelector((state) => 
    state.auth.users.filter(user => user.isActive)
  );
  
  // Find specific items
  const adminRole = useAppSelector((state) => 
    state.auth.roles.find(role => role.name === 'Super Admin')
  );
  
  return (
    <div>
      {isAuthenticated ? (
        <p>Welcome, {currentUser?.username}!</p>
      ) : (
        <p>Please log in</p>
      )}
      <p>Total POs: {poList.length}</p>
    </div>
  );
};
```

### Updating State (useAppDispatch)

```typescript
import { useAppDispatch, useAppSelector } from '../../store/hook';
import { login, logout, addUser, updateUser, deleteUser } from '../../store/authSlice';
import { addPO, updatePO, deletePO } from '../../store/poSlice';

const MyComponent = () => {
  const dispatch = useAppDispatch();
  
  // Login a user
  const handleLogin = (userData: User) => {
    dispatch(login(userData));
  };
  
  // Logout
  const handleLogout = () => {
    dispatch(logout());
  };
  
  // Add a new PO
  const handleCreatePO = (poData: POData) => {
    dispatch(addPO(poData));
  };
  
  // Update a PO
  const handleUpdatePO = (updatedPO: POData) => {
    dispatch(updatePO(updatedPO));
  };
  
  // Delete a PO
  const handleDeletePO = (poId: string) => {
    dispatch(deletePO(poId));
  };
  
  return (
    <button onClick={handleLogout}>Logout</button>
  );
};
```

### Complete Example (from DispatchDetails.tsx)

```typescript
import React, { useState } from "react";
import { Table, Button, Popconfirm } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { deleteDispatchDetail } from "../../store/poSlice";
import type { DispatchDetail, POData } from "../../store/poSlice";
import { useAppDispatch, useAppSelector } from "../../store/hook";
import { useParams } from "react-router-dom";

const DispatchDetails: React.FC = () => {
  // Get dispatch function
  const dispatch = useAppDispatch();
  
  // Get data from Redux store
  const dispatchDetails = useAppSelector((state) => state.po.dispatchDetails);
  const poList = useAppSelector((state) => state.po.poList);
  
  // Get PO ID from URL
  const { poId } = useParams<{ poId: string }>();
  
  // Find the specific PO
  const selectedPO = poList.find((po: POData) => po.id === poId);
  
  // Filter dispatch details for current PO
  const currentPODispatches = dispatchDetails.filter(
    (dispatchItem) => dispatchItem.poId === poId
  );
  
  // Handle delete action
  const handleDeleteDispatch = (dispatchId: string) => {
    dispatch(deleteDispatchDetail(dispatchId));
  };
  
  return (
    <Table 
      dataSource={currentPODispatches}
      columns={[
        // ... column definitions
        {
          title: 'Actions',
          render: (_, record) => (
            <Popconfirm
              title="Are you sure?"
              onConfirm={() => handleDeleteDispatch(record.id)}
            >
              <Button icon={<DeleteOutlined />} danger />
            </Popconfirm>
          ),
        },
      ]}
    />
  );
};
```

---

## Redux Persist Integration

Redux Persist allows your Redux state to survive page refreshes by saving it to localStorage.

### How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                  REDUX PERSIST FLOW                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  On App Start (REHYDRATE):                                   │
│  ┌──────────────┐        ┌──────────────┐                   │
│  │ localStorage │  --->  │ Redux Store  │                   │
│  │  (saved)     │        │  (restored)  │                   │
│  └──────────────┘        └──────────────┘                   │
│                                                              │
│  On State Change (PERSIST):                                  │
│  ┌──────────────┐        ┌──────────────┐                   │
│  │ Redux Store  │  --->  │ localStorage │                   │
│  │  (updated)   │        │   (saved)    │                   │
│  └──────────────┘        └──────────────┘                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Configuration in This Project

```typescript
const persistConfig = {
  key: "root",              // Key in localStorage
  version: 1,               // Schema version (for migrations)
  storage,                  // Storage engine (localStorage)
  whitelist: ["po", "auth"], // ONLY persist these slices
  blacklist: [baseApi.reducerPath], // DON'T persist API cache
};
```

### Why Whitelist/Blacklist?

| Slice | Should Persist? | Reason |
|-------|-----------------|--------|
| `auth` | Yes | Keep user logged in after refresh |
| `po` | Yes | Don't lose PO data being edited |
| `api` | No | Server data should be fetched fresh |

### Using PersistGate

In your app's entry point (`App.tsx` or `index.tsx`):

```typescript
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from './store';

const App = () => (
  <Provider store={store}>
    <PersistGate loading={<LoadingSpinner />} persistor={persistor}>
      <YourApp />
    </PersistGate>
  </Provider>
);
```

---

## Redux Slices vs RTK Query

Understanding when to use each approach is crucial.

### Use Redux Slices For:

| Use Case | Example |
|----------|---------|
| Local-only UI state | Modal open/close, tab selection |
| Client-side data | Form data before submission |
| Session state | Current user, authentication |
| Data computed on client | Filtered/sorted lists |
| Offline-first data | Data that must persist without server |

### Use RTK Query For:

| Use Case | Example |
|----------|---------|
| Server data fetching | GET /api/pos |
| Creating server records | POST /api/pos |
| Updating server records | PUT /api/pos/:id |
| Deleting server records | DELETE /api/pos/:id |
| Data that needs caching | User list from server |
| Loading/error states | Request status tracking |

### Comparison Table

| Feature | Redux Slices | RTK Query |
|---------|-------------|-----------|
| Data source | Client-side | Server API |
| Persistence | Optional (redux-persist) | Cache (automatic) |
| Loading states | Manual | Automatic |
| Error handling | Manual | Automatic |
| Caching | Manual | Automatic |
| Refetching | Manual | Automatic |
| TypeScript | Good | Excellent |

### Hybrid Approach (Recommended)

```
┌─────────────────────────────────────────────────────────────┐
│                 RECOMMENDED ARCHITECTURE                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Redux Slices (Local State):                                 │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  authSlice                                          │    │
│  │  • currentUser (session)                            │    │
│  │  • isAuthenticated                                  │    │
│  │  • roles (local management)                         │    │
│  │  • permissions (local management)                   │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  poSlice                                            │    │
│  │  • poList (local/offline data)                      │    │
│  │  • dispatchDetails (local/offline data)             │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  RTK Query (Server Data):                                    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  poApi (when connecting to backend)                 │    │
│  │  • useGetPOsQuery()                                 │    │
│  │  • useCreatePOMutation()                            │    │
│  │  • useUpdatePOMutation()                            │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Project Examples

### Example 1: Auth Slice (authSlice.ts)

The auth slice manages authentication and user/role/permission data:

```typescript
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// Types for the state
export interface User {
  id: string;
  username: string;
  email: string;
  password: string;
  roleId: string;
  isActive: boolean;
  createdAt: string;
  lastLogin: string | null;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissionIds: string[];
  isSystem: boolean;
}

export interface Permission {
  id: string;
  name: string;
  code: string;
  module: string;
  description: string;
}

export interface AuthState {
  currentUser: User | null;
  isAuthenticated: boolean;
  loginTimestamp: string | null;
  users: User[];
  roles: Role[];
  permissions: Permission[];
}

// Initial state with default data
const initialState: AuthState = {
  currentUser: null,
  isAuthenticated: false,
  loginTimestamp: null,
  users: defaultUsers,       // Pre-populated users
  roles: defaultRoles,       // Pre-populated roles
  permissions: defaultPermissions, // Pre-populated permissions
};

// Create the slice
const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    // Session actions
    login: (state, action: PayloadAction<User>) => {
      const user = action.payload;
      state.currentUser = { ...user, lastLogin: new Date().toISOString() };
      state.isAuthenticated = true;
      state.loginTimestamp = new Date().toISOString();
      // Update lastLogin in users array
      const userIndex = state.users.findIndex(u => u.id === user.id);
      if (userIndex !== -1) {
        state.users[userIndex].lastLogin = new Date().toISOString();
      }
    },
    
    logout: (state) => {
      state.currentUser = null;
      state.isAuthenticated = false;
      state.loginTimestamp = null;
    },
    
    // User CRUD actions
    addUser: (state, action: PayloadAction<Omit<User, "id" | "createdAt" | "lastLogin">>) => {
      const newUser: User = {
        ...action.payload,
        id: `user-${Date.now()}`,
        createdAt: new Date().toISOString(),
        lastLogin: null,
      };
      state.users.push(newUser);
    },
    
    updateUser: (state, action: PayloadAction<User>) => {
      const index = state.users.findIndex(u => u.id === action.payload.id);
      if (index !== -1) {
        state.users[index] = action.payload;
        // Update currentUser if it's the same user
        if (state.currentUser?.id === action.payload.id) {
          state.currentUser = action.payload;
        }
      }
    },
    
    deleteUser: (state, action: PayloadAction<string>) => {
      state.users = state.users.filter(u => u.id !== action.payload);
    },
    
    toggleUserActive: (state, action: PayloadAction<string>) => {
      const user = state.users.find(u => u.id === action.payload);
      if (user) {
        user.isActive = !user.isActive;
      }
    },
    
    // Role actions
    addRole: (state, action: PayloadAction<Omit<Role, "id">>) => {
      const newRole: Role = {
        ...action.payload,
        id: `role-${Date.now()}`,
      };
      state.roles.push(newRole);
    },
    
    // Permission assignment
    assignPermissionsToRole: (state, action: PayloadAction<{ roleId: string; permissionIds: string[] }>) => {
      const role = state.roles.find(r => r.id === action.payload.roleId);
      if (role) {
        role.permissionIds = action.payload.permissionIds;
      }
    },
  },
});

// Export actions
export const {
  login,
  logout,
  addUser,
  updateUser,
  deleteUser,
  toggleUserActive,
  addRole,
  updateRole,
  deleteRole,
  assignPermissionsToRole,
  addPermission,
  updatePermission,
  deletePermission,
} = authSlice.actions;

// Export reducer
export default authSlice.reducer;
```

### Example 2: PO Slice (poSlice.ts)

The PO slice manages purchase orders and dispatch details:

```typescript
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// Types
export interface POItem {
  category: string;
  oemName: string;
  product: string;
  quantity: number;
  spareQuantity: number;
  totalQuantity: number;
  pricePerUnit: number;
  totalPrice: number;
  warranty: string;
}

export interface DispatchDetail {
  id: string;
  poId: string;
  product: string;
  projectName: string;
  projectLocation: string;
  deliveryLocation: string;
  deliveryAddress: string;
  googleMapLink: string;
  deliveryQuantity: number;
  confirmDispatchDate: string;
  deliveryContact: string;
  remarks: string;
  createdAt: string;
}

export interface POData {
  id: string;
  date: string;
  clientName: string;
  osgPiNo: number;
  osgPiDate: string;
  clientPoNo: number;
  clientPoDate: string;
  poStatus: string;
  noOfDispatch: string;
  clientAddress: string;
  clientContact: string;
  poItems: POItem[];
  dispatchPlanDate: string;
  siteLocation: string;
  oscSupport: string;
  confirmDateOfDispatch: string;
  paymentStatus: string;
  remarks: string;
  createdAt: string;
}

interface POState {
  poList: POData[];
  dispatchDetails: DispatchDetail[];
}

const initialState: POState = {
  poList: [],
  dispatchDetails: [],
};

const poSlice = createSlice({
  name: "po",
  initialState,
  reducers: {
    // PO actions
    addPO: (state, action: PayloadAction<POData>) => {
      state.poList.push(action.payload);
    },
    
    updatePO: (state, action: PayloadAction<POData>) => {
      const index = state.poList.findIndex((po) => po.id === action.payload.id);
      if (index !== -1) {
        state.poList[index] = action.payload;
      }
    },
    
    deletePO: (state, action: PayloadAction<string>) => {
      state.poList = state.poList.filter((po) => po.id !== action.payload);
    },
    
    // Dispatch actions
    addDispatchDetail: (state, action: PayloadAction<DispatchDetail>) => {
      state.dispatchDetails.push(action.payload);
    },
    
    updateDispatchDetail: (state, action: PayloadAction<DispatchDetail>) => {
      const index = state.dispatchDetails.findIndex(
        (dispatch) => dispatch.id === action.payload.id
      );
      if (index !== -1) {
        state.dispatchDetails[index] = action.payload;
      }
    },
    
    deleteDispatchDetail: (state, action: PayloadAction<string>) => {
      state.dispatchDetails = state.dispatchDetails.filter(
        (dispatch) => dispatch.id !== action.payload
      );
    },
  },
});

export const {
  addPO,
  updatePO,
  deletePO,
  addDispatchDetail,
  updateDispatchDetail,
  deleteDispatchDetail,
} = poSlice.actions;

export default poSlice.reducer;
```

---

## Best Practices

### 1. Always Use Typed Hooks

```typescript
// ❌ Don't use untyped hooks
import { useSelector, useDispatch } from 'react-redux';

// ✅ Always use typed hooks
import { useAppSelector, useAppDispatch } from '../store/hook';
```

### 2. Keep Slices Feature-Focused

```
// ✅ Good - organized by feature
store/
├── authSlice.ts      // Auth, users, roles, permissions
├── poSlice.ts        // Purchase orders, dispatch details
├── uiSlice.ts        // UI state (modals, notifications)
└── index.ts          // Store configuration

// ❌ Bad - everything in one slice
store/
└── appSlice.ts       // Everything mixed together
```

### 3. Use PayloadAction for Type Safety

```typescript
// ❌ Without PayloadAction - no type checking
deleteUser: (state, action) => {
  // action.payload could be anything!
  state.users = state.users.filter(u => u.id !== action.payload);
},

// ✅ With PayloadAction<Type>
deleteUser: (state, action: PayloadAction<string>) => {
  // TypeScript knows payload is a string
  state.users = state.users.filter(u => u.id !== action.payload);
},
```

### 4. Colocate Related Actions

```typescript
// ✅ Good - related actions together
const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    // Session actions grouped
    login: (state, action) => { ... },
    logout: (state) => { ... },
    
    // User CRUD grouped
    addUser: (state, action) => { ... },
    updateUser: (state, action) => { ... },
    deleteUser: (state, action) => { ... },
    
    // Role CRUD grouped
    addRole: (state, action) => { ... },
    updateRole: (state, action) => { ... },
    deleteRole: (state, action) => { ... },
  },
});
```

### 5. Initialize State Properly

```typescript
// ✅ Good - complete initial state
const initialState: AuthState = {
  currentUser: null,
  isAuthenticated: false,
  loginTimestamp: null,
  users: [],
  roles: [],
  permissions: [],
};

// ❌ Bad - incomplete/missing fields
const initialState = {
  currentUser: null,
  // Missing other fields...
};
```

### 6. Use Selectors for Derived Data

```typescript
// ❌ Bad - computing in component
const Component = () => {
  const users = useAppSelector(state => state.auth.users);
  const activeUsers = users.filter(u => u.isActive); // Computed every render
};

// ✅ Better - selector with useMemo or reselect
const Component = () => {
  const activeUsers = useAppSelector(state => 
    state.auth.users.filter(u => u.isActive)
  );
};

// ✅✅ Best - create reusable selector (in slice file)
// In authSlice.ts
export const selectActiveUsers = (state: RootState) => 
  state.auth.users.filter(u => u.isActive);

// In component
const activeUsers = useAppSelector(selectActiveUsers);
```

---

## Common Pitfalls

### 1. Mutating State Outside Reducers

```typescript
// ❌ WRONG - Never mutate state directly in components
const Component = () => {
  const users = useAppSelector(state => state.auth.users);
  
  const handleAdd = () => {
    users.push(newUser); // THIS IS WRONG!
  };
};

// ✅ CORRECT - Always dispatch actions
const Component = () => {
  const dispatch = useAppDispatch();
  
  const handleAdd = () => {
    dispatch(addUser(newUser)); // Correct way
  };
};
```

### 2. Forgetting to Export Actions

```typescript
// ❌ WRONG - Actions not exported
const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    login: (state, action) => { ... },
  },
});

export default authSlice.reducer;
// Forgot to export actions!

// ✅ CORRECT - Export both actions and reducer
export const { login, logout, addUser } = authSlice.actions;
export default authSlice.reducer;
```

### 3. Using Plain Hooks Instead of Typed Hooks

```typescript
// ❌ WRONG - No type safety
import { useSelector } from 'react-redux';
const user = useSelector(state => state.auth.currentUser);
// TypeScript has no idea what 'state' is

// ✅ CORRECT - Full type safety
import { useAppSelector } from '../store/hook';
const user = useAppSelector(state => state.auth.currentUser);
// TypeScript knows state.auth.currentUser is User | null
```

### 4. Not Adding Slice to Store

```typescript
// ❌ WRONG - Slice not added to store
export const store = configureStore({
  reducer: {
    auth: authReducer,
    // Forgot to add poReducer!
  },
});

// ✅ CORRECT - All slices included
export const store = configureStore({
  reducer: {
    auth: authReducer,
    po: poReducer,
    [baseApi.reducerPath]: baseApi.reducer,
  },
});
```

### 5. Mixing Mutation and Return in Reducers

```typescript
// ❌ WRONG - Don't mix mutation and return
addUser: (state, action) => {
  state.users.push(action.payload);
  return state; // Don't do this!
},

// ✅ CORRECT - Either mutate...
addUser: (state, action) => {
  state.users.push(action.payload);
  // No return needed
},

// ✅ ...OR return new state
resetUsers: () => {
  return initialState; // Complete replacement
},
```

### 6. Not Handling Edge Cases in Reducers

```typescript
// ❌ WRONG - No null/undefined checks
updateUser: (state, action) => {
  const index = state.users.findIndex(u => u.id === action.payload.id);
  state.users[index] = action.payload; // Crashes if index is -1!
},

// ✅ CORRECT - Handle edge cases
updateUser: (state, action) => {
  const index = state.users.findIndex(u => u.id === action.payload.id);
  if (index !== -1) { // Check before updating
    state.users[index] = action.payload;
  }
},
```

---

## Glossary

| Term | Definition |
|------|------------|
| **Store** | Single object containing all application state |
| **Action** | Plain object describing what happened (has `type` and optional `payload`) |
| **Reducer** | Pure function: (state, action) => newState |
| **Slice** | Collection of reducer logic + actions for one feature |
| **Dispatch** | Function to send actions to the store |
| **Selector** | Function to extract data from the state |
| **PayloadAction** | TypeScript type for actions with typed payloads |
| **Immer** | Library enabling "mutable" syntax for immutable updates |
| **configureStore** | Redux Toolkit function to create the store |
| **createSlice** | Redux Toolkit function to create a slice |
| **useAppDispatch** | Typed hook to get dispatch function |
| **useAppSelector** | Typed hook to select state |
| **Redux Persist** | Library to persist Redux state to storage |
| **REHYDRATE** | Redux Persist action when loading saved state |
| **Whitelist** | List of slices to persist |
| **Blacklist** | List of slices NOT to persist |

---

## Next Steps

1. Review the **[authSlice.ts](../ui/src/store/authSlice.ts)** and **[poSlice.ts](../ui/src/store/poSlice.ts)** files to see real implementations
2. Look at component files like **DispatchDetails.tsx** to see how Redux is used in practice
3. Read the **[RTK_QUERY_GUIDE.md](./RTK_QUERY_GUIDE.md)** to understand when to use RTK Query vs Redux slices
4. Experiment by adding a new action to an existing slice
5. Try creating a simple new slice for UI state (like modal visibility)
