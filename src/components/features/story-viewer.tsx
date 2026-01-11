"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { X, Share2, Check, Link2, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence, PanInfo, useMotionValue, useTransform, useSpring } from "framer-motion";
import { StoryGroup } from "@/types";
import { getImageUrl } from "@/lib/utils";
import { useShare } from "@/hooks/use-share";

interface ModelPreview {
  name: string;
  imageUrl: string;
  storyMediaUrl?: string; // First story image from next/prev group (Instagram-style)
}

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
  // NEW: Preview data for adjacent models (Tinder-style peek)
  nextModelPreview?: ModelPreview | null;
  prevModelPreview?: ModelPreview | null;
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
  nextModelPreview,
  prevModelPreview 
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
  
  // Swipe physics state
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isAnimatingCube, setIsAnimatingCube] = useState(false); // Track cube animation state

  // Framer Motion values for Tinder-style drag
  const dragX = useMotionValue(0);
  const dragProgress = useTransform(dragX, [-200, 0, 200], [-1, 0, 1]); // -1 = full left, 1 = full right

  // Spring config for instant, responsive transitions (Instagram-style)
  const springConfig = { stiffness: 500, damping: 40, mass: 0.3 };
  const animatedX = useSpring(dragX, springConfig);

  // Instagram-style cube animation transforms (3D rotation) - Mobile only
  // Cube width is the viewport width, so rotation happens at the edge
  const cubeWidth = typeof window !== 'undefined' ? window.innerWidth : 400;
  
  // Animation value for cube rotation (only animates after drag release)
  const cubeRotation = useMotionValue(0);
  const animatedCubeRotation = useSpring(cubeRotation, { 
    stiffness: 500, 
    damping: 40,
    mass: 0.3
  });
  
  // Current card: rotates like a cube face (only during animation, not during drag)
  const currentRotateY = useTransform(animatedCubeRotation, (r) => r);
  const currentOpacity = useTransform(animatedCubeRotation, (r) => {
    const progress = Math.abs(r) / 90;
    return Math.max(0, 1 - progress * 0.3);
  });
  
  // Next card (right side): rotates in from the right (when going to next)
  const nextRotateY = useTransform(animatedCubeRotation, (r) => {
    if (r < 0) return 90 + r; // Rotates in as current rotates out
    return 90;
  });
  const nextOpacity = useTransform(animatedCubeRotation, (r) => {
    if (r < 0) return Math.abs(r) / 90;
    return 0;
  });
  const nextZ = useTransform(animatedCubeRotation, (r) => {
    if (r < 0) return (cubeWidth / 2) * (1 + r / 90);
    return 0;
  });
  
  // Prev card (left side): rotates in from the left (when going to prev)
  const prevRotateY = useTransform(animatedCubeRotation, (r) => {
    if (r > 0) return -90 + r; // Rotates in as current rotates out
    return -90;
  });
  const prevOpacity = useTransform(animatedCubeRotation, (r) => {
    if (r > 0) return r / 90;
    return 0;
  });
  const prevZ = useTransform(animatedCubeRotation, (r) => {
    if (r > 0) return (cubeWidth / 2) * (1 - r / 90);
    return 0;
  });

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
  const duration = currentStory?.duration || 5;

  // Framer Motion variants for model transitions
  const slideVariants = {
    enter: (direction: 'left' | 'right' | null) => ({
      x: direction === 'left' ? '100%' : direction === 'right' ? '-100%' : 0,
      opacity: 0,
      scale: 0.95,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
      transition: {
        x: { type: 'spring', stiffness: 300, damping: 30 },
        opacity: { duration: 0.2 },
        scale: { duration: 0.2 },
      },
    },
    exit: (direction: 'left' | 'right' | null) => ({
      x: direction === 'left' ? '-100%' : direction === 'right' ? '100%' : 0,
      opacity: 0,
      scale: 0.95,
      transition: {
        x: { type: 'spring', stiffness: 300, damping: 30 },
        opacity: { duration: 0.15 },
      },
    }),
  };

  // Pause and capture current progress
  const pauseStory = useCallback(() => {
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

  // Navigation helpers - Model transitions (instant, Instagram-style)
  const handleNextModel = useCallback(() => {
    if (nextGroupId && onNavigate) {
      setAnimationType('model');
      setSlideDirection('left'); // Content slides LEFT (new content comes from right)
      setIsTransitioning(true); // Remove blur during transition
      
      // Navigate immediately for instant transition
      onNavigate(nextGroupId);
      // Reset transition state quickly
      setTimeout(() => setIsTransitioning(false), 50);
    } else {
      handleClose();
    }
  }, [nextGroupId, onNavigate, handleClose]);

  const handlePrevModel = useCallback(() => {
    if (prevGroupId && onNavigate) {
      setAnimationType('model');
      setSlideDirection('right'); // Content slides RIGHT (new content comes from left)
      setIsTransitioning(true); // Remove blur during transition
      
      // Navigate immediately for instant transition
      onNavigate(prevGroupId);
      // Reset transition state quickly
      setTimeout(() => setIsTransitioning(false), 50);
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
    if (!currentStory || isPaused) return;

    // Set start time for this story
    const now = Date.now();
    // If resuming from pause, calculate adjusted start time
    const adjustedStartTime = pausedProgress > 0 
      ? now - (pausedProgress / 100 * duration * 1000)
      : now;
    setStoryStartTime(adjustedStartTime);
    
    // Progress update interval (60fps feel)
    const progressInterval = setInterval(() => {
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

  // Remove blur during navigation transitions for faster browsing
  useEffect(() => {
    if (isTransitioning) {
      // Remove blur during transition
      document.body.classList.remove('story-open');
    } else {
      // Restore blur when transition completes
      document.body.classList.add('story-open');
    }
  }, [isTransitioning]);

  // Reset state when group changes - optimized for instant transitions
  useEffect(() => {
    // Only reset essential state, keep drag position for smooth transition
    setCurrentStoryIndex(0);
    setIsAnimating(false);
    setIsPaused(false);
    setDragY(0);
    dragX.set(0);
    cubeRotation.set(0); // Reset cube rotation
    setIsClosing(false);
    setProgress(0);
    setPausedProgress(0);
    setIsUIHidden(false);
    setIsLongPress(false);
    setIsDragging(false);
    setIsAnimatingCube(false);
    
    // Quick reset of animation state
    setAnimationType('story');
    setSlideDirection(null);
  }, [group.id, dragX, cubeRotation]);

  // Handle screen tap navigation
  const handleTap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isLongPress || isDragging) {
      setIsLongPress(false);
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

  // Long press handlers - Instagram style (hide UI, freeze progress)
  const handleMouseDown = () => {
    longPressTimerRef.current = setTimeout(() => {
      pauseStory();
      setIsUIHidden(true);
      setIsLongPress(true);
    }, 150); // Slightly faster for snappier feel
  };

  const handleMouseUp = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
    if (isLongPress) {
      setIsUIHidden(false);
      resumeStory();
      setIsLongPress(false);
    }
  };

  // Drag end handler - triggers smooth cube animation (Instagram-style)
  const handleDragEnd = useCallback(() => {
    const currentDragX = dragX.get();
    const threshold = 60; // Threshold for navigation
    
    // Reset drag position (no visual feedback during drag)
    dragX.set(0);
    
    if (currentDragX < -threshold && nextGroupId && onNavigate) {
      // Dragged left past threshold -> animate cube to next story
      setIsTransitioning(true);
      setIsAnimatingCube(true);
      
      // Animate cube rotation to -90 degrees (smooth transition)
      cubeRotation.set(-90);
      
      // Navigate after animation completes (smooth spring animation)
      setTimeout(() => {
        onNavigate(nextGroupId);
        cubeRotation.set(0); // Reset for new story
        setIsAnimatingCube(false);
        setTimeout(() => setIsTransitioning(false), 50);
      }, 350); // Smooth animation duration (matches spring timing)
    } else if (currentDragX > threshold && prevGroupId && onNavigate) {
      // Dragged right past threshold -> animate cube to previous story
      setIsTransitioning(true);
      setIsAnimatingCube(true);
      
      // Animate cube rotation to 90 degrees (smooth transition)
      cubeRotation.set(90);
      
      // Navigate after animation completes (smooth spring animation)
      setTimeout(() => {
        onNavigate(prevGroupId);
        cubeRotation.set(0); // Reset for new story
        setIsAnimatingCube(false);
        setTimeout(() => setIsTransitioning(false), 50);
      }, 350); // Smooth animation duration (matches spring timing)
    } else {
      // Snap back to center (no animation needed, already at 0)
      cubeRotation.set(0);
    }
    
    // Resume story if paused during drag
    if (isPaused && !isLongPress) {
      resumeStory();
    }
    setIsDragging(false);
  }, [dragX, nextGroupId, prevGroupId, onNavigate, isPaused, isLongPress, resumeStory, cubeRotation]);

  // Combined drag handler - detects horizontal vs vertical (no animations during drag)
  const handleDrag = useCallback((event: any, info: { offset: { x: number; y: number } }) => {
    const { offset } = info;
    
    // Cancel long press
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
    if (isLongPress) {
      setIsUIHidden(false);
      setIsLongPress(false);
    }
    
    setIsDragging(true);
    
    // Determine dominant direction with threshold to prevent interference
    const absX = Math.abs(offset.x);
    const absY = Math.abs(offset.y);
    
    if (absX > absY + 10) {
      // Horizontal drag - track position but NO visual animation
      let constrainedX = offset.x;
      if (!nextGroupId && offset.x < 0) constrainedX = offset.x * 0.2; // Rubber band
      if (!prevGroupId && offset.x > 0) constrainedX = offset.x * 0.2;
      dragX.set(constrainedX);
      // Keep cube rotation at 0 during drag (no animation)
      cubeRotation.set(0);
      setDragY(0); // Reset vertical drag
    } else if (absY > absX + 10 && offset.y > 0) {
      // Vertical drag down - for close gesture (no animation, just tracking)
      setDragY(offset.y);
      dragX.set(0); // Reset horizontal drag
      cubeRotation.set(0); // Keep cube at 0
    }
    
    if (!isPaused) pauseStory();
  }, [dragX, nextGroupId, prevGroupId, isPaused, pauseStory, isLongPress, cubeRotation]);

  // Vertical drag end handler - instant close (no animation, Instagram-style)
  const handleVerticalDragEnd = useCallback(() => {
    if (dragY > 100) {
      // Instant close - no animation delay
      handleClose();
    } else {
      setDragY(0);
      setIsDragging(false);
      if (isPaused && !isLongPress) {
        resumeStory();
      }
    }
  }, [dragY, handleClose, isPaused, isLongPress, resumeStory]);

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
    
    // Pause story while share menu is active
    pauseStory();
    
    try {
      await share({
        url: storyUrl,
        title: modelName ? `Check out ${modelName}'s story on TranSpot` : 'Check out this story on TranSpot',
      });
    } finally {
      // Resume after share completes (success or cancel)
      resumeStory();
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

  // Preview Card Component - Instagram cube animation style
  const PreviewCard = ({ 
    preview, 
    position 
  }: { 
    preview: ModelPreview | null | undefined; 
    position: 'next' | 'prev' 
  }) => {
    if (!preview) return null;
    
    const isNext = position === 'next';
    
    return (
      <motion.div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{
          rotateY: isDesktop ? 0 : (isAnimatingCube ? (isNext ? nextRotateY : prevRotateY) : (isNext ? 90 : -90)),
          opacity: isDesktop ? 0 : (isAnimatingCube ? (isNext ? nextOpacity : prevOpacity) : 0),
          z: isDesktop ? 0 : (isAnimatingCube ? (isNext ? nextZ : prevZ) : 0),
          zIndex: 5,
          transformStyle: 'preserve-3d',
          backfaceVisibility: 'hidden',
        }}
      >
        <div 
          className="relative w-full h-full max-w-lg mx-auto"
          style={{ 
            maxHeight: 'calc(85vh - 40px)',
            margin: '20px 5px',
            transformStyle: 'preserve-3d',
          }}
        >
          {/* Just the next/prev story image - no blur, no zoom, no overlays */}
          <Image
            src={getImageUrl(preview.storyMediaUrl || preview.imageUrl)}
            alt={preview.name}
            fill
            className="object-contain"
            unoptimized
          />
        </div>
      </motion.div>
    );
  };

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
          // select-none prevents text selection, cursor-pointer for tap feedback
          className="fixed inset-0 z-[100] touch-none overscroll-y-none select-none"
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
          }}
        >
      {/* Dark overlay - the page content behind is already blurred via CSS */}
      <div 
        className="absolute inset-0 bg-[#050A14]/40"
        aria-hidden="true"
      />

      {/* Progress Bars - JavaScript-based progress tracking */}
      <div 
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

      {/* Card Stack Container - Instagram cube animation (mobile only) */}
      <div 
        className="relative w-full h-full flex items-center justify-center overflow-hidden"
        style={isDesktop ? {} : {
          perspective: '1000px',
          perspectiveOrigin: 'center center',
        }}
      >
        
        {/* Previous Model Preview Card (behind, left) - Only visible during cube animation */}
        {!isDesktop && isAnimatingCube && <PreviewCard preview={prevModelPreview} position="prev" />}
        
        {/* Next Model Preview Card (behind, right) - Only visible during cube animation */}
        {!isDesktop && isAnimatingCube && <PreviewCard preview={nextModelPreview} position="next" />}
        
        {/* Desktop Navigation Arrows */}
        {isDesktop && (
          <>
            {/* Previous Arrow */}
            {prevGroupId && (
              <button
                onClick={handlePrevModel}
                className="absolute left-4 z-[101] w-12 h-12 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-xl border border-white/20 hover:bg-black/60 hover:border-white/30 transition-all active:scale-95"
                aria-label="Previous story group"
              >
                <ChevronLeft className="w-6 h-6 text-white" />
              </button>
            )}
            
            {/* Next Arrow */}
            {nextGroupId && (
              <button
                onClick={handleNextModel}
                className="absolute right-4 z-[101] w-12 h-12 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-xl border border-white/20 hover:bg-black/60 hover:border-white/30 transition-all active:scale-95"
                aria-label="Next story group"
              >
                <ChevronRight className="w-6 h-6 text-white" />
              </button>
            )}
          </>
        )}
        
        {/* Current Story Card (front) - Instagram cube animation (mobile only) */}
        <motion.div
          key={`${group.id}-${currentStoryIndex}`}
          className={`relative w-full h-full max-w-lg mx-auto flex items-center justify-center ${isDesktop ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'}`}
          style={{
            rotateY: isDesktop ? 0 : (isAnimatingCube ? currentRotateY : 0),
            opacity: isDesktop ? 1 : (isAnimatingCube ? currentOpacity : 1),
            zIndex: 10,
            padding: '20px 5px',
            transformStyle: 'preserve-3d',
            backfaceVisibility: 'hidden',
          }}
          drag={isDesktop ? false : true}
          dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
          dragElastic={0.3}
          dragMomentum={false}
          whileDrag={{ cursor: 'grabbing' }}
          onDrag={isDesktop ? undefined : handleDrag}
          onDragEnd={isDesktop ? undefined : (e, info) => {
            // Check if it was a horizontal or vertical drag
            const absX = Math.abs(info.offset.x);
            const absY = Math.abs(info.offset.y);
            
            if (absX > absY + 10) {
              // Horizontal drag - handle navigation
              handleDragEnd();
            } else if (absY > absX + 10 && info.offset.y > 0) {
              // Vertical drag down - handle close
              handleVerticalDragEnd();
            } else {
              // Reset both
              dragX.set(0);
              setDragY(0);
              setIsDragging(false);
              if (isPaused && !isLongPress) {
                resumeStory();
              }
            }
          }}
          onPointerDown={handleMouseDown}
          onPointerUp={handleMouseUp}
          onPointerLeave={handleMouseUp}
          onClick={!isDragging ? handleTap : undefined}
        >
          {/* Story content wrapper - Vertical drag tracking (no animation during drag) */}
          <div
            className="relative w-full h-full bg-black/20"
            style={{ 
              maxHeight: 'calc(85vh - 40px)',
              // No transforms during drag - instant close on release
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
          
          {/* Drag direction indicator overlay - Hidden on desktop */}
          <AnimatePresence>
            {!isDesktop && isDragging && Math.abs(dragX.get()) > 30 && (
              <motion.div
                className="absolute inset-0 pointer-events-none flex items-center justify-center z-20"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div 
                  className="absolute top-1/2 -translate-y-1/2 px-4 py-2 rounded-full bg-black/60 backdrop-blur-xl border border-white/20"
                  style={{
                    left: dragX.get() < 0 ? 'auto' : 20,
                    right: dragX.get() < 0 ? 20 : 'auto',
                  }}
                >
                  <span className="text-white font-medium text-sm">
                    {dragX.get() < 0 ? (nextGroupId ? 'Release for next' : 'No more stories') : (prevGroupId ? 'Release for previous' : 'First story')}
                  </span>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>


      {/* Horizontal swipe indicator - shows when swiping between models - Hidden on desktop */}
      {!isDesktop && isDragging && Math.abs(dragX.get()) > 30 && (
        <motion.div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-[102]"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="bg-black/70 backdrop-blur-xl border border-white/20 rounded-2xl px-6 py-3 flex items-center gap-3">
            {dragX.get() < -30 ? (
              <>
                <span className="text-white/90 text-sm font-medium">
                  {nextGroupId ? '→ Next Model' : '→ End of Stories'}
                </span>
              </>
            ) : (
              <>
                <span className="text-white/90 text-sm font-medium">
                  {prevGroupId ? '← Previous Model' : '← First Story'}
                </span>
              </>
            )}
          </div>
        </motion.div>
      )}

      {/* Vertical swipe indicator - shows when dragging down to close */}
      {isDragging && dragY > 50 && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-[102]">
          <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-full px-5 py-2.5">
            <span className="text-white/90 text-sm font-medium">
              {dragY > 100 ? '↓ Release to close' : '↓ Swipe down to close'}
            </span>
          </div>
        </div>
      )}

      {/* Micro-Toast - Link Copied Confirmation (Electric Emerald) */}
      {isCopiedAndGo && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[200] pointer-events-none animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center gap-2 px-4 py-3 bg-black/70 backdrop-blur-xl border border-[#00FF85]/30 rounded-xl shadow-[0_0_20px_rgba(0,255,133,0.2)]">
            <Link2 className="w-5 h-5 text-[#00FF85]" />
            <span className="text-white font-medium text-sm">Link Copied! Opening...</span>
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
