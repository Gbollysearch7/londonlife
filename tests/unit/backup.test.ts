import { describe, expect, it } from "vitest";
import { dependencyOrder, orderSelfReferences } from "@/server/backup";

describe("backup ordering", () => {
  it("puts parents before children and ignores self-references", () => {
    const order = dependencyOrder(["ledger", "characters", "accounts", "games"], [
      { child: "characters", parent: "accounts" },
      { child: "ledger", parent: "characters" },
      { child: "games", parent: "characters" },
      { child: "games", parent: "games" },
    ]);
    expect(order).toEqual(["accounts", "characters", "games", "ledger"]);
  });

  it("reports a foreign-key cycle instead of looping", () => {
    expect(() => dependencyOrder(["a", "b"], [{ child: "a", parent: "b" }, { child: "b", parent: "a" }])).toThrow(/cycle/);
  });

  it("orders rows along a self-reference chain", () => {
    // [id, ref]
    const rows = [["c", "b"], ["a", null], ["b", "a"], ["x", "missing"]];
    const out = orderSelfReferences(rows, 1, 0).map((r) => r[0]);
    expect(out.indexOf("a")).toBeLessThan(out.indexOf("b"));
    expect(out.indexOf("b")).toBeLessThan(out.indexOf("c"));
    expect(out).toContain("x");
    expect(() => orderSelfReferences([["a", "b"], ["b", "a"]], 1, 0)).toThrow(/loop/);
  });
});
