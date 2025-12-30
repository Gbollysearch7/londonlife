// Advanced AI Prompt Engine for Professional Headshots

export interface StylePrompt {
  id: string;
  name: string;
  category: 'professional' | 'creative' | 'artistic' | 'specialty';
  description: string;
  shortDescription: string;
  bestFor: string[];
  previewColor: string;
  icon: string;
  prompt: PromptConfig;
}

export interface PromptConfig {
  task: string;
  identity_preservation: {
    face_match: string;
    features_to_preserve: string[];
    expression: string;
    age_appearance: string;
  };
  lighting: {
    type: string;
    direction: string;
    intensity: string;
    fill_light: boolean;
    rim_light: string;
    shadows: string;
    color_temperature: string;
  };
  background: {
    type: string;
    primary_color: string;
    secondary_color?: string;
    style: string;
    blur: number;
    vignette: string;
  };
  composition: {
    framing: string;
    aspect_ratio: string;
    head_position: string;
    eye_level: string;
    negative_space: string;
  };
  post_processing: {
    skin_smoothing: string;
    color_grading: string;
    sharpness: string;
    contrast: string;
    saturation: string;
  };
  attire_suggestion: string;
  mood: string;
  output_quality: string;
}

export const STYLE_PROMPTS: StylePrompt[] = [
  // PROFESSIONAL CATEGORY
  {
    id: 'executive',
    name: 'Executive',
    category: 'professional',
    description: 'C-suite boardroom ready. Commanding presence with sophisticated lighting that conveys authority and trustworthiness. Perfect for CEOs, directors, and senior leadership.',
    shortDescription: 'C-suite boardroom ready',
    bestFor: ['CEO', 'Director', 'Board Member', 'Senior Executive'],
    previewColor: '#1e3a5f',
    icon: 'business_center',
    prompt: {
      task: 'Transform this portrait into an executive-level professional headshot suitable for Fortune 500 company leadership pages',
      identity_preservation: {
        face_match: 'exact_match_required',
        features_to_preserve: ['face_shape', 'eye_color', 'skin_tone', 'nose_shape', 'lip_shape', 'eyebrow_shape', 'facial_structure', 'unique_features'],
        expression: 'confident_slight_smile_approachable_yet_authoritative',
        age_appearance: 'maintain_exact_current_age'
      },
      lighting: {
        type: 'rembrandt_with_soft_fill',
        direction: '45_degrees_front_left',
        intensity: 'medium_high',
        fill_light: true,
        rim_light: 'subtle_separation',
        shadows: 'defined_but_not_harsh',
        color_temperature: 'neutral_5500k'
      },
      background: {
        type: 'gradient',
        primary_color: '#1a1a2e',
        secondary_color: '#16213e',
        style: 'professional_deep_navy',
        blur: 0,
        vignette: 'subtle_edges'
      },
      composition: {
        framing: 'head_shoulders_upper_chest',
        aspect_ratio: '4:5',
        head_position: 'slight_angle_body_face_camera',
        eye_level: 'camera_at_eye_level',
        negative_space: 'balanced_professional'
      },
      post_processing: {
        skin_smoothing: 'minimal_natural_texture_preserved',
        color_grading: 'professional_neutral_slight_warmth',
        sharpness: 'high_on_eyes_medium_overall',
        contrast: 'medium_high',
        saturation: 'natural_slightly_reduced'
      },
      attire_suggestion: 'dark_suit_or_blazer_suggested',
      mood: 'authoritative_trustworthy_approachable',
      output_quality: 'ultra_high_4k_print_ready'
    }
  },
  {
    id: 'corporate',
    name: 'Corporate',
    category: 'professional',
    description: 'Standard professional headshot with clean, polished look. Versatile for any business context - websites, email signatures, and company directories.',
    shortDescription: 'Clean professional look',
    bestFor: ['Business Professional', 'Manager', 'Consultant', 'Office Worker'],
    previewColor: '#2d3748',
    icon: 'apartment',
    prompt: {
      task: 'Transform this portrait into a clean, professional corporate headshot suitable for business websites and LinkedIn',
      identity_preservation: {
        face_match: 'exact_match_required',
        features_to_preserve: ['face_shape', 'eye_color', 'skin_tone', 'nose_shape', 'lip_shape', 'eyebrow_shape', 'facial_structure', 'unique_features'],
        expression: 'friendly_professional_genuine_smile',
        age_appearance: 'maintain_exact_current_age'
      },
      lighting: {
        type: 'butterfly_soft_beauty',
        direction: 'front_centered_slightly_above',
        intensity: 'medium',
        fill_light: true,
        rim_light: 'none',
        shadows: 'soft_minimal',
        color_temperature: 'neutral_5600k'
      },
      background: {
        type: 'solid',
        primary_color: '#f5f5f5',
        style: 'clean_light_gray',
        blur: 0,
        vignette: 'none'
      },
      composition: {
        framing: 'head_and_shoulders',
        aspect_ratio: '1:1',
        head_position: 'centered_straight_on',
        eye_level: 'camera_at_eye_level',
        negative_space: 'even_balanced'
      },
      post_processing: {
        skin_smoothing: 'light_natural',
        color_grading: 'clean_neutral',
        sharpness: 'high_on_eyes',
        contrast: 'medium',
        saturation: 'natural'
      },
      attire_suggestion: 'business_casual_or_formal',
      mood: 'approachable_professional_competent',
      output_quality: 'ultra_high_4k'
    }
  },
  {
    id: 'linkedin',
    name: 'LinkedIn Pro',
    category: 'professional',
    description: 'Optimized specifically for LinkedIn. Engaging, approachable, and professional. Designed to increase profile views and connection requests.',
    shortDescription: 'LinkedIn optimized',
    bestFor: ['Job Seekers', 'Networkers', 'Sales Professionals', 'Recruiters'],
    previewColor: '#0077b5',
    icon: 'work',
    prompt: {
      task: 'Transform this portrait into a LinkedIn-optimized professional headshot that encourages engagement and connection',
      identity_preservation: {
        face_match: 'exact_match_required',
        features_to_preserve: ['face_shape', 'eye_color', 'skin_tone', 'nose_shape', 'lip_shape', 'eyebrow_shape', 'facial_structure', 'unique_features'],
        expression: 'warm_genuine_smile_eyes_engaged',
        age_appearance: 'maintain_exact_current_age'
      },
      lighting: {
        type: 'soft_natural_window',
        direction: 'front_left_soft',
        intensity: 'medium_bright',
        fill_light: true,
        rim_light: 'subtle',
        shadows: 'very_soft',
        color_temperature: 'warm_5800k'
      },
      background: {
        type: 'gradient',
        primary_color: '#e8f4f8',
        secondary_color: '#d1e7ed',
        style: 'soft_professional_blue_tint',
        blur: 5,
        vignette: 'subtle'
      },
      composition: {
        framing: 'head_shoulders_close',
        aspect_ratio: '1:1',
        head_position: 'slight_tilt_engaging',
        eye_level: 'camera_slightly_above',
        negative_space: 'tight_engaging'
      },
      post_processing: {
        skin_smoothing: 'light_flattering',
        color_grading: 'warm_friendly',
        sharpness: 'high_on_eyes_face',
        contrast: 'medium',
        saturation: 'slightly_enhanced'
      },
      attire_suggestion: 'smart_casual_colorful_allowed',
      mood: 'approachable_trustworthy_engaging',
      output_quality: 'high_web_optimized'
    }
  },
  {
    id: 'legal',
    name: 'Legal',
    category: 'professional',
    description: 'Attorney and law firm style. Conveys trust, expertise, and professionalism. Traditional yet modern approach favored by top law firms.',
    shortDescription: 'Attorney & law firm style',
    bestFor: ['Attorneys', 'Partners', 'Legal Consultants', 'Judges'],
    previewColor: '#1a1a2e',
    icon: 'gavel',
    prompt: {
      task: 'Transform this portrait into a distinguished legal professional headshot suitable for law firm websites and publications',
      identity_preservation: {
        face_match: 'exact_match_required',
        features_to_preserve: ['face_shape', 'eye_color', 'skin_tone', 'nose_shape', 'lip_shape', 'eyebrow_shape', 'facial_structure', 'unique_features'],
        expression: 'serious_confident_slight_warmth',
        age_appearance: 'maintain_exact_current_age'
      },
      lighting: {
        type: 'classic_portrait_loop',
        direction: '30_degrees_front_left',
        intensity: 'medium',
        fill_light: true,
        rim_light: 'subtle',
        shadows: 'defined_classic',
        color_temperature: 'neutral_cool_5400k'
      },
      background: {
        type: 'solid',
        primary_color: '#2c3e50',
        style: 'dark_professional_charcoal',
        blur: 0,
        vignette: 'medium'
      },
      composition: {
        framing: 'head_shoulders_formal',
        aspect_ratio: '4:5',
        head_position: 'traditional_slight_angle',
        eye_level: 'camera_at_eye_level',
        negative_space: 'classic_formal'
      },
      post_processing: {
        skin_smoothing: 'minimal_distinguished',
        color_grading: 'classic_timeless',
        sharpness: 'high_overall',
        contrast: 'medium_high',
        saturation: 'slightly_reduced'
      },
      attire_suggestion: 'formal_suit_dark_colors',
      mood: 'trustworthy_expert_distinguished',
      output_quality: 'ultra_high_4k_print_ready'
    }
  },
  {
    id: 'medical',
    name: 'Medical',
    category: 'professional',
    description: 'Healthcare professional style. Clean, trustworthy, and caring. Perfect for doctors, nurses, therapists, and healthcare administrators.',
    shortDescription: 'Healthcare professional',
    bestFor: ['Doctors', 'Nurses', 'Therapists', 'Healthcare Admin'],
    previewColor: '#10b981',
    icon: 'local_hospital',
    prompt: {
      task: 'Transform this portrait into a healthcare professional headshot that conveys care, expertise, and trustworthiness',
      identity_preservation: {
        face_match: 'exact_match_required',
        features_to_preserve: ['face_shape', 'eye_color', 'skin_tone', 'nose_shape', 'lip_shape', 'eyebrow_shape', 'facial_structure', 'unique_features'],
        expression: 'warm_caring_confident_smile',
        age_appearance: 'maintain_exact_current_age'
      },
      lighting: {
        type: 'soft_even_clinical',
        direction: 'front_even',
        intensity: 'bright_clean',
        fill_light: true,
        rim_light: 'none',
        shadows: 'minimal_clean',
        color_temperature: 'neutral_clean_5500k'
      },
      background: {
        type: 'solid',
        primary_color: '#f0fdf4',
        style: 'clean_medical_light',
        blur: 0,
        vignette: 'none'
      },
      composition: {
        framing: 'head_shoulders_approachable',
        aspect_ratio: '3:4',
        head_position: 'straight_engaging',
        eye_level: 'camera_at_eye_level',
        negative_space: 'clean_balanced'
      },
      post_processing: {
        skin_smoothing: 'light_healthy',
        color_grading: 'clean_fresh',
        sharpness: 'high_on_eyes',
        contrast: 'medium',
        saturation: 'natural_healthy'
      },
      attire_suggestion: 'white_coat_or_scrubs_or_professional',
      mood: 'caring_expert_trustworthy',
      output_quality: 'high_4k'
    }
  },

  // CREATIVE CATEGORY
  {
    id: 'startup',
    name: 'Startup Founder',
    category: 'creative',
    description: 'Modern tech leader look. Approachable yet innovative. Perfect for founders, tech executives, and startup team pages.',
    shortDescription: 'Modern tech leader',
    bestFor: ['Founders', 'Tech Executives', 'Entrepreneurs', 'VCs'],
    previewColor: '#8b5cf6',
    icon: 'rocket_launch',
    prompt: {
      task: 'Transform this portrait into a modern startup founder headshot that conveys innovation, approachability, and leadership',
      identity_preservation: {
        face_match: 'exact_match_required',
        features_to_preserve: ['face_shape', 'eye_color', 'skin_tone', 'nose_shape', 'lip_shape', 'eyebrow_shape', 'facial_structure', 'unique_features'],
        expression: 'confident_friendly_visionary_smile',
        age_appearance: 'maintain_exact_current_age'
      },
      lighting: {
        type: 'modern_soft_with_accent',
        direction: 'front_left_modern',
        intensity: 'medium_bright',
        fill_light: true,
        rim_light: 'modern_subtle',
        shadows: 'soft_dimensional',
        color_temperature: 'slightly_cool_modern_5300k'
      },
      background: {
        type: 'gradient',
        primary_color: '#1e1b4b',
        secondary_color: '#312e81',
        style: 'modern_tech_purple',
        blur: 0,
        vignette: 'subtle'
      },
      composition: {
        framing: 'head_shoulders_dynamic',
        aspect_ratio: '1:1',
        head_position: 'slight_angle_confident',
        eye_level: 'camera_slightly_below',
        negative_space: 'modern_asymmetric'
      },
      post_processing: {
        skin_smoothing: 'light_natural',
        color_grading: 'modern_tech_cool',
        sharpness: 'high',
        contrast: 'medium_high',
        saturation: 'slightly_enhanced'
      },
      attire_suggestion: 'smart_casual_no_tie',
      mood: 'innovative_approachable_visionary',
      output_quality: 'ultra_high_4k'
    }
  },
  {
    id: 'creative_director',
    name: 'Creative Director',
    category: 'creative',
    description: 'Artistic editorial style with dramatic lighting. Perfect for creative professionals, designers, and artistic directors.',
    shortDescription: 'Artistic editorial style',
    bestFor: ['Creative Directors', 'Designers', 'Art Directors', 'Creatives'],
    previewColor: '#ec4899',
    icon: 'palette',
    prompt: {
      task: 'Transform this portrait into an artistic creative director headshot with editorial magazine quality',
      identity_preservation: {
        face_match: 'exact_match_required',
        features_to_preserve: ['face_shape', 'eye_color', 'skin_tone', 'nose_shape', 'lip_shape', 'eyebrow_shape', 'facial_structure', 'unique_features'],
        expression: 'confident_artistic_intensity',
        age_appearance: 'maintain_exact_current_age'
      },
      lighting: {
        type: 'dramatic_single_source',
        direction: 'side_45_degrees',
        intensity: 'high_contrast',
        fill_light: false,
        rim_light: 'strong_separation',
        shadows: 'dramatic_defined',
        color_temperature: 'artistic_variable'
      },
      background: {
        type: 'solid',
        primary_color: '#0f0f0f',
        style: 'pure_black_studio',
        blur: 0,
        vignette: 'strong'
      },
      composition: {
        framing: 'head_dramatic_crop',
        aspect_ratio: '3:4',
        head_position: 'artistic_angle',
        eye_level: 'creative_varied',
        negative_space: 'dramatic_asymmetric'
      },
      post_processing: {
        skin_smoothing: 'minimal_texture_enhanced',
        color_grading: 'editorial_dramatic',
        sharpness: 'very_high',
        contrast: 'high',
        saturation: 'artistic_controlled'
      },
      attire_suggestion: 'black_or_bold_creative',
      mood: 'creative_bold_artistic',
      output_quality: 'ultra_high_4k_print'
    }
  },
  {
    id: 'speaker',
    name: 'Speaker/Author',
    category: 'creative',
    description: 'Warm, engaging, and trustworthy. Designed for thought leaders, speakers, authors, and coaches who need to connect with their audience.',
    shortDescription: 'Thought leader style',
    bestFor: ['Speakers', 'Authors', 'Coaches', 'Consultants'],
    previewColor: '#f59e0b',
    icon: 'record_voice_over',
    prompt: {
      task: 'Transform this portrait into a warm, engaging speaker/author headshot that builds trust and connection',
      identity_preservation: {
        face_match: 'exact_match_required',
        features_to_preserve: ['face_shape', 'eye_color', 'skin_tone', 'nose_shape', 'lip_shape', 'eyebrow_shape', 'facial_structure', 'unique_features'],
        expression: 'warm_engaging_authentic_smile',
        age_appearance: 'maintain_exact_current_age'
      },
      lighting: {
        type: 'warm_natural_soft',
        direction: 'front_soft_wrap',
        intensity: 'medium_warm',
        fill_light: true,
        rim_light: 'warm_subtle',
        shadows: 'soft_flattering',
        color_temperature: 'warm_golden_5800k'
      },
      background: {
        type: 'gradient',
        primary_color: '#fef3c7',
        secondary_color: '#fde68a',
        style: 'warm_inviting_gold',
        blur: 10,
        vignette: 'warm_subtle'
      },
      composition: {
        framing: 'head_shoulders_open',
        aspect_ratio: '4:5',
        head_position: 'engaging_slight_lean',
        eye_level: 'camera_at_eye_level',
        negative_space: 'open_welcoming'
      },
      post_processing: {
        skin_smoothing: 'light_warm',
        color_grading: 'warm_inviting',
        sharpness: 'high_on_eyes',
        contrast: 'medium',
        saturation: 'warm_enhanced'
      },
      attire_suggestion: 'warm_colors_approachable',
      mood: 'trustworthy_engaging_inspiring',
      output_quality: 'ultra_high_4k'
    }
  },
  {
    id: 'influencer',
    name: 'Influencer',
    category: 'creative',
    description: 'Social media optimized with vibrant, eye-catching appeal. Perfect for content creators, influencers, and social media personalities.',
    shortDescription: 'Social media optimized',
    bestFor: ['Influencers', 'Content Creators', 'YouTubers', 'Streamers'],
    previewColor: '#ef4444',
    icon: 'trending_up',
    prompt: {
      task: 'Transform this portrait into a vibrant, social-media-optimized influencer headshot',
      identity_preservation: {
        face_match: 'exact_match_required',
        features_to_preserve: ['face_shape', 'eye_color', 'skin_tone', 'nose_shape', 'lip_shape', 'eyebrow_shape', 'facial_structure', 'unique_features'],
        expression: 'energetic_bright_engaging_smile',
        age_appearance: 'maintain_exact_current_age'
      },
      lighting: {
        type: 'ring_light_beauty',
        direction: 'front_even_glamour',
        intensity: 'bright_flattering',
        fill_light: true,
        rim_light: 'colorful_accent',
        shadows: 'minimal_beauty',
        color_temperature: 'warm_flattering_5700k'
      },
      background: {
        type: 'gradient',
        primary_color: '#fce7f3',
        secondary_color: '#fbcfe8',
        style: 'soft_pink_social',
        blur: 15,
        vignette: 'soft'
      },
      composition: {
        framing: 'head_close_social',
        aspect_ratio: '1:1',
        head_position: 'dynamic_engaging',
        eye_level: 'slightly_above_flattering',
        negative_space: 'tight_punchy'
      },
      post_processing: {
        skin_smoothing: 'beauty_enhanced',
        color_grading: 'vibrant_social',
        sharpness: 'high',
        contrast: 'punchy',
        saturation: 'enhanced_vibrant'
      },
      attire_suggestion: 'trendy_colorful',
      mood: 'energetic_relatable_aspirational',
      output_quality: 'high_social_optimized'
    }
  },

  // ARTISTIC CATEGORY
  {
    id: 'noir',
    name: 'Classic Noir',
    category: 'artistic',
    description: 'Dramatic black and white with film noir aesthetics. Timeless, sophisticated, and cinematic.',
    shortDescription: 'Dramatic B&W film noir',
    bestFor: ['Artists', 'Musicians', 'Actors', 'Creatives'],
    previewColor: '#374151',
    icon: 'contrast',
    prompt: {
      task: 'Transform this portrait into a dramatic black and white film noir style headshot',
      identity_preservation: {
        face_match: 'exact_match_required',
        features_to_preserve: ['face_shape', 'eye_color', 'skin_tone', 'nose_shape', 'lip_shape', 'eyebrow_shape', 'facial_structure', 'unique_features'],
        expression: 'intense_mysterious_confident',
        age_appearance: 'maintain_exact_current_age'
      },
      lighting: {
        type: 'hard_dramatic_single',
        direction: 'harsh_side_45',
        intensity: 'high_contrast',
        fill_light: false,
        rim_light: 'hard_separation',
        shadows: 'deep_dramatic_noir',
        color_temperature: 'black_and_white'
      },
      background: {
        type: 'solid',
        primary_color: '#000000',
        style: 'pure_black',
        blur: 0,
        vignette: 'heavy_dramatic'
      },
      composition: {
        framing: 'head_dramatic_tight',
        aspect_ratio: '3:4',
        head_position: 'dramatic_angle',
        eye_level: 'cinematic_low',
        negative_space: 'noir_dramatic'
      },
      post_processing: {
        skin_smoothing: 'minimal_texture',
        color_grading: 'black_white_high_contrast',
        sharpness: 'very_high',
        contrast: 'very_high_noir',
        saturation: 'zero_monochrome'
      },
      attire_suggestion: 'dark_formal_classic',
      mood: 'mysterious_timeless_dramatic',
      output_quality: 'ultra_high_4k_print'
    }
  },
  {
    id: 'neon',
    name: 'Neon Glow',
    category: 'artistic',
    description: 'Cyberpunk-inspired with vibrant neon lighting. Bold pink and cyan accents create a futuristic, eye-catching look.',
    shortDescription: 'Cyberpunk neon style',
    bestFor: ['Gamers', 'DJs', 'Tech Creatives', 'Streamers'],
    previewColor: '#06b6d4',
    icon: 'bolt',
    prompt: {
      task: 'Transform this portrait into a cyberpunk-inspired headshot with dramatic neon lighting',
      identity_preservation: {
        face_match: 'exact_match_required',
        features_to_preserve: ['face_shape', 'eye_color', 'skin_tone', 'nose_shape', 'lip_shape', 'eyebrow_shape', 'facial_structure', 'unique_features'],
        expression: 'confident_edgy_cool',
        age_appearance: 'maintain_exact_current_age'
      },
      lighting: {
        type: 'dual_color_neon',
        direction: 'split_left_right',
        intensity: 'high_vivid',
        fill_light: false,
        rim_light: 'strong_neon_cyan',
        shadows: 'deep_colored',
        color_temperature: 'mixed_pink_cyan'
      },
      background: {
        type: 'solid',
        primary_color: '#0a0a0a',
        style: 'deep_black_neon_glow',
        blur: 0,
        vignette: 'neon_glow'
      },
      composition: {
        framing: 'head_edgy_crop',
        aspect_ratio: '1:1',
        head_position: 'dynamic_edgy',
        eye_level: 'varied_artistic',
        negative_space: 'tight_impactful'
      },
      post_processing: {
        skin_smoothing: 'light',
        color_grading: 'cyberpunk_neon',
        sharpness: 'high',
        contrast: 'high',
        saturation: 'high_neon'
      },
      attire_suggestion: 'dark_modern_tech',
      mood: 'futuristic_bold_edgy',
      output_quality: 'ultra_high_4k'
    }
  },
  {
    id: 'golden_hour',
    name: 'Golden Hour',
    category: 'artistic',
    description: 'Warm cinematic golden hour lighting. Romantic, dreamy, and naturally beautiful. Like sunset on a perfect day.',
    shortDescription: 'Warm cinematic sunset',
    bestFor: ['Lifestyle', 'Dating Profiles', 'Personal Brand', 'Creatives'],
    previewColor: '#d97706',
    icon: 'wb_sunny',
    prompt: {
      task: 'Transform this portrait into a warm golden hour cinematic headshot',
      identity_preservation: {
        face_match: 'exact_match_required',
        features_to_preserve: ['face_shape', 'eye_color', 'skin_tone', 'nose_shape', 'lip_shape', 'eyebrow_shape', 'facial_structure', 'unique_features'],
        expression: 'warm_natural_relaxed_smile',
        age_appearance: 'maintain_exact_current_age'
      },
      lighting: {
        type: 'natural_golden_hour',
        direction: 'backlit_with_fill',
        intensity: 'warm_soft',
        fill_light: true,
        rim_light: 'golden_halo',
        shadows: 'soft_warm',
        color_temperature: 'warm_golden_3500k'
      },
      background: {
        type: 'gradient',
        primary_color: '#fbbf24',
        secondary_color: '#f59e0b',
        style: 'golden_sunset_blur',
        blur: 20,
        vignette: 'warm_soft'
      },
      composition: {
        framing: 'head_shoulders_natural',
        aspect_ratio: '4:5',
        head_position: 'natural_relaxed',
        eye_level: 'natural',
        negative_space: 'airy_natural'
      },
      post_processing: {
        skin_smoothing: 'minimal_natural',
        color_grading: 'warm_golden_cinematic',
        sharpness: 'medium_soft',
        contrast: 'medium_soft',
        saturation: 'warm_golden'
      },
      attire_suggestion: 'casual_natural',
      mood: 'warm_inviting_natural',
      output_quality: 'ultra_high_4k'
    }
  },
  {
    id: 'high_fashion',
    name: 'High Fashion',
    category: 'artistic',
    description: 'Editorial magazine style with dramatic beauty lighting. Vogue-worthy with perfect skin and striking composition.',
    shortDescription: 'Editorial magazine style',
    bestFor: ['Models', 'Fashion Industry', 'Beauty', 'Luxury Brands'],
    previewColor: '#a855f7',
    icon: 'auto_awesome',
    prompt: {
      task: 'Transform this portrait into a high fashion editorial magazine headshot',
      identity_preservation: {
        face_match: 'exact_match_required',
        features_to_preserve: ['face_shape', 'eye_color', 'skin_tone', 'nose_shape', 'lip_shape', 'eyebrow_shape', 'facial_structure', 'unique_features'],
        expression: 'editorial_striking_confident',
        age_appearance: 'maintain_exact_current_age'
      },
      lighting: {
        type: 'beauty_dish_fashion',
        direction: 'front_above_butterfly',
        intensity: 'bright_even',
        fill_light: true,
        rim_light: 'subtle_separation',
        shadows: 'defined_beauty',
        color_temperature: 'neutral_fashion_5500k'
      },
      background: {
        type: 'solid',
        primary_color: '#fafafa',
        style: 'clean_white_studio',
        blur: 0,
        vignette: 'subtle'
      },
      composition: {
        framing: 'beauty_close_up',
        aspect_ratio: '3:4',
        head_position: 'editorial_angle',
        eye_level: 'above_beauty',
        negative_space: 'editorial_clean'
      },
      post_processing: {
        skin_smoothing: 'beauty_retouched',
        color_grading: 'fashion_editorial',
        sharpness: 'very_high_detail',
        contrast: 'high_fashion',
        saturation: 'controlled_rich'
      },
      attire_suggestion: 'high_fashion_or_minimal',
      mood: 'striking_editorial_luxurious',
      output_quality: 'ultra_high_4k_print'
    }
  },
  {
    id: 'minimalist',
    name: 'Minimalist',
    category: 'artistic',
    description: 'Clean, modern, and simple. Maximum impact with minimal elements. Perfect for those who appreciate understated elegance.',
    shortDescription: 'Clean modern minimal',
    bestFor: ['Designers', 'Architects', 'Minimalists', 'Modern Brands'],
    previewColor: '#6b7280',
    icon: 'crop_square',
    prompt: {
      task: 'Transform this portrait into a clean minimalist headshot with modern simplicity',
      identity_preservation: {
        face_match: 'exact_match_required',
        features_to_preserve: ['face_shape', 'eye_color', 'skin_tone', 'nose_shape', 'lip_shape', 'eyebrow_shape', 'facial_structure', 'unique_features'],
        expression: 'calm_confident_subtle_smile',
        age_appearance: 'maintain_exact_current_age'
      },
      lighting: {
        type: 'soft_even_flat',
        direction: 'front_diffused',
        intensity: 'even_balanced',
        fill_light: true,
        rim_light: 'none',
        shadows: 'minimal_soft',
        color_temperature: 'neutral_5500k'
      },
      background: {
        type: 'solid',
        primary_color: '#ffffff',
        style: 'pure_white_minimal',
        blur: 0,
        vignette: 'none'
      },
      composition: {
        framing: 'head_centered_minimal',
        aspect_ratio: '1:1',
        head_position: 'centered_straight',
        eye_level: 'camera_level',
        negative_space: 'generous_balanced'
      },
      post_processing: {
        skin_smoothing: 'light_natural',
        color_grading: 'clean_neutral',
        sharpness: 'medium_natural',
        contrast: 'low_soft',
        saturation: 'slightly_desaturated'
      },
      attire_suggestion: 'simple_solid_colors',
      mood: 'calm_confident_modern',
      output_quality: 'ultra_high_4k'
    }
  },

  // SPECIALTY CATEGORY
  {
    id: 'dating',
    name: 'Dating Profile',
    category: 'specialty',
    description: 'Friendly and approachable for dating apps. Natural, genuine, and attractive without looking staged or fake.',
    shortDescription: 'Dating app optimized',
    bestFor: ['Dating Apps', 'Social Profiles', 'Personal Use'],
    previewColor: '#f43f5e',
    icon: 'favorite',
    prompt: {
      task: 'Transform this portrait into a natural, attractive dating profile headshot',
      identity_preservation: {
        face_match: 'exact_match_required',
        features_to_preserve: ['face_shape', 'eye_color', 'skin_tone', 'nose_shape', 'lip_shape', 'eyebrow_shape', 'facial_structure', 'unique_features'],
        expression: 'natural_genuine_warm_smile',
        age_appearance: 'maintain_exact_current_age'
      },
      lighting: {
        type: 'natural_soft_flattering',
        direction: 'front_soft_natural',
        intensity: 'medium_flattering',
        fill_light: true,
        rim_light: 'subtle_natural',
        shadows: 'soft_flattering',
        color_temperature: 'warm_natural_5600k'
      },
      background: {
        type: 'gradient',
        primary_color: '#e0f2fe',
        secondary_color: '#bae6fd',
        style: 'soft_natural_outdoor_feel',
        blur: 25,
        vignette: 'soft_natural'
      },
      composition: {
        framing: 'head_shoulders_natural',
        aspect_ratio: '4:5',
        head_position: 'natural_slight_tilt',
        eye_level: 'natural',
        negative_space: 'natural_balanced'
      },
      post_processing: {
        skin_smoothing: 'minimal_natural',
        color_grading: 'warm_natural',
        sharpness: 'medium_natural',
        contrast: 'medium_natural',
        saturation: 'natural_warm'
      },
      attire_suggestion: 'casual_authentic',
      mood: 'approachable_genuine_attractive',
      output_quality: 'high_app_optimized'
    }
  },
  {
    id: 'actor',
    name: 'Actor Headshot',
    category: 'specialty',
    description: 'Industry-standard casting headshot. Meets theatrical and commercial casting requirements with proper formatting.',
    shortDescription: 'Casting industry standard',
    bestFor: ['Actors', 'Models', 'Performers', 'Voice Artists'],
    previewColor: '#0ea5e9',
    icon: 'theater_comedy',
    prompt: {
      task: 'Transform this portrait into an industry-standard actor casting headshot',
      identity_preservation: {
        face_match: 'exact_match_required',
        features_to_preserve: ['face_shape', 'eye_color', 'skin_tone', 'nose_shape', 'lip_shape', 'eyebrow_shape', 'facial_structure', 'unique_features'],
        expression: 'neutral_with_personality_eyes_alive',
        age_appearance: 'maintain_exact_current_age'
      },
      lighting: {
        type: 'theatrical_standard',
        direction: 'front_45_standard',
        intensity: 'medium_even',
        fill_light: true,
        rim_light: 'subtle',
        shadows: 'defined_not_harsh',
        color_temperature: 'neutral_5500k'
      },
      background: {
        type: 'solid',
        primary_color: '#e5e7eb',
        style: 'neutral_gray_standard',
        blur: 0,
        vignette: 'none'
      },
      composition: {
        framing: 'head_shoulders_casting_standard',
        aspect_ratio: '8:10',
        head_position: 'standard_slight_angle',
        eye_level: 'camera_level',
        negative_space: 'casting_standard'
      },
      post_processing: {
        skin_smoothing: 'minimal_natural',
        color_grading: 'neutral_accurate',
        sharpness: 'high_on_eyes',
        contrast: 'medium',
        saturation: 'natural_accurate'
      },
      attire_suggestion: 'solid_colors_no_patterns',
      mood: 'versatile_castable_authentic',
      output_quality: 'ultra_high_8x10_print'
    }
  },
  {
    id: 'realtor',
    name: 'Real Estate Agent',
    category: 'specialty',
    description: 'Trustworthy and professional for real estate. Approachable with a confident smile that builds client trust.',
    shortDescription: 'Real estate professional',
    bestFor: ['Realtors', 'Agents', 'Brokers', 'Property Managers'],
    previewColor: '#22c55e',
    icon: 'home',
    prompt: {
      task: 'Transform this portrait into a trustworthy real estate agent headshot',
      identity_preservation: {
        face_match: 'exact_match_required',
        features_to_preserve: ['face_shape', 'eye_color', 'skin_tone', 'nose_shape', 'lip_shape', 'eyebrow_shape', 'facial_structure', 'unique_features'],
        expression: 'warm_trustworthy_confident_smile',
        age_appearance: 'maintain_exact_current_age'
      },
      lighting: {
        type: 'warm_professional',
        direction: 'front_soft_warm',
        intensity: 'bright_friendly',
        fill_light: true,
        rim_light: 'subtle_warm',
        shadows: 'soft_friendly',
        color_temperature: 'warm_friendly_5700k'
      },
      background: {
        type: 'gradient',
        primary_color: '#f0fdf4',
        secondary_color: '#dcfce7',
        style: 'fresh_green_trust',
        blur: 5,
        vignette: 'subtle'
      },
      composition: {
        framing: 'head_shoulders_friendly',
        aspect_ratio: '3:4',
        head_position: 'open_approachable',
        eye_level: 'camera_level',
        negative_space: 'friendly_balanced'
      },
      post_processing: {
        skin_smoothing: 'light_natural',
        color_grading: 'warm_inviting',
        sharpness: 'high_on_eyes',
        contrast: 'medium',
        saturation: 'natural_warm'
      },
      attire_suggestion: 'business_professional_friendly',
      mood: 'trustworthy_approachable_professional',
      output_quality: 'high_4k'
    }
  }
];

// Helper function to get styles by category
export const getStylesByCategory = (category: StylePrompt['category']) => {
  return STYLE_PROMPTS.filter(style => style.category === category);
};

// Helper function to get a style by ID
export const getStyleById = (id: string) => {
  return STYLE_PROMPTS.find(style => style.id === id);
};

// Function to generate the final prompt for FAL AI
export const generateFinalPrompt = (style: StylePrompt): string => {
  const p = style.prompt;

  return JSON.stringify({
    task: p.task,
    critical_requirements: {
      identity: "CRITICAL: The output MUST be the EXACT same person as the input. Preserve ALL facial features exactly.",
      face_preservation: p.identity_preservation,
      no_alterations: "Do NOT change: face shape, nose, lips, eyes, skin color, or any identifying features"
    },
    style_specifications: {
      lighting: p.lighting,
      background: p.background,
      composition: p.composition,
      mood: p.mood
    },
    technical_requirements: {
      post_processing: p.post_processing,
      output_quality: p.output_quality
    },
    suggestions: {
      attire: p.attire_suggestion
    }
  }, null, 2);
};

// Get all categories
export const STYLE_CATEGORIES = [
  { id: 'professional', name: 'Professional', icon: 'work', description: 'Corporate and business styles' },
  { id: 'creative', name: 'Creative', icon: 'palette', description: 'Modern and innovative styles' },
  { id: 'artistic', name: 'Artistic', icon: 'brush', description: 'Dramatic and editorial styles' },
  { id: 'specialty', name: 'Specialty', icon: 'stars', description: 'Industry-specific styles' }
];
