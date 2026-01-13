'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  ArrowLeft, 
  User, 
  Image as ImageIcon, 
  Film, 
  Pin,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ModelBasicInfo } from './model-basic-info';
import { GalleryManager } from './gallery-manager';
import { StoryManager } from './story-manager';
import { PinnedBlocksManager } from './pinned-blocks-manager';

type Tab = 'basic' | 'gallery' | 'stories' | 'pinned';

interface ModelEditorProps {
  adminKey: string;
  modelId: string | null; // null for new model
  onBack: () => void;
  onSaved: () => void;
}

export function ModelEditor({ adminKey, modelId, onBack, onSaved }: ModelEditorProps) {
  const [activeTab, setActiveTab] = useState<Tab>('basic');
  const [model, setModel] = useState<any>(null);
  const [loading, setLoading] = useState(!!modelId);
  const [saving, setSaving] = useState(false);

  const fetchModel = useCallback(async () => {
    if (!modelId) return;
    
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/models/${modelId}?key=${adminKey}`);
      const json = await res.json();
      
      if (json.success) {
        setModel(json.data);
      } else {
        console.error('Failed to fetch model:', json.error);
      }
    } catch (err) {
      console.error('Failed to fetch model:', err);
    } finally {
      setLoading(false);
    }
  }, [adminKey, modelId]);

  useEffect(() => {
    fetchModel();
  }, [fetchModel]);

  const tabs: { id: Tab; label: string; icon: typeof User }[] = [
    { id: 'basic', label: 'Basic Info', icon: User },
    { id: 'gallery', label: 'Gallery', icon: ImageIcon },
    { id: 'stories', label: 'Stories', icon: Film },
    { id: 'pinned', label: 'Pinned Blocks', icon: Pin },
  ];

  // Only show content tabs if editing existing model
  const availableTabs = modelId ? tabs : [tabs[0]];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#7A27FF]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 bg-card border border-white/10 rounded-lg text-white hover:border-white/20 transition-colors"
          aria-label="Back to models list"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-white">
            {modelId ? `Edit: ${model?.name || 'Model'}` : 'Add New Model'}
          </h2>
          {model?.slug && (
            <p className="text-sm text-muted-foreground">@{model.slug}</p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-2 overflow-x-auto scrollbar-hide">
        {availableTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
              activeTab === tab.id
                ? "bg-[#7A27FF] text-white"
                : "text-muted-foreground hover:text-white hover:bg-white/5"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-card border border-white/10 rounded-xl p-6">
        {activeTab === 'basic' && (
          <ModelBasicInfo
            adminKey={adminKey}
            model={model}
            isNew={!modelId}
            onSaved={(savedModel) => {
              setModel(savedModel);
              if (!modelId) {
                // If new model was created, go back to list
                onSaved();
              }
            }}
          />
        )}
        
        {activeTab === 'gallery' && model && (
          <GalleryManager
            adminKey={adminKey}
            modelId={model.id}
            modelSlug={model.slug}
            initialItems={model.gallery_items || []}
            onUpdate={fetchModel}
          />
        )}
        
        {activeTab === 'stories' && model && (
          <StoryManager
            adminKey={adminKey}
            modelId={model.id}
            modelSlug={model.slug}
            storyGroups={model.story_groups || []}
            onUpdate={fetchModel}
          />
        )}
        
        {activeTab === 'pinned' && model && (
          <PinnedBlocksManager
            adminKey={adminKey}
            modelId={model.id}
            modelSlug={model.slug}
            storyGroups={(model.story_groups || []).filter((g: any) => g.is_pinned)}
            onUpdate={fetchModel}
          />
        )}
      </div>
    </div>
  );
}
