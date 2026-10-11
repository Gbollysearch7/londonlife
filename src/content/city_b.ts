import type { ActivityDef, VenueDef } from "./types";

/**
 * LONDON CONTENT DEFAULTS (spec ch. 30–31), venues part B: stadium, hotel, river jetty, golf club,
 * bike workshop, build yard, air terminal and the two civic buildings.
 * Original fictional venues, NPCs and prices; not real businesses, real fixtures or real opening hours.
 * Features owned by other systems (flights, vehicles, land, elections, court cases) are labelled as
 * coming later and never faked here.
 */

/** Reputation level (1-based, see REPUTATION_TITLES) needed for the members' side of The Members' Green. */
export const MEMBERS_GREEN_REP_LEVEL = 4;

export const VENUES_B: VenueDef[] = [
  {
    id: "borough_stadium",
    name: "Borough Stadium",
    district: "Brixton",
    kind: "venue",
    blurb: "A roaring bowl of red seats with a covered concourse and a training pitch. Fictional matches in the afternoon, concerts in the evening, tours in the morning.",
    opening: "10:00–23:00 · Match 14:00–17:00 · Concert 19:00–22:00",
    access: "Tickets per event",
    npcs: [{ id: "lou", name: "Lou", role: "Stadium steward (NPC)" }],
    street: { x: 30 },
    map: [3.5, 7.35],
    hours: [10, 23],
    tags: ["sport", "music", "social", "fitness"],
  },
  {
    id: "thames_house",
    name: "The Thames House Hotel",
    district: "South Bank",
    kind: "venue",
    blurb: "A grand riverside hotel with a brunch buffet, a lounge band, a pool and a spa. Day rooms for a rest; your home stays your home.",
    opening: "07:00–00:00",
    access: "Pay per treat",
    npcs: [{ id: "celeste", name: "Celeste", role: "Concierge (NPC)" }],
    street: { x: 14 },
    map: [3.3, 4.05],
    hours: [7, 24],
    tags: ["food", "care", "fitness", "music"],
  },
  {
    id: "riverlight_jetty",
    name: "Riverlight Jetty",
    district: "Greenwich",
    kind: "venue",
    blurb: "A floating pontoon with a ticket hut and the little cruiser Evening Star. Scheduled sightseeing sailings that start and end right here.",
    opening: "10:00–21:00 · Sailings 11:00–16:00, 17:00 and 19:00",
    access: "Ticket per sailing",
    npcs: [{ id: "moss", name: "Skipper Moss", role: "Boat skipper (NPC)" }],
    street: { x: 32 },
    map: [9.1, 5.45],
    hours: [10, 21],
    tags: ["outdoors", "photography", "social"],
  },
  {
    id: "members_green",
    name: "The Members' Green",
    district: "Greenwich",
    kind: "venue",
    blurb: "A fictional prestige golf club on the hill. Members' course and clubhouse for well-known Londoners; the public driving range is open to everyone.",
    opening: "07:00–21:00",
    access: "Range: open to all · Course & clubhouse: Borough Favourite reputation",
    npcs: [{ id: "fenwick", name: "Mr Fenwick", role: "Club secretary (NPC)" }],
    street: { x: 34 },
    map: [8.7, 6.75],
    hours: [7, 21],
    tags: ["fitness", "outdoors", "social"],
  },
  {
    id: "pedal_patch",
    name: "Pedal & Patch",
    district: "Shoreditch",
    kind: "venue",
    blurb: "A bike workshop under a railway arch: repair stands, a route board and a coffee hatch. Bike rental and ownership are coming later.",
    opening: "08:00–19:00",
    access: "Free entry",
    npcs: [{ id: "rosa", name: "Rosa", role: "Bike mechanic (NPC)" }],
    street: { x: 33 },
    map: [5.6, 2.55],
    hours: [8, 19],
    tags: ["fitness", "earn", "learn"],
  },
  {
    id: "build_yard",
    name: "Borough Build Yard",
    district: "King's Cross",
    kind: "venue",
    blurb: "Timber racks, brick pallets and a joinery workshop by the rail lands. Learn practical skills now; owning land and building on it comes later.",
    opening: "07:00–18:00",
    access: "Free entry",
    npcs: [{ id: "tunde", name: "Tunde", role: "Yard foreman (NPC)" }],
    street: { x: 22 },
    map: [2.3, 0.6],
    hours: [7, 18],
    tags: ["learn", "enterprise", "earn"],
  },
  {
    id: "air_terminal",
    name: "London Air Terminal",
    district: "Greenwich",
    kind: "venue",
    blurb: "A bright departures hall with a café overlooking the apron, comfy seats and fictional duty-free shops. Flights aren't open to players yet.",
    opening: "05:00–00:00",
    access: "Public areas free · Flights not yet available",
    npcs: [{ id: "imani", name: "Imani", role: "Information desk (NPC)" }],
    street: { x: 36 },
    map: [10.4, 5.3],
    hours: [5, 24],
    tags: ["photography", "food", "free"],
  },
  {
    id: "city_hall",
    name: "City Hall & Polling Room",
    district: "City",
    kind: "venue",
    blurb: "The borough's civic building: a public lobby, a civic display and a talk room. The polling room is ready for elections when they arrive.",
    opening: "09:00–18:00",
    access: "Free · Elections coming later",
    npcs: [{ id: "gwen", name: "Gwen", role: "Civic guide (NPC)" }],
    street: { x: 26 },
    map: [4.2, 3.55],
    hours: [9, 18],
    tags: ["free", "learn", "social"],
  },
  {
    id: "justice_hall",
    name: "City Justice Hall",
    district: "City",
    kind: "venue",
    blurb: "Stone columns, a quiet law library and a hearing room. Learn how the courts work; public hearings of fictional cases are coming later.",
    opening: "09:00–17:00",
    access: "Free · Public gallery coming later",
    npcs: [{ id: "bram", name: "Usher Bram", role: "Court usher (NPC)" }],
    street: { x: 28 },
    map: [4.85, 3.45],
    hours: [9, 17],
    tags: ["free", "learn", "quiet"],
  },
];

const NO_REFUND = "Cancelling ends the activity with no reward; costs already paid are not refunded.";
const PAID = "Leaving before the end pays nothing.";
const TICKET = "Tickets aren't refunded if you leave early.";
const chat = (npc: string, name: string, location: VenueDef["id"], anchor: string): ActivityDef => ({
  id: `chat_${npc}`,
  label: `Chat with ${name}`,
  description: `${name} is an NPC: a named local character, not another player.`,
  location,
  minutes: 2,
  costPence: 0,
  needs: { social: 12 },
  xp: { skill: "charisma", amount: 4 },
  cooldownMin: 30,
  cancelRule: NO_REFUND,
  event: "npc_chat",
  eventData: { npc },
  npc,
  anchor,
});
const toilet = (location: VenueDef["id"]): ActivityDef => ({
  id: `${location}_toilet`,
  label: "Use the toilets",
  description: "",
  location,
  minutes: 1,
  costPence: 0,
  needs: { bladder: 65 },
  cancelRule: NO_REFUND,
  event: "toilet",
  anchor: "wc",
});
const members = MEMBERS_GREEN_REP_LEVEL;

export const ACTIVITIES_B: ActivityDef[] = [
  // ── Borough Stadium ──
  { id: "stadium_match", label: "Watch the match", description: "£25 ticket for this afternoon's fictional derby. Gates open 14:00; last entry 16:59.", location: "borough_stadium", minutes: 15, costPence: 2500, needs: { fun: 35, social: 12, energy: -4, bladder: -4 }, dailyLimit: 1, hours: [14, 17], cancelRule: TICKET, event: "relaxed", eventData: { show: "match" }, anchor: "stands" },
  { id: "stadium_concert", label: "Evening concert", description: "£30 ticket for an original stadium pop act. Doors 19:00; last entry 21:59.", location: "borough_stadium", minutes: 15, costPence: 3000, needs: { fun: 38, social: 10, energy: -5, bladder: -4 }, dailyLimit: 1, hours: [19, 22], cancelRule: TICKET, event: "relaxed", eventData: { show: "concert" }, anchor: "stands" },
  { id: "stadium_chant", label: "Lead a chant in the stands", description: "Get the whole block singing during an event.", location: "borough_stadium", minutes: 3, costPence: 0, needs: { fun: 10, social: 10, energy: -2 }, xp: { skill: "charisma", amount: 6 }, cooldownMin: 30, hours: [14, 22], cancelRule: NO_REFUND, event: "practised", eventData: { skill: "charisma" }, anchor: "stands" },
  { id: "stadium_tour", label: "Stadium tour", description: "£12 morning tour of the dressing rooms, tunnel and press box with Lou.", location: "borough_stadium", minutes: 10, costPence: 1200, needs: { fun: 16, social: 6, energy: -2 }, dailyLimit: 1, hours: [10, 14], cancelRule: TICKET, event: "relaxed", eventData: { show: "tour" }, anchor: "tunnel" },
  { id: "stadium_scarf", label: "Buy a matchday scarf", description: "£10 souvenir moment: wave it in the stands. It's a keepsake moment only and isn't added to your wardrobe.", location: "borough_stadium", minutes: 1, costPence: 1000, needs: { fun: 8 }, dailyLimit: 1, cancelRule: "Paid at the kiosk; not refunded.", event: "souvenir_bought", eventData: { item: "scarf" }, anchor: "shop" },
  { id: "penalty_practice", label: "Penalty practice", description: "Free spot-kicks on the training pitch while no event is on.", location: "borough_stadium", minutes: 8, costPence: 0, needs: { fun: 12, energy: -8, hygiene: -6 }, xp: { skill: "fitness", amount: 16 }, minEnergy: 15, hours: [10, 14], cancelRule: NO_REFUND, event: "practised", eventData: { skill: "fitness" }, anchor: "pitch" },
  { id: "stadium_pie", label: "Concourse pie", description: "Steak-style mushroom pie and a cup of tea, £6.", location: "borough_stadium", minutes: 3, costPence: 600, needs: { hunger: 32, fun: 4, bladder: -4 }, cancelRule: "Paid at the kiosk; not refunded.", event: "meal_eaten", anchor: "concourse" },
  chat("lou", "Lou", "borough_stadium", "concourse"),
  toilet("borough_stadium"),

  // ── The Thames House Hotel ──
  { id: "hotel_brunch", label: "Brunch buffet", description: "£18 all-you-can-eat pastries, eggs and fruit. 08:00–14:00.", location: "thames_house", minutes: 4, costPence: 1800, needs: { hunger: 50, fun: 10, bladder: -4 }, hours: [8, 14], cancelRule: "Paid at the door; not refunded.", event: "meal_eaten", anchor: "buffet" },
  { id: "lounge_band", label: "Listen to the lounge band", description: "A jazz trio plays the lounge most evenings. Free to sit in.", location: "thames_house", minutes: 10, costPence: 0, needs: { fun: 20, social: 4, energy: 3 }, hours: [18, 24], cancelRule: NO_REFUND, event: "relaxed", anchor: "lounge" },
  { id: "hotel_swim", label: "Swim in the pool", description: "£10 day pass for lengths in the rooftop-style pool.", location: "thames_house", minutes: 10, costPence: 1000, needs: { fun: 10, energy: -10, hygiene: 4 }, xp: { skill: "fitness", amount: 20 }, minEnergy: 15, hours: [7, 22], cancelRule: "The pool pass isn't refunded.", event: "practised", eventData: { skill: "fitness" }, anchor: "pool" },
  { id: "spa_massage", label: "Spa massage", description: "£35 for a slow, warm massage. One a day.", location: "thames_house", minutes: 10, costPence: 3500, needs: { energy: 20, fun: 18, hygiene: 8 }, dailyLimit: 1, hours: [9, 21], cancelRule: "The treatment is paid up front; not refunded.", event: "relaxed", anchor: "spa" },
  { id: "hotel_room_rest", label: "Rest in a day room", description: "£45 timed day room for a proper lie-down. It's a rest, not a move — you keep your own home.", location: "thames_house", minutes: 20, costPence: 4500, needs: { energy: 50, hunger: -4 }, dailyLimit: 1, cancelRule: "The day-room fee isn't refunded if you check out early.", event: "napped", anchor: "room" },
  { id: "hotel_photos", label: "Photograph the atrium", description: "Marble, brass and a chandelier the size of a car.", location: "thames_house", minutes: 10, costPence: 0, needs: { fun: 8 }, xp: { skill: "photography", amount: 20 }, cancelRule: NO_REFUND, event: "practised", eventData: { skill: "photography" }, anchor: "lobby" },
  chat("celeste", "Celeste", "thames_house", "lobby"),
  toilet("thames_house"),

  // ── Riverlight Jetty ──
  { id: "cruise_day", label: "Daytime river loop", description: "£8 round trip past the old docks, back to this jetty. Boarding 11:00–15:59.", location: "riverlight_jetty", minutes: 10, costPence: 800, needs: { fun: 20, social: 6, energy: 2 }, hours: [11, 16], cancelRule: TICKET, event: "relaxed", eventData: { sailing: "day" }, anchor: "boat" },
  { id: "cruise_sunset_17", label: "Sunset cruise · 17:00 sailing", description: "£14 ticket. Boarding 17:00–17:59; returns to this jetty.", location: "riverlight_jetty", minutes: 15, costPence: 1400, needs: { fun: 34, social: 10, energy: 4 }, dailyLimit: 1, hours: [17, 18], cancelRule: TICKET, event: "relaxed", eventData: { sailing: "sunset" }, anchor: "boat" },
  { id: "cruise_sunset_19", label: "Sunset cruise · 19:00 sailing", description: "£14 ticket. Boarding 19:00–19:59; returns to this jetty.", location: "riverlight_jetty", minutes: 15, costPence: 1400, needs: { fun: 34, social: 10, energy: 4 }, dailyLimit: 1, hours: [19, 20], cancelRule: TICKET, event: "relaxed", eventData: { sailing: "sunset" }, anchor: "boat" },
  { id: "deck_photos", label: "Photograph from the pontoon", description: "Gulls, cranes and the light on the water.", location: "riverlight_jetty", minutes: 10, costPence: 0, needs: { fun: 10 }, xp: { skill: "photography", amount: 20 }, cancelRule: NO_REFUND, event: "practised", eventData: { skill: "photography" }, anchor: "deck" },
  { id: "jetty_snack", label: "Hot chocolate and a pretzel", description: "£4 from the ticket hut window.", location: "riverlight_jetty", minutes: 2, costPence: 400, needs: { hunger: 18, fun: 4, bladder: -4 }, cancelRule: NO_REFUND, event: "meal_eaten", anchor: "hut" },
  chat("moss", "Skipper Moss", "riverlight_jetty", "hut"),
  toilet("riverlight_jetty"),

  // ── The Members' Green ──
  { id: "range_bucket", label: "Hit a bucket at the range", description: "£5 for a bucket of balls at the public driving range. Open to everyone.", location: "members_green", minutes: 10, costPence: 500, needs: { fun: 12, energy: -6 }, xp: { skill: "fitness", amount: 20 }, minEnergy: 15, cancelRule: "The bucket isn't refunded.", event: "practised", eventData: { skill: "fitness" }, anchor: "range" },
  { id: "golf_lesson", label: "Lesson with the club pro", description: "£20 one-to-one at the public range. Open to everyone.", location: "members_green", minutes: 10, costPence: 2000, needs: { fun: 8, social: 6, energy: -6 }, xp: { skill: "fitness", amount: 32 }, minEnergy: 15, dailyLimit: 1, cancelRule: "The lesson fee isn't refunded.", event: "practised", eventData: { skill: "fitness" }, anchor: "range" },
  { id: "range_tea", label: "Tea and a flapjack", description: "£3 at the range hut.", location: "members_green", minutes: 2, costPence: 300, needs: { hunger: 12, energy: 4, bladder: -5 }, cancelRule: NO_REFUND, event: "meal_eaten", anchor: "hut" },
  { id: "golf_round", label: "Play nine holes", description: "£30 green fee on the members' course. Members only: needs reputation level 4 (Borough Favourite).", location: "members_green", minutes: 15, costPence: 3000, needs: { fun: 22, social: 8, energy: -10, hygiene: -4 }, xp: { skill: "fitness", amount: 30 }, minEnergy: 20, repGate: members, cancelRule: "The green fee isn't refunded.", event: "practised", eventData: { skill: "fitness" }, anchor: "tee" },
  { id: "clubhouse_lunch", label: "Lunch on the clubhouse terrace", description: "£16 for the club plate. Members only.", location: "members_green", minutes: 4, costPence: 1600, needs: { hunger: 45, fun: 8, social: 6, bladder: -4 }, repGate: members, cancelRule: "Paid at the table; not refunded.", event: "meal_eaten", anchor: "terrace" },
  { id: "members_network", label: "Network in the clubhouse", description: "Swap stories with founders and bankers. Contacts, not instant cash. Members only.", location: "members_green", minutes: 6, costPence: 0, needs: { social: 14 }, xp: { skill: "charisma", amount: 12 }, repGate: members, cooldownMin: 60, cancelRule: NO_REFUND, event: "practised", eventData: { skill: "charisma" }, anchor: "clubhouse" },
  chat("fenwick", "Mr Fenwick", "members_green", "clubhouse"),
  toilet("members_green"),

  // ── Pedal & Patch ──
  { id: "bike_repair_job", label: "Patch punctures for Rosa", description: "Practice job: fix inner tubes for £16.", location: "pedal_patch", minutes: 6, costPence: 0, payPence: 1600, needs: { energy: -4, hygiene: -3 }, xp: { skill: "enterprise", amount: 8 }, dailyLimit: 3, minEnergy: 15, cancelRule: PAID, event: "side_task_paid", anchor: "stand" },
  { id: "bike_workshop", label: "Bike maintenance workshop", description: "£5 class: brakes, gears and chains.", location: "pedal_patch", minutes: 10, costPence: 500, needs: { fun: 6, social: 4 }, xp: { skill: "enterprise", amount: 20 }, cancelRule: "The class fee isn't refunded.", event: "practised", eventData: { skill: "enterprise" }, anchor: "workshop" },
  { id: "social_ride", label: "Join the morning social ride", description: "Free group loop on a borrowed shop bike, 09:00–11:59. Bike ownership comes later.", location: "pedal_patch", minutes: 10, costPence: 0, needs: { fun: 14, social: 12, energy: -10, hygiene: -8 }, xp: { skill: "fitness", amount: 20 }, minEnergy: 20, dailyLimit: 1, hours: [9, 12], cancelRule: NO_REFUND, event: "practised", eventData: { skill: "fitness" }, anchor: "board" },
  { id: "route_board", label: "Plan a route on the board", description: "Pins, string and Rosa's favourite canal paths.", location: "pedal_patch", minutes: 4, costPence: 0, needs: { fun: 8 }, cooldownMin: 30, cancelRule: NO_REFUND, event: "relaxed", anchor: "board" },
  { id: "pedal_coffee", label: "Coffee from the hatch", description: "£3 flat white in a dented tin mug.", location: "pedal_patch", minutes: 2, costPence: 300, needs: { energy: 8, fun: 2, bladder: -6 }, cancelRule: NO_REFUND, event: "relaxed", anchor: "hatch" },
  chat("rosa", "Rosa", "pedal_patch", "stand"),
  toilet("pedal_patch"),

  // ── Borough Build Yard ──
  { id: "site_induction", label: "Site safety induction", description: "£10 practical session with Tunde. One a day.", location: "build_yard", minutes: 10, costPence: 1000, needs: { social: 4 }, xp: { skill: "enterprise", amount: 22 }, dailyLimit: 1, cancelRule: "The session fee isn't refunded.", event: "practised", eventData: { skill: "enterprise" }, npc: "tunde", anchor: "planning" },
  { id: "joinery_session", label: "Practical joinery session", description: "£6 bench time: measure, cut, join.", location: "build_yard", minutes: 10, costPence: 600, needs: { fun: 8, energy: -6, hygiene: -6 }, xp: { skill: "enterprise", amount: 20 }, minEnergy: 15, cancelRule: "The bench fee isn't refunded.", event: "practised", eventData: { skill: "enterprise" }, anchor: "workshop" },
  { id: "materials_browse", label: "Browse the materials yard", description: "Timber, brick and slate with price tags. Buying materials comes with land and building later.", location: "build_yard", minutes: 6, costPence: 0, needs: { fun: 6 }, cancelRule: NO_REFUND, event: "relaxed", anchor: "materials" },
  { id: "planning_desk", label: "Ask at the planning desk", description: "Learn how a build plan works. Owning a plot and building on it is coming later.", location: "build_yard", minutes: 4, costPence: 0, needs: { social: 4 }, xp: { skill: "enterprise", amount: 6 }, cooldownMin: 60, cancelRule: NO_REFUND, event: "practised", eventData: { skill: "enterprise" }, anchor: "planning" },
  { id: "yard_van", label: "Load the delivery van", description: "Heavy lifting for £18.", location: "build_yard", minutes: 5, costPence: 0, payPence: 1800, needs: { energy: -7, hygiene: -5 }, xp: { skill: "fitness", amount: 6 }, dailyLimit: 2, minEnergy: 20, cancelRule: PAID, event: "side_task_paid", anchor: "van" },
  { id: "builders_tea", label: "Builder's tea at the hut", description: "£1 for a strong one.", location: "build_yard", minutes: 2, costPence: 100, needs: { energy: 6, fun: 2, bladder: -6 }, cancelRule: NO_REFUND, event: "relaxed", anchor: "hut" },
  chat("tunde", "Tunde", "build_yard", "hut"),
  toilet("build_yard"),

  // ── London Air Terminal ──
  { id: "apron_cafe", label: "Coffee by the apron window", description: "£5 coffee and croissant while the planes taxi past.", location: "air_terminal", minutes: 3, costPence: 500, needs: { hunger: 16, energy: 8, fun: 4, bladder: -6 }, cancelRule: NO_REFUND, event: "meal_eaten", anchor: "cafe" },
  { id: "plane_watching", label: "Watch the planes", description: "Take-offs, landings and a tug pushing back a jet.", location: "air_terminal", minutes: 8, costPence: 0, needs: { fun: 16 }, cancelRule: NO_REFUND, event: "relaxed", anchor: "window" },
  { id: "plane_photos", label: "Photograph the take-offs", description: "Long lenses and patience at the big window.", location: "air_terminal", minutes: 10, costPence: 0, needs: { fun: 8 }, xp: { skill: "photography", amount: 20 }, cancelRule: NO_REFUND, event: "practised", eventData: { skill: "photography" }, anchor: "window" },
  { id: "terminal_relax", label: "Relax in the lounge seats", description: "Free, with a view of the departures board you can't use yet.", location: "air_terminal", minutes: 6, costPence: 0, needs: { energy: 10, fun: 3 }, cancelRule: NO_REFUND, event: "relaxed", anchor: "lounge" },
  { id: "duty_free_browse", label: "Browse the duty-free", description: "Window-shopping fictional perfumes and chocolates. Nothing to buy yet.", location: "air_terminal", minutes: 6, costPence: 0, needs: { fun: 10 }, cancelRule: NO_REFUND, event: "relaxed", anchor: "shops" },
  chat("imani", "Imani", "air_terminal", "info"),
  toilet("air_terminal"),

  // ── City Hall & Polling Room ──
  { id: "civic_display", label: "Read the civic display", description: "How the fictional borough council works, what it spends and who decides.", location: "city_hall", minutes: 8, costPence: 0, needs: { fun: 4 }, xp: { skill: "enterprise", amount: 10 }, cancelRule: NO_REFUND, event: "practised", eventData: { skill: "enterprise" }, anchor: "display" },
  { id: "community_talk", label: "Attend a community talk", description: "Neighbours discuss parks, buses and bins. 12:00–16:59, one a day.", location: "city_hall", minutes: 10, costPence: 0, needs: { social: 12, fun: 4 }, xp: { skill: "charisma", amount: 14 }, dailyLimit: 1, hours: [12, 17], cancelRule: NO_REFUND, event: "practised", eventData: { skill: "charisma" }, anchor: "talk" },
  { id: "civic_greeter", label: "Volunteer as a lobby greeter", description: "Point visitors the right way and hand out leaflets.", location: "city_hall", minutes: 10, costPence: 0, needs: { social: 14, energy: -5 }, xp: { skill: "charisma", amount: 12 }, minEnergy: 15, cancelRule: NO_REFUND, event: "practised", eventData: { skill: "charisma" }, anchor: "lobby" },
  { id: "lobby_rest", label: "Sit in the public lobby", description: "Free benches and a water fountain.", location: "city_hall", minutes: 5, costPence: 0, needs: { energy: 8, bladder: -3 }, cancelRule: NO_REFUND, event: "relaxed", anchor: "bench" },
  chat("gwen", "Gwen", "city_hall", "lobby"),
  toilet("city_hall"),

  // ── City Justice Hall ──
  { id: "courts_tour", label: "Learn about the courts", description: "A free usher-led tour of how game disputes will be heard. Public hearings are coming later.", location: "justice_hall", minutes: 10, costPence: 0, needs: { fun: 6, social: 6 }, xp: { skill: "enterprise", amount: 12 }, dailyLimit: 1, cancelRule: NO_REFUND, event: "relaxed", anchor: "hearing" },
  { id: "law_library_reading", label: "Quiet reading in the law library", description: "Contracts, consumer rights and small-business rules, for free.", location: "justice_hall", minutes: 10, costPence: 0, needs: { fun: 3 }, xp: { skill: "enterprise", amount: 20 }, cancelRule: NO_REFUND, event: "practised", eventData: { skill: "enterprise" }, anchor: "library" },
  chat("bram", "Usher Bram", "justice_hall", "hall"),
  toilet("justice_hall"),
];
