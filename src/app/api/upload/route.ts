import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";

export const runtime = "edge";

const ADMIN_KEY = process.env.ADMIN_KEY || "admin123";

// Initialize S3Client for Cloudflare R2
const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export async function POST(request: Request) {
  try {
    // Security check - validate admin key
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (!key || key !== ADMIN_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { filename, contentType, bucket } = body;

    if (!filename || !contentType) {
      return NextResponse.json(
        { error: "Missing required fields: filename and contentType" },
        { status: 400 }
      );
    }

    // Determine bucket and path based on bucket parameter or filename pattern
    // bucket can be: 'stories' | 'models' | undefined (defaults to 'stories' for backward compatibility)
    const targetBucket = bucket || 'stories';
    
    // Generate unique file path based on bucket
    let uniqueFilename: string;
    if (targetBucket === 'models' || targetBucket === 'trans-image-directory') {
      // For gallery items: use filename as-is (already includes model-slug/)
      uniqueFilename = filename;
    } else {
      // For stories: prefix with "stories/"
      uniqueFilename = `stories/${Date.now()}-${filename}`;
    }

    // Determine bucket name
    let bucketName: string;
    if (targetBucket === 'models' || targetBucket === 'trans-image-directory') {
      bucketName = process.env.R2_BUCKET_NAME || 'trans-image-directory';
    } else {
      bucketName = process.env.R2_STORIES_BUCKET_NAME || 'stories';
    }

    // Log for debugging (remove in production if needed)
    console.log("Upload bucket selection:", {
      path: uniqueFilename,
      targetBucket,
      R2_STORIES_BUCKET_NAME: process.env.R2_STORIES_BUCKET_NAME,
      R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
      selectedBucket: bucketName,
    });

    // Create the PutObject command
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: uniqueFilename,
      ContentType: contentType,
    });

    // Generate presigned URL (expires in 60 seconds)
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 60 });

    // Construct public URL using the appropriate domain based on bucket
    // Stories should use NEXT_PUBLIC_R2_STORIES_DOMAIN, models use NEXT_PUBLIC_R2_DOMAIN
    const publicDomain = (targetBucket === 'models' || targetBucket === 'trans-image-directory')
      ? process.env.NEXT_PUBLIC_R2_DOMAIN || process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "pub-7a8adad1ccfc4f0db171158b6cf5c030.r2.dev"
      : process.env.NEXT_PUBLIC_R2_STORIES_DOMAIN || process.env.NEXT_PUBLIC_R2_DOMAIN || "pub-7a8adad1ccfc4f0db171158b6cf5c030.r2.dev";
    
    // Ensure domain has https:// prefix if it doesn't already
    const publicUrl = publicDomain.startsWith("http")
      ? `${publicDomain}/${uniqueFilename}`
      : `https://${publicDomain}/${uniqueFilename}`;

    return NextResponse.json({
      uploadUrl,
      publicUrl,
      key: uniqueFilename,
    });
  } catch (error) {
    console.error("Upload presign error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
