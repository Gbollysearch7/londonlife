/** Billboard spots: pure data shared by the 3D boards and the placement tests. */

export interface Spot {
  site: string;
  /** Position of the board's bottom-centre on its posts (or on the wall). */
  pos: [number, number, number];
  rotY: number;
  w: number;
  h: number;
  /** Height of the board's bottom edge above the ground; posts are drawn up to it. */
  base: number;
  /** Wall-mounted boards have no posts; shelters get a little roof. */
  mount?: "posts" | "wall" | "shelter";
}

/** Where boards stand, keyed by venue id ("street" is the journey street scene). Kept clear of walk paths. */
export const BILLBOARD_SPOTS: Record<string, Spot[]> = {
  south_bank: [{ site: "south_bank", pos: [8.9, 0, 1.4], rotY: -90, w: 3.2, h: 1.8, base: 1.3 }],
  borough_market: [{ site: "borough_market", pos: [5.9, 0, -4.86], rotY: 0, w: 2.4, h: 1.35, base: 1.85, mount: "wall" }],
  regents_green: [{ site: "regents_green", pos: [-4.4, 0, -6.5], rotY: 0, w: 3.2, h: 1.8, base: 1.3 }],
  borough_stadium: [{ site: "stadium", pos: [5.4, 0, -7.1], rotY: 0, w: 4.2, h: 2.1, base: 2.3 }],
  street: [
    { site: "high_street", pos: [-19.5, 0.12, -4.25], rotY: 0, w: 1.3, h: 1.9, base: 0.3, mount: "shelter" },
    { site: "high_street", pos: [6.5, 0.12, -4.25], rotY: 0, w: 1.3, h: 1.9, base: 0.3, mount: "shelter" },
    { site: "high_street", pos: [25.0, 0.12, -4.25], rotY: 0, w: 1.3, h: 1.9, base: 0.3, mount: "shelter" },
  ],
};
