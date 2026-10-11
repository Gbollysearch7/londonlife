import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { profileFor } from "@/client/graphics";
import { sceneHotspots } from "@/world/hotspots";
import { LAYOUTS } from "@/world/venues/layouts";

describe("graphics quality profiles", () => {
  it("Low drops shadows, render scale and particles; High caps shadow maps on small screens", () => {
    const low = profileFor("low", { small: false, reducedMotion: false });
    expect(low.shadows).toBe(false);
    expect(low.dpr[1]).toBeLessThanOrEqual(1);
    expect(low.particles).toBeLessThan(1);
    expect(profileFor("high", { small: false, reducedMotion: false }).shadowMapSize).toBe(2048);
    expect(profileFor("high", { small: true, reducedMotion: false }).shadowMapSize).toBe(1024);
    expect(profileFor("high", { small: true, reducedMotion: false }).dpr[1]).toBeLessThan(profileFor("high", { small: false, reducedMotion: false }).dpr[1]);
  });

  it("reduced motion stops decorative motion on every quality", () => {
    expect(profileFor("high", { small: false, reducedMotion: true }).motion).toBe(false);
    expect(profileFor("low", { small: false, reducedMotion: true }).motion).toBe(false);
    expect(profileFor("high", { small: false, reducedMotion: false }).motion).toBe(true);
  });
});

/** A minimal state shaped like the server's, with only what the directory reads. */
function fakeState(location: string, extra: Record<string, unknown> = {}) {
  return {
    character: { location },
    journey: null,
    social: { visit: null },
    home: { tier: { gridW: 6, gridD: 5 } },
    furniture: [
      { id: "f1", defId: "single_bed", placed: true, x: 0, y: 0, rot: 0 },
      { id: "f2", defId: "single_bed", placed: false, x: null, y: null, rot: 0 },
    ],
    actions: [] as { id: string; label: string; available: boolean; hidden?: boolean; npc?: string }[],
    treasure: { anchor: null, found: false },
    ...extra,
  } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

describe("scene directory (keyboard list of hotspots)", () => {
  it("lists placed furniture and the way out at home, never stored items", () => {
    const list = sceneHotspots(fakeState("home"));
    expect(list.map((e) => e.key)).toEqual(["f1", "head-out"]);
    expect(list[1].kind).toBe("map");
    // While moving an item it isn't listed.
    expect(sceneHotspots(fakeState("home"), { placingId: "f1" }).map((e) => e.key)).toEqual(["head-out"]);
  });

  it("lists every NPC (labelled NPC) and the exit in each venue", () => {
    for (const [id, layout] of Object.entries(LAYOUTS)) {
      const list = sceneHotspots(fakeState(id));
      for (const n of layout.npcs) expect(list.find((e) => e.key === `npc:${n.id}`)?.label).toMatch(/\(NPC\)$/);
      if (layout.anchors.exit?.label) expect(list.some((e) => e.key === "anchor:exit")).toBe(true);
    }
  });

  it("is empty while travelling or visiting", () => {
    expect(sceneHotspots(fakeState("home", { journey: { id: "j" } }))).toEqual([]);
    expect(sceneHotspots(fakeState("home", { social: { visit: { hostId: "h" } } }))).toEqual([]);
  });
});

// WCAG relative luminance contrast.
function lum(hex: string) {
  const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

describe("colour contrast of the new platform UI", () => {
  const css = fs.readFileSync("app/globals.css", "utf8");
  const token = (name: string) => css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))![1];
  const pairs: [string, string, string][] = [
    ["directory/settings text", token("ink"), token("paper")],
    ["secondary text on paper", token("ink-2"), token("paper")],
    ["secondary text on ivory", token("ink-2"), token("ivory")],
    ["segmented control text", token("ink"), token("ivory-2")],
    ["dev-only box text", "#17232b", "#f1e3c4"],
    ["dev-only label", "#ffffff", "#7b5a1d"],
    ["dev-only link", "#17232b", "#fbf8f2"],
    ["success message", "#1d5a45", token("paper")],
    ["error message", token("red"), token("paper")],
    ["perf overlay", "#fbf8f2", "#17232b"],
  ];
  for (const [name, fg, bg] of pairs) {
    it(`${name} meets WCAG AA (4.5:1)`, () => {
      expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5);
    });
  }
});
