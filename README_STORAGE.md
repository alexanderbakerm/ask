# File Storage System

This template uses **S3-compatible storage** (Cloudflare R2 recommended) for file uploads like user avatars and organization logos. Files are uploaded directly to storage using presigned URLs, with a storage service for secure access.

---

## Quick Setup

### 1. Create Cloudflare R2 Bucket

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → R2 Object Storage
2. Create a bucket (e.g., `my-app-images`)
3. Create an R2 API token:
   - Manage R2 API Tokens → Create API Token
   - Permissions: Object Read & Write
   - Specify bucket: select your bucket

### 2. Configure Environment Variables

```bash
# .env
S3_ACCESS_KEY_ID="your-r2-access-key-id"
S3_SECRET_ACCESS_KEY="your-r2-secret-access-key"
S3_ENDPOINT="https://<ACCOUNT_ID>.r2.cloudflarestorage.com"
S3_REGION="auto"
NEXT_PUBLIC_IMAGES_BUCKET_NAME="my-app-images"
```

### 3. Configure CORS

In the R2 bucket settings, add CORS rules:

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://yourdomain.com"],
    "AllowedMethods": ["GET", "PUT", "DELETE"],
    "AllowedHeaders": ["*"]
  }
]
```

That's it! File uploads are now enabled.

---

## How It Works

### Upload Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    Client    │     │    tRPC      │     │   Storage    │     │    R2/S3     │
│  Component   │────▶│   Router     │────▶│   Service    │────▶│   Bucket     │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
       │                                                               ▲
       │                                                               │
       └──────────────── Direct PUT with signed URL ───────────────────┘
```

1. **User selects file** → File picker with drag-and-drop
2. **Image cropping** → Square crop at 256x256 max
3. **Request signed URL** → tRPC mutation returns presigned upload URL
4. **Direct upload** → File goes directly to S3 (not through server)
5. **Save path** → Database stores path, not full URL
6. **Display** → Storage generates signed download URLs

### Download Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Browser    │────▶│ Storage Route│────▶│   Storage    │────▶│    R2/S3     │
│              │     │   /storage   │     │   Service    │     │   Bucket     │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
       │                                                               │
       │◀────────────── Redirect to signed URL ────────────────────────┘
```

---

## Storage Service

### Get Upload URL

```typescript
import { getSignedUploadUrl } from "@/lib/storage";
import { storageConfig } from "@/config/storage.config";

const signedUrl = await getSignedUploadUrl(
  "user123-abc.png", // path
  storageConfig.bucketNames.images // bucket
);
// Returns URL valid for 60 seconds
```

### Get Download URL

```typescript
import { getSignedUrl } from "@/lib/storage";

const signedUrl = await getSignedUrl(
  "user123-abc.png", // path
  storageConfig.bucketNames.images, // bucket
  60 * 60 // expires in 1 hour
);
```

---

## Using the Storage Service

The /storage route converts storage paths to accessible URLs.

### Hook Usage

```typescript
import { useStorage } from "@/hooks/use-storage";

function MyComponent({ imagePath }) {
  // Converts "user123-abc.png" to "/storage/my-bucket/user123-abc.png"
  const imageUrl = useStorage(imagePath);

  // With fallback
  const imageUrl = useStorage(imagePath, "/default-avatar.png");

  return <img src={imageUrl} alt="..." />;
}
```

### Behavior

| Input                           | Output                              |
| ------------------------------- | ----------------------------------- |
| `null` or `undefined`           | Returns fallback (or undefined)     |
| `"user123-abc.png"`             | `/storage/{bucket}/user123-abc.png` |
| `"https://example.com/img.png"` | Returns as-is (external URL)        |

### Proxy Route

The proxy at `/storage/{bucket}/{path}`:

1. Validates the bucket name
2. Generates a signed URL (1 hour expiry)
3. Redirects to the signed URL
4. Caches for 1 hour

---

## Upload Components

### User Avatar

```tsx
import { UserAvatarUpload } from "@/components/user/user-avatar-upload";

<UserAvatarUpload />;
```

Features:

- Drag-and-drop or click to upload
- Image cropping (square, 256x256 max)
- PNG and JPEG support
- Loading state
- Automatic session reload after upload

### Organization Logo

```tsx
import { OrganizationLogoCard } from "@/components/organization/organization-logo-card";

<OrganizationLogoCard />;
```

Features:

- Same as user avatar
- Updates organization via Better Auth
- Invalidates organization queries after upload

### Display Components

```tsx
import { UserAvatar } from "@/components/user/user-avatar";
import { OrganizationLogo } from "@/components/organization/organization-logo";

// User avatar (circular)
<UserAvatar name="John Doe" src={user.image} />

// Organization logo (rounded corners)
<OrganizationLogo name="Acme Inc" src={organization.logo} />
```

---

## tRPC Endpoint

### Get Signed Upload URL

```typescript
// Request
const { signedUrl } = await trpc.uploads.signedUploadUrl.mutate({
  bucket: "my-app-images",
  path: "user123-abc.png",
});

// Upload file directly
await fetch(signedUrl, {
  method: "PUT",
  body: file,
  headers: { "Content-Type": "image/jpeg" },
});
```

The endpoint:

- Requires authentication
- Validates bucket against whitelist
- Returns 403 for unauthorized buckets

---

## Database Storage

**Important**: Store paths, not full URLs.

```typescript
// Good - store path only
await db
  .update(userTable)
  .set({ image: "user123-abc.png" })
  .where(eq(userTable.id, userId));

// Bad - don't store full URLs
await db
  .update(userTable)
  .set({ image: "https://storage.example.com/bucket/user123-abc.png" })
  .where(eq(userTable.id, userId));
```

The `useStorage` hook converts paths to URLs at runtime.

---

## Path Conventions

| Entity      | Path Format           | Example                    |
| ----------- | --------------------- | -------------------------- |
| User Avatar | `{userId}-{uuid}.png` | `abc123-550e8400-e29b.png` |
| Org Logo    | `{orgId}-{uuid}.png`  | `org456-6ba7b810-9dad.png` |

Using UUIDs prevents:

- Filename collisions
- Cache issues on update
- Predictable URLs

---

## Security

### Path Validation

All paths are validated before use:

| Check             | Protection Against  |
| ----------------- | ------------------- |
| No `..`           | Path traversal      |
| No absolute paths | System file access  |
| No null bytes     | Validation bypass   |
| Alphanumeric only | Injection attacks   |
| No hidden files   | Accessing `.` files |

### Access Control

| Feature               | Implementation                        |
| --------------------- | ------------------------------------- |
| Upload authentication | `protectedProcedure` (requires login) |
| Bucket whitelist      | Only configured buckets allowed       |
| Signed URL expiry     | Upload: 60s, Download: 1 hour         |
| Direct upload         | Files don't pass through server       |
| No public access      | All access via signed URLs            |

---

## Alternative Providers

While Cloudflare R2 is recommended, any S3-compatible storage works:

### AWS S3

```bash
S3_ENDPOINT="https://s3.us-east-1.amazonaws.com"
S3_REGION="us-east-1"
S3_ACCESS_KEY_ID="AKIA..."
S3_SECRET_ACCESS_KEY="..."
NEXT_PUBLIC_IMAGES_BUCKET_NAME="my-bucket"
```

### MinIO (Self-hosted)

```bash
S3_ENDPOINT="https://minio.yourdomain.com"
S3_REGION="us-east-1"
S3_ACCESS_KEY_ID="minioadmin"
S3_SECRET_ACCESS_KEY="minioadmin"
NEXT_PUBLIC_IMAGES_BUCKET_NAME="images"
```

### DigitalOcean Spaces

```bash
S3_ENDPOINT="https://nyc3.digitaloceanspaces.com"
S3_REGION="nyc3"
S3_ACCESS_KEY_ID="..."
S3_SECRET_ACCESS_KEY="..."
NEXT_PUBLIC_IMAGES_BUCKET_NAME="my-space"
```

---

## Adding New Upload Types

### 1. Update Storage Config

```typescript
// config/storage.config.ts
export const storageConfig = {
  bucketNames: {
    images: env.NEXT_PUBLIC_IMAGES_BUCKET_NAME ?? "",
    documents: env.NEXT_PUBLIC_DOCUMENTS_BUCKET_NAME ?? "", // New
  },
};
```

### 2. Add Environment Variable

```bash
NEXT_PUBLIC_DOCUMENTS_BUCKET_NAME="my-app-documents"
```

### 3. Update tRPC Router

```typescript
// trpc/routers/storage/index.ts
signedUploadUrl: protectedProcedure
  .input(signedUploadUrlSchema)
  .mutation(async ({ input }) => {
    const allowedBuckets = [
      storageConfig.bucketNames.images,
      storageConfig.bucketNames.documents,  // Add new bucket
    ];

    if (allowedBuckets.includes(input.bucket)) {
      const signedUrl = await getSignedUploadUrl(
        input.path,
        input.bucket,
      );
      return { signedUrl };
    }
    throw new TRPCError({ code: "FORBIDDEN" });
  }),
```

### 4. Update Storage Route (if needed)

```typescript
// app/storage/[...path]/route.ts
const allowedBuckets = [
  storageConfig.bucketNames.images,
  storageConfig.bucketNames.documents,
];

if (allowedBuckets.includes(bucket)) {
  // ... generate signed URL
}
```

---

## Troubleshooting

### CORS Errors

**Error**: `Access to fetch blocked by CORS policy`

**Solution**: Add your domain to R2 CORS settings:

```json
{
  "AllowedOrigins": ["https://yourdomain.com"],
  "AllowedMethods": ["GET", "PUT"],
  "AllowedHeaders": ["*"]
}
```

### Upload Fails with 403

**Possible causes**:

1. Signed URL expired (valid for 60 seconds)
2. Wrong bucket name
3. Invalid R2 credentials

### Images Not Loading

**Check**:

1. Storage route is working (`/storage/{bucket}/{path}`)
2. Database stores path, not full URL
3. `useStorage` hook is being used

### "Missing S3 environment variables"

Ensure all required variables are set:

- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_ENDPOINT`
- `NEXT_PUBLIC_IMAGES_BUCKET_NAME`

---

## File Reference

| File                                                 | Purpose                    |
| ---------------------------------------------------- | -------------------------- |
| `config/storage.config.ts`                           | Bucket configuration       |
| `lib/storage/index.ts`                               | Service export             |
| `lib/storage/s3.ts`                                  | S3 client & URL generation |
| `app/storage/[...path]/route.ts`                     | Storage handler            |
| `hooks/use-storage.tsx`                              | Path to URL conversion     |
| `trpc/routers/storage/index.ts`                      | Upload API                 |
| `schemas/upload-schemas.ts`                          | Validation schemas         |
| `components/crop-image-modal.tsx`                    | Image cropper              |
| `components/user/user-avatar.tsx`                    | Avatar display             |
| `components/user/user-avatar-upload.tsx`             | Avatar upload              |
| `components/organization/organization-logo.tsx`      | Logo display               |
| `components/organization/organization-logo-card.tsx` | Logo upload                |

---

## Environment Variables

| Variable                         | Required | Description                |
| -------------------------------- | -------- | -------------------------- |
| `S3_ACCESS_KEY_ID`               | Yes      | S3/R2 access key           |
| `S3_SECRET_ACCESS_KEY`           | Yes      | S3/R2 secret key           |
| `S3_ENDPOINT`                    | Yes      | S3-compatible endpoint URL |
| `S3_REGION`                      | No       | Region (default: `auto`)   |
| `NEXT_PUBLIC_IMAGES_BUCKET_NAME` | Yes      | Bucket name for images     |
