"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { X, Share2, Check, Link2, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { StoryGroup } from "@/types";
import { getImageUrl } from "@/lib/utils";
import { useShare } from "@/hooks/use-share";

interface StoryViewerProps {
  group: StoryGroup;
  onClose: () => void;
  socialLink?: string;
  modelName?: string;
  modelImage?: string;
  modelSlug?: string;
  isVerified?: boolean;
  // Playlist navigation props
  nextGroupId?: string;
  prevGroupId?: string;
  onNavigate?: (groupId: string) => void;
  // Disable long press pause (for model profile stories)
  disableLongPress?: boolean;
}

// Date formatting helper - no external dependency
function formatStoryDate(dateString: string, isPinned: boolean): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  // Pinned stories: Show absolute date (e.g., "Oct 24")
  if (isPinned) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // Recent stories: Show relative time
  if (diffMinutes < 1) return 'now';
  if (diffMinutes < 60) return `${diffMinutes}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function StoryViewer({ 
  group, 
  onClose, 
  socialLink, 
  modelName, 
  modelImage, 
  modelSlug, 
  isVerified, 
  nextGroupId, 
  prevGroupId, 
  onNavigate,
  disableLongPress = false
}: StoryViewerProps) {
  // Share hook
  const { share, copyAndGo, isCopied, isCopiedAndGo } = useShare();

  // Local state
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLongPress, setIsLongPress] = useState(false);
  const [isUIHidden, setIsUIHidden] = useState(false); // Hides UI during long press
  const [progress, setProgress] = useState(0); // 0-100 percentage for current story
  const [storyStartTime, setStoryStartTime] = useState<number>(0); // Timestamp when story started
  const [pausedProgress, setPausedProgress] = useState<number>(0); // Progress when paused
  const [animationType, setAnimationType] = useState<'story' | 'model'>('story');
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [nextModelName, setNextModelName] = useState<string | null>(null); // For transition indicator
  const [showCopiedToast, setShowCopiedToast] = useState(false); // For "Link Copied" toast in model profile
  
  // Animation state
  const [isClosing, setIsClosing] = useState(false);
  
  // Swipe detection state (no visual feedback, just detection)
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const hasSwiped = useRef(false); // Track if a swipe occurred to prevent tap

  // Desktop detection
  const [isDesktop, setIsDesktop] = useState(false);
  
  useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  // Refs
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sort stories chronologically (oldest first) so they play in order
  // Most recent story should be at the END of the sequence
  const stories = [...(group.stories || [])].sort((a, b) => {
    const dateA = new Date(a.posted_date || a.created_at);
    const dateB = new Date(b.posted_date || b.created_at);
    return dateA.getTime() - dateB.getTime(); // Ascending: oldest first, newest last
  });
  const currentStory = stories[currentStoryIndex];
  // Double duration in model profile (since pause is disabled)
  const baseDuration = currentStory?.duration || 5;
  const duration = disableLongPress ? baseDuration * 2 : baseDuration;

  // Framer Motion variants for model-to-model transitions
  // Direction: 'left' = going to NEXT model, 'right' = going to PREVIOUS model
  const slideVariants = {
    enter: (direction: 'left' | 'right' | null) => ({
      x: direction === 'left' ? '100%' : direction === 'right' ? '-100%' : 0,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
      transition: {
        x: { type: 'spring', stiffness: 350, damping: 35, mass: 0.8 },
        opacity: { duration: 0.15 },
      },
    },
    exit: (direction: 'left' | 'right' | null) => ({
      x: direction === 'left' ? '-50%' : direction === 'right' ? '50%' : 0,
      opacity: 0,
      transition: {
        x: { type: 'spring', stiffness: 350, damping: 35, mass: 0.8 },
        opacity: { duration: 0.12 },
      },
    }),
  };

  // Pause and capture current progress
  const pauseStory = useCallback(() => {
    // Immediately clear the progress interval
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setPausedProgress(progress);
    setIsPaused(true);
  }, [progress]);

  // Resume from paused state
  const resumeStory = useCallback(() => {
    setIsPaused(false);
    // pausedProgress is already set, useEffect will use it to resume
  }, []);

  // Close the viewer - instant close for vertical drag (Instagram-style)
  const handleClose = useCallback(() => {
    // Clean up all timers
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    
    // Instant close - no animation delay (Instagram mobile behavior)
    setIsClosing(true);
    setSlideDirection(null);
    onClose();
  }, [onClose]);

  // Navigation helpers - Model transitions (with slide animation)
  const handleNextModel = useCallback(() => {
    if (nextGroupId && onNavigate) {
      setAnimationType('model');
      setSlideDirection('left'); // Content slides LEFT (new comes from right)
      setIsTransitioning(true);
      
      // Delay navigation to allow exit animation to start
      // 150ms = enough time for exit to be visible, but fast enough to feel instant
      setTimeout(() => {
        onNavigate(nextGroupId);
        // Reset transition state after navigation completes
        setTimeout(() => {
          setIsTransitioning(false);
          setSlideDirection(null);
        }, 300);
      }, 150);
    } else {
      handleClose();
    }
  }, [nextGroupId, onNavigate, handleClose]);

  const handlePrevModel = useCallback(() => {
    if (prevGroupId && onNavigate) {
      setAnimationType('model');
      setSlideDirection('right'); // Content slides RIGHT (new comes from left)
      setIsTransitioning(true);
      
      // Delay navigation to allow exit animation to start
      setTimeout(() => {
        onNavigate(prevGroupId);
        // Reset transition state after navigation completes
        setTimeout(() => {
          setIsTransitioning(false);
          setSlideDirection(null);
        }, 300);
      }, 150);
    }
    // If no prevGroupId, do nothing (stay on current)
  }, [prevGroupId, onNavigate]);

  // Navigation helpers - Story transitions
  const handleNextStory = useCallback(() => {
    if (currentStoryIndex < stories.length - 1) {
      setAnimationType('story');
      setIsAnimating(false);
      setCurrentStoryIndex((prev) => prev + 1);
      return true;
    }
    return false;
  }, [currentStoryIndex, stories.length]);

  const handlePrevStory = useCallback(() => {
    if (currentStoryIndex > 0) {
      setAnimationType('story');
      setIsAnimating(false);
      setCurrentStoryIndex((prev) => prev - 1);
      return true;
    }
    return false;
  }, [currentStoryIndex]);

  // Tap navigation - tries story first, then model
  const goToNext = useCallback(() => {
    if (!handleNextStory()) {
      handleNextModel();
    }
  }, [handleNextStory, handleNextModel]);

  const goToPrev = useCallback(() => {
    if (!handlePrevStory()) {
      handlePrevModel();
    }
  }, [handlePrevStory, handlePrevModel]);

  // Progress tracking with JavaScript interval (replaces CSS-only approach)
  useEffect(() => {
    if (!currentStory) return;

    // If paused, don't start or continue the interval
    if (isPaused) {
      return;
    }

    // Set start time for this story
    const now = Date.now();
    // If resuming from pause, calculate adjusted start time
    const adjustedStartTime = pausedProgress > 0 
      ? now - (pausedProgress / 100 * duration * 1000)
      : now;
    setStoryStartTime(adjustedStartTime);
    
    // Progress update interval (60fps feel)
    const progressInterval = setInterval(() => {
      // Double-check pause state inside interval to prevent updates when paused
      if (isPaused) {
        clearInterval(progressInterval);
        return;
      }
      
      const elapsed = Date.now() - adjustedStartTime;
      const newProgress = Math.min((elapsed / (duration * 1000)) * 100, 100);
      setProgress(newProgress);
      
      // Auto-advance when complete
      if (newProgress >= 100) {
        clearInterval(progressInterval);
        goToNext();
      }
    }, 16); // ~60fps update rate

    return () => {
      clearInterval(progressInterval);
    };
  }, [currentStoryIndex, currentStory, isPaused, duration, goToNext, pausedProgress]);

  // Reset progress when story changes
  useEffect(() => {
    setProgress(0);
    setPausedProgress(0);
  }, [currentStoryIndex, group.id]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };
  }, []);

  // Add blur effect to page content when story viewer opens
  // Remove blur during transitions for faster browsing (Instagram-style)
  useEffect(() => {
    // Add class to body to blur background content
    document.body.classList.add('story-open');
    
    // Cleanup: remove class when component unmounts
    return () => {
      document.body.classList.remove('story-open');
    };
  }, []);

  // Keep blur active at all times - overlay will handle covering during model transitions
  // This ensures smooth experience without flicker
  useEffect(() => {
    // Always keep blur active - overlay covers during model-to-model transitions
    document.body.classList.add('story-open');
  }, []);

  // Reset state when group changes
  useEffect(() => {
    setCurrentStoryIndex(0);
    setIsAnimating(false);
    setIsPaused(false);
    setIsClosing(false);
    setProgress(0);
    setPausedProgress(0);
    setIsUIHidden(false);
    setIsLongPress(false);
    
    // Reset animation state - IMPORTANT: Don't reset slideDirection here
    // as it's needed for the enter animation
    setAnimationType('story');
    
    // Reset slideDirection after enter animation completes
    const resetTimer = setTimeout(() => {
      setSlideDirection(null);
    }, 400);
    
    return () => clearTimeout(resetTimer);
  }, [group.id]);

  // Handle screen tap navigation (for stories within same group)
  // Only triggers if it's a tap (not a swipe)
  const handleTap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isLongPress) {
      setIsLongPress(false);
      return;
    }

    // Ignore if this was a swipe
    if (hasSwiped.current) {
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    const percentage = x / width;

    if (percentage < 0.3) {
      goToPrev();
    } else if (percentage > 0.7) {
      goToNext();
    }
  };

  // Swipe detection handlers (Instagram mobile web style)
  const handleSwipeStart = useCallback((e: React.PointerEvent) => {
    swipeStart.current = { x: e.clientX, y: e.clientY };
    hasSwiped.current = false; // Reset swipe flag
  }, []);

  const handleSwipeEnd = useCallback((e: React.PointerEvent) => {
    if (!swipeStart.current) return;

    const deltaX = e.clientX - swipeStart.current.x;
    const deltaY = e.clientY - swipeStart.current.y;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    const threshold = 50; // Minimum swipe distance

    // Determine dominant direction
    if (absY > absX + 20 && absY > threshold && deltaY > 0) {
      // Vertical swipe down - instant close (no animation)
      hasSwiped.current = true;
      handleClose();
    } else if (absX > absY + 20 && absX > threshold) {
      // Horizontal swipe - trigger slide animation
      hasSwiped.current = true;
      if (deltaX < -threshold && nextGroupId) {
        // Swiped left - go to next group (with animation)
        handleNextModel();
      } else if (deltaX > threshold && prevGroupId) {
        // Swiped right - go to previous group (with animation)
        handlePrevModel();
      }
    }

    // Clear swipe start - delay slightly to prevent tap triggering
    setTimeout(() => {
      swipeStart.current = null;
      hasSwiped.current = false;
    }, 100);
  }, [nextGroupId, prevGroupId, handleNextModel, handlePrevModel, handleClose]);

  // Long press handlers - Instagram style (hide UI, freeze progress)
  const handleMouseDown = useCallback(() => {
    // Disable long press if disabled (model profile)
    if (disableLongPress) return;
    
    longPressTimerRef.current = setTimeout(() => {
      pauseStory();
      setIsUIHidden(true);
      setIsLongPress(true);
    }, 150); // Slightly faster for snappier feel
  }, [pauseStory, disableLongPress]);

  const handleMouseUp = useCallback(() => {
    // Disable long press if disabled (model profile)
    if (disableLongPress) return;
    
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (isLongPress) {
      setIsUIHidden(false);
      resumeStory();
      setIsLongPress(false);
    }
  }, [isLongPress, resumeStory, disableLongPress]);



  // Block context menu (long press menu on mobile)
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowLeft":
          goToPrev();
          break;
        case "ArrowRight":
          goToNext();
          break;
        case "Escape":
          e.preventDefault();
          handleClose();
          break;
        case " ":
          e.preventDefault();
          if (isPaused) {
            resumeStory();
          } else {
            pauseStory();
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goToPrev, goToNext, handleClose, isPaused, pauseStory, resumeStory]);

  // Get current story URL for sharing/deep linking
  // Always use group.id (not story.id) since HomeStoriesBar looks for group IDs
  // Always point to model's profile page for consistent deep linking
  const getCurrentStoryUrl = useCallback(() => {
    if (typeof window === 'undefined') return '';
    const baseUrl = window.location.origin;
    // If we have modelSlug, always use the model's profile page for deep linking
    // This ensures the link works regardless of where the story was opened from
    if (modelSlug) {
      return `${baseUrl}/model/${modelSlug}?story=${group.id}`;
    }
    // Fallback to current URL if no slug (shouldn't happen in practice)
    const url = new URL(window.location.href);
    url.searchParams.set('story', group.id);
    return url.toString();
  }, [group.id, modelSlug]);

  // Handle Share button click - Pause while share sheet is open
  const handleShare = async () => {
    const storyUrl = getCurrentStoryUrl();
    
    // In model profile: copy to clipboard and show toast
    if (disableLongPress) {
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          await navigator.clipboard.writeText(storyUrl);
          setShowCopiedToast(true);
          // Hide toast after 2 seconds
          setTimeout(() => {
            setShowCopiedToast(false);
          }, 2000);
        }
      } catch (error) {
        console.error('Clipboard error:', error);
      }
      return;
    }
    
    // Main layout: use native share with pause/resume
    // Only pause if long press is enabled (main layout)
    pauseStory();
    
    try {
      await share({
        url: storyUrl,
        title: modelName ? `Check out ${modelName}'s story on TranSpot` : 'Check out this story on TranSpot',
      });
    } catch (error) {
      // Handle any errors silently
      console.error('Share error:', error);
    } finally {
      // Small delay to ensure share sheet is fully closed before resuming
      setTimeout(() => {
        resumeStory();
      }, 100);
    }
  };

  // Handle "Respond to Story" CTA click - Copy & Go
  const handleRespondToStory = () => {
    if (socialLink && socialLink !== "#") {
      // Use current page URL for deep linking
      copyAndGo(window.location.href, socialLink, { delay: 800 });
    }
  };

  // Handle profile redirect - navigate to model profile page
  const handleProfileClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering tap navigation
    if (modelSlug) {
      // Use window.location.href for full page refresh (cleans up modal state)
      window.location.href = `/model/${modelSlug}`;
    }
  };

  // Don't render if no stories
  if (stories.length === 0) {
    return null;
  }

  const mediaUrl = getImageUrl(currentStory?.media_url);
  
  // Avatar logic: modelImage for Recent (non-pinned), cover_url for pinned
  const avatarUrl = !group.is_pinned && modelImage 
    ? modelImage 
    : group.cover_url;


  // Get portal container - render outside main content to avoid blur
  const portalContainer = typeof document !== 'undefined' 
    ? document.getElementById('story-portal') || document.body 
    : null;

  // If no portal container (SSR), don't render
  if (!portalContainer) {
    return null;
  }

  // Render via portal to #story-portal (outside #main-content blur scope)
  return createPortal(
    <AnimatePresence>
      {!isClosing && (
        <motion.div
          ref={containerRef}
          data-story-viewer="true"
          // Fix pull-to-refresh: touch-none prevents browser gestures, overscroll-y-none prevents overscroll
          // select-none prevents text selection
          className="fixed inset-0 z-[100] overscroll-y-none select-none"
          // Block context menu and apply iOS-specific styles
          onContextMenu={handleContextMenu}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.2 } }}
          style={{
            // Critical for iOS Safari - prevents long-press callout
            WebkitTouchCallout: 'none',
            // Prevent any user selection
            WebkitUserSelect: 'none',
            // Allow pointer events to pass through to children
            pointerEvents: 'auto',
            touchAction: 'none', // Prevent browser gestures but allow our handlers
          }}
        >
      {/* Dark overlay - the page content behind is already blurred via CSS */}
      <div 
        className="absolute inset-0 bg-[#050A14]/40"
        aria-hidden="true"
      />

      {/* Progress Bars - JavaScript-based progress tracking */}
      {/* Key by group.id to prevent duplication during transitions */}
      <div 
        key={`progress-${group.id}`}
        className={`absolute top-0 left-0 right-0 z-[102] flex gap-1 p-2 safe-area-top transition-opacity duration-200 ${
          isUIHidden ? 'opacity-0' : 'opacity-100'
        }`}
      >
        {stories.map((story, index) => (
          <div
            key={story.id}
            className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden"
          >
            <div
              className="h-full bg-white rounded-full"
              style={{
                width: index < currentStoryIndex 
                  ? '100%' 
                  : index === currentStoryIndex 
                    ? `${progress}%`
                    : '0%',
                // Smooth micro-transitions for the progress bar
                transition: 'width 0.05s linear',
              }}
            />
          </div>
        ))}
      </div>

      {/* Header - Group info and close button */}
      <div 
        className={`absolute top-4 left-0 right-0 z-[102] flex items-center justify-between px-4 mt-2 transition-opacity duration-200 ${
          isUIHidden ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      >
        {/* Profile Link - Avatar and Name (clickable) */}
        {modelSlug ? (
          <button
            onClick={handleProfileClick}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer"
            aria-label={`View ${modelName || group.title || "model"} profile`}
          >
            {/* Group thumbnail - Gold ring accent */}
            <div className="w-10 h-10 rounded-full overflow-hidden bg-white/10 ring-2 ring-[#D4AF37]/40">
              {avatarUrl && (
                <Image
                  src={getImageUrl(avatarUrl)}
                  alt={group.title || "Story"}
                  width={40}
                  height={40}
                  className="object-cover w-full h-full pointer-events-none"
                  draggable={false}
                  unoptimized
                />
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-white font-semibold text-sm">
                {modelName || group.title || "Recent"}
              </span>
              {isVerified && (
                <img
                  src="/verified-badge.svg"
                  alt="Verified"
                  className="w-4 h-4 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)] flex-shrink-0"
                  width={16}
                  height={16}
                />
              )}
              {/* Date Display - Relative for Recent, Absolute for Pinned */}
              {currentStory?.posted_date && (
                <span className="text-white/50 text-xs">
                  {formatStoryDate(currentStory.posted_date, group.is_pinned)}
                </span>
              )}
            </div>
          </button>
        ) : (
          <div className="flex items-center gap-3">
            {/* Group thumbnail - Gold ring accent */}
            <div className="w-10 h-10 rounded-full overflow-hidden bg-white/10 ring-2 ring-[#D4AF37]/40">
              {avatarUrl && (
                <Image
                  src={getImageUrl(avatarUrl)}
                  alt={group.title || "Story"}
                  width={40}
                  height={40}
                  className="object-cover w-full h-full pointer-events-none"
                  draggable={false}
                  unoptimized
                />
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-white font-semibold text-sm">
                {modelName || group.title || "Recent"}
              </span>
              {isVerified && (
                <img
                  src="/verified-badge.svg"
                  alt="Verified"
                  className="w-4 h-4 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)] flex-shrink-0"
                  width={16}
                  height={16}
                />
              )}
              {/* Date Display - Relative for Recent, Absolute for Pinned */}
              {currentStory?.posted_date && (
                <span className="text-white/50 text-xs">
                  {formatStoryDate(currentStory.posted_date, group.is_pinned)}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Close button - Glassmorphism with Gold hover */}
        <button
          onClick={handleClose}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 backdrop-blur-sm border border-white/10 hover:bg-white/15 hover:border-[#D4AF37]/30 transition-all active:scale-95"
          aria-label="Close stories"
        >
          <X className="w-6 h-6 text-white" />
        </button>
      </div>

      {/* Story Container - with AnimatePresence for model transitions */}
      <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
        
        {/* Desktop Navigation Arrows */}
        {isDesktop && (
          <>
            {/* Previous Arrow */}
            {prevGroupId && (
              <button
                onClick={handlePrevModel}
                className="absolute left-4 z-[103] w-12 h-12 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-xl border border-white/20 hover:bg-black/60 hover:border-white/30 transition-all active:scale-95"
                aria-label="Previous story group"
              >
                <ChevronLeft className="w-6 h-6 text-white" />
              </button>
            )}
            
            {/* Next Arrow */}
            {nextGroupId && (
              <button
                onClick={handleNextModel}
                className="absolute right-4 z-[103] w-12 h-12 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-xl border border-white/20 hover:bg-black/60 hover:border-white/30 transition-all active:scale-95"
                aria-label="Next story group"
              >
                <ChevronRight className="w-6 h-6 text-white" />
              </button>
            )}
          </>
        )}
        
        {/* Animated Story Card - AnimatePresence handles exit animations */}
        <AnimatePresence mode="popLayout" custom={slideDirection}>
          <motion.div
            key={group.id} // Key by group.id so AnimatePresence detects model changes
            custom={slideDirection}
            variants={slideVariants}
            initial={slideDirection ? "enter" : false}
            animate="center"
            exit="exit"
            className="absolute inset-0 flex items-center justify-center cursor-pointer"
            style={{ pointerEvents: 'auto' }}
            onPointerDown={(e) => {
              e.stopPropagation();
              if (!disableLongPress) handleMouseDown();
              if (!isDesktop) handleSwipeStart(e);
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              if (!disableLongPress) handleMouseUp();
              if (!isDesktop) handleSwipeEnd(e);
            }}
            onPointerLeave={(e) => {
              e.stopPropagation();
              if (!disableLongPress) handleMouseUp();
              if (!isDesktop && swipeStart.current) handleSwipeEnd(e);
            }}
            onPointerCancel={(e) => {
              e.stopPropagation();
              if (!disableLongPress) handleMouseUp();
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleTap(e);
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
              if (!disableLongPress) handleMouseDown();
            }}
            onTouchEnd={(e) => {
              e.stopPropagation();
              if (!disableLongPress) handleMouseUp();
            }}
            onTouchCancel={(e) => {
              e.stopPropagation();
              if (!disableLongPress) handleMouseUp();
            }}
          >
            {/* Story content wrapper */}
            <div 
              className="relative w-full h-full"
              onPointerDown={(e) => {
                e.stopPropagation();
                if (!disableLongPress) handleMouseDown();
                if (!isDesktop) handleSwipeStart(e);
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
                if (!disableLongPress) handleMouseUp();
                if (!isDesktop) handleSwipeEnd(e);
              }}
              onPointerLeave={(e) => {
                e.stopPropagation();
                if (!disableLongPress) handleMouseUp();
                if (!isDesktop && swipeStart.current) handleSwipeEnd(e);
              }}
              onPointerCancel={(e) => {
                e.stopPropagation();
                if (!disableLongPress) handleMouseUp();
              }}
              onClick={(e) => {
                e.stopPropagation();
                handleTap(e);
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                if (!disableLongPress) handleMouseDown();
              }}
              onTouchEnd={(e) => {
                e.stopPropagation();
                if (!disableLongPress) handleMouseUp();
              }}
              onTouchCancel={(e) => {
                e.stopPropagation();
                if (!disableLongPress) handleMouseUp();
              }}
            >
                {currentStory?.media_type === "video" ? (
                  (() => {
                    const mp4Url = getImageUrl(currentStory.media_url);
                    const webmUrl = mp4Url.endsWith('.mp4') 
                      ? mp4Url.slice(0, -4) + '.webm' 
                      : mp4Url.replace(/\.mp4(\?|$)/, '.webm$1');
                    const posterUrl = getImageUrl(group.cover_url);
                    
                    return (
                      <video
                        key={currentStory.id}
                        className="w-full h-full object-contain pointer-events-none"
                        poster={posterUrl}
                        autoPlay
                        muted
                        playsInline
                        onEnded={goToNext}
                      >
                        <source src={webmUrl} type="video/webm" />
                        <source src={mp4Url} type="video/mp4" />
                      </video>
                    );
                  })()
                ) : (
                  <div className="relative w-full h-full">
                    {mediaUrl && (
                      <Image
                        key={currentStory?.id}
                        src={mediaUrl}
                        alt={`Story ${currentStoryIndex + 1}`}
                        fill
                        className="object-contain pointer-events-none"
                        draggable={false}
                        sizes="100vw"
                        priority
                        unoptimized
                      />
                    )}
                  </div>
                )}
              </div>
          </motion.div>
        </AnimatePresence>
        
        {/* Model Transition Overlay - Blurred overlay to prevent main layout flash during model-to-model navigation */}
        {isTransitioning && animationType === 'model' && (
          <div
            className="absolute inset-0 bg-[#050A14]/40 backdrop-blur-xl z-[110] pointer-events-none"
            style={{ 
              backdropFilter: 'blur(20px) saturate(120%)',
              WebkitBackdropFilter: 'blur(20px) saturate(120%)',
            }}
          />
        )}
      </div>

      {/* Micro-Toast - Link Copied Confirmation (Electric Emerald) */}
      {(isCopiedAndGo || showCopiedToast) && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[200] pointer-events-none animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center gap-2 px-4 py-3 bg-black/70 backdrop-blur-xl border border-[#00FF85]/30 rounded-xl shadow-[0_0_20px_rgba(0,255,133,0.2)]">
            <Link2 className="w-5 h-5 text-[#00FF85]" />
            <span className="text-white font-medium text-sm">
              {isCopiedAndGo ? 'Link Copied! Opening...' : 'Link Copied!'}
            </span>
          </div>
        </div>
      )}

      {/* Action Bar Background - Opaque glass shadow at bottom */}
      {socialLink && socialLink !== "#" && (
        <div 
          className={`absolute bottom-0 left-0 right-0 z-[101] h-32 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none transition-opacity duration-200 ${
            isUIHidden ? 'opacity-0' : 'opacity-100'
          }`}
        />
      )}

      {/* Action Bar - Respond to Story + Share */}
      {socialLink && socialLink !== "#" && (
        <div 
          className={`absolute bottom-8 left-0 right-0 z-[102] flex items-center justify-center gap-3 px-4 safe-area-bottom transition-opacity duration-200 ${
            isUIHidden ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        >
          {/* Respond to Story Button - iOS Glassmorphism Style */}
          <button
            onClick={handleRespondToStory}
            className="flex items-center gap-2 px-6 py-3 bg-white/10 backdrop-blur-xl text-[#00FF85] border border-white/20 rounded-full font-bold transition-all duration-300 shadow-[0_0_20px_rgba(0,255,133,0.15)] hover:bg-white/15 hover:border-[#00FF85]/40 hover:shadow-[0_0_25px_rgba(0,255,133,0.25)] active:scale-[0.98] active:bg-white/20"
          >
            <span>Respond to Story</span>
          </button>

          {/* Share Button - Neon Cyber Violet Dark Glass */}
          <button
            onClick={handleShare}
            className="relative flex items-center justify-center w-12 h-12 bg-black/50 backdrop-blur-xl rounded-full transition-all duration-300 shadow-[0_0_20px_rgba(192,132,252,0.3)] hover:bg-black/60 hover:shadow-[0_0_30px_rgba(192,132,252,0.5)] hover:scale-105 active:scale-95 active:bg-black/70"
            aria-label="Share story"
          >
            {isCopied ? (
              <Check className="w-5 h-5 text-[#C084FC] drop-shadow-[0_0_10px_rgba(192,132,252,1)]" />
            ) : (
              <Share2 className="w-5 h-5 text-[#C084FC] drop-shadow-[0_0_10px_rgba(192,132,252,1)]" />
            )}
          </button>
        </div>
      )}
        </motion.div>
      )}
    </AnimatePresence>,
    portalContainer
  );
}
