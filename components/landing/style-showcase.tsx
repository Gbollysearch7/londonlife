'use client';

import { useState } from 'react';
import { STYLE_PROMPTS, STYLE_CATEGORIES, getStylesByCategory } from '@/lib/prompts';

export function StyleShowcase() {
  const [activeCategory, setActiveCategory] = useState('professional');
  const [hoveredStyle, setHoveredStyle] = useState<string | null>(null);

  const categoryStyles = getStylesByCategory(activeCategory as 'professional' | 'creative' | 'artistic' | 'specialty');

  return (
    <section className="py-24 relative overflow-hidden" id="styles">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950" />
      <div className="absolute inset-0 bg-grid opacity-20" />

      {/* Decorative gradient */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-indigo-500/10 rounded-full blur-3xl" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-6">
            <span className="material-symbols-outlined text-indigo-400 text-sm">palette</span>
            <span className="text-sm text-indigo-300">18+ Professional Styles</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
            Choose Your Perfect <span className="gradient-text">Style</span>
          </h2>
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
            From corporate executive to creative artist, we have a style for every
            profession, personality, and platform.
          </p>
        </div>

        {/* Category tabs */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {STYLE_CATEGORIES.map((category) => (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium transition-all ${
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

        {/* Category description */}
        <div className="text-center mb-8">
          <p className="text-zinc-500">
            {STYLE_CATEGORIES.find(c => c.id === activeCategory)?.description}
          </p>
        </div>

        {/* Styles grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
          {categoryStyles.map((style) => (
            <div
              key={style.id}
              onMouseEnter={() => setHoveredStyle(style.id)}
              onMouseLeave={() => setHoveredStyle(null)}
              className="group relative"
            >
              <div className={`relative rounded-2xl overflow-hidden border transition-all duration-300 cursor-pointer ${
                hoveredStyle === style.id
                  ? 'border-indigo-500 shadow-xl shadow-indigo-500/20 scale-[1.02]'
                  : 'border-zinc-800 hover:border-zinc-700'
              }`}>
                {/* Style preview */}
                <div
                  className="aspect-[3/4] relative"
                  style={{
                    background: `linear-gradient(135deg, ${style.previewColor}dd, ${style.previewColor}99)`
                  }}
                >
                  {/* Icon */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="material-symbols-outlined text-6xl text-white/30">
                      {style.icon}
                    </span>
                  </div>

                  {/* Hover overlay with details */}
                  <div className={`absolute inset-0 bg-zinc-900/95 p-4 flex flex-col transition-opacity ${
                    hoveredStyle === style.id ? 'opacity-100' : 'opacity-0'
                  }`}>
                    {/* Best for tags */}
                    <div className="flex-1">
                      <p className="text-xs text-zinc-500 mb-2">Best for:</p>
                      <div className="flex flex-wrap gap-1">
                        {style.bestFor.map((use) => (
                          <span key={use} className="px-2 py-0.5 bg-zinc-800 rounded text-xs text-zinc-300">
                            {use}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* CTA */}
                    <button className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1">
                      <span className="material-symbols-outlined text-base">add</span>
                      Use This Style
                    </button>
                  </div>

                  {/* Gradient overlay */}
                  <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-zinc-900 to-transparent" />
                </div>

                {/* Style info */}
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-white mb-0.5">{style.name}</h3>
                      <p className="text-xs text-zinc-400">{style.shortDescription}</p>
                    </div>
                    <span className="material-symbols-outlined text-lg text-white/50">{style.icon}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* All styles count */}
        <div className="mt-12 text-center">
          <p className="text-zinc-500 mb-4">
            Showing {categoryStyles.length} styles in {STYLE_CATEGORIES.find(c => c.id === activeCategory)?.name}.
            <span className="text-white ml-1">{STYLE_PROMPTS.length} total styles available.</span>
          </p>
          <a
            href="/dashboard/create"
            className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
          >
            <span>Explore all styles</span>
            <span className="material-symbols-outlined text-lg">arrow_forward</span>
          </a>
        </div>

        {/* Feature highlights */}
        <div className="mt-16 grid md:grid-cols-3 gap-6">
          {[
            {
              icon: 'psychology',
              title: 'AI-Powered Style Matching',
              description: 'Our AI understands your profession and suggests the perfect style for your needs.'
            },
            {
              icon: 'tune',
              title: 'Customizable Settings',
              description: 'Adjust background, lighting, and more to get exactly the look you want.'
            },
            {
              icon: 'face',
              title: 'Identity Preservation',
              description: 'Advanced technology ensures you look like you — just more professional.'
            }
          ].map((feature) => (
            <div key={feature.title} className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800">
              <span className="material-symbols-outlined text-3xl text-indigo-400 mb-4 block">{feature.icon}</span>
              <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
              <p className="text-sm text-zinc-400">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
