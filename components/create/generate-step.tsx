'use client';

import { useEffect, useState } from 'react';

interface GenerateStepProps {
  isGenerating: boolean;
  progress: number;
  stage: string;
}

const stages = [
  { key: 'analyzing', label: 'Analyzing your photo', icon: 'psychology' },
  { key: 'processing', label: 'Applying style transformation', icon: 'auto_fix_high' },
  { key: 'enhancing', label: 'Enhancing details', icon: 'tune' },
  { key: 'finalizing', label: 'Finalizing output', icon: 'check_circle' },
];

const tips = [
  'Our AI preserves your exact facial features for a natural look.',
  'Professional studio lighting is simulated for the best results.',
  'Each style is optimized for specific use cases like LinkedIn or headshots.',
  'You can regenerate with different settings if needed.',
  'Higher resolution outputs are available for print use.',
];

export function GenerateStep({ isGenerating, progress, stage }: GenerateStepProps) {
  const [currentTip, setCurrentTip] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    if (isGenerating) {
      const tipInterval = setInterval(() => {
        setCurrentTip((prev) => (prev + 1) % tips.length);
      }, 4000);

      const timeInterval = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);

      return () => {
        clearInterval(tipInterval);
        clearInterval(timeInterval);
      };
    }
  }, [isGenerating]);

  const currentStageIndex = stages.findIndex((s) => s.key === stage);

  return (
    <div className="text-center py-12">
      {/* Main progress indicator */}
      <div className="relative w-40 h-40 mx-auto mb-8">
        {/* Background circle */}
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="80"
            cy="80"
            r="70"
            fill="none"
            stroke="#27272a"
            strokeWidth="8"
          />
          <circle
            cx="80"
            cy="80"
            r="70"
            fill="none"
            stroke="url(#gradient)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${progress * 4.4} 440`}
            className="transition-all duration-500"
          />
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
          </defs>
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold">{Math.round(progress)}%</span>
          <span className="text-xs text-zinc-500">{elapsedTime}s elapsed</span>
        </div>
      </div>

      {/* Stage info */}
      <div className="mb-8">
        <div className="flex items-center justify-center gap-2 text-lg font-medium mb-2">
          <span className="material-symbols-outlined text-indigo-400 animate-pulse">
            {stages[currentStageIndex]?.icon || 'hourglass_empty'}
          </span>
          <span>{stages[currentStageIndex]?.label || 'Processing...'}</span>
        </div>
        <p className="text-sm text-zinc-500">
          Please wait while we create your professional headshot
        </p>
      </div>

      {/* Stage progress */}
      <div className="flex justify-center gap-2 mb-8">
        {stages.map((s, index) => (
          <div
            key={s.key}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition-all ${
              index < currentStageIndex
                ? 'bg-emerald-500/20 text-emerald-400'
                : index === currentStageIndex
                ? 'bg-indigo-500/20 text-indigo-400'
                : 'bg-zinc-800 text-zinc-600'
            }`}
          >
            <span className="material-symbols-outlined text-sm">
              {index < currentStageIndex ? 'check_circle' : s.icon}
            </span>
            <span className="hidden sm:inline">{s.label.split(' ')[0]}</span>
          </div>
        ))}
      </div>

      {/* Animated dots */}
      <div className="flex justify-center gap-2 mb-8">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>

      {/* Tips */}
      <div className="max-w-md mx-auto p-4 rounded-xl bg-zinc-900/50 border border-zinc-800">
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-indigo-400 text-lg">tips_and_updates</span>
          <div className="text-left">
            <p className="text-xs text-zinc-500 mb-1">Did you know?</p>
            <p className="text-sm text-zinc-300">{tips[currentTip]}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
