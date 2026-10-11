/**
 * Fictional game health (spec ch. 7.3): not medical advice or diagnosis.
 * Sustained neglect brings on a cold; recovery is free at the Health Centre, cheap at the pharmacy,
 * or it passes on its own after a day.
 */
export const CONDITIONS = {
  run_down: {
    label: "Run down",
    blurb: "A fictional cold from running on empty. Mood is lower, energy drains faster and strenuous activities are off until you recover.",
    mood: -8,
    energyDecay: 1.3,
    /** Real minutes before it clears on its own (before any development time scale). */
    naturalMinutes: 24 * 60,
  },
} as const;
export type ConditionId = keyof typeof CONDITIONS;

/** A cold starts when one of these needs is fully empty after settlement. */
export const ONSET_NEEDS = ["hunger", "energy", "hygiene"] as const;

/** Takeaway menu and grocery bundles for the Food app (fictional prices). */
export const DELIVERY = { feePence: 250, minutes: 20 };
export const DELIVERY_MENU: { id: string; name: string; blurb: string; pricePence: number; items: Record<string, number> }[] = [
  { id: "curry", name: "Lamb-free Madras", blurb: "Vegetable curry with rice and a naan.", pricePence: 900, items: { takeaway_curry: 1 } },
  { id: "noodles", name: "Ginger noodles", blurb: "Stir-fried noodles with greens.", pricePence: 800, items: { takeaway_noodles: 1 } },
  { id: "pizza", name: "Margherita pizza", blurb: "Wood-fired, delivered warm.", pricePence: 1000, items: { takeaway_pizza: 1 } },
  { id: "basics", name: "Basics box", blurb: "Bread ×2, beans, pasta, tomatoes and eggs.", pricePence: 700, items: { bread: 2, beans: 1, pasta: 1, tomato: 1, eggs: 1 } },
  { id: "jollof_kit", name: "Jollof kit", blurb: "Rice, tomatoes and plantain for jollof.", pricePence: 400, items: { rice: 1, tomato: 1, plantain: 1 } },
];
