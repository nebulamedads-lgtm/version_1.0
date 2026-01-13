'use client';

import { useState, useEffect } from 'react';
import { 
  Save, 
  Loader2, 
  Plus, 
  X,
  ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModelBasicInfoProps {
  adminKey: string;
  model: any | null;
  isNew: boolean;
  onSaved: (model: any) => void;
}

export function ModelBasicInfo({ adminKey, model, isNew, onSaved }: ModelBasicInfoProps) {
  const [formData, setFormData] = useState({
    name: model?.name || '',
    slug: model?.slug || '',
    bio: model?.bio || '',
    bio_es: model?.bio_es || '',
    tags: model?.tags || [],
    social_link: model?.social_link || '',
    image_url: model?.image_url || '',
    is_verified: model?.is_verified || false,
    is_new: model?.is_new !== undefined ? model.is_new : true,
    is_pinned: model?.is_pinned || false,
  });
  
  const [newTag, setNewTag] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update form data when model changes
  useEffect(() => {
    if (model) {
      setFormData({
        name: model.name || '',
        slug: model.slug || '',
        bio: model.bio || '',
        bio_es: model.bio_es || '',
        tags: model.tags || [],
        social_link: model.social_link || '',
        image_url: model.image_url || '',
        is_verified: model.is_verified || false,
        is_new: model.is_new !== undefined ? model.is_new : true,
        is_pinned: model.is_pinned || false,
      });
    }
  }, [model]);

  const handleChange = (field: string, value: any) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      
      // Auto-generate slug from name if new model and slug is empty
      if (field === 'name' && isNew && !prev.slug) {
        const slug = value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        updated.slug = slug;
      }
      
      return updated;
    });
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }));
      setNewTag('');
    }
  };

  const removeTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter((t: string) => t !== tag)
    }));
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    
    try {
      const url = isNew 
        ? `/api/admin/models?key=${adminKey}`
        : `/api/admin/models/${model.id}?key=${adminKey}`;
      
      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      
      const json = await res.json();
      
      if (json.success) {
        onSaved(json.data);
        setError(null);
      } else {
        setError(json.error || 'Failed to save');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const isFormValid = formData.name && formData.slug && formData.social_link;

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* Basic Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">
            Name *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="Valentina Aguirre"
            className="w-full px-4 py-2 bg-background border border-white/10 rounded-lg text-white placeholder:text-muted-foreground focus:outline-none focus:border-[#00FF85]/50"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">
            Slug * <span className="text-xs">(URL-friendly name)</span>
          </label>
          <input
            type="text"
            value={formData.slug}
            onChange={(e) => handleChange('slug', e.target.value)}
            placeholder="valentina-aguirre"
            className="w-full px-4 py-2 bg-background border border-white/10 rounded-lg text-white placeholder:text-muted-foreground focus:outline-none focus:border-[#00FF85]/50"
          />
        </div>
      </div>

      {/* Bio */}
      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-1">
          Bio (English)
        </label>
        <textarea
          value={formData.bio}
          onChange={(e) => handleChange('bio', e.target.value)}
          placeholder="Model description in English..."
          rows={3}
          className="w-full px-4 py-2 bg-background border border-white/10 rounded-lg text-white resize-none placeholder:text-muted-foreground focus:outline-none focus:border-[#00FF85]/50"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-1">
          Bio (Spanish) <span className="text-xs text-muted-foreground">(Optional)</span>
        </label>
        <textarea
          value={formData.bio_es}
          onChange={(e) => handleChange('bio_es', e.target.value)}
          placeholder="Descripción del modelo en español..."
          rows={3}
          className="w-full px-4 py-2 bg-background border border-white/10 rounded-lg text-white resize-none placeholder:text-muted-foreground focus:outline-none focus:border-[#00FF85]/50"
        />
      </div>

      {/* Social Link */}
      <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">
            Social Link (OnlyFans/Fansly) *
          </label>
          <div className="relative">
            <input
              type="url"
              value={formData.social_link}
              onChange={(e) => handleChange('social_link', e.target.value)}
              placeholder="https://onlyfans.com/username"
              className="w-full px-4 py-2 pr-10 bg-background border border-white/10 rounded-lg text-white placeholder:text-muted-foreground focus:outline-none focus:border-[#00FF85]/50"
            />
            {formData.social_link && (
              <a
                href={formData.social_link}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
      </div>

      {/* Profile Image URL */}
      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-1">
          Profile Image URL *
        </label>
        <input
          type="text"
          value={formData.image_url}
          onChange={(e) => handleChange('image_url', e.target.value)}
          placeholder="valentina-aguirre/profile.webp"
          className="w-full px-4 py-2 bg-background border border-white/10 rounded-lg text-white placeholder:text-muted-foreground focus:outline-none focus:border-[#00FF85]/50"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Path in R2 bucket (e.g., model-slug/profile.webp)
        </p>
      </div>

      {/* Tags */}
      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-1">
          Tags
        </label>
        <div className="flex flex-wrap gap-2 mb-2">
          {formData.tags.map((tag: string) => (
            <span
              key={tag}
              className="flex items-center gap-1 px-3 py-1 bg-[#7A27FF]/20 text-[#7A27FF] rounded-full text-sm"
            >
              {tag}
              <button 
              onClick={() => removeTag(tag)} 
              className="hover:text-white transition-colors"
              aria-label={`Remove tag ${tag}`}
            >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
            placeholder="Add tag..."
            className="flex-1 px-4 py-2 bg-background border border-white/10 rounded-lg text-white placeholder:text-muted-foreground focus:outline-none focus:border-[#00FF85]/50"
          />
          <button
            onClick={addTag}
            className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white hover:bg-white/10 transition-colors"
            aria-label="Add tag"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Toggles */}
      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.is_verified}
            onChange={(e) => handleChange('is_verified', e.target.checked)}
            className="w-4 h-4 rounded border-white/20 bg-background text-[#00FF85] focus:ring-[#00FF85] focus:ring-offset-2 focus:ring-offset-background cursor-pointer"
          />
          <span className="text-white">Verified</span>
        </label>
        
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.is_new}
            onChange={(e) => handleChange('is_new', e.target.checked)}
            className="w-4 h-4 rounded border-white/20 bg-background text-[#7A27FF] focus:ring-[#7A27FF] focus:ring-offset-2 focus:ring-offset-background cursor-pointer"
          />
          <span className="text-white">New</span>
        </label>
        
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.is_pinned}
            onChange={(e) => handleChange('is_pinned', e.target.checked)}
            className="w-4 h-4 rounded border-white/20 bg-background text-[#D4AF37] focus:ring-[#D4AF37] focus:ring-offset-2 focus:ring-offset-background cursor-pointer"
          />
          <span className="text-white">Pinned to Top</span>
        </label>
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-4 border-t border-white/10">
        <button
          onClick={handleSubmit}
          disabled={saving || !isFormValid}
          className={cn(
            "flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-colors",
            saving || !isFormValid
              ? "bg-white/10 text-muted-foreground cursor-not-allowed"
              : "bg-[#00FF85] text-black hover:bg-[#00FF85]/90"
          )}
        >
          {saving ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Save className="w-5 h-5" />
          )}
          {isNew ? 'Create Model' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
