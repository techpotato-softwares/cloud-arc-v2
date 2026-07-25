# OEM API Documentation

This document provides comprehensive documentation for all OEM (Original Equipment Manufacturer) API endpoints.

## Base URL
```
/api/oem
```

## Endpoints

### 1. Create OEM

Creates a new OEM in the system.

**Endpoint:** `POST /api/oem/`

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "string",
  "status": "Active" | "Inactive",
  "createdBy": "string (optional)"
}
```

**Request Body Schema:**
- `name` (string, required): The name of the OEM
- `status` (string, required): Status of the OEM. Must be either "Active" or "Inactive"
- `createdBy` (string, optional): ID or username of the user creating the OEM

**Sample Request:**
```json
{
  "name": "Bosch",
  "status": "Active",
  "createdBy": "user123"
}
```

**Success Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "oemId": "770e8400-e29b-41d4-a716-446655440000",
    "name": "Bosch",
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
  "error": "Error creating OEM",
  "message": "Detailed error message here"
}
```

---

### 2. Get All OEMs

Retrieves a list of all OEMs in the system.

**Endpoint:** `GET /api/oem/`

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:** None

**Query Parameters:** None

**Sample Request:**
```bash
GET /api/oem/
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "oemId": "770e8400-e29b-41d4-a716-446655440000",
      "name": "Bosch",
      "status": "Active",
      "createdBy": "user123",
      "updatedBy": null,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    },
    {
      "oemId": "880e8400-e29b-41d4-a716-446655440001",
      "name": "Delphi",
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
  "error": "Error fetching OEMs",
  "message": "Detailed error message here"
}
```

---

### 3. Get OEM by ID

Retrieves a specific OEM by its ID.

**Endpoint:** `GET /api/oem/{id}`

**Request Headers:**
```
Content-Type: application/json
```

**Path Parameters:**
- `id` (string, required): The unique identifier of the OEM

**Request Body:** None

**Sample Request:**
```bash
GET /api/oem/770e8400-e29b-41d4-a716-446655440000
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "oemId": "770e8400-e29b-41d4-a716-446655440000",
    "name": "Bosch",
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
  "error": "Error fetching OEM",
  "message": "OEM not found"
}
```

---

### 4. Update OEM

Updates an existing OEM by its ID.

**Endpoint:** `PUT /api/oem/{id}`

**Request Headers:**
```
Content-Type: application/json
```

**Path Parameters:**
- `id` (string, required): The unique identifier of the OEM to update

**Request Body:**
```json
{
  "name": "string (optional)",
  "status": "Active" | "Inactive (optional)",
  "updatedBy": "string (optional)"
}
```

**Request Body Schema:**
- `name` (string, optional): The updated name of the OEM
- `status` (string, optional): Updated status. Must be either "Active" or "Inactive"
- `updatedBy` (string, optional): ID or username of the user updating the OEM

**Sample Request:**
```json
{
  "name": "Bosch Automotive",
  "status": "Active",
  "updatedBy": "user123"
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "oemId": "770e8400-e29b-41d4-a716-446655440000",
    "name": "Bosch Automotive",
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
  "error": "Error updating OEM",
  "message": "OEM not found or update failed"
}
```

---

### 5. Delete OEM

Deletes an OEM by its ID.

**Endpoint:** `DELETE /api/oem/{id}`

**Request Headers:**
```
Content-Type: application/json
```

**Path Parameters:**
- `id` (string, required): The unique identifier of the OEM to delete

**Request Body:** None

**Sample Request:**
```bash
DELETE /api/oem/770e8400-e29b-41d4-a716-446655440000
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
  "error": "Error deleting OEM",
  "message": "OEM not found or deletion failed"
}
```

---

## Response Schema

### OEMResponse
```typescript
{
  oemId: string;           // UUID of the OEM
  name: string;            // Name of the OEM
  status: 'Active' | 'Inactive';  // Status of the OEM
  createdBy?: string | null;      // User who created the OEM (optional)
  updatedBy?: string | null;      // User who last updated the OEM (optional)
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
- OEM IDs are UUIDs
- Status values are case-sensitive and must be exactly "Active" or "Inactive"
- When creating an OEM, `createdBy` is optional but recommended for audit purposes
- When updating an OEM, all fields are optional - only provide the fields you want to update
- OEMs are used to categorize products by their original equipment manufacturer
- Products can be associated with OEMs through the Product API
