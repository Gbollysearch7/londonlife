'use client';

import { useState } from 'react';

interface CustomizeOptions {
  background: string;
  lighting: string;
  variations: number;
}

interface CustomizeStepProps {
  options: CustomizeOptions;
  onOptionsChange: (options: CustomizeOptions) => void;
}

const backgrounds = [
  { id: 'auto', label: 'Auto (Style Default)', color: null, icon: 'auto_awesome' },
  { id: 'gradient-dark', label: 'Dark Gradient', color: 'linear-gradient(135deg, #1a1a2e, #16213e)', icon: 'gradient' },
  { id: 'gradient-light', label: 'Light Gradient', color: 'linear-gradient(135deg, #f5f5f5, #e0e0e0)', icon: 'gradient' },
  { id: 'solid-white', label: 'Solid White', color: '#ffffff', icon: 'square' },
  { id: 'solid-gray', label: 'Solid Gray', color: '#e5e7eb', icon: 'square' },
  { id: 'solid-dark', label: 'Solid Dark', color: '#18181b', icon: 'square' },
  { id: 'blur', label: 'Blurred Original', color: null, icon: 'blur_on' },
];

const lightingOptions = [
  { id: 'auto', label: 'Auto (Style Default)', icon: 'auto_awesome', description: 'Best for the selected style' },
  { id: 'soft', label: 'Soft & Even', icon: 'wb_twilight', description: 'Gentle, flattering light' },
  { id: 'dramatic', label: 'Dramatic', icon: 'contrast', description: 'High contrast, defined shadows' },
  { id: 'natural', label: 'Natural', icon: 'wb_sunny', description: 'Like natural daylight' },
];

const variationOptions = [1, 2, 3, 4];

export function CustomizeStep({ options, onOptionsChange }: CustomizeStepProps) {
  const updateOption = <K extends keyof CustomizeOptions>(key: K, value: CustomizeOptions[K]) => {
    onOptionsChange({ ...options, [key]: value });
  };

  return (
    <div className="space-y-8">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2">Customize Your Headshot</h2>
        <p className="text-zinc-400">
          Fine-tune the look to match your preferences
        </p>
      </div>

      {/* Background selection */}
      <div>
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-indigo-400">wallpaper</span>
          Background
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {backgrounds.map((bg) => (
            <button
              key={bg.id}
              onClick={() => updateOption('background', bg.id)}
              className={`p-4 rounded-xl border text-left transition-all ${
                options.background === bg.id
                  ? 'border-indigo-500 bg-indigo-500/10'
                  : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'
              }`}
            >
              <div
                className="w-full aspect-video rounded-lg mb-3 border border-zinc-700 flex items-center justify-center"
                style={{
                  background: bg.color || (bg.id === 'auto' ? 'linear-gradient(135deg, #6366f1, #a855f7)' : '#27272a')
                }}
              >
                <span className="material-symbols-outlined text-white/50">{bg.icon}</span>
              </div>
              <p className="text-sm font-medium">{bg.label}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Lighting selection */}
      <div>
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-indigo-400">wb_sunny</span>
          Lighting Style
        </h3>
        <div className="grid sm:grid-cols-2 gap-3">
          {lightingOptions.map((lighting) => (
            <button
              key={lighting.id}
              onClick={() => updateOption('lighting', lighting.id)}
              className={`p-4 rounded-xl border text-left transition-all flex items-start gap-4 ${
                options.lighting === lighting.id
                  ? 'border-indigo-500 bg-indigo-500/10'
                  : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'
              }`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                options.lighting === lighting.id ? 'bg-indigo-500/20' : 'bg-zinc-800'
              }`}>
                <span className={`material-symbols-outlined text-2xl ${
                  options.lighting === lighting.id ? 'text-indigo-400' : 'text-zinc-500'
                }`}>
                  {lighting.icon}
                </span>
              </div>
              <div>
                <p className="font-medium">{lighting.label}</p>
                <p className="text-sm text-zinc-500">{lighting.description}</p>
              </div>
              {options.lighting === lighting.id && (
                <span className="material-symbols-outlined text-indigo-400 ml-auto">check_circle</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Variations */}
      <div>
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-indigo-400">photo_library</span>
          Number of Variations
        </h3>
        <p className="text-sm text-zinc-500 mb-4">
          Generate multiple variations to choose from. Each variation uses 1 credit.
        </p>
        <div className="flex gap-3">
          {variationOptions.map((num) => (
            <button
              key={num}
              onClick={() => updateOption('variations', num)}
              className={`flex-1 py-4 rounded-xl border text-center transition-all ${
                options.variations === num
                  ? 'border-indigo-500 bg-indigo-500/10 text-white'
                  : 'border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-700 hover:text-white'
              }`}
            >
              <div className="text-2xl font-bold mb-1">{num}</div>
              <div className="text-xs">{num === 1 ? 'variation' : 'variations'}</div>
            </button>
          ))}
        </div>
        <p className="text-xs text-zinc-600 mt-2 text-center">
          This will use {options.variations} credit{options.variations > 1 ? 's' : ''}
        </p>
      </div>

      {/* Summary */}
      <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800">
        <h4 className="font-medium mb-3">Summary</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-zinc-500">Background:</span>
            <span>{backgrounds.find(b => b.id === options.background)?.label}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Lighting:</span>
            <span>{lightingOptions.find(l => l.id === options.lighting)?.label}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Variations:</span>
            <span>{options.variations}</span>
          </div>
          <div className="flex justify-between pt-2 border-t border-zinc-800">
            <span className="text-zinc-500">Credits used:</span>
            <span className="text-indigo-400 font-medium">{options.variations}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
