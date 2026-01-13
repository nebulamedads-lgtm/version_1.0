// Model form data for creating/editing
export interface ModelFormData {
  name: string;
  slug: string;
  bio: string;
  bio_es?: string;
  tags: string[];
  social_link: string;
  image_url: string;
  is_verified: boolean;
  is_new: boolean;
  is_pinned: boolean;
}

// Model with related counts for list view
export interface ModelWithCounts {
  id: string;
  name: string;
  slug: string;
  image_url: string;
  is_verified: boolean;
  is_new: boolean;
  is_pinned: boolean;
  social_link: string;
  tags: string[];
  created_at: string;
  gallery_count: number;
  story_count: number;
}

// Gallery item for management
export interface GalleryItemAdmin {
  id: string;
  model_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  poster_url?: string;
  sort_order: number;
  created_at: string;
}

// Story group for pinned block management
export interface StoryGroupAdmin {
  id: string;
  model_id: string;
  title: string | null;
  is_pinned: boolean;
  cover_url: string;
  sort_order: number;
  created_at: string;
  stories: StoryAdmin[];
}

// Individual story for management
export interface StoryAdmin {
  id: string;
  group_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  poster_url?: string;
  duration: number;
  sort_order: number;
  created_at: string;
}

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
