'use client';

import { useState, useCallback } from 'react';
import { 
  GripVertical, 
  Trash2, 
  Plus, 
  Image as ImageIcon, 
  Film,
  Loader2,
  Save
} from 'lucide-react';
import Image from 'next/image';
import { cn, getImageUrl } from '@/lib/utils';
import type { GalleryItemAdmin } from '@/types/admin';

interface GalleryManagerProps {
  adminKey: string;
  modelId: string;
  modelSlug: string;
  initialItems: GalleryItemAdmin[];
  onUpdate: () => void;
}

export function GalleryManager({ 
  adminKey, 
  modelId, 
  modelSlug, 
  initialItems, 
  onUpdate 
}: GalleryManagerProps) {
  const [items, setItems] = useState<GalleryItemAdmin[]>(
    [...initialItems].sort((a, b) => a.sort_order - b.sort_order)
  );
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');

  const handleDragStart = (itemId: string) => {
    setDraggedItem(itemId);
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedItem || draggedItem === targetId) return;
    
    const draggedIndex = items.findIndex(i => i.id === draggedItem);
    const targetIndex = items.findIndex(i => i.id === targetId);
    
    if (draggedIndex === -1 || targetIndex === -1) return;
    
    const newItems = [...items];
    const [removed] = newItems.splice(draggedIndex, 1);
    newItems.splice(targetIndex, 0, removed);
    
    // Update sort_order
    newItems.forEach((item, index) => {
      item.sort_order = index;
    });
    
    setItems(newItems);
    setHasChanges(true);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  const saveOrder = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/gallery/reorder?key=${adminKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((item, index) => ({
            id: item.id,
            sort_order: index,
          })),
        }),
      });
      
      const json = await res.json();
      if (json.success) {
        setHasChanges(false);
        onUpdate();
      } else {
        alert('Failed to save order: ' + json.error);
      }
    } catch (err) {
      console.error('Save order error:', err);
      alert('Failed to save order');
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async (itemId: string) => {
    if (!confirm('Delete this gallery item?')) return;
    
    try {
      const res = await fetch(`/api/admin/gallery/${itemId}?key=${adminKey}`, {
        method: 'DELETE',
      });
      
      const json = await res.json();
      if (json.success) {
        setItems(items.filter(i => i.id !== itemId));
        onUpdate();
      } else {
        alert('Failed to delete: ' + json.error);
      }
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete item');
    }
  };

  const uploadFile = async (file: File, mediaType: 'image' | 'video'): Promise<string | null> => {
    try {
      // Get file extension
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const contentType = mediaType === 'video' 
        ? (ext === 'webm' ? 'video/webm' : 'video/mp4')
        : 'image/webp';
      
      // Generate filename: model-slug/timestamp-filename.ext
      // Note: The upload API currently prefixes with "stories/", so we'll need to
      // strip that prefix from the returned key for gallery items
      const timestamp = Date.now();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filename = `${modelSlug}/${timestamp}-${sanitizedName}`;

      // Use proxy upload to avoid CORS issues
      setUploadProgress(`Uploading ${file.name}...`);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('filename', filename);
      formData.append('contentType', contentType);
      formData.append('bucket', 'models'); // Gallery items go to models bucket

      const uploadRes = await fetch(`/api/upload/proxy?key=${adminKey}`, {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        // Try to parse JSON error, fallback to status text
        let errorMessage = `Upload failed: ${uploadRes.statusText}`;
        try {
          const error = await uploadRes.json();
          errorMessage = error.error || error.message || errorMessage;
        } catch {
          // If response is not JSON, use status text
          const text = await uploadRes.text();
          errorMessage = text || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const result = await uploadRes.json();
      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
      }
      
      return result.key;
    } catch (err) {
      console.error('Upload error:', err);
      throw err;
    }
  };

  const handleUpload = async (files: FileList | null, mediaType: 'image' | 'video') => {
    if (!files || files.length === 0) return;
    
    setUploading(true);
    setUploadProgress('Starting upload...');
    
    try {
      const uploadedFiles: { media_url: string; poster_url?: string }[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress(`Processing ${i + 1}/${files.length}: ${file.name}...`);
        
        // Upload main file
        const mediaUrl = await uploadFile(file, mediaType);
        if (!mediaUrl) continue;
        
        let posterUrl: string | undefined;
        
        // For videos, we need a poster image
        // For now, we'll use the first frame or require manual upload
        // You can enhance this later with video thumbnail extraction
        if (mediaType === 'video') {
          // Placeholder - in production, you'd extract a frame or upload a poster separately
          // For now, we'll create the item without a poster and let admin add it later
        }
        
        uploadedFiles.push({ media_url: mediaUrl, poster_url: posterUrl });
      }
      
      // Create gallery items
      setUploadProgress('Creating gallery items...');
      for (const file of uploadedFiles) {
        const res = await fetch(`/api/admin/gallery?key=${adminKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model_id: modelId,
            media_url: file.media_url,
            media_type: mediaType,
            poster_url: file.poster_url || null,
          }),
        });
        
        if (!res.ok) {
          const json = await res.json();
          console.error('Failed to create gallery item:', json.error);
        }
      }
      
      // Refresh items
      onUpdate();
      setUploadProgress('');
    } catch (err) {
      console.error('Upload error:', err);
      alert('Upload failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setUploading(false);
      setUploadProgress('');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h3 className="text-lg font-semibold text-white">
          Gallery Items ({items.length})
        </h3>
        
        <div className="flex gap-2 flex-wrap">
          {/* Upload Buttons */}
          <label className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white cursor-pointer hover:bg-white/10 transition-colors">
            <ImageIcon className="w-4 h-4" />
            <span className="text-sm">Add Image</span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleUpload(e.target.files, 'image')}
              disabled={uploading}
            />
          </label>
          
          <label className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white cursor-pointer hover:bg-white/10 transition-colors">
            <Film className="w-4 h-4" />
            <span className="text-sm">Add Video</span>
            <input
              type="file"
              accept="video/*"
              multiple
              className="hidden"
              onChange={(e) => handleUpload(e.target.files, 'video')}
              disabled={uploading}
            />
          </label>
          
          {/* Save Order Button */}
          {hasChanges && (
            <button
              onClick={saveOrder}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-[#00FF85] text-black rounded-lg font-medium hover:bg-[#00FF85]/90 transition-colors disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Order
            </button>
          )}
        </div>
      </div>

      {/* Instructions */}
      <p className="text-sm text-muted-foreground">
        Drag items to reorder. The first item is the profile cover. The last item becomes the locked VIP teaser.
      </p>

      {/* Gallery Grid */}
      {items.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-white/10 rounded-xl">
          <ImageIcon className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No gallery items yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Upload images or videos to get started
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {items.map((item, index) => (
            <div
              key={item.id}
              draggable
              onDragStart={() => handleDragStart(item.id)}
              onDragOver={(e) => handleDragOver(e, item.id)}
              onDragEnd={handleDragEnd}
              className={cn(
                "relative aspect-[3/4] rounded-xl overflow-hidden border-2 transition-all cursor-grab active:cursor-grabbing",
                draggedItem === item.id
                  ? "border-[#7A27FF] opacity-50 scale-95"
                  : "border-white/10 hover:border-white/30",
                index === 0 && "ring-2 ring-[#00FF85]",
                index === items.length - 1 && "ring-2 ring-[#D4AF37]"
              )}
            >
              {/* Media */}
              {item.media_type === 'video' ? (
                <video
                  src={getImageUrl(item.media_url)}
                  poster={item.poster_url ? getImageUrl(item.poster_url) : undefined}
                  className="absolute inset-0 w-full h-full object-cover"
                  muted
                  playsInline
                />
              ) : (
                <Image
                  src={getImageUrl(item.media_url)}
                  alt={`Gallery item ${index + 1}`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                  unoptimized
                />
              )}
              
              {/* Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity">
                {/* Position badge */}
                <div className="absolute top-2 left-2 flex items-center gap-1">
                  <GripVertical className="w-4 h-4 text-white" />
                  <span className="text-white text-sm font-medium">#{index + 1}</span>
                </div>
                
                {/* Type badge */}
                <div className="absolute top-2 right-2">
                  {item.media_type === 'video' ? (
                    <Film className="w-4 h-4 text-white" />
                  ) : (
                    <ImageIcon className="w-4 h-4 text-white" />
                  )}
                </div>
                
                {/* Delete button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteItem(item.id);
                  }}
                  className="absolute bottom-2 right-2 p-2 bg-red-500/80 rounded-lg text-white hover:bg-red-500 transition-colors"
                  aria-label={`Delete gallery item ${index + 1}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                
                {/* Labels */}
                {index === 0 && (
                  <span className="absolute bottom-2 left-2 px-2 py-1 bg-[#00FF85] text-black text-xs rounded font-medium">
                    Cover
                  </span>
                )}
                {index === items.length - 1 && (
                  <span className="absolute bottom-2 left-2 px-2 py-1 bg-[#D4AF37] text-black text-xs rounded font-medium">
                    VIP Teaser
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

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
