'use client';

import { MessageCircle } from 'lucide-react';
import { useAnalytics } from '@/hooks/use-analytics';

interface ChatButtonProps {
  href: string;
  modelId: string;
  modelName: string;
  variant?: 'fixed' | 'inline';
  label?: string;
}

export function ChatButton({ href, modelId, modelName, variant = 'fixed', label }: ChatButtonProps) {
  const { trackClick } = useAnalytics();

  const handleClick = async () => {
    await trackClick(modelId, 'social');
  };

  // Render label exactly as passed (parent page constructs full string)
  // Fallback to constructed text only if label is not provided
  const buttonText = label ?? `Chat with ${modelName}`;

  // iOS Glassmorphism Style: Frosted glass with Electric Emerald accent
  const buttonClasses = `
    h-14 text-lg font-semibold rounded-full 
    bg-white/10 backdrop-blur-xl
    text-[#00FF85]
    border border-white/20
    shadow-[0_0_20px_rgba(0,255,133,0.15)]
    hover:bg-white/15 hover:border-[#00FF85]/40 hover:shadow-[0_0_25px_rgba(0,255,133,0.25)]
    active:scale-[0.98] active:bg-white/20
    transition-all duration-300 ease-out
    flex items-center justify-center
    whitespace-nowrap
    px-6
  `.trim().replace(/\s+/g, ' ');

  // Desktop inline variant: minimal padding, full width, extended 10% horizontally, reduced font size, no neon effect
  const inlineButtonClasses = variant === 'inline' 
    ? `${buttonClasses} lg:px-3 lg:w-full lg:scale-x-[1.1] lg:origin-center lg:text-sm lg:h-[47.6px] lg:shadow-none lg:hover:shadow-none`
    : buttonClasses;

  if (variant === 'inline') {
    return (
      <a
        id="chat-button"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        className={inlineButtonClasses}
      >
        <MessageCircle className="w-5 h-5 mr-3 text-[#00FF85] flex-shrink-0" />
        <span className="truncate">{buttonText}</span>
      </a>
    );
  }

  return (
    <a
      id="chat-button"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className={`fixed bottom-4 left-4 right-4 z-50 ${buttonClasses}`}
    >
      <MessageCircle className="w-5 h-5 mr-3 text-[#00FF85]" />
      {buttonText}
    </a>
  );
}

