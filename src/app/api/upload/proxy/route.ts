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
    let uniqueFilename: string;
    if (targetBucket === 'models' || targetBucket === 'trans-image-directory') {
      uniqueFilename = filename;
    } else {
      uniqueFilename = `stories/${Date.now()}-${filename}`;
    }

    // Determine bucket name
    let bucketName: string;
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
    await s3Client.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: uniqueFilename,
      Body: uint8Array,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    }));

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
    console.error("Proxy upload error:", error);
    
    // Provide detailed error information for debugging
    const errorMessage = error instanceof Error 
      ? error.message 
      : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error("Error details:", {
      message: errorMessage,
      stack: errorStack,
      bucketName,
      uniqueFilename,
    });
    
    return NextResponse.json(
      { 
        success: false,
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? errorStack : undefined
      },
      { status: 500 }
    );
  }
}
