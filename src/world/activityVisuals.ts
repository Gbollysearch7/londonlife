import type { ParticleKind } from "./effects";
import type { Pose, Prop } from "./poses";
import { VISUALS_A } from "./activityVisuals_a";

/** How an activity looks in the world: pose at its anchor, held prop, particles and privacy. */
export interface Visual {
  pose: Pose;
  prop?: Prop;
  particles?: ParticleKind;
  /** Hidden for privacy (toilets, showers); the fixture shows it's in use instead. */
  hide?: boolean;
  /** Sits on the anchor's seat rather than standing in front of it. */
  seated?: boolean;
  /** Moves around the area while the activity runs instead of standing still. */
  roam?: "walk" | "jog";
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
  watch_cinema: { pose: "sit", seated: true, particles: "sparkle" },
  practise_piano: { pose: "type", particles: "notes" },
  workstation_sprint: { pose: "type", particles: "code", seated: true },
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
  watch_band: { pose: "dance" },
  house_party: { pose: "dance", particles: "notes" },
  house_party_pantry: { pose: "dance", particles: "notes" },
  backroom_dance: { pose: "dance", particles: "notes" },
  open_mic: { pose: "perform", prop: "mic", particles: "notes" },
  backroom_setup: { pose: "work" },
  backroom_drink: { pose: "sit", seated: true },
  park_walk: { pose: "walk", roam: "walk" },
  park_jog: { pose: "jog", roam: "jog", particles: "sweat" },
  picnic: { pose: "snack", prop: "plate", particles: "food" },
  park_photos: { pose: "photo", particles: "sparkle" },
  outdoor_fitness: { pose: "celebrate", particles: "sweat" },
  park_bench: { pose: "sit", seated: true },
  library_coding: { pose: "read", seated: true },
  library_cooking: { pose: "read", seated: true },
  library_business: { pose: "read", seated: true },
  library_computer: { pose: "type", particles: "code", seated: true },
  reading_group: { pose: "sit", particles: "chat", seated: true },
  campus_study: { pose: "read", seated: true },
  campus_tutorial: { pose: "talk", particles: "chat" },
  campus_canteen: { pose: "snack", prop: "plate", particles: "food" },
  five_a_side: { pose: "jog", roam: "jog", particles: "sweat" },
  campus_tutor: { pose: "talk", particles: "chat" },
  yard_coding: { pose: "type", particles: "code", seated: true },
  yard_pitch: { pose: "talk", particles: "sparkle" },
  yard_repair: { pose: "work", particles: "sparkle" },
  yard_network: { pose: "snack", prop: "cup", particles: "chat" },
  yard_bug_bash: { pose: "type", particles: "code", seated: true },
  company_work_yard: { pose: "type", particles: "sparkle", seated: true },
  company_work_home: { pose: "type", particles: "sparkle", seated: true },
  pub_quiz: { pose: "sit", particles: "chat", seated: true },
  watch_match: { pose: "talk" },
  pub_lunch: { pose: "eat", particles: "steam", seated: true },
  pub_darts: { pose: "wave" },
  pub_drink: { pose: "sit", seated: true },
  club_dance: { pose: "dance", particles: "notes" },
  dance_battle: { pose: "dance", particles: "sparkle" },
  club_mocktail: { pose: "sit", seated: true },
  river_walk: { pose: "walk", roam: "walk" },
  busk: { pose: "strum", prop: "guitar", particles: "notes" },
  skyline_photo: { pose: "photo", particles: "sparkle" },
  watch_sunset: { pose: "sit", seated: true, particles: "hearts" },
  street_snack: { pose: "snack", prop: "cup", particles: "food" },
  market_street_food: { pose: "snack", prop: "plate", particles: "food" },
  market_help: { pose: "work" },
  market_photo_gig: { pose: "photo", particles: "sparkle" },
  market_browse: { pose: "idle" },
  gym_weights: { pose: "lift", particles: "sweat" },
  gym_treadmill: { pose: "jog", particles: "sweat" },
  gym_yoga: { pose: "yoga" },
  gym_coaching: { pose: "lift", particles: "sweat" },
  gym_shower: { pose: "idle", hide: true, particles: "steam" },
  gym_shake: { pose: "snack", prop: "cup" },
  salon_gossip: { pose: "sit", particles: "chat", seated: true },
  salon_nails: { pose: "sit", particles: "sparkle", seated: true },
  salon_assist: { pose: "work" },
  see_nurse: { pose: "talk", particles: "hearts" },
  pharmacy_remedy: { pose: "snack", prop: "cup" },
  health_check: { pose: "talk" },
  health_volunteer: { pose: "work", particles: "chat" },
  health_water: { pose: "sit", seated: true },
  ...VISUALS_A,
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
