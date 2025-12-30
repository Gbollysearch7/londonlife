// Local storage utilities for gallery, history, and preferences

export interface GeneratedImage {
  id: string;
  originalImage: string;
  generatedImage: string;
  styleId: string;
  styleName: string;
  createdAt: string;
  isFavorite: boolean;
  settings?: {
    background?: string;
    lighting?: string;
    variations?: number;
  };
}

export interface GenerationHistory {
  id: string;
  originalImage: string;
  generatedImages: string[];
  styleId: string;
  styleName: string;
  createdAt: string;
  processingTime: number;
  settings?: Record<string, unknown>;
}

export interface UserPreferences {
  defaultStyle: string;
  defaultBackground: string;
  defaultLighting: string;
  defaultVariations: number;
  notificationsEnabled: boolean;
  autoSaveToGallery: boolean;
  theme: 'dark' | 'light' | 'system';
  emailNotifications: boolean;
  marketingEmails: boolean;
}

const STORAGE_KEYS = {
  GALLERY: 'snapstudio_gallery',
  HISTORY: 'snapstudio_history',
  PREFERENCES: 'snapstudio_preferences',
  CREDITS: 'snapstudio_credits',
};

// Check if we're in browser
const isBrowser = typeof window !== 'undefined';

// Gallery functions
export const getGallery = (): GeneratedImage[] => {
  if (!isBrowser) return [];
  const data = localStorage.getItem(STORAGE_KEYS.GALLERY);
  return data ? JSON.parse(data) : [];
};

export const addToGallery = (image: GeneratedImage): void => {
  if (!isBrowser) return;
  const gallery = getGallery();
  gallery.unshift(image);
  localStorage.setItem(STORAGE_KEYS.GALLERY, JSON.stringify(gallery));
};

export const removeFromGallery = (id: string): void => {
  if (!isBrowser) return;
  const gallery = getGallery().filter(img => img.id !== id);
  localStorage.setItem(STORAGE_KEYS.GALLERY, JSON.stringify(gallery));
};

export const toggleFavorite = (id: string): void => {
  if (!isBrowser) return;
  const gallery = getGallery().map(img =>
    img.id === id ? { ...img, isFavorite: !img.isFavorite } : img
  );
  localStorage.setItem(STORAGE_KEYS.GALLERY, JSON.stringify(gallery));
};

export const getFavorites = (): GeneratedImage[] => {
  return getGallery().filter(img => img.isFavorite);
};

export const clearGallery = (): void => {
  if (!isBrowser) return;
  localStorage.removeItem(STORAGE_KEYS.GALLERY);
};

// History functions
export const getHistory = (): GenerationHistory[] => {
  if (!isBrowser) return [];
  const data = localStorage.getItem(STORAGE_KEYS.HISTORY);
  return data ? JSON.parse(data) : [];
};

export const addToHistory = (entry: GenerationHistory): void => {
  if (!isBrowser) return;
  const history = getHistory();
  history.unshift(entry);
  // Keep only last 50 entries
  const trimmed = history.slice(0, 50);
  localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(trimmed));
};

export const clearHistory = (): void => {
  if (!isBrowser) return;
  localStorage.removeItem(STORAGE_KEYS.HISTORY);
};

// Preferences functions
const DEFAULT_PREFERENCES: UserPreferences = {
  defaultStyle: '',
  defaultBackground: 'studio',
  defaultLighting: 'soft',
  defaultVariations: 1,
  notificationsEnabled: true,
  autoSaveToGallery: true,
  theme: 'dark',
  emailNotifications: true,
  marketingEmails: false,
};

export const getPreferences = (): UserPreferences => {
  if (!isBrowser) {
    return DEFAULT_PREFERENCES;
  }
  const data = localStorage.getItem(STORAGE_KEYS.PREFERENCES);
  return data ? { ...DEFAULT_PREFERENCES, ...JSON.parse(data) } : DEFAULT_PREFERENCES;
};

export const savePreferences = (prefs: UserPreferences): void => {
  if (!isBrowser) return;
  localStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(prefs));
};

export const updatePreferences = (prefs: Partial<UserPreferences>): void => {
  if (!isBrowser) return;
  const current = getPreferences();
  const updated = { ...current, ...prefs };
  localStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(updated));
};

// Credits functions (demo purposes)
export const getCredits = (): number => {
  if (!isBrowser) return 10;
  const data = localStorage.getItem(STORAGE_KEYS.CREDITS);
  return data ? parseInt(data, 10) : 10; // Start with 10 free credits
};

export const useCredit = (): boolean => {
  if (!isBrowser) return false;
  const credits = getCredits();
  if (credits <= 0) return false;
  localStorage.setItem(STORAGE_KEYS.CREDITS, String(credits - 1));
  return true;
};

export const addCredits = (amount: number): void => {
  if (!isBrowser) return;
  const credits = getCredits();
  localStorage.setItem(STORAGE_KEYS.CREDITS, String(credits + amount));
};

// Stats
export const getStats = () => {
  const gallery = getGallery();
  const history = getHistory();
  const favorites = getFavorites();
  const credits = getCredits();

  return {
    totalGenerated: gallery.length,
    totalFavorites: favorites.length,
    creditsRemaining: credits,
    recentGenerations: gallery.slice(0, 6),
    styleBreakdown: gallery.reduce((acc, img) => {
      acc[img.styleName] = (acc[img.styleName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  };
};

// Generate unique ID
export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};
