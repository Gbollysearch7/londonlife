'use client';

import Link from 'next/link';
import type { GeneratedImage } from '@/lib/storage';

interface RecentGenerationsProps {
  images: GeneratedImage[];
}

export function RecentGenerations({ images }: RecentGenerationsProps) {
  if (images.length === 0) {
    return (
      <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-zinc-800 flex items-center justify-center">
          <span className="material-symbols-outlined text-3xl text-zinc-600">photo_library</span>
        </div>
        <h3 className="text-lg font-semibold mb-2">No headshots yet</h3>
        <p className="text-zinc-500 mb-6 max-w-sm mx-auto">
          Create your first professional headshot in under 60 seconds.
        </p>
        <Link
          href="/dashboard/create"
          className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-semibold transition-colors"
        >
          <span className="material-symbols-outlined">add_photo_alternate</span>
          Create Your First Headshot
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
        <h2 className="font-semibold flex items-center gap-2">
          <span className="material-symbols-outlined text-indigo-400">history</span>
          Recent Generations
        </h2>
        <Link
          href="/dashboard/gallery"
          className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1"
        >
          View all
          <span className="material-symbols-outlined text-lg">arrow_forward</span>
        </Link>
      </div>

      {/* Grid */}
      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
        {images.map((image) => (
          <div
            key={image.id}
            className="group relative aspect-[3/4] rounded-xl bg-zinc-800 overflow-hidden cursor-pointer"
          >
            {/* Placeholder for image */}
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/50 to-purple-900/50 flex items-center justify-center">
              <span className="material-symbols-outlined text-4xl text-white/30">person</span>
            </div>

            {/* Favorite indicator */}
            {image.isFavorite && (
              <div className="absolute top-2 right-2">
                <span className="material-symbols-outlined text-pink-500">favorite</span>
              </div>
            )}

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
              <span className="text-xs text-zinc-300">{image.styleName}</span>
              <div className="flex gap-2">
                <button className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
                  <span className="material-symbols-outlined text-lg">download</span>
                </button>
                <button className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
                  <span className="material-symbols-outlined text-lg">visibility</span>
                </button>
              </div>
            </div>

            {/* Style badge */}
            <div className="absolute bottom-2 left-2 right-2">
              <div className="px-2 py-1 rounded-lg bg-black/50 backdrop-blur-sm">
                <p className="text-xs text-white truncate">{image.styleName}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
