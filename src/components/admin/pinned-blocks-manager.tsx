'use client';

import { useState } from 'react';
import { 
  Pin, 
  Plus, 
  Trash2, 
  Edit, 
  ChevronUp, 
  ChevronDown,
  GripVertical,
  Image as ImageIcon,
  Film,
  Save,
  Loader2,
  X
} from 'lucide-react';
import Image from 'next/image';
import { cn, getImageUrl } from '@/lib/utils';
import type { StoryGroupAdmin } from '@/types/admin';

interface PinnedBlocksManagerProps {
  adminKey: string;
  modelId: string;
  modelSlug: string;
  storyGroups: StoryGroupAdmin[];
  onUpdate: () => void;
}

export function PinnedBlocksManager({ 
  adminKey, 
  modelId, 
  modelSlug, 
  storyGroups: initialGroups,
  onUpdate 
}: PinnedBlocksManagerProps) {
  const [groups, setGroups] = useState<StoryGroupAdmin[]>(
    [...initialGroups].sort((a, b) => a.sort_order - b.sort_order)
  );
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBlockTitle, setNewBlockTitle] = useState('');
  const [saving, setSaving] = useState(false);

  const createBlock = async () => {
    if (!newBlockTitle.trim()) return;
    
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/story-groups?key=${adminKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model_id: modelId,
          title: newBlockTitle.trim(),
          is_pinned: true,
        }),
      });
      
      const json = await res.json();
      if (json.success) {
        setGroups([...groups, { ...json.data, stories: [] }]);
        setNewBlockTitle('');
        setShowCreateModal(false);
        onUpdate();
      } else {
        alert('Failed to create: ' + json.error);
      }
    } catch (err) {
      console.error('Create error:', err);
      alert('Failed to create block');
    } finally {
      setSaving(false);
    }
  };

  const updateBlock = async (groupId: string, updates: Partial<StoryGroupAdmin>) => {
    try {
      const res = await fetch(`/api/admin/story-groups/${groupId}?key=${adminKey}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      
      const json = await res.json();
      if (json.success) {
        setGroups(groups.map(g => g.id === groupId ? { ...g, ...updates } : g));
        setEditingGroup(null);
        onUpdate();
      } else {
        alert('Failed to update: ' + json.error);
      }
    } catch (err) {
      console.error('Update error:', err);
      alert('Failed to update block');
    }
  };

  const deleteBlock = async (groupId: string) => {
    if (!confirm('Delete this pinned block and all its stories?')) return;
    
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
      alert('Failed to delete block');
    }
  };

  const moveBlock = async (groupId: string, direction: 'up' | 'down') => {
    const index = groups.findIndex(g => g.id === groupId);
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === groups.length - 1)
    ) return;
    
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const newGroups = [...groups];
    [newGroups[index], newGroups[newIndex]] = [newGroups[newIndex], newGroups[index]];
    
    // Update sort_order
    const updates = newGroups.map((g, i) => ({
      id: g.id,
      sort_order: i,
    }));
    
    setGroups(newGroups.map((g, i) => ({ ...g, sort_order: i })));
    
    // Save to server
    try {
      const res = await fetch(`/api/admin/story-groups/reorder?key=${adminKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: updates }),
      });
      
      await res.json();
    } catch (err) {
      console.error('Reorder error:', err);
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
      }
    } catch (err) {
      console.error('Delete story error:', err);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Pin className="w-5 h-5 text-[#D4AF37]" />
            Pinned Blocks ({groups.length})
          </h3>
          <p className="text-sm text-muted-foreground">
            Pinned blocks appear at the top of the model's story section
          </p>
        </div>
        
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#D4AF37] text-black rounded-lg font-medium hover:bg-[#D4AF37]/90"
        >
          <Plus className="w-4 h-4" />
          Create Block
        </button>
      </div>

      {/* Blocks List */}
      {groups.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-white/10 rounded-xl">
          <Pin className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No pinned blocks yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Create blocks like "Trips", "Behind the Scenes", etc.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group, index) => (
            <div
              key={group.id}
              className="bg-background border border-white/10 rounded-xl overflow-hidden"
            >
              {/* Block Header */}
              <div className="flex items-center gap-4 p-4 border-b border-white/10">
                <GripVertical className="w-5 h-5 text-muted-foreground cursor-grab" />
                
                {/* Cover */}
                <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-white/5 flex-shrink-0">
                  {group.cover_url ? (
                    <Image
                      src={getImageUrl(group.cover_url)}
                      alt={group.title || 'Block cover'}
                      fill
                      className="object-cover"
                      sizes="48px"
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                </div>
                
                {/* Title */}
                <div className="flex-1">
                  {editingGroup === group.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="px-3 py-1 bg-card border border-white/10 rounded-lg text-white"
                        autoFocus
                      />
                      <button
                        onClick={() => updateBlock(group.id, { title: editTitle })}
                        className="p-1 text-[#00FF85] hover:bg-[#00FF85]/10 rounded"
                      >
                        <Save className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setEditingGroup(null)}
                        className="p-1 text-muted-foreground hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <h4 className="font-semibold text-white">{group.title || 'Untitled'}</h4>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {group.stories?.length || 0} stories
                  </p>
                </div>
                
                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => moveBlock(group.id, 'up')}
                    disabled={index === 0}
                    className="p-2 text-muted-foreground hover:text-white hover:bg-white/5 rounded-lg disabled:opacity-30"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => moveBlock(group.id, 'down')}
                    disabled={index === groups.length - 1}
                    className="p-2 text-muted-foreground hover:text-white hover:bg-white/5 rounded-lg disabled:opacity-30"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setEditingGroup(group.id);
                      setEditTitle(group.title || '');
                    }}
                    className="p-2 text-muted-foreground hover:text-white hover:bg-white/5 rounded-lg"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteBlock(group.id)}
                    className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              {/* Stories Preview */}
              <div className="p-4">
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
                        
                        {/* Delete overlay */}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button
                            onClick={() => deleteStory(story.id, group.id)}
                            className="p-1 bg-red-500 rounded text-white"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                        
                        {/* Type indicator */}
                        {story.media_type === 'video' && (
                          <Film className="absolute top-1 right-1 w-3 h-3 text-white" />
                        )}
                      </div>
                    ))}
                    
                    {/* Add story button */}
                    <button className="w-16 h-20 rounded-lg border-2 border-dashed border-white/20 flex items-center justify-center hover:border-white/40 transition-colors flex-shrink-0">
                      <Plus className="w-5 h-5 text-muted-foreground" />
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No stories in this block. Add stories using the Story Manager.
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-white/10 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-white mb-4">
              Create Pinned Block
            </h3>
            
            <input
              type="text"
              value={newBlockTitle}
              onChange={(e) => setNewBlockTitle(e.target.value)}
              placeholder="Block title (e.g., Trips, BTS)"
              className="w-full px-4 py-2 bg-background border border-white/10 rounded-lg text-white mb-4"
              autoFocus
            />
            
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewBlockTitle('');
                }}
                className="px-4 py-2 text-muted-foreground hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={createBlock}
                disabled={saving || !newBlockTitle.trim()}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg font-medium",
                  saving || !newBlockTitle.trim()
                    ? "bg-white/10 text-muted-foreground"
                    : "bg-[#D4AF37] text-black"
                )}
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
