/**
 * Wardrobe (spec ch. 34): garment styles you own once and wear in any palette colour,
 * plus salon prices. Original, fictional prices.
 */
export type Slot = "top" | "bottom" | "hat" | "glasses" | "scarf";

export interface GarmentDef {
  id: string;
  slot: Slot;
  /** Style index understood by the avatar renderer. */
  style: number;
  name: string;
  pricePence: number;
  /** Owned by everyone from the start. */
  starter?: boolean;
}

export const GARMENTS: GarmentDef[] = [
  { id: "top_tee", slot: "top", style: 0, name: "T-shirt", pricePence: 0, starter: true },
  { id: "top_hoodie", slot: "top", style: 1, name: "Hoodie", pricePence: 2500 },
  { id: "top_shirt", slot: "top", style: 2, name: "Collared shirt", pricePence: 3000 },
  { id: "top_jacket", slot: "top", style: 3, name: "Vintage jacket", pricePence: 4500 },
  { id: "top_jumper", slot: "top", style: 4, name: "Knit jumper", pricePence: 2800 },
  { id: "bottom_trousers", slot: "bottom", style: 0, name: "Trousers", pricePence: 0, starter: true },
  { id: "bottom_shorts", slot: "bottom", style: 1, name: "Shorts", pricePence: 1800 },
  { id: "bottom_skirt", slot: "bottom", style: 2, name: "Skirt", pricePence: 2400 },
  { id: "bottom_joggers", slot: "bottom", style: 3, name: "Joggers", pricePence: 2000 },
  { id: "hat_beanie", slot: "hat", style: 1, name: "Beanie", pricePence: 1200 },
  { id: "hat_cap", slot: "hat", style: 2, name: "Cap", pricePence: 1000 },
  { id: "hat_bucket", slot: "hat", style: 3, name: "Bucket hat", pricePence: 1400 },
  { id: "glasses", slot: "glasses", style: 1, name: "Round glasses", pricePence: 2000 },
  { id: "scarf", slot: "scarf", style: 1, name: "Wool scarf", pricePence: 1500 },
];
export const garmentDef = (id: string) => GARMENTS.find((g) => g.id === id);

/** Where clothes are sold. */
export const WARDROBE_SHOP = "borough_market" as const;

export const SALON = { venue: "crown_and_curl" as const, stylePence: 2500, colourPence: 1500 };
