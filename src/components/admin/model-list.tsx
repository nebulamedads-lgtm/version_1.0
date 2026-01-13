'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Search, 
  Plus, 
  Trash2, 
  Edit, 
  CheckCircle, 
  Pin,
  Image as ImageIcon,
  Film,
  RefreshCw
} from 'lucide-react';
import Image from 'next/image';
import { cn, getImageUrl } from '@/lib/utils';
import type { ModelWithCounts } from '@/types/admin';

interface ModelListProps {
  adminKey: string;
  onEditModel: (modelId: string) => void;
  onAddModel: () => void;
}

export function ModelList({ adminKey, onEditModel, onAddModel }: ModelListProps) {
  const [models, setModels] = useState<ModelWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchModels = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ key: adminKey });
      if (search) params.set('search', search);
      
      const res = await fetch(`/api/admin/models?${params}`);
      const json = await res.json();
      
      if (json.success) {
        setModels(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch models:', err);
    } finally {
      setLoading(false);
    }
  }, [adminKey, search]);

  // Fetch on mount and when dependencies change
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchModels();
    }, search ? 300 : 0); // Immediate fetch if no search, debounce if searching
    
    return () => clearTimeout(timer);
  }, [fetchModels, search]);

  const handleDelete = async (modelId: string) => {
    if (deleteConfirm !== modelId) {
      setDeleteConfirm(modelId);
      return;
    }

    try {
      const res = await fetch(`/api/admin/models/${modelId}?key=${adminKey}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      
      if (json.success) {
        setModels(models.filter(m => m.id !== modelId));
        setDeleteConfirm(null);
      } else {
        alert('Failed to delete: ' + json.error);
        setDeleteConfirm(null);
      }
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete model');
      setDeleteConfirm(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <h2 className="text-xl font-bold text-white">
          Models ({models.length})
        </h2>
        
        <div className="flex gap-3 w-full sm:w-auto">
          {/* Search */}
          <div className="relative flex-1 sm:flex-initial">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search models..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2 bg-card border border-white/10 rounded-lg text-white text-sm w-full sm:w-64 placeholder:text-muted-foreground focus:outline-none focus:border-[#00FF85]/50"
            />
          </div>
          
          {/* Refresh */}
          <button
            onClick={fetchModels}
            disabled={loading}
            className="p-2 bg-card border border-white/10 rounded-lg text-white hover:border-white/20 transition-colors disabled:opacity-50"
            aria-label="Refresh models"
          >
            <RefreshCw className={cn("w-5 h-5", loading && "animate-spin")} />
          </button>
          
          {/* Add Model */}
          <button
            onClick={onAddModel}
            className="flex items-center gap-2 px-4 py-2 bg-[#00FF85] text-black rounded-lg font-medium hover:bg-[#00FF85]/90 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline">Add Model</span>
          </button>
        </div>
      </div>

      {/* Model List */}
      <div className="space-y-2">
        {loading && models.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            Loading models...
          </div>
        ) : models.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No models found. Add your first model!
          </div>
        ) : (
          models.map((model) => (
            <div
              key={model.id}
              className="flex items-center gap-4 p-4 bg-card border border-white/10 rounded-xl hover:border-white/20 transition-colors"
            >
              {/* Thumbnail */}
              <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-white/5 flex-shrink-0">
                {model.image_url ? (
                  <Image
                    src={getImageUrl(model.image_url)}
                    alt={model.name}
                    fill
                    className="object-cover"
                    sizes="64px"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}
              </div>
              
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-white truncate">{model.name}</h3>
                  {model.is_verified && (
                    <CheckCircle className="w-4 h-4 text-[#00FF85]" fill="currentColor" />
                  )}
                  {model.is_new && (
                    <span className="px-2 py-0.5 bg-[#7A27FF]/20 text-[#7A27FF] text-xs rounded-full">
                      New
                    </span>
                  )}
                  {model.is_pinned && (
                    <Pin className="w-4 h-4 text-[#D4AF37]" fill="currentColor" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground">@{model.slug}</p>
                <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <ImageIcon className="w-3 h-3" />
                    {model.gallery_count} gallery
                  </span>
                  <span className="flex items-center gap-1">
                    <Film className="w-3 h-3" />
                    {model.story_count} stories
                  </span>
                </div>
              </div>
              
              {/* Tags */}
              <div className="hidden lg:flex gap-1 flex-wrap max-w-[200px]">
                {model.tags.slice(0, 3).map((tag) => (
                  <span 
                    key={tag}
                    className="px-2 py-0.5 bg-white/5 text-xs text-muted-foreground rounded"
                  >
                    {tag}
                  </span>
                ))}
                {model.tags.length > 3 && (
                  <span className="px-2 py-0.5 text-xs text-muted-foreground">
                    +{model.tags.length - 3}
                  </span>
                )}
              </div>
              
              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => onEditModel(model.id)}
                  className="p-2 bg-white/5 rounded-lg text-white hover:bg-white/10 transition-colors"
                  aria-label={`Edit ${model.name}`}
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(model.id)}
                  className={cn(
                    "p-2 rounded-lg transition-colors",
                    deleteConfirm === model.id
                      ? "bg-red-500 text-white"
                      : "bg-white/5 text-red-400 hover:bg-red-500/20"
                  )}
                  aria-label={deleteConfirm === model.id ? `Confirm delete ${model.name}` : `Delete ${model.name}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
