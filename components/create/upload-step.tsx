'use client';

import { useState, useCallback } from 'react';

interface UploadStepProps {
  onImageSelect: (image: string, file: File) => void;
  selectedImage: string | null;
}

export function UploadStep({ onImageSelect, selectedImage }: UploadStepProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, []);

  const processFile = (file: File) => {
    setError(null);

    // Validate file type
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Please upload a JPG, PNG, or WebP image.');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be less than 10MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      onImageSelect(result, file);
    };
    reader.readAsDataURL(file);
  };

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (items) {
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) processFile(file);
        }
      }
    }
  }, []);

  // Add paste listener
  if (typeof window !== 'undefined') {
    window.addEventListener('paste', handlePaste as EventListener);
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2">Upload Your Selfie</h2>
        <p className="text-zinc-400">
          Drag and drop your photo, paste from clipboard, or click to browse
        </p>
      </div>

      {/* Upload zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all ${
          isDragging
            ? 'border-indigo-500 bg-indigo-500/10'
            : selectedImage
            ? 'border-emerald-500/50 bg-emerald-500/5'
            : 'border-zinc-700 hover:border-zinc-600 bg-zinc-900/50'
        }`}
      >
        {selectedImage ? (
          <div className="space-y-4">
            <div className="relative w-48 h-64 mx-auto rounded-xl overflow-hidden border-2 border-emerald-500/50 shadow-lg shadow-emerald-500/10">
              <img
                src={selectedImage}
                alt="Selected"
                className="w-full h-full object-cover"
              />
              <div className="absolute top-2 right-2 w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
                <span className="material-symbols-outlined text-white text-lg">check</span>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 text-emerald-400">
              <span className="material-symbols-outlined">check_circle</span>
              <span>Image ready for transformation</span>
            </div>
            <button
              onClick={() => onImageSelect('', null as unknown as File)}
              className="text-sm text-zinc-500 hover:text-white transition-colors"
            >
              Choose a different photo
            </button>
          </div>
        ) : (
          <>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileSelect}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="space-y-4">
              <div className={`w-20 h-20 mx-auto rounded-2xl flex items-center justify-center transition-colors ${
                isDragging ? 'bg-indigo-500/20' : 'bg-zinc-800'
              }`}>
                <span className={`material-symbols-outlined text-4xl ${
                  isDragging ? 'text-indigo-400' : 'text-zinc-500'
                }`}>
                  cloud_upload
                </span>
              </div>
              <div>
                <p className="text-lg font-medium mb-1">
                  {isDragging ? 'Drop your image here' : 'Drop your selfie here'}
                </p>
                <p className="text-sm text-zinc-500">
                  or <span className="text-indigo-400">click to browse</span>
                </p>
              </div>
              <div className="flex items-center justify-center gap-4 text-xs text-zinc-600">
                <span>JPG, PNG, WebP</span>
                <span>•</span>
                <span>Max 10MB</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
          <span className="material-symbols-outlined">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* Tips */}
      <div className="grid sm:grid-cols-3 gap-4">
        {[
          { icon: 'wb_sunny', title: 'Good Lighting', desc: 'Natural daylight works best' },
          { icon: 'face', title: 'Face the Camera', desc: 'Look directly at the lens' },
          { icon: 'crop_free', title: 'Clear View', desc: 'No sunglasses or obstructions' }
        ].map((tip) => (
          <div key={tip.title} className="flex items-start gap-3 p-4 rounded-xl bg-zinc-900/50 border border-zinc-800">
            <span className="material-symbols-outlined text-indigo-400">{tip.icon}</span>
            <div>
              <p className="font-medium text-sm">{tip.title}</p>
              <p className="text-xs text-zinc-500">{tip.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
