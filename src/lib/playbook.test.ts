// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_RULES,
  MAX_RULES,
  PLAYBOOK_KEY,
  activeRules,
  loadPlaybook,
  savePlaybook,
} from "@/lib/playbook";
import { SPECIALTIES, advocateLinks, cityFrom } from "@/lib/advocate";

beforeEach(() => {
  window.localStorage.clear();
});

describe("playbook storage", () => {
  it("starts from the default positions and persists edits", () => {
    expect(loadPlaybook()).toEqual(DEFAULT_RULES);
    savePlaybook([{ id: "x", text: "Deposit refunded within 15 days", enabled: true }]);
    expect(loadPlaybook().map((r) => r.id)).toEqual(["x"]);
  });

  it("ignores corrupt entries and caps the list", () => {
    window.localStorage.setItem(PLAYBOOK_KEY, "{nope");
    expect(loadPlaybook()).toEqual(DEFAULT_RULES);
    const many = Array.from({ length: 30 }, (_, n) => ({ id: `${n}`, text: `Rule ${n}`, enabled: true }));
    window.localStorage.setItem(PLAYBOOK_KEY, JSON.stringify([{ id: 1 }, ...many]));
    expect(loadPlaybook()).toHaveLength(MAX_RULES);
  });

  it("sends only enabled, non-empty positions", () => {
    expect(
      activeRules([
        { id: "a", text: "  Mutual liability  ", enabled: true },
        { id: "b", text: "Off", enabled: false },
        { id: "c", text: "   ", enabled: true },
      ]),
    ).toEqual(["Mutual liability"]);
  });
});

describe("advocate finder", () => {
  it("extracts the city from a location", () => {
    expect(cityFrom("Pune, Maharashtra")).toBe("Pune");
    expect(cityFrom("Delhi (NCT), India")).toBe("Delhi");
    expect(cityFrom("")).toBe("");
  });

  it("builds a specialty + city search and official legal-aid links", () => {
    const links = advocateLinks("property", "Pune, Maharashtra");
    expect(links[0]?.label).toBe("Search: Property & tenancy in Pune");
    expect(decodeURIComponent(links[0]?.url ?? "")).toContain("rent tenancy advocate Pune");
    expect(links.some((l) => l.url.includes("nalsa.gov.in"))).toBe(true);
    for (const l of links) expect(l.url).toMatch(/^https:\/\//);
  });

  it("falls back to the first specialty and all of India", () => {
    const links = advocateLinks("unknown", "");
    expect(links[0]?.label).toBe(`Search: ${SPECIALTIES[0]?.label} in India`);
  });
});
