"use client";

interface GenerationResultProps {
  images: Array<{ url: string; width: number; height: number }>;
  onReset: () => void;
  styleName: string;
}

export function GenerationResult({ images, onReset, styleName }: GenerationResultProps) {
  const handleDownload = async (url: string, index: number) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `headshot-${styleName.toLowerCase().replace(/\s+/g, "-")}-${index + 1}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Download failed:", error);
      window.open(url, "_blank");
    }
  };

  const handleShare = async (url: string) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "My AI Headshot",
          text: "Check out my new professional headshot!",
          url: url,
        });
      } catch (error) {
        console.error("Share failed:", error);
      }
    } else {
      navigator.clipboard.writeText(url);
      alert("Image URL copied to clipboard!");
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 mb-4">
          <span className="material-symbols-outlined text-green-500 text-[32px]">check_circle</span>
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Your Headshots Are Ready!</h2>
        <p className="text-[#71717a]">
          Generated with <span className="text-indigo-400 font-medium">{styleName}</span> style
        </p>
      </div>

      {/* Images Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {images.map((image, index) => (
          <div key={index} className="group bg-[#18181b] border border-[#27272a] rounded-2xl overflow-hidden hover:border-indigo-500/30 transition-all">
            <div className="relative aspect-square">
              <img
                src={image.url}
                alt={`Generated headshot ${index + 1}`}
                className="w-full h-full object-cover"
              />

              {/* Overlay Actions */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                <button
                  onClick={() => handleDownload(image.url, index)}
                  className="flex items-center px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-sm font-medium transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px] mr-2">download</span>
                  Download
                </button>
                <button
                  onClick={() => handleShare(image.url)}
                  className="flex items-center justify-center w-10 h-10 bg-[#27272a] hover:bg-[#3f3f46] text-white rounded-xl transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">share</span>
                </button>
              </div>
            </div>

            {/* Image Info */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md bg-green-500/10 text-green-500 border border-green-500/20">
                  Ready
                </span>
                <span className="text-sm text-[#71717a]">
                  {image.width} x {image.height}
                </span>
              </div>
              <button
                onClick={() => handleDownload(image.url, index)}
                className="flex items-center text-sm font-medium text-[#a1a1aa] hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined text-[18px] mr-1">download</span>
                Save
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex justify-center gap-4">
        <button
          onClick={onReset}
          className="flex items-center px-6 py-3 bg-[#18181b] border border-[#27272a] hover:border-indigo-500/30 text-white rounded-xl font-medium transition-all hover:bg-[#27272a]"
        >
          <span className="material-symbols-outlined text-[20px] mr-2">refresh</span>
          Generate Another
        </button>
      </div>
    </div>
  );
}
