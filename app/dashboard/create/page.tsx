'use client';

import { useState, useCallback } from 'react';
import { Header } from '@/components/dashboard/header';
import { UploadStep } from '@/components/create/upload-step';
import { StyleStep } from '@/components/create/style-step';
import { CustomizeStep } from '@/components/create/customize-step';
import { GenerateStep } from '@/components/create/generate-step';
import { ResultsStep } from '@/components/create/results-step';
import { generateFinalPrompt, type StylePrompt } from '@/lib/prompts';
import { addToGallery, addToHistory, generateId, useCredit, getCredits } from '@/lib/storage';

type Step = 'upload' | 'style' | 'customize' | 'generate' | 'results';

interface CustomizeOptions {
  background: string;
  lighting: string;
  variations: number;
}

const steps: { id: Step; label: string; icon: string }[] = [
  { id: 'upload', label: 'Upload', icon: 'cloud_upload' },
  { id: 'style', label: 'Style', icon: 'style' },
  { id: 'customize', label: 'Customize', icon: 'tune' },
  { id: 'generate', label: 'Generate', icon: 'auto_awesome' },
  { id: 'results', label: 'Results', icon: 'check_circle' },
];

export default function CreatePage() {
  const [currentStep, setCurrentStep] = useState<Step>('upload');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<StylePrompt | null>(null);
  const [customizeOptions, setCustomizeOptions] = useState<CustomizeOptions>({
    background: 'auto',
    lighting: 'auto',
    variations: 1,
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('analyzing');
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

  const handleImageSelect = useCallback((image: string, file: File) => {
    setSelectedImage(image);
    setSelectedFile(file);
    if (image) {
      setCurrentStep('style');
    }
  }, []);

  const handleStyleSelect = useCallback((style: StylePrompt) => {
    setSelectedStyle(style);
  }, []);

  const handleGenerate = async () => {
    if (!selectedImage || !selectedStyle) return;

    // Check credits
    const credits = getCredits();
    if (credits < customizeOptions.variations) {
      setError(`Not enough credits. You need ${customizeOptions.variations} credits but have ${credits}.`);
      return;
    }

    setCurrentStep('generate');
    setIsGenerating(true);
    setProgress(0);
    setError(null);

    const stages = ['analyzing', 'processing', 'enhancing', 'finalizing'];
    let currentStageIndex = 0;

    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        const newProgress = prev + Math.random() * 5 + 2;
        if (newProgress >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        // Update stage
        const stageProgress = Math.floor(newProgress / 25);
        if (stageProgress > currentStageIndex && stageProgress < stages.length) {
          currentStageIndex = stageProgress;
          setStage(stages[currentStageIndex]);
        }
        return newProgress;
      });
    }, 500);

    try {
      // Generate the prompt
      const prompt = generateFinalPrompt(selectedStyle);

      // Call the API
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: selectedImage,
          prompt,
          style: selectedStyle.id,
          options: customizeOptions,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Generation failed');
      }

      const data = await response.json();

      // Use credits
      for (let i = 0; i < customizeOptions.variations; i++) {
        useCredit();
      }

      // Store in gallery and history
      const generatedImageUrls = data.images || [data.image];
      setGeneratedImages(generatedImageUrls);

      // Add to gallery
      generatedImageUrls.forEach((img: string) => {
        addToGallery({
          id: generateId(),
          originalImage: selectedImage,
          generatedImage: img,
          styleId: selectedStyle.id,
          styleName: selectedStyle.name,
          createdAt: new Date().toISOString(),
          isFavorite: false,
          settings: customizeOptions,
        });
      });

      // Add to history
      addToHistory({
        id: generateId(),
        originalImage: selectedImage,
        generatedImages: generatedImageUrls,
        styleId: selectedStyle.id,
        styleName: selectedStyle.name,
        createdAt: new Date().toISOString(),
        processingTime: Math.round(progress / 10),
        settings: customizeOptions,
      });

      clearInterval(progressInterval);
      setProgress(100);
      setIsGenerating(false);
      setCurrentStep('results');
    } catch (err) {
      clearInterval(progressInterval);
      setIsGenerating(false);
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setCurrentStep('customize');
    }
  };

  const handleTryAgain = () => {
    setCurrentStep('generate');
    handleGenerate();
  };

  const handleTryDifferentStyle = () => {
    setCurrentStep('style');
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'upload':
        return !!selectedImage;
      case 'style':
        return !!selectedStyle;
      case 'customize':
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      if (currentStep === 'customize') {
        handleGenerate();
      } else {
        setCurrentStep(steps[nextIndex].id);
      }
    }
  };

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex].id);
    }
  };

  return (
    <>
      <Header title="Create New Headshot" subtitle="Transform your selfie in minutes" />

      {/* Progress steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const isActive = step.id === currentStep;
            const isCompleted = index < currentStepIndex;
            const isClickable = index < currentStepIndex && currentStep !== 'generate';

            return (
              <div key={step.id} className="flex items-center flex-1">
                {/* Step indicator */}
                <button
                  onClick={() => isClickable && setCurrentStep(step.id)}
                  disabled={!isClickable}
                  className={`flex items-center gap-2 ${
                    isClickable ? 'cursor-pointer' : 'cursor-default'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                      isActive
                        ? 'bg-indigo-600 text-white'
                        : isCompleted
                        ? 'bg-emerald-500 text-white'
                        : 'bg-zinc-800 text-zinc-500'
                    }`}
                  >
                    {isCompleted ? (
                      <span className="material-symbols-outlined text-lg">check</span>
                    ) : (
                      <span className="material-symbols-outlined text-lg">{step.icon}</span>
                    )}
                  </div>
                  <span
                    className={`hidden sm:block text-sm font-medium ${
                      isActive ? 'text-white' : isCompleted ? 'text-emerald-400' : 'text-zinc-500'
                    }`}
                  >
                    {step.label}
                  </span>
                </button>

                {/* Connector line */}
                {index < steps.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-4 ${
                      index < currentStepIndex ? 'bg-emerald-500' : 'bg-zinc-800'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3">
          <span className="material-symbols-outlined text-red-400">error</span>
          <span className="text-red-300">{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-400 hover:text-red-300"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      )}

      {/* Step content */}
      <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 p-6 sm:p-8">
        {currentStep === 'upload' && (
          <UploadStep
            onImageSelect={handleImageSelect}
            selectedImage={selectedImage}
          />
        )}

        {currentStep === 'style' && (
          <StyleStep
            selectedStyle={selectedStyle}
            onStyleSelect={handleStyleSelect}
          />
        )}

        {currentStep === 'customize' && (
          <CustomizeStep
            options={customizeOptions}
            onOptionsChange={setCustomizeOptions}
          />
        )}

        {currentStep === 'generate' && (
          <GenerateStep
            isGenerating={isGenerating}
            progress={progress}
            stage={stage}
          />
        )}

        {currentStep === 'results' && selectedImage && selectedStyle && (
          <ResultsStep
            originalImage={selectedImage}
            generatedImages={generatedImages.length > 0 ? generatedImages : [selectedImage]}
            styleName={selectedStyle.name}
            onTryAgain={handleTryAgain}
            onTryDifferentStyle={handleTryDifferentStyle}
          />
        )}
      </div>

      {/* Navigation buttons */}
      {currentStep !== 'generate' && currentStep !== 'results' && (
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={handleBack}
            disabled={currentStepIndex === 0}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all ${
              currentStepIndex === 0
                ? 'text-zinc-600 cursor-not-allowed'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            <span className="material-symbols-outlined">arrow_back</span>
            Back
          </button>

          <button
            onClick={handleNext}
            disabled={!canProceed()}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium transition-all ${
              canProceed()
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/25'
                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
            }`}
          >
            {currentStep === 'customize' ? (
              <>
                <span className="material-symbols-outlined">auto_awesome</span>
                Generate Headshot
              </>
            ) : (
              <>
                Continue
                <span className="material-symbols-outlined">arrow_forward</span>
              </>
            )}
          </button>
        </div>
      )}
    </>
  );
}
