import type { ParticleKind } from "./effects";
import type { Pose, Prop } from "./poses";

/** How an activity looks in the world: pose at its anchor, held prop, particles and privacy. */
export interface Visual {
  pose: Pose;
  prop?: Prop;
  particles?: ParticleKind;
  /** Hidden for privacy (toilets, showers); the fixture shows it's in use instead. */
  hide?: boolean;
  /** Sits on the anchor's seat rather than standing in front of it. */
  seated?: boolean;
}

const BY_ID: Record<string, Visual> = {
  sleep: { pose: "sleep", particles: "zzz" },
  nap: { pose: "sleep", particles: "zzz" },
  rest_sofa: { pose: "sleep", particles: "zzz", seated: true },
  shower: { pose: "idle", hide: true, particles: "steam" },
  public_shower: { pose: "idle", hide: true, particles: "steam" },
  snack: { pose: "snack", prop: "cup", particles: "food" },
  watch_tv: { pose: "sit", seated: true },
  relax: { pose: "sit", seated: true },
  read_cookbook: { pose: "read", seated: true },
  read_coding_book: { pose: "read", seated: true },
  coding_sprint_home: { pose: "type", particles: "code", seated: true },
  practise_guitar: { pose: "guitar", particles: "notes", seated: true },
  home_workout: { pose: "lift", particles: "sweat" },
  plate_of_the_day: { pose: "eat", particles: "food", seated: true },
  curry_bowl: { pose: "eat", particles: "steam", seated: true },
  community_meal: { pose: "eat", particles: "food", seated: true },
  serve_shift: { pose: "work" },
  community_lunch_setup: { pose: "work" },
  volunteer: { pose: "work" },
  cooking_demo: { pose: "idle", particles: "sparkle" },
  coding_club: { pose: "type", particles: "code", seated: true },
  office_coffee: { pose: "snack", prop: "cup" },
};

export function visualFor(activityId: string): Visual {
  if (BY_ID[activityId]) return BY_ID[activityId];
  if (activityId.startsWith("cook_")) return { pose: "cook", prop: "pan", particles: "steam" };
  if (activityId.startsWith("eat_")) return { pose: "eat", particles: "food", seated: true };
  if (activityId.startsWith("chat_")) return { pose: "talk", particles: "chat" };
  if (activityId.endsWith("toilet")) return { pose: "idle", hide: true };
  return { pose: "work" };
}

/** Workplace pose per career while on shift. */
export function shiftVisual(careerId: string | undefined): Visual {
  switch (careerId) {
    case "tech":
    case "product":
      return { pose: "type", particles: "code", seated: true };
    case "banking":
      return { pose: "talk", seated: false };
    case "kitchen":
      return { pose: "cook", prop: "pan", particles: "steam" };
    default:
      return { pose: "work" };
  }
}
