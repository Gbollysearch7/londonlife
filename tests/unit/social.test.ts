import { describe, expect, it } from "vitest";
import { BEST_FRIEND_POINTS, PLAYER_FRIEND_TIERS, cleanText, playerFriendTier } from "@/content/social";

describe("social content rules", () => {
  it("player friendship tiers run Acquaintance → Best friend with rising thresholds", () => {
    expect(PLAYER_FRIEND_TIERS.map((t) => t.title)).toEqual(["Acquaintance", "Friend", "Good friend", "Best friend"]);
    for (let i = 1; i < PLAYER_FRIEND_TIERS.length; i++) expect(PLAYER_FRIEND_TIERS[i].points).toBeGreaterThan(PLAYER_FRIEND_TIERS[i - 1].points);
    expect(playerFriendTier(0)).toMatchObject({ title: "Acquaintance", level: 0, best: false });
    expect(playerFriendTier(BEST_FRIEND_POINTS - 1).best).toBe(false);
    expect(playerFriendTier(BEST_FRIEND_POINTS)).toMatchObject({ title: "Best friend", best: true, next: null });
  });

  it("message text is trimmed, stripped of control characters and keeps one extra char so over-length is detectable", () => {
    expect(cleanText("  hi\u0000 there\u0007 ", 50)).toBe("hi there");
    expect(cleanText("line one\nline two", 50)).toBe("line one\nline two");
    expect(cleanText("<b>bold</b>", 50)).toBe("<b>bold</b>");
    expect(cleanText("x".repeat(600), 500)).toHaveLength(501);
    expect(cleanText(undefined, 10)).toBe("");
  });
});
