"use client";

interface CategoryPillsProps {
  tags: string[];
  selectedTag: string | null;
  onSelectTag: (tag: string | null) => void;
  activeFeed?: string; // 'near' | 'new' | 'favorites'
}

export function CategoryPills({ tags, selectedTag, onSelectTag, activeFeed = 'near' }: CategoryPillsProps) {
  // Dynamic accent color based on active feed - iOS 26 glass effect
  const isNewFeed = activeFeed === 'new';
  const activeStyles = isNewFeed
    ? "bg-[#7A27FF]/30 backdrop-blur-xl text-white border border-[#7A27FF]/40 shadow-[0_0_15px_rgba(122,39,255,0.3)] hover:bg-[#7A27FF]/40 hover:border-[#7A27FF]/60 hover:shadow-[0_0_20px_rgba(122,39,255,0.5)]"
    : "bg-[#00FF85]/30 backdrop-blur-xl text-white border border-[#00FF85]/40 shadow-[0_0_15px_rgba(0,255,133,0.3)] hover:bg-[#00FF85]/40 hover:border-[#00FF85]/60 hover:shadow-[0_0_20px_rgba(0,255,133,0.5)]";

  const handleTagClick = (tag: string) => {
    if (selectedTag === tag) {
      onSelectTag(null);
    } else {
      onSelectTag(tag);
    }
  };

  return (
    <div 
      className="overflow-x-auto scrollbar-hide h-full"
      style={{
        background: 'transparent',
        border: 'none',
        boxShadow: 'none',
      }}
    >
      <div 
        className="flex items-center gap-3 pr-4 h-full" 
        style={{ 
          paddingTop: '18px', 
          paddingBottom: '14px',
          paddingLeft: '8px',
          background: 'transparent',
          border: 'none',
          boxShadow: 'none',
        }}
      >
        {tags.map((tag: string) => {
          const isActive = selectedTag === tag;
          return (
            <button
              key={tag}
              onClick={() => handleTagClick(tag)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-300 ${
                isActive
                  ? activeStyles
                  : "bg-white/10 backdrop-blur-xl border border-white/20 hover:bg-white/15 hover:border-white/30 text-white"
              }`}
              style={!isActive ? {
                textShadow: '0 1px 2px rgba(0,0,0,0.5)'
              } : undefined}
              type="button"
            >
              {tag}
            </button>
          );
        })}
      </div>
    </div>
  );
}

