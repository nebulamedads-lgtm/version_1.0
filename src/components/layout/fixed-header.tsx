'use client';

import { useQueryState } from 'nuqs';
import { MapPin, Sparkles, Star, LucideIcon } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface FixedHeaderProps {
  userCity: string;
  nav: {
    near: string;
    new: string;
    favorites: string;
  };
  header: {
    modelsNear: string;
    unknownCity: string;
  };
}

interface NavButtonProps {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  label: string;
  variant?: 'emerald' | 'violet' | 'gold';
}

export function FixedHeader({ userCity, nav, header }: FixedHeaderProps) {
  // Use nuqs to manage URL state
  const [feed, setFeed] = useQueryState('feed', { defaultValue: 'near' });

  // Check if city is "You" or "Unknown" (case-insensitive)
  const isYou = userCity.toLowerCase() === 'you' || userCity === 'Unknown';

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex flex-col bg-background/60 backdrop-blur-2xl shadow-lg shadow-black/10 border-b border-white/10">
      {/* Top Row: Brand Name */}
      <div className="flex items-center justify-between lg:justify-center relative px-4 py-3">
        <div className="flex items-center gap-2 lg:absolute lg:left-1/2 lg:-translate-x-1/2">
          <h1 className="text-xl font-bold tracking-tighter text-foreground">
            Tran<span className="text-primary">Spot</span>
          </h1>
          <Image
            src="/Page-logo.svg"
            alt="TranSpot Logo"
            width={24}
            height={24}
            className="w-6 h-6"
            priority
          />
        </div>
        {feed === 'near' && (
          <span className="text-xs font-medium text-muted-foreground flex items-center gap-1 lg:absolute lg:right-4">
            <MapPin size={12} />
            {isYou ? (
              `${header.modelsNear} ${header.unknownCity}`
            ) : (
              <>
                {header.modelsNear} <span className="capitalize">{userCity}</span>
              </>
            )}
          </span>
        )}
      </div>

      {/* Bottom Row: Navigation Tabs */}
      <div className="flex w-full px-2 pb-2">
        <NavButton
          active={feed === 'near'}
          onClick={() => setFeed('near')}
          icon={MapPin}
          label={nav.near}
          variant="emerald"
        />
        <NavButton
          active={feed === 'new'}
          onClick={() => setFeed('new')}
          icon={Sparkles}
          label={nav.new}
          variant="violet"
        />
        <NavButton
          active={feed === 'favorites'}
          onClick={() => setFeed('favorites')}
          icon={Star}
          label={nav.favorites}
          variant="gold"
        />
      </div>
    </div>
  );
}

function NavButton({ active, onClick, icon: Icon, label, variant = 'emerald' }: NavButtonProps) {
  // Color variants for different tabs
  const variantStyles = {
    emerald: {
      text: 'text-[#00FF85]',
      shadow: 'shadow-[0_0_12px_rgba(0,255,133,0.2)]',
    },
    violet: {
      text: 'text-[#C084FC]',
      shadow: 'shadow-[0_0_12px_rgba(192,132,252,0.3)]',
    },
    gold: {
      text: 'text-[#D4AF37]',
      shadow: 'shadow-[0_0_12px_rgba(212,175,55,0.2)]',
    },
  };

  const style = variantStyles[variant];

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all duration-300',
        active 
          ? `bg-white/15 backdrop-blur-sm border border-white/20 ${style.text} ${style.shadow}` 
          : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
      )}
    >
      <Icon size={16} className={active ? 'fill-current' : ''} />
      {label}
    </button>
  );
}

