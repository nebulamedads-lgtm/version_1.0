-- Migration: Add sort_order column to story_groups for pinned block ordering
-- This allows manual ordering of pinned story groups (blocks) within a model's profile

-- Add sort_order column if it doesn't exist
ALTER TABLE story_groups ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Create index for efficient sorting queries
-- Index on (model_id, is_pinned, sort_order) for fast retrieval of ordered pinned blocks
CREATE INDEX IF NOT EXISTS idx_story_groups_sort ON story_groups(model_id, is_pinned, sort_order);

-- Add comment for documentation
COMMENT ON COLUMN story_groups.sort_order IS 'Manual ordering for pinned story groups. Lower numbers appear first. Only applies to pinned groups (is_pinned = true).';
