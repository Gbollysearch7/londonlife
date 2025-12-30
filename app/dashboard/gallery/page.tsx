'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/dashboard/header';
import { getGallery, toggleFavorite, removeFromGallery, type GeneratedImage } from '@/lib/storage';

type ViewMode = 'grid' | 'list';
type SortBy = 'date' | 'style' | 'favorites';

export default function GalleryPage() {
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [filterStyle, setFilterStyle] = useState<string>('all');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [modalImage, setModalImage] = useState<GeneratedImage | null>(null);

  useEffect(() => {
    loadImages();
  }, []);

  const loadImages = () => {
    const gallery = getGallery();
    setImages(gallery);
  };

  const handleToggleFavorite = (id: string) => {
    toggleFavorite(id);
    loadImages();
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this headshot?')) {
      removeFromGallery(id);
      loadImages();
    }
  };

  const handleBulkDelete = () => {
    if (confirm(`Delete ${selectedImages.length} selected headshots?`)) {
      selectedImages.forEach(id => removeFromGallery(id));
      setSelectedImages([]);
      loadImages();
    }
  };

  const handleDownload = (image: GeneratedImage) => {
    const link = document.createElement('a');
    link.href = image.generatedImage;
    link.download = `headshot-${image.styleName.toLowerCase().replace(/\s+/g, '-')}.png`;
    link.click();
  };

  const toggleSelectImage = (id: string) => {
    setSelectedImages(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Get unique styles for filter
  const uniqueStyles = [...new Set(images.map(img => img.styleName))];

  // Filter and sort images
  let filteredImages = [...images];

  if (filterStyle !== 'all') {
    filteredImages = filteredImages.filter(img => img.styleName === filterStyle);
  }

  switch (sortBy) {
    case 'favorites':
      filteredImages.sort((a, b) => (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0));
      break;
    case 'style':
      filteredImages.sort((a, b) => a.styleName.localeCompare(b.styleName));
      break;
    case 'date':
    default:
      filteredImages.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  return (
    <>
      <Header
        title="My Gallery"
        subtitle={`${images.length} headshot${images.length !== 1 ? 's' : ''} created`}
        action={{
          label: 'Create New',
          href: '/dashboard/create',
          icon: 'add_photo_alternate'
        }}
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          {/* View mode toggle */}
          <div className="flex items-center bg-zinc-900 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'grid' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-lg">grid_view</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'list' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-lg">view_list</span>
            </button>
          </div>

          {/* Sort dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
          >
            <option value="date">Sort by Date</option>
            <option value="style">Sort by Style</option>
            <option value="favorites">Favorites First</option>
          </select>

          {/* Style filter */}
          <select
            value={filterStyle}
            onChange={(e) => setFilterStyle(e.target.value)}
            className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Styles</option>
            {uniqueStyles.map(style => (
              <option key={style} value={style}>{style}</option>
            ))}
          </select>
        </div>

        {/* Bulk actions */}
        {selectedImages.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-500">{selectedImages.length} selected</span>
            <button
              onClick={handleBulkDelete}
              className="px-4 py-2 bg-red-500/10 text-red-400 rounded-lg text-sm hover:bg-red-500/20 transition-colors"
            >
              Delete Selected
            </button>
            <button
              onClick={() => setSelectedImages([])}
              className="px-4 py-2 bg-zinc-800 text-zinc-400 rounded-lg text-sm hover:bg-zinc-700 transition-colors"
            >
              Clear Selection
            </button>
          </div>
        )}
      </div>

      {/* Gallery content */}
      {images.length === 0 ? (
        <div className="text-center py-16 bg-zinc-900/50 rounded-2xl border border-zinc-800">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-zinc-800 flex items-center justify-center">
            <span className="material-symbols-outlined text-4xl text-zinc-600">photo_library</span>
          </div>
          <h3 className="text-xl font-semibold mb-2">Your gallery is empty</h3>
          <p className="text-zinc-500 mb-6 max-w-sm mx-auto">
            Create your first professional headshot and it will appear here.
          </p>
          <a
            href="/dashboard/create"
            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-semibold transition-colors"
          >
            <span className="material-symbols-outlined">add_photo_alternate</span>
            Create Your First Headshot
          </a>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredImages.map((image) => (
            <div
              key={image.id}
              className={`group relative aspect-[3/4] rounded-xl overflow-hidden bg-zinc-800 border-2 transition-all cursor-pointer ${
                selectedImages.includes(image.id)
                  ? 'border-indigo-500 ring-2 ring-indigo-500/50'
                  : 'border-zinc-700 hover:border-zinc-600'
              }`}
            >
              {/* Image */}
              <div
                className="absolute inset-0 bg-gradient-to-br from-indigo-900/50 to-purple-900/50 flex items-center justify-center"
                onClick={() => setModalImage(image)}
              >
                <span className="material-symbols-outlined text-4xl text-white/30">person</span>
              </div>

              {/* Selection checkbox */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSelectImage(image.id);
                }}
                className={`absolute top-2 left-2 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                  selectedImages.includes(image.id)
                    ? 'bg-indigo-600 border-indigo-600'
                    : 'bg-black/50 border-white/30 opacity-0 group-hover:opacity-100'
                }`}
              >
                {selectedImages.includes(image.id) && (
                  <span className="material-symbols-outlined text-white text-sm">check</span>
                )}
              </button>

              {/* Favorite button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleFavorite(image.id);
                }}
                className="absolute top-2 right-2"
              >
                <span className={`material-symbols-outlined text-xl ${
                  image.isFavorite ? 'text-pink-500' : 'text-white/50 hover:text-pink-400'
                }`}>
                  {image.isFavorite ? 'favorite' : 'favorite_border'}
                </span>
              </button>

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
      ) : (
        <div className="space-y-3">
          {filteredImages.map((image) => (
            <div
              key={image.id}
              className={`flex items-center gap-4 p-4 rounded-xl bg-zinc-900/50 border transition-all ${
                selectedImages.includes(image.id)
                  ? 'border-indigo-500'
                  : 'border-zinc-800 hover:border-zinc-700'
              }`}
            >
              {/* Checkbox */}
              <button
                onClick={() => toggleSelectImage(image.id)}
                className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                  selectedImages.includes(image.id)
                    ? 'bg-indigo-600 border-indigo-600'
                    : 'border-zinc-600'
                }`}
              >
                {selectedImages.includes(image.id) && (
                  <span className="material-symbols-outlined text-white text-sm">check</span>
                )}
              </button>

              {/* Thumbnail */}
              <div
                className="w-16 h-20 rounded-lg bg-gradient-to-br from-indigo-900/50 to-purple-900/50 flex items-center justify-center cursor-pointer"
                onClick={() => setModalImage(image)}
              >
                <span className="material-symbols-outlined text-white/30">person</span>
              </div>

              {/* Info */}
              <div className="flex-1">
                <p className="font-medium">{image.styleName}</p>
                <p className="text-sm text-zinc-500">
                  {new Date(image.createdAt).toLocaleDateString()} at{' '}
                  {new Date(image.createdAt).toLocaleTimeString()}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleFavorite(image.id)}
                  className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
                >
                  <span className={`material-symbols-outlined ${
                    image.isFavorite ? 'text-pink-500' : 'text-zinc-500'
                  }`}>
                    {image.isFavorite ? 'favorite' : 'favorite_border'}
                  </span>
                </button>
                <button
                  onClick={() => handleDownload(image)}
                  className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
                >
                  <span className="material-symbols-outlined text-zinc-500">download</span>
                </button>
                <button
                  onClick={() => handleDelete(image.id)}
                  className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
                >
                  <span className="material-symbols-outlined text-zinc-500">delete</span>
                </button>
              </div>
            </div>
          ))}
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
              <h3 className="font-semibold">{modalImage.styleName}</h3>
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
                onClick={() => handleToggleFavorite(modalImage.id)}
                className="py-3 px-4 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors"
              >
                <span className={`material-symbols-outlined ${
                  modalImage.isFavorite ? 'text-pink-500' : 'text-zinc-400'
                }`}>
                  {modalImage.isFavorite ? 'favorite' : 'favorite_border'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
