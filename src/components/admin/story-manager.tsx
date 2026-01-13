'use client';

import { useState, useEffect } from 'react';
import { 
  Film, 
  Image as ImageIcon, 
  Plus, 
  Trash2, 
  Upload,
  Loader2,
  Pin,
  Clock
} from 'lucide-react';
import Image from 'next/image';
import { cn, getImageUrl } from '@/lib/utils';
import type { StoryGroupAdmin } from '@/types/admin';

interface StoryManagerProps {
  adminKey: string;
  modelId: string;
  modelSlug: string;
  storyGroups: StoryGroupAdmin[];
  onUpdate: () => void;
}

export function StoryManager({ 
  adminKey, 
  modelId, 
  modelSlug, 
  storyGroups: initialGroups,
  onUpdate 
}: StoryManagerProps) {
  const [groups, setGroups] = useState<StoryGroupAdmin[]>(initialGroups);

  // Sync state when props update
  useEffect(() => {
    setGroups(initialGroups);
  }, [initialGroups]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [mediaMode, setMediaMode] = useState<'image' | 'video'>('image');

  // Separate pinned and recent groups
  const pinnedGroups = groups.filter(g => g.is_pinned);
  const recentGroups = groups.filter(g => !g.is_pinned);

  const uploadFile = async (file: File, filename: string): Promise<string> => {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const contentType = mediaMode === 'video' 
      ? (ext === 'webm' ? 'video/webm' : 'video/mp4')
      : (file.type || 'image/webp');

    setUploadProgress(`Getting upload URL for ${file.name}...`);
    const presignRes = await fetch(`/api/upload?key=${adminKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename,
        contentType,
      }),
    });

    if (!presignRes.ok) {
      throw new Error('Failed to get upload URL');
    }

    const { uploadUrl, key } = await presignRes.json();

    setUploadProgress(`Uploading ${file.name}...`);
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });

    if (!uploadRes.ok) {
      throw new Error('Failed to upload file');
    }

    return key;
  };

  const handleUpload = async (files: FileList | null, isPinned: boolean = false) => {
    if (!files || files.length === 0) return;
    
    setUploading(true);
    setUploadProgress('Starting upload...');
    
    try {
      const timestamp = Date.now();
      const file = files[0];
      const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9-_]/g, "-");
      
      let mediaUrl: string;
      let coverUrl: string;
      let mediaType: 'image' | 'video';
      let duration: number;

      if (mediaMode === 'video') {
        // For video, we'd need MP4, WebM, and poster
        // For now, simplified - just upload the main file
        const filename = `stories/${timestamp}-${cleanName}.mp4`;
        mediaUrl = await uploadFile(file, filename);
        coverUrl = mediaUrl; // Placeholder - would need separate poster upload
        mediaType = 'video';
        duration = 15;
      } else {
        const ext = file.name.split('.').pop()?.toLowerCase() || 'webp';
        const filename = `stories/${timestamp}-${cleanName}.${ext}`;
        mediaUrl = await uploadFile(file, filename);
        coverUrl = mediaUrl;
        mediaType = 'image';
        duration = 5;
      }

      setUploadProgress('Creating story...');
      const res = await fetch(`/api/admin/stories?key=${adminKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model_id: modelId,
          is_pinned: isPinned,
          title: isPinned ? 'Pinned' : null,
          media_url: mediaUrl,
          cover_url: coverUrl,
          media_type: mediaType,
          duration: duration,
        }),
      });

      const json = await res.json();
      if (json.success) {
        onUpdate();
        setUploadProgress('');
      } else {
        alert('Failed to create story: ' + json.error);
      }
    } catch (err) {
      console.error('Upload error:', err);
      alert('Upload failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setUploading(false);
      setUploadProgress('');
    }
  };

  const deleteStory = async (storyId: string, groupId: string) => {
    if (!confirm('Delete this story?')) return;
    
    try {
      const res = await fetch(`/api/admin/stories/${storyId}?key=${adminKey}`, {
        method: 'DELETE',
      });
      
      const json = await res.json();
      if (json.success) {
        setGroups(groups.map(g => 
          g.id === groupId 
            ? { ...g, stories: g.stories.filter(s => s.id !== storyId) }
            : g
        ));
        onUpdate();
      } else {
        alert('Failed to delete: ' + json.error);
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const deleteGroup = async (groupId: string) => {
    if (!confirm('Delete this story group and all its stories?')) return;
    
    try {
      const res = await fetch(`/api/admin/story-groups/${groupId}?key=${adminKey}`, {
        method: 'DELETE',
      });
      
      const json = await res.json();
      if (json.success) {
        setGroups(groups.filter(g => g.id !== groupId));
        onUpdate();
      } else {
        alert('Failed to delete: ' + json.error);
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Film className="w-5 h-5" />
            Stories ({groups.reduce((acc, g) => acc + (g.stories?.length || 0), 0)})
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Manage recent and pinned story groups
          </p>
        </div>
        
        <div className="flex gap-2">
          <select
            value={mediaMode}
            onChange={(e) => setMediaMode(e.target.value as 'image' | 'video')}
            className="px-3 py-2 bg-background border border-white/10 rounded-lg text-white text-sm"
          >
            <option value="image">Image</option>
            <option value="video">Video</option>
          </select>
          
          <label className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white cursor-pointer hover:bg-white/10 transition-colors">
            {mediaMode === 'image' ? <ImageIcon className="w-4 h-4" /> : <Film className="w-4 h-4" />}
            <span className="text-sm">Add to Recent</span>
            <input
              type="file"
              accept={mediaMode === 'image' ? 'image/*' : 'video/*'}
              className="hidden"
              onChange={(e) => handleUpload(e.target.files, false)}
              disabled={uploading}
            />
          </label>
        </div>
      </div>

      {/* Pinned Groups */}
      {pinnedGroups.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-white flex items-center gap-2">
            <Pin className="w-4 h-4 text-[#D4AF37]" />
            Pinned Blocks
          </h4>
          {pinnedGroups.map((group) => (
            <div
              key={group.id}
              className="bg-background border border-white/10 rounded-xl p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h5 className="font-medium text-white">{group.title || 'Pinned'}</h5>
                  <span className="text-xs text-muted-foreground">
                    ({group.stories?.length || 0} stories)
                  </span>
                </div>
                <button
                  onClick={() => deleteGroup(group.id)}
                  className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              
              {group.stories && group.stories.length > 0 ? (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {group.stories.map((story) => (
                    <div
                      key={story.id}
                      className="relative w-16 h-20 rounded-lg overflow-hidden bg-white/5 flex-shrink-0 group"
                    >
                      {story.media_type === 'video' ? (
                        <video
                          src={getImageUrl(story.media_url)}
                          poster={story.poster_url ? getImageUrl(story.poster_url) : undefined}
                          className="absolute inset-0 w-full h-full object-cover"
                          muted
                          playsInline
                        />
                      ) : (
                        <Image
                          src={getImageUrl(story.media_url)}
                          alt="Story"
                          fill
                          className="object-cover"
                          sizes="64px"
                          unoptimized
                        />
                      )}
                      
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                          onClick={() => deleteStory(story.id, group.id)}
                          className="p-1 bg-red-500 rounded text-white"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      
                      {story.media_type === 'video' && (
                        <Film className="absolute top-1 right-1 w-3 h-3 text-white" />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No stories in this pinned block
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Recent Stories */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-white flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Recent Stories
        </h4>
        
        {recentGroups.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-white/10 rounded-xl">
            <Film className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No recent stories yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Upload stories to get started
            </p>
          </div>
        ) : (
          recentGroups.map((group) => (
            <div
              key={group.id}
              className="bg-background border border-white/10 rounded-xl p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h5 className="font-medium text-white">Recent Stories</h5>
                  <span className="text-xs text-muted-foreground">
                    ({group.stories?.length || 0} stories)
                  </span>
                </div>
                <button
                  onClick={() => deleteGroup(group.id)}
                  className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              
              {group.stories && group.stories.length > 0 ? (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {group.stories.map((story) => (
                    <div
                      key={story.id}
                      className="relative w-16 h-20 rounded-lg overflow-hidden bg-white/5 flex-shrink-0 group"
                    >
                      {story.media_type === 'video' ? (
                        <video
                          src={getImageUrl(story.media_url)}
                          poster={story.poster_url ? getImageUrl(story.poster_url) : undefined}
                          className="absolute inset-0 w-full h-full object-cover"
                          muted
                          playsInline
                        />
                      ) : (
                        <Image
                          src={getImageUrl(story.media_url)}
                          alt="Story"
                          fill
                          className="object-cover"
                          sizes="64px"
                          unoptimized
                        />
                      )}
                      
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                          onClick={() => deleteStory(story.id, group.id)}
                          className="p-1 bg-red-500 rounded text-white"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      
                      {story.media_type === 'video' && (
                        <Film className="absolute top-1 right-1 w-3 h-3 text-white" />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No stories yet
                </p>
              )}
            </div>
          ))
        )}
      </div>

      {/* Upload indicator */}
      {uploading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-white/10 p-6 rounded-xl text-center min-w-[300px]">
            <Loader2 className="w-8 h-8 animate-spin text-[#7A27FF] mx-auto mb-2" />
            <p className="text-white font-medium mb-1">Uploading...</p>
            {uploadProgress && (
              <p className="text-sm text-muted-foreground">{uploadProgress}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
