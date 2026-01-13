import { S3Client, DeleteObjectCommand, DeleteObjectsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

// Initialize S3 client for R2
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

// Bucket names
const MODELS_BUCKET = 'trans-image-directory';
const STORIES_BUCKET = 'stories';

/**
 * Extract the key (path) from a full URL or path
 * Handles both full URLs and relative paths
 */
export function extractKeyFromUrl(url: string, bucket: 'models' | 'stories'): string {
  if (!url) return '';
  
  // If it's already just a path (e.g., "valentina-aguirre/photo1.webp")
  if (!url.startsWith('http')) {
    return url;
  }
  
  // Extract path from full URL
  // e.g., "https://pub-xxx.r2.dev/valentina-aguirre/photo1.webp" -> "valentina-aguirre/photo1.webp"
  try {
    const urlObj = new URL(url);
    // Remove leading slash
    return urlObj.pathname.startsWith('/') ? urlObj.pathname.slice(1) : urlObj.pathname;
  } catch {
    // If URL parsing fails, return as-is
    return url;
  }
}

/**
 * Delete a single file from R2
 */
export async function deleteFromR2(
  key: string, 
  bucket: 'models' | 'stories'
): Promise<{ success: boolean; error?: string }> {
  if (!key) {
    return { success: true }; // Nothing to delete
  }
  
  const client = getR2Client();
  const bucketName = bucket === 'models' ? MODELS_BUCKET : STORIES_BUCKET;
  
  try {
    await client.send(new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    }));
    
    console.log(`[R2] Deleted: ${bucketName}/${key}`);
    return { success: true };
  } catch (error) {
    console.error(`[R2] Delete failed: ${bucketName}/${key}`, error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Delete multiple files from R2 (batch delete)
 * More efficient than individual deletes
 */
export async function deleteMultipleFromR2(
  keys: string[], 
  bucket: 'models' | 'stories'
): Promise<{ success: boolean; deleted: number; failed: string[] }> {
  if (!keys || keys.length === 0) {
    return { success: true, deleted: 0, failed: [] };
  }
  
  // Filter out empty keys
  const validKeys = keys.filter(k => k && k.trim() !== '');
  if (validKeys.length === 0) {
    return { success: true, deleted: 0, failed: [] };
  }
  
  const client = getR2Client();
  const bucketName = bucket === 'models' ? MODELS_BUCKET : STORIES_BUCKET;
  
  console.log(`[R2] Attempting to delete ${validKeys.length} files from bucket: ${bucketName}`);
  console.log(`[R2] Keys to delete:`, validKeys);
  
  try {
    // R2/S3 supports batch delete of up to 1000 objects at a time
    const result = await client.send(new DeleteObjectsCommand({
      Bucket: bucketName,
      Delete: {
        Objects: validKeys.map(key => ({ Key: key })),
        Quiet: false, // Return info about deleted objects
      },
    }));
    
    const deleted = result.Deleted?.length || 0;
    const failed = result.Errors?.map(e => ({ key: e.Key || 'unknown', code: e.Code, message: e.Message })) || [];
    
    console.log(`[R2] Batch delete result: ${deleted} deleted, ${failed.length} failed in ${bucketName}`);
    if (failed.length > 0) {
      console.error(`[R2] Failed deletions:`, failed);
    }
    
    return {
      success: failed.length === 0,
      deleted,
      failed: failed.map(f => f.key),
    };
  } catch (error) {
    console.error(`[R2] Batch delete failed in ${bucketName}:`, error);
    if (error instanceof Error) {
      console.error(`[R2] Error message:`, error.message);
      console.error(`[R2] Error stack:`, error.stack);
    }
    return {
      success: false,
      deleted: 0,
      failed: validKeys,
    };
  }
}

/**
 * Delete all files for a model (entire folder)
 * Used when deleting a model completely
 */
export async function deleteModelFolder(modelSlug: string): Promise<{
  success: boolean;
  deletedFromModels: number;
  deletedFromStories: number;
  errors: string[];
}> {
  const client = getR2Client();
  const errors: string[] = [];
  let deletedFromModels = 0;
  let deletedFromStories = 0;
  
  // Delete from models bucket (gallery images)
  try {
    // List all objects with the model slug prefix
    const listResult = await client.send(new ListObjectsV2Command({
      Bucket: MODELS_BUCKET,
      Prefix: `${modelSlug}/`,
    }));
    
    if (listResult.Contents && listResult.Contents.length > 0) {
      const keys = listResult.Contents.map(obj => obj.Key!).filter(Boolean);
      const deleteResult = await deleteMultipleFromR2(keys, 'models');
      deletedFromModels = deleteResult.deleted;
      if (!deleteResult.success) {
        errors.push(...deleteResult.failed.map(k => `models/${k}`));
      }
    }
  } catch (error) {
    errors.push(`Failed to delete from models bucket: ${error}`);
  }
  
  // Delete from stories bucket
  try {
    const listResult = await client.send(new ListObjectsV2Command({
      Bucket: STORIES_BUCKET,
      Prefix: `${modelSlug}/`,
    }));
    
    if (listResult.Contents && listResult.Contents.length > 0) {
      const keys = listResult.Contents.map(obj => obj.Key!).filter(Boolean);
      const deleteResult = await deleteMultipleFromR2(keys, 'stories');
      deletedFromStories = deleteResult.deleted;
      if (!deleteResult.success) {
        errors.push(...deleteResult.failed.map(k => `stories/${k}`));
      }
    }
  } catch (error) {
    errors.push(`Failed to delete from stories bucket: ${error}`);
  }
  
  return {
    success: errors.length === 0,
    deletedFromModels,
    deletedFromStories,
    errors,
  };
}

/**
 * Helper to get all media URLs from a story (including WebM variants)
 */
export function getStoryMediaKeys(story: {
  media_url: string;
  media_type: string;
  poster_url?: string | null;
}): string[] {
  const keys: string[] = [];
  
  if (story.media_url) {
    keys.push(extractKeyFromUrl(story.media_url, 'stories'));
    
    // If video, also delete WebM variant
    if (story.media_type === 'video' && story.media_url.endsWith('.mp4')) {
      keys.push(extractKeyFromUrl(story.media_url.replace('.mp4', '.webm'), 'stories'));
    }
  }
  
  if (story.poster_url) {
    keys.push(extractKeyFromUrl(story.poster_url, 'stories'));
  }
  
  return keys.filter(k => k && k.trim() !== '');
}

/**
 * Determine which bucket a URL belongs to based on domain or path
 */
function detectBucketFromUrl(url: string): 'models' | 'stories' {
  if (!url) return 'models'; // Default to models
  
  // Check if URL contains stories domain
  if (url.includes(process.env.NEXT_PUBLIC_R2_STORIES_DOMAIN || '')) {
    return 'stories';
  }
  
  // Check if path starts with "stories/" or "gallery/" (old pattern)
  const key = extractKeyFromUrl(url, 'models');
  if (key.startsWith('stories/') || key.startsWith('gallery/')) {
    return 'stories';
  }
  
  // Default to models bucket
  return 'models';
}

/**
 * Helper to get all media URLs from a gallery item (including WebM variants)
 * Returns keys with bucket information
 */
export function getGalleryItemMediaKeys(item: {
  media_url: string;
  media_type: string;
  poster_url?: string | null;
}): Array<{ key: string; bucket: 'models' | 'stories' }> {
  const keys: Array<{ key: string; bucket: 'models' | 'stories' }> = [];
  
  if (item.media_url) {
    const bucket = detectBucketFromUrl(item.media_url);
    const key = extractKeyFromUrl(item.media_url, bucket);
    if (key) {
      keys.push({ key, bucket });
      
      // If video, also delete WebM variant
      if (item.media_type === 'video' && item.media_url.endsWith('.mp4')) {
        const webmKey = key.replace('.mp4', '.webm');
        keys.push({ key: webmKey, bucket });
      }
    }
  }
  
  if (item.poster_url) {
    const bucket = detectBucketFromUrl(item.poster_url);
    const key = extractKeyFromUrl(item.poster_url, bucket);
    if (key) {
      keys.push({ key, bucket });
    }
  }
  
  return keys.filter(k => k.key && k.key.trim() !== '');
}
