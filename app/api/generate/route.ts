import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { getStyleById, generateFinalPrompt } from "@/lib/prompts";

// Configure fal client
fal.config({
  credentials: process.env.FAL_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { image, prompt, style, options } = body;

    if (!image) {
      return NextResponse.json(
        { error: "No image data provided" },
        { status: 400 }
      );
    }

    if (!style) {
      return NextResponse.json(
        { error: "No style selected" },
        { status: 400 }
      );
    }

    const styleData = getStyleById(style);
    if (!styleData) {
      return NextResponse.json(
        { error: "Invalid style selected" },
        { status: 400 }
      );
    }

    // Generate the advanced prompt
    const finalPrompt = prompt || generateFinalPrompt(styleData);

    // Upload the base64 image to fal storage first
    const imageBlob = await fetch(image).then(r => r.blob());
    const imageFile = new File([imageBlob], "selfie.jpg", { type: "image/jpeg" });
    const uploadedUrl = await fal.storage.upload(imageFile);

    // Generate the headshot using Nano Banana Pro
    const result = await fal.subscribe("fal-ai/nano-banana-pro/edit", {
      input: {
        prompt: finalPrompt,
        image_urls: [uploadedUrl],
        aspect_ratio: "3:4",
        resolution: "2K",
        output_format: "png",
        num_images: options?.variations || 1,
      },
      logs: true,
    });

    // Extract image URLs from result
    const images = result.data?.images?.map((img: { url: string }) => img.url) || [];

    if (images.length === 0) {
      throw new Error("No images generated");
    }

    return NextResponse.json({
      success: true,
      images,
      image: images[0],
      style: styleData.name,
    });
  } catch (error) {
    console.error("Generation error:", error);

    // Return more specific error messages
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    if (errorMessage.includes("insufficient") || errorMessage.includes("credits")) {
      return NextResponse.json(
        { error: "Insufficient API credits. Please check your FAL account." },
        { status: 402 }
      );
    }

    if (errorMessage.includes("rate limit")) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please wait a moment and try again." },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: "Failed to generate image. Please try again." },
      { status: 500 }
    );
  }
}
