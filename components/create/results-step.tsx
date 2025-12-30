'use client';

import { useState } from 'react';
import Link from 'next/link';

interface ResultsStepProps {
  originalImage: string;
  generatedImages: string[];
  styleName: string;
  onTryAgain: () => void;
  onTryDifferentStyle: () => void;
}

export function ResultsStep({
  originalImage,
  generatedImages,
  styleName,
  onTryAgain,
  onTryDifferentStyle
}: ResultsStepProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonPosition, setComparisonPosition] = useState(50);

  const selectedImage = generatedImages[selectedIndex];

  const handleDownload = (format: 'png' | 'jpg' | 'webp') => {
    // In production, this would trigger actual download
    const link = document.createElement('a');
    link.href = selectedImage;
    link.download = `headshot-${styleName.toLowerCase().replace(/\s+/g, '-')}.${format}`;
    link.click();
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My Professional Headshot',
          text: 'Check out my new professional headshot created with SnapStudio!',
          url: window.location.href
        });
      } catch (err) {
        console.log('Share cancelled');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-4">
          <span className="material-symbols-outlined text-emerald-400">check_circle</span>
          <span className="text-sm text-emerald-300">Your headshot is ready!</span>
        </div>
        <h2 className="text-2xl font-bold mb-2">Looking Great!</h2>
        <p className="text-zinc-400">
          Your professional headshot has been generated with the {styleName} style
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main preview */}
        <div className="lg:col-span-2">
          <div className="relative rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800">
            {showComparison ? (
              // Comparison view
              <div
                className="relative aspect-[3/4] cursor-ew-resize"
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  setComparisonPosition((x / rect.width) * 100);
                }}
              >
                {/* Before */}
                <div
                  className="absolute inset-0"
                  style={{ clipPath: `inset(0 ${100 - comparisonPosition}% 0 0)` }}
                >
                  <img
                    src={originalImage}
                    alt="Original"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-4 left-4 px-3 py-1 rounded-lg bg-black/50 backdrop-blur-sm text-xs">
                    Original
                  </div>
                </div>

                {/* After */}
                <div
                  className="absolute inset-0"
                  style={{ clipPath: `inset(0 0 0 ${comparisonPosition}%)` }}
                >
                  <img
                    src={selectedImage}
                    alt="Generated"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-4 right-4 px-3 py-1 rounded-lg bg-indigo-500/50 backdrop-blur-sm text-xs">
                    {styleName}
                  </div>
                </div>

                {/* Slider */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-white"
                  style={{ left: `${comparisonPosition}%` }}
                >
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center">
                    <span className="material-symbols-outlined text-zinc-800">drag_handle</span>
                  </div>
                </div>
              </div>
            ) : (
              // Single view
              <div className="aspect-[3/4]">
                <img
                  src={selectedImage}
                  alt="Generated headshot"
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Toggle comparison */}
            <button
              onClick={() => setShowComparison(!showComparison)}
              className="absolute bottom-4 left-4 px-4 py-2 rounded-lg bg-black/50 backdrop-blur-sm text-sm flex items-center gap-2 hover:bg-black/70 transition-colors"
            >
              <span className="material-symbols-outlined text-lg">compare</span>
              {showComparison ? 'Hide Comparison' : 'Compare with Original'}
            </button>
          </div>

          {/* Variations */}
          {generatedImages.length > 1 && (
            <div className="mt-4">
              <p className="text-sm text-zinc-500 mb-2">Variations:</p>
              <div className="flex gap-2">
                {generatedImages.map((img, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedIndex(index)}
                    className={`relative w-20 h-24 rounded-xl overflow-hidden border-2 transition-all ${
                      selectedIndex === index
                        ? 'border-indigo-500 scale-105'
                        : 'border-zinc-700 hover:border-zinc-600'
                    }`}
                  >
                    <img src={img} alt={`Variation ${index + 1}`} className="w-full h-full object-cover" />
                    {selectedIndex === index && (
                      <div className="absolute inset-0 bg-indigo-500/20 flex items-center justify-center">
                        <span className="material-symbols-outlined text-white">check</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions panel */}
        <div className="space-y-4">
          {/* Download options */}
          <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-indigo-400">download</span>
              Download
            </h3>
            <div className="space-y-2">
              {[
                { format: 'png' as const, label: 'PNG (High Quality)', size: '~2.5 MB', recommended: true },
                { format: 'jpg' as const, label: 'JPG (Compressed)', size: '~500 KB', recommended: false },
                { format: 'webp' as const, label: 'WebP (Web Optimized)', size: '~300 KB', recommended: false },
              ].map((option) => (
                <button
                  key={option.format}
                  onClick={() => handleDownload(option.format)}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-zinc-400">image</span>
                    <div className="text-left">
                      <p className="text-sm font-medium">{option.label}</p>
                      <p className="text-xs text-zinc-500">{option.size}</p>
                    </div>
                  </div>
                  {option.recommended && (
                    <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-400 rounded text-xs">
                      Recommended
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Share */}
          <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-indigo-400">share</span>
              Share
            </h3>
            <button
              onClick={handleShare}
              className="w-full py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 transition-colors flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined">share</span>
              Share Your Headshot
            </button>
          </div>

          {/* Actions */}
          <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-indigo-400">refresh</span>
              Not Happy?
            </h3>
            <div className="space-y-2">
              <button
                onClick={onTryAgain}
                className="w-full py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 transition-colors text-sm"
              >
                Regenerate with Same Settings
              </button>
              <button
                onClick={onTryDifferentStyle}
                className="w-full py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 transition-colors text-sm"
              >
                Try a Different Style
              </button>
            </div>
          </div>

          {/* Create another */}
          <Link
            href="/dashboard/create"
            className="block w-full py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 transition-colors text-center font-semibold"
          >
            Create Another Headshot
          </Link>
        </div>
      </div>
    </div>
  );
}
