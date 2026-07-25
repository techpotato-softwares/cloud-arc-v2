# S3 File Upload Implementation Guide

This document provides a comprehensive guide for the S3 file upload feature in the ArcForge CloudArc application. It covers the architecture, API endpoints, frontend integration, and best practices.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [Backend Implementation](#backend-implementation)
5. [Frontend Implementation](#frontend-implementation)
6. [API Endpoints](#api-endpoints)
7. [Usage Examples](#usage-examples)
8. [Configuration](#configuration)
9. [CDK Infrastructure](#cdk-infrastructure)
10. [Cleanup Job](#cleanup-job)
11. [Troubleshooting](#troubleshooting)

---

## Overview

The S3 file upload feature uses **presigned URLs** for secure, direct uploads to S3 from the browser. This approach:

- **Reduces server load**: Files go directly to S3, not through our servers
- **Improves performance**: No file data passes through Lambda (faster uploads)
- **Enhances security**: Presigned URLs are time-limited and specific to each file
- **Supports large files**: No Lambda memory/timeout limitations

### Staged Upload Workflow

Files go through a staged upload process:

```
1. PENDING    → User selects file, presigned URL generated, file uploaded to S3
2. CONFIRMED  → User submits form, files linked to entity (dispatch, delivery, etc.)
3. DELETED    → File soft-deleted (can be hard deleted by cleanup job)
```

---

## Architecture

```
┌──────────────────┐     1. Request presigned URLs     ┌──────────────────┐
│                  │ ─────────────────────────────────→│                  │
│    Frontend      │                                   │    Backend API   │
│    (React)       │←─────────────────────────────────│    (Express)     │
│                  │     2. Return URLs + fileIds      │                  │
└────────┬─────────┘                                   └────────┬─────────┘
         │                                                      │
         │ 3. Upload directly to S3                             │ 4. Create pending
         │    using presigned URL                               │    records in DB
         ▼                                                      ▼
┌──────────────────┐                                   ┌──────────────────┐
│                  │                                   │                  │
│    AWS S3        │                                   │   PostgreSQL     │
│    Bucket        │                                   │   Database       │
│                  │                                   │                  │
└──────────────────┘                                   └──────────────────┘

         │                                                      │
         │ 5. On form submit,                                   │
         │    confirm files                                     │
         ▼                                                      ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  Backend API: Update file status to "confirmed" and link to entity      │
└──────────────────────────────────────────────────────────────────────────┘
```

### Key Components

| Component | Location | Description |
|-----------|----------|-------------|
| S3 Utilities | `api/layers/shared/nodejs/src/utils/s3.ts` | S3 client, presigned URL generation |
| FileRepository | `api/src/repositories/FileRepository.ts` | Database operations for files |
| FileService | `api/src/services/FileService.ts` | Business logic for file operations |
| FileController | `api/src/controllers/FileController.ts` | API endpoints |
| fileApi.ts | `ui/src/store/api/fileApi.ts` | RTK Query hooks |
| S3FileUpload | `ui/src/Components/POManagement/S3FileUpload.tsx` | Upload component with S3 integration |
| FilePreview | `ui/src/Components/POManagement/FilePreview.tsx` | Display uploaded files with download |

---

## Database Schema

The `FileUpload` model stores metadata about uploaded files:

```prisma
model FileUpload {
  fileId           Int            @id @default(autoincrement()) @map("file_id")
  originalFileName String         @map("original_file_name") @db.VarChar(255)
  storedFileName   String         @map("stored_file_name") @db.VarChar(255)
  mimeType         String         @map("mime_type") @db.VarChar(100)
  fileSize         Int            @map("file_size")
  s3Key            String         @map("s3_key") @db.VarChar(500)
  s3Bucket         String         @map("s3_bucket") @db.VarChar(100)
  status           String         @default("pending") @map("status") @db.VarChar(20)
  entityType       String?        @map("entity_type") @db.VarChar(50)
  entityId         String?        @map("entity_id") @db.VarChar(50)
  poId             String?        @map("po_id") @db.VarChar(20)
  purchaseOrder    PurchaseOrder? @relation(...)
  uploadedBy       Int            @map("uploaded_by")
  uploader         User           @relation(...)
  confirmedAt      DateTime?      @map("confirmed_at")
  deletedAt        DateTime?      @map("deleted_at")
  createdAt        DateTime       @default(now()) @map("created_at")
  updatedAt        DateTime       @updatedAt @map("updated_at")

  @@index([status])
  @@index([entityType, entityId])
  @@index([poId])
  @@map("file_uploads")
}
```

### Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `fileId` | Int | Auto-increment primary key |
| `originalFileName` | String | Original file name as uploaded by user |
| `storedFileName` | String | UUID-prefixed file name stored in S3 |
| `mimeType` | String | MIME type (e.g., "application/pdf") |
| `fileSize` | Int | File size in bytes |
| `s3Key` | String | Full path in S3 bucket |
| `s3Bucket` | String | S3 bucket name |
| `status` | String | "pending", "confirmed", or "deleted" |
| `entityType` | String | "dispatch", "delivery", "ppm", "commissioning", "warranty" |
| `entityId` | String | ID of the associated entity |
| `poId` | String | PO ID for organization |
| `uploadedBy` | Int | User ID who uploaded the file |
| `confirmedAt` | DateTime | When file was confirmed |

---

## Backend Implementation

### S3 Utilities

Located at `api/layers/shared/nodejs/src/utils/s3.ts`:

```typescript
// Generate presigned upload URL
const presignedUrl = await generatePresignedUploadUrl({
  originalFileName: "invoice.pdf",
  mimeType: "application/pdf",
  fileSize: 1024000,
  poId: "OSG-00000001",
  entityType: "dispatch",
  entityId: "D001",
});
// Returns: { uploadUrl, s3Key, s3Bucket, expiresIn }

// Generate presigned download URL
const downloadUrl = await generatePresignedDownloadUrl(s3Key, originalFileName);
// Returns: { downloadUrl, expiresIn }

// Delete file from S3
await deleteFileFromS3(s3Key);

// Delete multiple files
await deleteFilesFromS3(s3Keys);
```

### FileService Methods

```typescript
interface IFileService {
  // Generate presigned URLs for multiple files
  generatePresignedUploadUrls(
    request: GeneratePresignedUrlsRequest,
    uploadedBy: number
  ): Promise<GeneratePresignedUrlsResponse>;

  // Confirm uploaded files and link to entity
  confirmFiles(request: ConfirmFilesRequest): Promise<ConfirmFilesResponse>;

  // Get presigned download URL
  getDownloadUrl(fileId: number): Promise<PresignedDownloadUrlResponse>;

  // Get files for an entity
  getEntityFiles(request: ListEntityFilesRequest): Promise<FileListResponse>;

  // Get files for a PO
  getPOFiles(poId: string, page?: number, limit?: number): Promise<FileListResponse>;

  // Soft delete a file
  deleteFile(fileId: number): Promise<DeleteFileResponse>;

  // Cleanup orphaned files
  cleanupOrphanedFiles(request: CleanupOrphanedFilesRequest): Promise<CleanupOrphanedFilesResponse>;
}
```

---

## Frontend Implementation

### S3FileUpload Component

The `S3FileUpload` component handles file selection, upload to S3, and confirmation:

```tsx
import S3FileUpload, { S3FileUploadRef } from "./S3FileUpload";

const MyFormModal: React.FC = () => {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const fileUploadRef = useRef<S3FileUploadRef>(null);

  const handleSubmit = async () => {
    // Upload and confirm files
    const fileIds = await fileUploadRef.current?.uploadAndConfirm();
    console.log("Uploaded files:", fileIds);
    
    // Save form with file IDs...
  };

  return (
    <Form>
      {/* Other form fields */}
      
      <S3FileUpload
        ref={fileUploadRef}
        fileList={fileList}
        onChange={setFileList}
        poId="OSG-00000001"
        entityType="dispatch"
        entityId="D001"
        minFiles={1}
        maxFiles={5}
        maxSizeMB={10}
      />
      
      <Button onClick={handleSubmit}>Submit</Button>
    </Form>
  );
};
```

### S3FileUploadRef Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `uploadAndConfirm()` | `Promise<number[]>` | Upload all files to S3 and confirm them |
| `isUploading` | `boolean` | Whether upload is in progress |
| `getUploadedFileIds()` | `number[]` | Get list of uploaded file IDs |

### FilePreview Component

Display uploaded files with download capability:

```tsx
import FilePreview from "./FilePreview";

const MyComponent: React.FC = () => {
  const files = [
    { fileId: 1, originalFileName: "invoice.pdf", mimeType: "application/pdf", fileSize: 1024000 },
    { fileId: 2, originalFileName: "photo.jpg", mimeType: "image/jpeg", fileSize: 512000 },
  ];

  return (
    <FilePreview
      files={files}
      direction="horizontal"
      showFileNames={true}
      maxVisible={5}
      iconSize={24}
    />
  );
};
```

### RTK Query Hooks

```typescript
import {
  useGeneratePresignedUrlsMutation,
  useConfirmFilesMutation,
  useLazyGetDownloadUrlQuery,
  useGetEntityFilesQuery,
  useDeleteFileMutation,
  uploadFileToS3,
} from "../../store/api/fileApi";

// Generate presigned URLs
const [generateUrls] = useGeneratePresignedUrlsMutation();
const result = await generateUrls({
  files: [{ originalFileName: "doc.pdf", mimeType: "application/pdf", fileSize: 1024 }],
  poId: "OSG-00000001",
}).unwrap();

// Upload file to S3 directly
await uploadFileToS3(file, result.files[0].uploadUrl, (progress) => {
  console.log(`Upload progress: ${progress}%`);
});

// Confirm files
const [confirmFiles] = useConfirmFilesMutation();
await confirmFiles({
  fileIds: [1, 2, 3],
  entityType: "dispatch",
  entityId: "D001",
}).unwrap();

// Get download URL and open in new tab
const [getDownloadUrl] = useLazyGetDownloadUrlQuery();
const { downloadUrl } = await getDownloadUrl(fileId).unwrap();
window.open(downloadUrl, "_blank");

// Get files for an entity
const { data: files } = useGetEntityFilesQuery({
  entityType: "dispatch",
  entityId: "D001",
});
```

---

## API Endpoints

### POST /api/files/presigned-urls

Generate presigned upload URLs for multiple files.

**Request:**
```json
{
  "files": [
    {
      "originalFileName": "invoice.pdf",
      "mimeType": "application/pdf",
      "fileSize": 1024000
    }
  ],
  "poId": "OSG-00000001",
  "entityType": "dispatch",
  "entityId": "D001"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "files": [
      {
        "fileId": 1,
        "originalFileName": "invoice.pdf",
        "uploadUrl": "https://bucket.s3.amazonaws.com/...",
        "s3Key": "uploads/OSG-00000001/dispatch/D001/uuid_invoice.pdf",
        "expiresIn": 3600
      }
    ]
  }
}
```

### POST /api/files/confirm

Confirm uploaded files and link to entity.

**Request:**
```json
{
  "fileIds": [1, 2, 3],
  "entityType": "dispatch",
  "entityId": "D001",
  "poId": "OSG-00000001"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "confirmedCount": 3,
    "files": [...]
  }
}
```

### GET /api/files/:fileId/download-url

Get presigned download URL for a file.

**Response:**
```json
{
  "success": true,
  "data": {
    "fileId": 1,
    "originalFileName": "invoice.pdf",
    "downloadUrl": "https://bucket.s3.amazonaws.com/...",
    "expiresIn": 3600
  }
}
```

### GET /api/files/entity/:entityType/:entityId

Get all files for a specific entity.

**Response:**
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1
  }
}
```

### GET /api/files/po/:poId

Get all files for a PO.

### DELETE /api/files/:fileId

Soft delete a file.

### POST /api/files/cleanup

Cleanup orphaned pending files (admin only).

**Request:**
```json
{
  "olderThanHours": 24,
  "dryRun": false
}
```

---

## Usage Examples

### Example 1: Dispatch Document Upload

```tsx
const DispatchDocumentForm: React.FC = () => {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const fileUploadRef = useRef<S3FileUploadRef>(null);

  const handleSubmit = async (values: FormValues) => {
    try {
      // 1. Upload files to S3 and confirm
      const fileIds = await fileUploadRef.current?.uploadAndConfirm();
      
      // 2. Save dispatch document with file IDs
      await saveDispatchDocument({
        ...values,
        fileIds,
      });
      
      message.success("Dispatch document saved successfully!");
    } catch (error) {
      message.error("Failed to save dispatch document");
    }
  };

  return (
    <Form onFinish={handleSubmit}>
      {/* Form fields */}
      
      <Form.Item label="Upload Documents">
        <S3FileUpload
          ref={fileUploadRef}
          fileList={fileList}
          onChange={setFileList}
          poId={poId}
          entityType="dispatch"
          entityId={dispatchId}
          minFiles={5}
          maxFiles={5}
          label="Dispatch Documents"
          helperText="Upload OSG PI, Tax Invoice, E-way bill, Delivery Challan, LR Copy"
        />
      </Form.Item>
      
      <Button type="primary" htmlType="submit">
        Submit
      </Button>
    </Form>
  );
};
```

### Example 2: Display Uploaded Files in Details Modal

```tsx
const DispatchDetailsModal: React.FC<Props> = ({ dispatch }) => {
  const { data: filesData } = useGetEntityFilesQuery({
    entityType: "dispatch",
    entityId: dispatch.id,
  });

  return (
    <Modal title="Dispatch Details">
      <Descriptions>
        {/* Other details */}
      </Descriptions>
      
      <div>
        <Typography.Text strong>Uploaded Documents:</Typography.Text>
        <FilePreview
          files={filesData?.data.map(f => ({
            fileId: f.fileId,
            originalFileName: f.originalFileName,
            mimeType: f.mimeType,
            fileSize: f.fileSize,
          })) || []}
          showFileNames
        />
      </div>
    </Modal>
  );
};
```

---

## Configuration

### Environment Variables

Add these to your environment configuration:

```json
{
  "S3_BUCKET_NAME": "arcforge-files-dev",
  "S3_UPLOAD_URL_EXPIRES_IN": "3600",
  "S3_DOWNLOAD_URL_EXPIRES_IN": "3600",
  "S3_MAX_FILE_SIZE": "10485760",
  "FILE_CLEANUP_HOURS": "24",
  "FILE_CLEANUP_DRY_RUN": "false"
}
```

### S3 Bucket CORS Configuration

For direct browser uploads, configure CORS on your S3 bucket:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedOrigins": ["http://localhost:3000", "https://yourdomain.com"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

### Allowed File Types

The following MIME types are allowed:

- **Images**: JPEG, PNG, GIF, BMP, WebP, SVG
- **Documents**: PDF, Word (.doc, .docx), Excel (.xls, .xlsx)

Maximum file size: 10MB (configurable via `S3_MAX_FILE_SIZE`)

---

## CDK Infrastructure

The S3 bucket and cleanup job are provisioned automatically via CDK for QA and Production environments.

### S3 Bucket Configuration

**Location**: `cdk/config/s3.config.ts`

The S3 bucket is configured per environment with appropriate CORS and security settings:

```typescript
// Development
{
  id: "files",
  bucketNamePrefix: "arcforge-files",
  versioned: false,
  removalPolicy: RemovalPolicy.DESTROY,
  enableCors: true,
  corsAllowedOrigins: [
    "__AUTO__",  // Automatically replaced with CloudFront URL
    "http://localhost:3000",
    "http://localhost:4000",
  ],
}

// QA
{
  id: "files",
  bucketNamePrefix: "arcforge-files",
  versioned: true,
  removalPolicy: RemovalPolicy.DESTROY,
  corsAllowedOrigins: ["__AUTO__"],  // Automatically uses CloudFront URL
}

// Production
{
  id: "files",
  bucketNamePrefix: "arcforge-files",
  versioned: true,
  removalPolicy: RemovalPolicy.RETAIN,
  corsAllowedOrigins: ["__AUTO__"],  // Automatically uses CloudFront URL
}
```

### Automatic CORS Configuration

The S3 bucket CORS origins are **automatically configured** using the CloudFront distribution URL:

1. **`__AUTO__` placeholder**: Use this in `corsAllowedOrigins` to indicate that the CloudFront URL should be automatically injected
2. **No manual updates needed**: CDK passes the CloudFront domain to the S3 construct at deploy time
3. **Works across environments**: Each environment gets its own CloudFront URL automatically

**How it works:**
1. `StaticSiteConstruct` is created first → produces CloudFront distribution
2. CloudFront URL (e.g., `https://d1234abcd.cloudfront.net`) is extracted
3. This URL is passed to `S3Construct` via `additionalCorsOrigins` prop
4. S3 bucket is created with CloudFront URL in CORS configuration

**Adding custom domains**: If you have a custom domain for your frontend, add it alongside `__AUTO__`:

```typescript
corsAllowedOrigins: [
  "__AUTO__",  // CloudFront URL
  "https://app.arcforge.com",  // Custom domain
],
```

### S3 Bucket Settings by Environment

| Setting | Dev | QA | Prod |
|---------|-----|-----|------|
| Bucket Name | arcforge-files-dev | arcforge-files-qa | arcforge-files-prod |
| Versioning | No | Yes | Yes |
| Removal Policy | DESTROY | DESTROY | RETAIN |
| Block Public Access | Yes | Yes | Yes |
| Encryption | S3-Managed | S3-Managed | S3-Managed |
| CORS | localhost | QA domains | Prod domains |

### Scheduled Cleanup Lambda

**Location**: `cdk/lib/constructs/core/scheduled-lambda-construct.ts`

The cleanup Lambda is automatically scheduled via CloudWatch Events (EventBridge):

```typescript
{
  name: "fileCleanup",
  handler: "dist/lambdas/fileCleanup.lambda.handler",
  description: "Cleanup orphaned pending file uploads",
  scheduleExpression: "rate(6 hours)",  // Runs every 6 hours
  timeout: 300,  // 5 minutes
  memorySize: 256,
  environment: {
    FILE_CLEANUP_HOURS: "24",
    FILE_CLEANUP_DRY_RUN: "false",  // "true" in dev
  },
}
```

### Lambda Environment Variables (Auto-configured by CDK)

| Variable | Description |
|----------|-------------|
| `S3_BUCKET_NAME` | Automatically set from S3 construct |
| `FILE_CLEANUP_HOURS` | Hours after which pending files are deleted |
| `FILE_CLEANUP_DRY_RUN` | Set to "true" in dev to test without deleting |

### CDK Deployment

```bash
# Deploy to QA
cd cdk
npm run cdk deploy -- --context env=qa

# Deploy to Production
npm run cdk deploy -- --context env=prod
```

### CDK Files Overview

| File | Description |
|------|-------------|
| `cdk/config/s3.config.ts` | S3 bucket configuration per environment |
| `cdk/lib/constructs/storage/s3-construct.ts` | S3 bucket creation with CORS |
| `cdk/lib/constructs/core/scheduled-lambda-construct.ts` | Scheduled Lambda creation |
| `cdk/lib/stacks/api-stack.ts` | Main stack that ties everything together |

### IAM Permissions

The CDK automatically grants these permissions to all Lambda functions:

**S3 Permissions** (via `S3Construct`):
```
s3:GetObject
s3:PutObject
s3:DeleteObject
s3:GetObjectVersion
s3:GetObjectTagging
s3:PutObjectTagging
s3:ListBucket
s3:GetBucketLocation
```

**Secrets Manager Permissions** (for DB and JWT secrets):
```
secretsmanager:GetSecretValue
```

---

## Cleanup Job

The `fileCleanup.lambda.ts` runs periodically to delete orphaned files:

- Finds pending files older than 24 hours (configurable)
- Deletes files from S3
- Removes database records

### Manual Cleanup

You can also trigger cleanup via the API:

```bash
curl -X POST http://localhost:4000/api/files/cleanup \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"olderThanHours": 24, "dryRun": true}'
```

Set `dryRun: true` to see what would be deleted without actually deleting.

---

## Troubleshooting

### Common Issues

1. **"Access Denied" when uploading to S3**
   - Check S3 bucket CORS configuration
   - Verify presigned URL hasn't expired
   - Ensure file size matches what was specified

2. **Files not appearing after upload**
   - Verify the `confirmFiles` API was called
   - Check if files are still in "pending" status
   - Ensure correct entityType and entityId

3. **Download URL not working**
   - Presigned download URLs expire (default 1 hour)
   - Generate a new download URL

4. **Cleanup job not running**
   - Check CloudWatch Events/EventBridge schedule
   - Verify FILE_CLEANUP_HOURS environment variable
   - Check Lambda logs for errors

### Debug Tips

1. Check file status in database:
   ```sql
   SELECT * FROM file_uploads WHERE entity_type = 'dispatch' AND entity_id = 'D001';
   ```

2. Check S3 for files:
   ```bash
   aws s3 ls s3://arcforge-files-dev/uploads/OSG-00000001/
   ```

3. Test presigned URL generation:
   ```bash
   curl -X POST http://localhost:4000/api/files/presigned-urls \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer $TOKEN" \
     -d '{"files": [{"originalFileName": "test.pdf", "mimeType": "application/pdf", "fileSize": 1024}]}'
   ```

---

## S3 Path Structure

Files are organized in S3 as follows:

```
{bucket}/
└── uploads/
    └── {poId}/
        └── {entityType}/
            └── {entityId}/
                └── {uuid}_{originalFileName}
```

Example:
```
arcforge-files-dev/
└── uploads/
    └── OSG-00000001/
        └── dispatch/
            └── D001/
                └── a1b2c3d4-e5f6-7890_invoice.pdf
                └── b2c3d4e5-f6a7-8901_eway_bill.pdf
        └── delivery/
            └── D001/
                └── c3d4e5f6-a7b8-9012_proof_of_delivery.jpg
```

---

## Permissions

Add these permission codes to your system:

| Permission Code | Description |
|-----------------|-------------|
| `file_upload` | Upload files |
| `file_download` | Download files |
| `file_delete` | Delete files |
| `file_cleanup_admin` | Run cleanup job |

---

## Best Practices

1. **Always confirm files**: Call `confirmFiles` after successful form submission
2. **Handle upload errors**: Show user-friendly error messages
3. **Show progress**: Use the progress callback for better UX
4. **Validate file types**: Client-side and server-side validation
5. **Set appropriate limits**: Configure maxFiles and maxSizeMB based on use case
6. **Use lazy queries**: Use `useLazyGetDownloadUrlQuery` for on-demand downloads

---

## Migration Notes

If migrating from local file storage to S3:

1. Run database migration to add FileUpload table
2. Deploy backend changes
3. Configure S3 bucket and CORS
4. Update environment variables
5. Replace FileUpload component with S3FileUpload
6. Add FilePreview where files are displayed
7. Test upload/download flow

---

## Related Documentation

- [RTK Query Guide](./RTK_QUERY_GUIDE.md)
- [Authorization Implementation](./AUTHORIZATION_IMPLEMENTATION.md)
- [Local Development](./LOCAL_DEVELOPMENT.md)

