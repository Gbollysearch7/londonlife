'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/dashboard/header';
import { getFavorites, toggleFavorite, removeFromGallery, type GeneratedImage } from '@/lib/storage';
import Link from 'next/link';

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<GeneratedImage[]>([]);
  const [modalImage, setModalImage] = useState<GeneratedImage | null>(null);

  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = () => {
    const favs = getFavorites();
    setFavorites(favs);
  };

  const handleToggleFavorite = (id: string) => {
    toggleFavorite(id);
    loadFavorites();
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this headshot?')) {
      removeFromGallery(id);
      loadFavorites();
    }
  };

  const handleDownload = (image: GeneratedImage) => {
    const link = document.createElement('a');
    link.href = image.generatedImage;
    link.download = `headshot-${image.styleName.toLowerCase().replace(/\s+/g, '-')}.png`;
    link.click();
  };

  return (
    <>
      <Header
        title="Favorites"
        subtitle={`${favorites.length} favorite headshot${favorites.length !== 1 ? 's' : ''}`}
        action={{
          label: 'Create New',
          href: '/dashboard/create',
          icon: 'add_photo_alternate'
        }}
      />

      {/* Gallery content */}
      {favorites.length === 0 ? (
        <div className="text-center py-16 bg-zinc-900/50 rounded-2xl border border-zinc-800">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-zinc-800 flex items-center justify-center">
            <span className="material-symbols-outlined text-4xl text-zinc-600">favorite</span>
          </div>
          <h3 className="text-xl font-semibold mb-2">No favorites yet</h3>
          <p className="text-zinc-500 mb-6 max-w-sm mx-auto">
            Mark your best headshots as favorites and they&apos;ll appear here for quick access.
          </p>
          <Link
            href="/dashboard/gallery"
            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-semibold transition-colors"
          >
            <span className="material-symbols-outlined">photo_library</span>
            Browse Gallery
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {favorites.map((image) => (
            <div
              key={image.id}
              className="group relative aspect-[3/4] rounded-xl overflow-hidden bg-zinc-800 border-2 border-zinc-700 hover:border-pink-500/50 transition-all cursor-pointer"
            >
              {/* Image */}
              <div
                className="absolute inset-0 bg-gradient-to-br from-indigo-900/50 to-purple-900/50 flex items-center justify-center"
                onClick={() => setModalImage(image)}
              >
                <span className="material-symbols-outlined text-4xl text-white/30">person</span>
              </div>

              {/* Favorite badge */}
              <div className="absolute top-2 right-2">
                <span className="material-symbols-outlined text-xl text-pink-500">favorite</span>
              </div>

              {/* Overlay with actions */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <p className="text-sm font-medium mb-1">{image.styleName}</p>
                  <p className="text-xs text-zinc-400">
                    {new Date(image.createdAt).toLocaleDateString()}
                  </p>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(image);
                      }}
                      className="flex-1 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs flex items-center justify-center gap-1 transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">download</span>
                      Download
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleFavorite(image.id);
                      }}
                      className="py-1.5 px-2 bg-pink-500/20 hover:bg-pink-500/30 rounded-lg text-pink-400 transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">heart_minus</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(image.id);
                      }}
                      className="py-1.5 px-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-red-400 transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick actions */}
      {favorites.length > 0 && (
        <div className="mt-8 p-6 bg-gradient-to-br from-pink-500/10 to-purple-500/10 rounded-2xl border border-pink-500/20">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-pink-500/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl text-pink-400">download</span>
              </div>
              <div>
                <p className="font-semibold">Download All Favorites</p>
                <p className="text-sm text-zinc-400">Get all your best headshots in one click</p>
              </div>
            </div>
            <button
              onClick={() => favorites.forEach(img => handleDownload(img))}
              className="px-6 py-3 bg-pink-600 hover:bg-pink-500 rounded-xl font-medium transition-colors flex items-center gap-2"
            >
              <span className="material-symbols-outlined">download</span>
              Download {favorites.length} Image{favorites.length !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      )}

      {/* Modal */}
      {modalImage && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setModalImage(null)}
        >
          <div
            className="bg-zinc-900 rounded-2xl border border-zinc-800 max-w-2xl w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-pink-500">favorite</span>
                <h3 className="font-semibold">{modalImage.styleName}</h3>
              </div>
              <button
                onClick={() => setModalImage(null)}
                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Image */}
            <div className="aspect-[3/4] bg-gradient-to-br from-indigo-900/50 to-purple-900/50 flex items-center justify-center">
              <span className="material-symbols-outlined text-6xl text-white/30">person</span>
            </div>

            {/* Actions */}
            <div className="p-4 flex gap-3">
              <button
                onClick={() => handleDownload(modalImage)}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <span className="material-symbols-outlined">download</span>
                Download
              </button>
              <button
                onClick={() => {
                  handleToggleFavorite(modalImage.id);
                  setModalImage(null);
                }}
                className="py-3 px-4 bg-pink-500/20 hover:bg-pink-500/30 rounded-xl transition-colors"
              >
                <span className="material-symbols-outlined text-pink-500">heart_minus</span>
              </button>
              <Link
                href={`/dashboard/create?style=${modalImage.styleId}`}
                className="py-3 px-4 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors"
              >
                <span className="material-symbols-outlined">refresh</span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
