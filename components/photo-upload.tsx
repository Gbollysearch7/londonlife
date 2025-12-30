"use client";

import { useCallback, useState } from "react";

interface PhotoUploadProps {
  onImageSelect: (imageData: string) => void;
  selectedImage: string | null;
  onClear: () => void;
}

export function PhotoUpload({ onImageSelect, selectedImage, onClear }: PhotoUploadProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      onImageSelect(result);
    };
    reader.readAsDataURL(file);
  }, [onImageSelect]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  if (selectedImage) {
    return (
      <div className="relative max-w-md mx-auto">
        <div className="relative aspect-square rounded-2xl overflow-hidden border-2 border-indigo-500/50 shadow-2xl shadow-indigo-500/20">
          <img
            src={selectedImage}
            alt="Selected selfie"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        </div>
        <button
          onClick={onClear}
          className="absolute top-4 right-4 flex items-center px-3 py-2 bg-[#18181b]/80 backdrop-blur-sm border border-[#27272a] text-white rounded-lg text-sm font-medium hover:bg-[#27272a] transition-colors"
        >
          <span className="material-symbols-outlined text-[16px] mr-1">close</span>
          Change
        </button>
      </div>
    );
  }

  return (
    <div
      className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 cursor-pointer ${
        isDragging
          ? "border-indigo-500 bg-indigo-500/10"
          : "border-[#27272a] hover:border-indigo-500/50 hover:bg-[#18181b]"
      }`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <input
        type="file"
        accept="image/*"
        onChange={handleInputChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />

      <div className="flex flex-col items-center gap-4">
        <div className={`w-20 h-20 rounded-2xl flex items-center justify-center border transition-colors ${
          isDragging
            ? "bg-indigo-500/20 border-indigo-500/50"
            : "bg-[#27272a] border-[#3f3f46]"
        }`}>
          <span className={`material-symbols-outlined text-[36px] ${isDragging ? "text-indigo-400" : "text-[#71717a]"}`}>
            {isDragging ? "photo_library" : "cloud_upload"}
          </span>
        </div>

        <div>
          <p className="text-lg font-semibold text-white mb-1">
            {isDragging ? "Drop your photo here" : "Upload your selfie"}
          </p>
          <p className="text-sm text-[#71717a]">
            Drag and drop or click to browse
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-[#52525b]">
          <span className="px-2 py-1 rounded bg-[#27272a]">JPG</span>
          <span className="px-2 py-1 rounded bg-[#27272a]">PNG</span>
          <span className="px-2 py-1 rounded bg-[#27272a]">WebP</span>
          <span className="text-[#71717a]">• Max 10MB</span>
        </div>
      </div>
    </div>
  );
}
