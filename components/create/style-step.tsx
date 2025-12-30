'use client';

import { useState } from 'react';
import { STYLE_PROMPTS, STYLE_CATEGORIES, getStylesByCategory, type StylePrompt } from '@/lib/prompts';

interface StyleStepProps {
  selectedStyle: StylePrompt | null;
  onStyleSelect: (style: StylePrompt) => void;
}

export function StyleStep({ selectedStyle, onStyleSelect }: StyleStepProps) {
  const [activeCategory, setActiveCategory] = useState<string>('professional');
  const [hoveredStyle, setHoveredStyle] = useState<string | null>(null);

  const categoryStyles = getStylesByCategory(activeCategory as 'professional' | 'creative' | 'artistic' | 'specialty');

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2">Choose Your Style</h2>
        <p className="text-zinc-400">
          Select from 18+ professional styles to match your needs
        </p>
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap justify-center gap-2 mb-6">
        {STYLE_CATEGORIES.map((category) => (
          <button
            key={category.id}
            onClick={() => setActiveCategory(category.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeCategory === category.id
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25'
                : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800 hover:text-white border border-zinc-700'
            }`}
          >
            <span className="material-symbols-outlined text-lg">{category.icon}</span>
            {category.name}
          </button>
        ))}
      </div>

      {/* Styles grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {categoryStyles.map((style) => {
          const isSelected = selectedStyle?.id === style.id;
          const isHovered = hoveredStyle === style.id;

          return (
            <button
              key={style.id}
              onClick={() => onStyleSelect(style)}
              onMouseEnter={() => setHoveredStyle(style.id)}
              onMouseLeave={() => setHoveredStyle(null)}
              className={`relative text-left rounded-2xl overflow-hidden border transition-all duration-300 ${
                isSelected
                  ? 'border-indigo-500 ring-2 ring-indigo-500/50 scale-[1.02]'
                  : 'border-zinc-800 hover:border-zinc-700'
              }`}
            >
              {/* Style preview */}
              <div
                className="aspect-[3/4] relative"
                style={{
                  background: `linear-gradient(135deg, ${style.previewColor}dd, ${style.previewColor}99)`
                }}
              >
                {/* Icon */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="material-symbols-outlined text-5xl text-white/30">
                    {style.icon}
                  </span>
                </div>

                {/* Selected checkmark */}
                {isSelected && (
                  <div className="absolute top-2 right-2 w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center shadow-lg">
                    <span className="material-symbols-outlined text-white text-lg">check</span>
                  </div>
                )}

                {/* Gradient overlay */}
                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-zinc-900 to-transparent" />

                {/* Hover details */}
                {isHovered && !isSelected && (
                  <div className="absolute inset-0 bg-zinc-900/90 p-3 flex flex-col animate-fadeIn">
                    <p className="text-xs text-zinc-500 mb-1">Best for:</p>
                    <div className="flex flex-wrap gap-1 mb-auto">
                      {style.bestFor.slice(0, 3).map((use) => (
                        <span key={use} className="px-2 py-0.5 bg-zinc-800 rounded text-xs text-zinc-300">
                          {use}
                        </span>
                      ))}
                    </div>
                    <div className="text-xs text-indigo-400 flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">info</span>
                      Click to select
                    </div>
                  </div>
                )}
              </div>

              {/* Style info */}
              <div className="p-3 bg-zinc-900">
                <h3 className="font-semibold text-sm mb-0.5">{style.name}</h3>
                <p className="text-xs text-zinc-500 line-clamp-1">{style.shortDescription}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected style details */}
      {selectedStyle && (
        <div className="p-5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 mt-6">
          <div className="flex items-start gap-4">
            <div
              className="w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${selectedStyle.previewColor}30` }}
            >
              <span
                className="material-symbols-outlined text-3xl"
                style={{ color: selectedStyle.previewColor }}
              >
                {selectedStyle.icon}
              </span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-lg">{selectedStyle.name}</h3>
                <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-400 rounded text-xs">
                  Selected
                </span>
              </div>
              <p className="text-sm text-zinc-400 mb-3">{selectedStyle.description}</p>
              <div className="flex flex-wrap gap-2">
                {selectedStyle.bestFor.map((use) => (
                  <span key={use} className="px-2 py-1 bg-zinc-800 rounded-lg text-xs text-zinc-300">
                    {use}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* All styles count */}
      <p className="text-center text-sm text-zinc-500">
        Showing {categoryStyles.length} styles in {STYLE_CATEGORIES.find(c => c.id === activeCategory)?.name}.
        {' '}<span className="text-zinc-400">{STYLE_PROMPTS.length} total available.</span>
      </p>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
