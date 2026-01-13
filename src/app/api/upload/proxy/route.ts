import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";

export const runtime = "edge";

const ADMIN_KEY = process.env.ADMIN_KEY || "admin123";

// Initialize S3Client for Cloudflare R2
function getS3Client() {
  const endpoint = process.env.R2_ENDPOINT 
    || `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  
  return new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

// POST - Proxy upload to R2 (avoids CORS issues)
export async function POST(request: Request) {
  let bucketName: string | undefined;
  let uniqueFilename: string | undefined;
  
  try {
    // Security check
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (!key || key !== ADMIN_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const filename = formData.get("filename") as string;
    const contentType = formData.get("contentType") as string;
    const bucket = formData.get("bucket") as string;

    if (!file || !filename || !contentType) {
      return NextResponse.json(
        { error: "Missing required fields: file, filename, contentType" },
        { status: 400 }
      );
    }

    // Determine bucket and path
    const targetBucket = bucket || 'stories';
    if (targetBucket === 'models' || targetBucket === 'trans-image-directory') {
      uniqueFilename = filename;
    } else {
      uniqueFilename = `stories/${Date.now()}-${filename}`;
    }

    // Determine bucket name
    if (targetBucket === 'models' || targetBucket === 'trans-image-directory') {
      bucketName = process.env.R2_BUCKET_NAME || 'trans-image-directory';
    } else {
      bucketName = process.env.R2_STORIES_BUCKET_NAME || 'stories';
    }

    // Convert File to ArrayBuffer (Edge runtime compatible)
    const arrayBuffer = await file.arrayBuffer();
    // Use Uint8Array instead of Buffer for Edge runtime compatibility
    const uint8Array = new Uint8Array(arrayBuffer);

    // Upload directly to R2
    const s3Client = getS3Client();
    
    console.log("Attempting R2 upload:", {
      bucket: bucketName,
      key: uniqueFilename,
      contentType,
      fileSize: uint8Array.length,
      hasCredentials: !!process.env.R2_ACCESS_KEY_ID,
    });
    
    try {
      await s3Client.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: uniqueFilename,
        Body: uint8Array,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }));
      console.log("R2 upload successful:", { bucket: bucketName, key: uniqueFilename });
    } catch (r2Error) {
      console.error("R2 upload failed:", r2Error);
      // Re-throw with more context
      throw new Error(
        `R2 upload failed: ${r2Error instanceof Error ? r2Error.message : String(r2Error)}`
      );
    }

    // Construct public URL
    const publicDomain = (targetBucket === 'models' || targetBucket === 'trans-image-directory')
      ? process.env.NEXT_PUBLIC_R2_DOMAIN || process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "pub-7a8adad1ccfc4f0db171158b6cf5c030.r2.dev"
      : process.env.NEXT_PUBLIC_R2_STORIES_DOMAIN || process.env.NEXT_PUBLIC_R2_DOMAIN || "pub-7a8adad1ccfc4f0db171158b6cf5c030.r2.dev";
    
    const publicUrl = publicDomain.startsWith("http")
      ? `${publicDomain}/${uniqueFilename}`
      : `https://${publicDomain}/${uniqueFilename}`;

    return NextResponse.json({
      success: true,
      key: uniqueFilename,
      publicUrl,
    });
  } catch (error) {
    // Extract error message safely (avoid DOMParser issues from AWS SDK)
    let errorMessage = "Internal Server Error";
    let errorCode: string | undefined;
    
    if (error instanceof Error) {
      errorMessage = error.message || "Internal Server Error";
      // Check if it's an AWS SDK error
      if ('$metadata' in error || 'Code' in error || 'name' in error) {
        // AWS SDK error - extract safe information
        const awsError = error as any;
        errorCode = awsError.Code || awsError.name || undefined;
        errorMessage = awsError.message || awsError.Message || errorMessage;
        
        // Log AWS-specific error details
        console.error("AWS SDK error:", {
          code: errorCode,
          message: errorMessage,
          bucket: bucketName,
          key: uniqueFilename,
        });
      } else {
        console.error("General error:", errorMessage);
      }
    } else {
      errorMessage = String(error);
      console.error("Unknown error type:", error);
    }
    
    return NextResponse.json(
      { 
        success: false,
        error: errorMessage,
        ...(errorCode && { code: errorCode }),
      },
      { status: 500 }
    );
  }
}
