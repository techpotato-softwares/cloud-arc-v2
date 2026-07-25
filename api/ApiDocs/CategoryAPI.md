# Category API Documentation

This document provides comprehensive documentation for all Category API endpoints.

## Base URL
```
/api/category
```

## Endpoints

### 1. Create Category

Creates a new category in the system.

**Endpoint:** `POST /api/category/`

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "string",
  "status": "Active" | "Inactive",
  "createdBy": "string"
}
```

**Request Body Schema:**
- `name` (string, required): The name of the category
- `status` (string, required): Status of the category. Must be either "Active" or "Inactive"
- `createdBy` (string, required): ID or username of the user creating the category

**Sample Request:**
```json
{
  "name": "Electronics",
  "status": "Active",
  "createdBy": "user123"
}
```

**Success Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "categoryId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Electronics",
    "status": "Active",
    "createdBy": "user123",
    "updatedBy": "user123",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Error Response (400/500):**
```json
{
  "success": false,
  "error": "Error creating category",
  "message": "Detailed error message here"
}
```

---

### 2. Get All Categories

Retrieves a list of all categories in the system.

**Endpoint:** `GET /api/category/`

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:** None

**Query Parameters:** None

**Sample Request:**
```bash
GET /api/category/
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "categoryId": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Electronics",
      "status": "Active",
      "createdBy": "user123",
      "updatedBy": "user123",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    },
    {
      "categoryId": "660e8400-e29b-41d4-a716-446655440001",
      "name": "Mechanical Parts",
      "status": "Active",
      "createdBy": "user456",
      "updatedBy": "user456",
      "createdAt": "2024-01-16T11:20:00.000Z",
      "updatedAt": "2024-01-16T11:20:00.000Z"
    }
  ]
}
```

**Error Response (500):**
```json
{
  "success": false,
  "error": "Error fetching categories",
  "message": "Detailed error message here"
}
```

---

### 3. Get Category by ID

Retrieves a specific category by its ID.

**Endpoint:** `GET /api/category/{id}`

**Request Headers:**
```
Content-Type: application/json
```

**Path Parameters:**
- `id` (string, required): The unique identifier of the category

**Request Body:** None

**Sample Request:**
```bash
GET /api/category/550e8400-e29b-41d4-a716-446655440000
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "categoryId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Electronics",
    "status": "Active",
    "createdBy": "user123",
    "updatedBy": "user123",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Error Response (404/500):**
```json
{
  "success": false,
  "error": "Error fetching category",
  "message": "Category not found"
}
```

---

### 4. Update Category

Updates an existing category by its ID.

**Endpoint:** `PUT /api/category/{id}`

**Request Headers:**
```
Content-Type: application/json
```

**Path Parameters:**
- `id` (string, required): The unique identifier of the category to update

**Request Body:**
```json
{
  "name": "string (optional)",
  "status": "Active" | "Inactive (optional)",
  "updatedBy": "string (required)"
}
```

**Request Body Schema:**
- `name` (string, optional): The updated name of the category
- `status` (string, optional): Updated status. Must be either "Active" or "Inactive"
- `updatedBy` (string, required): ID or username of the user updating the category

**Sample Request:**
```json
{
  "name": "Electronic Components",
  "status": "Active",
  "updatedBy": "user123"
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "categoryId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Electronic Components",
    "status": "Active",
    "createdBy": "user123",
    "updatedBy": "user123",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-20T14:45:00.000Z"
  }
}
```

**Error Response (404/500):**
```json
{
  "success": false,
  "error": "Error updating category",
  "message": "Category not found or update failed"
}
```

---

### 5. Delete Category

Deletes a category by its ID.

**Endpoint:** `DELETE /api/category/{id}`

**Request Headers:**
```
Content-Type: application/json
```

**Path Parameters:**
- `id` (string, required): The unique identifier of the category to delete

**Request Body:** None

**Sample Request:**
```bash
DELETE /api/category/550e8400-e29b-41d4-a716-446655440000
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "deleted": true
  }
}
```

**Error Response (404/500):**
```json
{
  "success": false,
  "error": "Error deleting category",
  "message": "Category not found or deletion failed"
}
```

---

## Response Schema

### CategoryResponse
```typescript
{
  categoryId: string;      // UUID of the category
  name: string;            // Name of the category
  status: 'Active' | 'Inactive';  // Status of the category
  createdBy: string;       // User who created the category
  updatedBy: string;       // User who last updated the category
  createdAt: Date;         // Creation timestamp
  updatedAt: Date;         // Last update timestamp
}
```

## Common Error Responses

All endpoints may return the following error responses:

**400 Bad Request:**
```json
{
  "success": false,
  "error": "Validation error",
  "message": "Invalid request parameters"
}
```

**404 Not Found:**
```json
{
  "success": false,
  "error": "Resource not found",
  "message": "The requested resource does not exist"
}
```

**500 Internal Server Error:**
```json
{
  "success": false,
  "error": "Internal server error",
  "message": "An unexpected error occurred"
}
```

## Notes

- All timestamps are in ISO 8601 format (UTC)
- Category IDs are UUIDs
- Status values are case-sensitive and must be exactly "Active" or "Inactive"
- When creating a category, both `createdBy` and `updatedBy` are set to the provided `createdBy` value
- When updating a category, `updatedBy` is required and must be provided in the request body
