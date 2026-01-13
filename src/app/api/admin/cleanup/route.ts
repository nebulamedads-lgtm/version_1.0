import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { extractKeyFromUrl } from '@/lib/r2-utils';

export const runtime = 'edge';

function getR2Client() {
  // Support both R2_ENDPOINT (full URL) and R2_ACCOUNT_ID (construct URL)
  const endpoint = process.env.R2_ENDPOINT 
    || `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  
  return new S3Client({
    region: 'auto',
    endpoint,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

// Shared function to analyze orphaned files
async function analyzeOrphanedFiles() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  const client = getR2Client();
  
  // Get all known keys from Supabase (normalized to R2 keys)
  const knownKeys = new Set<string>();
  
  // Models profile images
  const { data: models } = await supabase.from('models').select('image_url, slug');
  models?.forEach(m => {
    if (m.image_url) {
      const key = extractKeyFromUrl(m.image_url, 'models');
      if (key) knownKeys.add(key);
    }
  });
  
  // Gallery items
  const { data: galleryItems } = await supabase.from('gallery_items').select('media_url, poster_url, media_type');
  galleryItems?.forEach(item => {
    if (item.media_url) {
      const key = extractKeyFromUrl(item.media_url, 'models');
      if (key) {
        knownKeys.add(key);
        // Add WebM variant for videos
        if (item.media_type === 'video' && item.media_url.endsWith('.mp4')) {
          knownKeys.add(key.replace('.mp4', '.webm'));
        }
      }
    }
    if (item.poster_url) {
      const key = extractKeyFromUrl(item.poster_url, 'models');
      if (key) knownKeys.add(key);
    }
  });
  
  // Story groups
  const { data: storyGroups } = await supabase.from('story_groups').select('cover_url');
  storyGroups?.forEach(g => {
    if (g.cover_url) {
      const key = extractKeyFromUrl(g.cover_url, 'stories');
      if (key) knownKeys.add(key);
    }
  });
  
  // Stories
  const { data: stories } = await supabase.from('stories').select('media_url, poster_url, media_type');
  stories?.forEach(story => {
    if (story.media_url) {
      const key = extractKeyFromUrl(story.media_url, 'stories');
      if (key) {
        knownKeys.add(key);
        // Add WebM variant for videos
        if (story.media_type === 'video' && story.media_url.endsWith('.mp4')) {
          knownKeys.add(key.replace('.mp4', '.webm'));
        }
      }
    }
    if (story.poster_url) {
      const key = extractKeyFromUrl(story.poster_url, 'stories');
      if (key) knownKeys.add(key);
    }
  });

  // List all files in R2 buckets
  const orphanedFiles: { bucket: string; key: string; size: number }[] = [];
  
  // Check models bucket
  let modelsContinuationToken: string | undefined;
  do {
    const modelsResult = await client.send(new ListObjectsV2Command({
      Bucket: 'trans-image-directory',
      ContinuationToken: modelsContinuationToken,
    }));
    
    modelsResult.Contents?.forEach(obj => {
      if (obj.Key && !knownKeys.has(obj.Key)) {
        orphanedFiles.push({
          bucket: 'trans-image-directory',
          key: obj.Key,
          size: obj.Size || 0,
        });
      }
    });
    
    modelsContinuationToken = modelsResult.NextContinuationToken;
  } while (modelsContinuationToken);
  
  // Check stories bucket
  let storiesContinuationToken: string | undefined;
  do {
    const storiesResult = await client.send(new ListObjectsV2Command({
      Bucket: 'stories',
      ContinuationToken: storiesContinuationToken,
    }));
    
    storiesResult.Contents?.forEach(obj => {
      if (obj.Key && !knownKeys.has(obj.Key)) {
        orphanedFiles.push({
          bucket: 'stories',
          key: obj.Key,
          size: obj.Size || 0,
        });
      }
    });
    
    storiesContinuationToken = storiesResult.NextContinuationToken;
  } while (storiesContinuationToken);

  const totalOrphanedSize = orphanedFiles.reduce((acc, f) => acc + f.size, 0);

  return {
    knownKeysCount: knownKeys.size,
    orphanedFiles,
    totalOrphanedSize,
  };
}

// GET - Analyze orphaned files
export async function GET(request: Request) {
  const url = new URL(request.url);
  const adminKey = url.searchParams.get('key');
  
  const ADMIN_KEY = process.env.ADMIN_KEY || 'admin123';
  if (adminKey !== ADMIN_KEY) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const analysis = await analyzeOrphanedFiles();

  return NextResponse.json({
    success: true,
    analysis: {
      knownKeysCount: analysis.knownKeysCount,
      orphanedFilesCount: analysis.orphanedFiles.length,
      orphanedTotalSizeBytes: analysis.totalOrphanedSize,
      orphanedTotalSizeMB: (analysis.totalOrphanedSize / 1024 / 1024).toFixed(2),
    },
    orphanedFiles: analysis.orphanedFiles.slice(0, 100), // Limit response size
    hasMore: analysis.orphanedFiles.length > 100,
  });
}

// POST - Delete orphaned files
export async function POST(request: Request) {
  const url = new URL(request.url);
  const adminKey = url.searchParams.get('key');
  const confirm = url.searchParams.get('confirm');
  
  const ADMIN_KEY = process.env.ADMIN_KEY || 'admin123';
  if (adminKey !== ADMIN_KEY) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  
  if (confirm !== 'true') {
    return NextResponse.json({ 
      success: false, 
      error: 'Add ?confirm=true to actually delete files' 
    }, { status: 400 });
  }

  // Run analysis to get all orphaned files
  const analysis = await analyzeOrphanedFiles();
  
  if (analysis.orphanedFiles.length === 0) {
    return NextResponse.json({
      success: true,
      deleted: 0,
      message: 'No orphaned files to delete',
    });
  }

  const client = getR2Client();
  let deletedCount = 0;
  const errors: string[] = [];

  // Group by bucket
  const modelsBucketKeys: string[] = [];
  const storiesBucketKeys: string[] = [];
  
  analysis.orphanedFiles.forEach(f => {
    if (f.bucket === 'trans-image-directory') {
      modelsBucketKeys.push(f.key);
    } else if (f.bucket === 'stories') {
      storiesBucketKeys.push(f.key);
    }
  });

  // Delete from models bucket (in batches of 1000)
  for (let i = 0; i < modelsBucketKeys.length; i += 1000) {
    const batch = modelsBucketKeys.slice(i, i + 1000);
    try {
      const result = await client.send(new DeleteObjectsCommand({
        Bucket: 'trans-image-directory',
        Delete: {
          Objects: batch.map((key: string) => ({ Key: key })),
        },
      }));
      deletedCount += result.Deleted?.length || 0;
    } catch (err) {
      errors.push(`Models bucket batch ${Math.floor(i / 1000) + 1}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Delete from stories bucket (in batches of 1000)
  for (let i = 0; i < storiesBucketKeys.length; i += 1000) {
    const batch = storiesBucketKeys.slice(i, i + 1000);
    try {
      const result = await client.send(new DeleteObjectsCommand({
        Bucket: 'stories',
        Delete: {
          Objects: batch.map((key: string) => ({ Key: key })),
        },
      }));
      deletedCount += result.Deleted?.length || 0;
    } catch (err) {
      errors.push(`Stories bucket batch ${Math.floor(i / 1000) + 1}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return NextResponse.json({
    success: errors.length === 0,
    deleted: deletedCount,
    errors: errors.length > 0 ? errors : undefined,
  });
}
