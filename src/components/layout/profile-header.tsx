'use client';

import Link from 'next/link';
import { ChevronLeft, Share2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useShare } from '@/hooks/use-share';

export function ProfileHeader() {
  const { share, isCopied } = useShare();

  const handleShare = async () => {
    if (typeof window !== 'undefined') {
      await share({
        url: window.location.href,
        title: 'Check out this profile on TransHere',
      });
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/70 backdrop-blur-2xl border-b border-white/10 pointer-events-none lg:hidden">
      <div className="flex items-center justify-between p-4 pointer-events-auto">
        {/* Back Button - Glassmorphism pill with brighter Violet accent for better readability */}
        <Link href="/">
          <Button
            variant="ghost"
            size="sm"
            className="text-[#B794F6] hover:text-[#C084FC] bg-white/10 hover:bg-[#B794F6]/20 backdrop-blur-xl border border-[#B794F6]/40 rounded-full shadow-lg shadow-[#B794F6]/10"
            style={{
              textShadow: '0 1px 2px rgba(0,0,0,0.7), 0 0 4px rgba(0,0,0,0.5)'
            }}
          >
            <ChevronLeft size={20} className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]" />
            Back
          </Button>
        </Link>

        {/* Brand Name - Glassmorphism pill with dark opaque background */}
        <Link href="/" className="flex items-center px-4 py-2 rounded-full bg-black/60 backdrop-blur-xl border border-white/20 hover:bg-black/70 transition-all duration-300">
          <span className="text-white font-bold tracking-tighter">
            <span className="text-[#7A27FF]">Trans</span><span className="text-[#00FF85]">Here</span>
          </span>
        </Link>

        {/* Share Button - Glassmorphism pill with Emerald accent */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleShare}
          className="text-[#00FF85] hover:text-[#00FF85] bg-white/10 hover:bg-[#00FF85]/20 backdrop-blur-xl border border-[#00FF85]/40 rounded-full w-[72px] flex items-center justify-center shadow-lg shadow-[#00FF85]/10"
          aria-label="Share profile"
        >
          {isCopied ? (
            <Check size={20} className="text-[#00FF85] drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]" />
          ) : (
            <Share2 size={20} className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]" />
          )}
        </Button>
      </div>
    </header>
  );
}

