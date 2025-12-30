export interface PhotoStyle {
  id: string;
  name: string;
  description: string;
  prompt: string;
  gradient: string;
}

// JSON-structured prompts with face consistency instructions
const createPrompt = (styleInstructions: object): string => {
  const basePrompt = {
    task: "Transform this portrait photo into a professional headshot",
    critical_requirements: {
      face_preservation: "MUST preserve exact facial features, face shape, eye color, skin tone, and likeness of the original person",
      identity: "The output MUST be recognizable as the same person in the input image",
      no_alterations: "Do NOT change facial structure, nose shape, lip shape, or any identifying features"
    },
    ...styleInstructions,
    output_specs: {
      quality: "Ultra high quality, professional photography standard",
      resolution: "Sharp, detailed, suitable for professional use",
      format: "Portrait headshot composition"
    }
  };
  return JSON.stringify(basePrompt);
};

export const photoStyles: PhotoStyle[] = [
  {
    id: "classic-bw",
    name: "Classic B&W Film",
    description: "Timeless black and white photography inspired by classic film stocks like Ilford HP5. High-contrast with dramatic shadows.",
    prompt: createPrompt({
      style: "Classic Black and White Film Photography",
      lighting: {
        type: "Dramatic high-contrast lighting",
        shadows: "Deep, rich shadows",
        highlights: "Bright, clean highlights"
      },
      aesthetic: {
        film_stock: "Ilford HP5 inspired",
        grain: "Subtle film grain texture",
        mood: "Hollywood glamour, timeless elegance"
      },
      color: "Convert to black and white while maintaining skin tone luminosity"
    }),
    gradient: "from-gray-900 via-gray-600 to-gray-400"
  },
  {
    id: "neon-dual",
    name: "Neon Dual-Tone",
    description: "Bold and contemporary dual-tone lighting with vibrant blue and pink neon hues for a striking modern look.",
    prompt: createPrompt({
      style: "Neon Dual-Tone Portrait",
      lighting: {
        type: "Dual-tone colored lighting",
        left_side: "Vibrant electric blue neon light",
        right_side: "Hot pink/magenta neon light",
        blend: "Smooth gradient where colors meet on face"
      },
      aesthetic: {
        mood: "Modern, cyberpunk, social media ready",
        contrast: "Bold color contrast",
        background: "Dark to make neon colors pop"
      }
    }),
    gradient: "from-blue-500 via-purple-500 to-pink-500"
  },
  {
    id: "studio-pro",
    name: "Studio Professional",
    description: "Clean, professional headshot with butterfly lighting on a pristine white background. Perfect for LinkedIn.",
    prompt: createPrompt({
      style: "Professional Studio Headshot",
      lighting: {
        type: "Butterfly lighting (Paramount lighting)",
        key_light: "Soft, even illumination from above",
        fill: "Minimal shadows, clean look"
      },
      background: {
        color: "Pure white or light gray gradient",
        style: "Clean, corporate, professional"
      },
      aesthetic: {
        angle: "3/4 view or straight on",
        lens_look: "85mm portrait lens equivalent",
        use_case: "LinkedIn, corporate profiles, business headshots"
      }
    }),
    gradient: "from-slate-100 via-white to-slate-200"
  },
  {
    id: "ethereal",
    name: "Ethereal Lighting",
    description: "Fine art photography meets fashion editorial with subtle spectral light effects and optical dispersion.",
    prompt: createPrompt({
      style: "Ethereal Fine Art Portrait",
      lighting: {
        type: "Chiaroscuro with spectral effects",
        primary: "Soft directional light creating depth",
        effects: "Subtle rainbow prism/optical dispersion highlights"
      },
      aesthetic: {
        mood: "Dreamy, elegant, futuristic",
        shadows: "Deep artistic shadows",
        atmosphere: "Fashion editorial meets fine art"
      },
      background: "Dark with subtle gradient"
    }),
    gradient: "from-indigo-500 via-purple-400 to-pink-300"
  },
  {
    id: "beam",
    name: "Beam Lighting",
    description: "Dramatic fashion editorial style with a focused beam of light illuminating the face against a dark background.",
    prompt: createPrompt({
      style: "Beam Lighting Fashion Portrait",
      lighting: {
        type: "Single focused beam of light",
        direction: "From above or side, illuminating face",
        quality: "Soft but directional",
        falloff: "Dramatic falloff into darkness"
      },
      background: {
        color: "Pure black or very dark",
        style: "Minimal, all focus on subject"
      },
      aesthetic: {
        mood: "Moody, elegant, fashion editorial",
        contrast: "High contrast chiaroscuro effect"
      }
    }),
    gradient: "from-amber-300 via-yellow-200 to-amber-400"
  },
  {
    id: "slit",
    name: "Slit Lighting",
    description: "Cinematic noir style featuring a precise vertical slit of warm light across the face.",
    prompt: createPrompt({
      style: "Cinematic Slit Lighting Portrait",
      lighting: {
        type: "Narrow vertical slit of light",
        color: "Warm golden/amber tone",
        technique: "Optical snoot or venetian blind effect",
        coverage: "Stripe of light across eyes and face"
      },
      aesthetic: {
        mood: "Film noir, cinematic, mysterious",
        contrast: "Extreme high contrast",
        shadows: "Deep blacks surrounding the light strip"
      },
      background: "Pure black"
    }),
    gradient: "from-orange-500 via-amber-400 to-yellow-300"
  },
  {
    id: "silhouette",
    name: "Silhouette",
    description: "Dramatic black and white profile with extreme rim lighting creating a luminous halo effect.",
    prompt: createPrompt({
      style: "Dramatic Rim-Lit Silhouette",
      lighting: {
        type: "Extreme rim/edge lighting from behind",
        effect: "Luminous halo around subject profile",
        face: "Minimal front light, mostly silhouette"
      },
      composition: {
        angle: "Profile or 3/4 profile view",
        focus: "Edge-lit contours of face"
      },
      aesthetic: {
        color: "Black and white",
        contrast: "Maximum contrast",
        background: "Pure black",
        mood: "Dramatic, artistic, high impact"
      }
    }),
    gradient: "from-black via-gray-800 to-gray-600"
  }
];

export function getStyleById(id: string): PhotoStyle | undefined {
  return photoStyles.find(style => style.id === id);
}
