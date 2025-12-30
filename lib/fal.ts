import { fal } from "@fal-ai/client";

// Configure fal client with API key from environment
fal.config({
  credentials: process.env.FAL_KEY,
});

export interface GenerateImageParams {
  imageUrl: string;
  prompt: string;
  aspectRatio?: string;
  resolution?: string;
}

export interface GeneratedImage {
  url: string;
  width: number;
  height: number;
  content_type: string;
}

export interface GenerateImageResult {
  images: GeneratedImage[];
}

export async function generateHeadshot(params: GenerateImageParams): Promise<GenerateImageResult> {
  const { imageUrl, prompt, aspectRatio = "1:1", resolution = "2K" } = params;

  const result = await fal.subscribe("fal-ai/nano-banana-pro/edit", {
    input: {
      prompt,
      image_urls: [imageUrl],
      aspect_ratio: aspectRatio,
      resolution,
      output_format: "png",
    },
    logs: true,
    onQueueUpdate: (update) => {
      if (update.status === "IN_PROGRESS") {
        console.log("Generation in progress...", update.logs);
      }
    },
  });

  return {
    images: result.data.images as GeneratedImage[],
  };
}

export { fal };
