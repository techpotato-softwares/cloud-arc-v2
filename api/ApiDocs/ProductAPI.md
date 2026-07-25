# Product API Documentation

This document provides comprehensive documentation for all Product API endpoints.

## Base URL
```
/api/product
```

## Endpoints

### 1. Create Product

Creates a new product in the system.

**Endpoint:** `POST /api/product/`

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "string",
  "category": "string",
  "oem": "string",
  "status": "Active" | "Inactive",
  "createdBy": "string (optional)"
}
```

**Request Body Schema:**
- `name` (string, required): The name of the product
- `category` (string, required): The category ID that this product belongs to
- `oem` (string, required): The OEM (Original Equipment Manufacturer) ID for this product
- `status` (string, required): Status of the product. Must be either "Active" or "Inactive"
- `createdBy` (string, optional): ID or username of the user creating the product

**Sample Request:**
```json
{
  "name": "AC Compressor",
  "category": "550e8400-e29b-41d4-a716-446655440000",
  "oem": "770e8400-e29b-41d4-a716-446655440000",
  "status": "Active",
  "createdBy": "user123"
}
```

**Success Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "productId": "880e8400-e29b-41d4-a716-446655440000",
    "name": "AC Compressor",
    "category": "550e8400-e29b-41d4-a716-446655440000",
    "oem": "770e8400-e29b-41d4-a716-446655440000",
    "status": "Active",
    "createdBy": "user123",
    "updatedBy": null,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Error Response (400/500):**
```json
{
  "success": false,
  "error": "Error creating product",
  "message": "Detailed error message here"
}
```

---

### 2. Get All Products

Retrieves a list of all products in the system.

**Endpoint:** `GET /api/product/`

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:** None

**Query Parameters:** None

**Sample Request:**
```bash
GET /api/product/
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "productId": "880e8400-e29b-41d4-a716-446655440000",
      "name": "AC Compressor",
      "category": "550e8400-e29b-41d4-a716-446655440000",
      "oem": "770e8400-e29b-41d4-a716-446655440000",
      "status": "Active",
      "createdBy": "user123",
      "updatedBy": null,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    },
    {
      "productId": "990e8400-e29b-41d4-a716-446655440001",
      "name": "Brake Pad Set",
      "category": "660e8400-e29b-41d4-a716-446655440001",
      "oem": "770e8400-e29b-41d4-a716-446655440000",
      "status": "Active",
      "createdBy": "user456",
      "updatedBy": "user456",
      "createdAt": "2024-01-16T11:20:00.000Z",
      "updatedAt": "2024-01-18T09:15:00.000Z"
    }
  ]
}
```

**Error Response (500):**
```json
{
  "success": false,
  "error": "Error fetching products",
  "message": "Detailed error message here"
}
```

---

### 3. Get Product by ID

Retrieves a specific product by its ID.

**Endpoint:** `GET /api/product/{id}`

**Request Headers:**
```
Content-Type: application/json
```

**Path Parameters:**
- `id` (string, required): The unique identifier of the product

**Request Body:** None

**Sample Request:**
```bash
GET /api/product/880e8400-e29b-41d4-a716-446655440000
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "productId": "880e8400-e29b-41d4-a716-446655440000",
    "name": "AC Compressor",
    "category": "550e8400-e29b-41d4-a716-446655440000",
    "oem": "770e8400-e29b-41d4-a716-446655440000",
    "status": "Active",
    "createdBy": "user123",
    "updatedBy": null,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Error Response (404/500):**
```json
{
  "success": false,
  "error": "Error fetching product",
  "message": "Product not found"
}
```

---

### 4. Update Product

Updates an existing product by its ID.

**Endpoint:** `PUT /api/product/{id}`

**Request Headers:**
```
Content-Type: application/json
```

**Path Parameters:**
- `id` (string, required): The unique identifier of the product to update

**Request Body:**
```json
{
  "name": "string (optional)",
  "category": "string (optional)",
  "oem": "string (optional)",
  "status": "Active" | "Inactive (optional)",
  "updatedBy": "string (optional)"
}
```

**Request Body Schema:**
- `name` (string, optional): The updated name of the product
- `category` (string, optional): The updated category ID
- `oem` (string, optional): The updated OEM ID
- `status` (string, optional): Updated status. Must be either "Active" or "Inactive"
- `updatedBy` (string, optional): ID or username of the user updating the product

**Sample Request:**
```json
{
  "name": "AC Compressor Premium",
  "status": "Active",
  "updatedBy": "user123"
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "productId": "880e8400-e29b-41d4-a716-446655440000",
    "name": "AC Compressor Premium",
    "category": "550e8400-e29b-41d4-a716-446655440000",
    "oem": "770e8400-e29b-41d4-a716-446655440000",
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
  "error": "Error updating product",
  "message": "Product not found or update failed"
}
```

---

### 5. Delete Product

Deletes a product by its ID.

**Endpoint:** `DELETE /api/product/{id}`

**Request Headers:**
```
Content-Type: application/json
```

**Path Parameters:**
- `id` (string, required): The unique identifier of the product to delete

**Request Body:** None

**Sample Request:**
```bash
DELETE /api/product/880e8400-e29b-41d4-a716-446655440000
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
  "error": "Error deleting product",
  "message": "Product not found or deletion failed"
}
```

---

## Response Schema

### ProductResponse
```typescript
{
  productId: string;       // UUID of the product
  name: string;            // Name of the product
  category: string;        // Category ID that the product belongs to
  oem: string;             // OEM ID for the product
  status: 'Active' | 'Inactive';  // Status of the product
  createdBy?: string | null;      // User who created the product (optional)
  updatedBy?: string | null;      // User who last updated the product (optional)
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
- Product IDs are UUIDs
- Category and OEM must be valid existing IDs in the system
- Status values are case-sensitive and must be exactly "Active" or "Inactive"
- When creating a product, `createdBy` is optional but recommended for audit purposes
- When updating a product, all fields are optional - only provide the fields you want to update
- The `category` and `oem` fields in requests should contain the respective IDs (UUIDs), not names

## Relationships

- **Category**: A product must belong to an existing category. The category ID must be valid.
- **OEM**: A product must be associated with an existing OEM. The OEM ID must be valid.
- Products can be filtered or queried by their category or OEM relationships.
