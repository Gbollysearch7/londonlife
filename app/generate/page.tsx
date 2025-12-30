"use client";

import { useState } from "react";
import { PhotoUpload } from "@/components/photo-upload";
import { StyleSelector } from "@/components/style-selector";
import { GenerationResult } from "@/components/generation-result";
import { getStyleById } from "@/lib/styles";

type Step = "upload" | "style" | "generating" | "result";

interface GeneratedImage {
  url: string;
  width: number;
  height: number;
}

export default function GeneratePage() {
  const [step, setStep] = useState<Step>("upload");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleImageSelect = (imageData: string) => {
    setSelectedImage(imageData);
    setStep("style");
  };

  const handleClearImage = () => {
    setSelectedImage(null);
    setStep("upload");
  };

  const handleStyleSelect = (styleId: string) => {
    setSelectedStyle(styleId);
  };

  const handleGenerate = async () => {
    if (!selectedImage || !selectedStyle) return;

    setStep("generating");
    setError(null);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageData: selectedImage,
          styleId: selectedStyle,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate image");
      }

      setGeneratedImages(data.images);
      setStep("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStep("style");
    }
  };

  const handleReset = () => {
    setSelectedImage(null);
    setSelectedStyle(null);
    setGeneratedImages([]);
    setError(null);
    setStep("upload");
  };

  const selectedStyleData = selectedStyle ? getStyleById(selectedStyle) : null;

  return (
    <div className="min-h-screen pt-24 pb-16 bg-[#09090b]">
      {/* Background Effects */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[100px] translate-x-1/2 -translate-y-1/2" />
      </div>

      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Create Your <span className="gradient-text">Professional Headshot</span>
          </h1>
          <p className="text-[#71717a] max-w-xl mx-auto">
            Upload a selfie, choose a style, and get your AI-generated professional headshot in seconds
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-4 mb-12">
          {["Upload", "Style", "Generate"].map((label, index) => {
            const stepIndex = ["upload", "style", "generating", "result"].indexOf(step);
            const isActive = index <= stepIndex || (step === "result" && index <= 2);
            const isCurrent =
              (step === "upload" && index === 0) ||
              (step === "style" && index === 1) ||
              ((step === "generating" || step === "result") && index === 2);

            return (
              <div key={label} className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold transition-all ${
                      isActive
                        ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/25"
                        : "bg-[#27272a] text-[#71717a]"
                    } ${isCurrent ? "ring-2 ring-indigo-400 ring-offset-2 ring-offset-[#09090b]" : ""}`}
                  >
                    {isActive && index < stepIndex ? (
                      <span className="material-symbols-outlined text-[18px]">check</span>
                    ) : (
                      index + 1
                    )}
                  </div>
                  <span className={`text-sm font-medium ${isActive ? "text-white" : "text-[#71717a]"}`}>
                    {label}
                  </span>
                </div>
                {index < 2 && (
                  <div className={`w-12 h-0.5 rounded ${isActive ? "bg-indigo-500" : "bg-[#27272a]"}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Main Content Card */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-8">
          {step === "upload" && (
            <div className="space-y-6">
              <PhotoUpload
                onImageSelect={handleImageSelect}
                selectedImage={selectedImage}
                onClear={handleClearImage}
              />
            </div>
          )}

          {step === "style" && (
            <div className="space-y-8">
              {/* Preview of selected image */}
              {selectedImage && (
                <div className="flex justify-center">
                  <div className="relative w-32 h-32 rounded-xl overflow-hidden border-2 border-indigo-500/50 shadow-lg shadow-indigo-500/10">
                    <img
                      src={selectedImage}
                      alt="Your photo"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              )}

              <StyleSelector
                selectedStyle={selectedStyle}
                onSelectStyle={handleStyleSelect}
              />

              {error && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">error</span>
                  {error}
                </div>
              )}

              <div className="flex justify-between gap-4">
                <button
                  onClick={() => setStep("upload")}
                  className="flex items-center px-5 py-3 bg-[#27272a] hover:bg-[#3f3f46] text-white rounded-xl font-medium transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px] mr-2">arrow_back</span>
                  Back
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={!selectedStyle}
                  className={`flex items-center flex-1 max-w-xs justify-center px-6 py-3 rounded-xl font-semibold transition-all ${
                    selectedStyle
                      ? "bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-500/25"
                      : "bg-[#27272a] text-[#71717a] cursor-not-allowed"
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px] mr-2">auto_awesome</span>
                  Generate Headshot
                  <span className="material-symbols-outlined text-[18px] ml-2">arrow_forward</span>
                </button>
              </div>
            </div>
          )}

          {step === "generating" && (
            <div className="py-16 text-center space-y-6">
              <div className="relative w-24 h-24 mx-auto">
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-indigo-500 to-indigo-600 animate-spin" style={{ animationDuration: "3s" }} />
                <div className="absolute inset-2 rounded-full bg-[#18181b] flex items-center justify-center">
                  <span className="material-symbols-outlined text-indigo-400 text-[32px] animate-pulse">auto_awesome</span>
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">
                  Creating Your Headshot
                </h3>
                <p className="text-[#a1a1aa]">
                  Applying <span className="text-indigo-400 font-medium">{selectedStyleData?.name}</span> style...
                </p>
                <div className="flex items-center justify-center gap-2 mt-4 text-sm text-[#71717a]">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                  This usually takes 10-30 seconds
                </div>
              </div>
            </div>
          )}

          {step === "result" && generatedImages.length > 0 && (
            <GenerationResult
              images={generatedImages}
              onReset={handleReset}
              styleName={selectedStyleData?.name || ""}
            />
          )}
        </div>
      </div>
    </div>
  );
}
