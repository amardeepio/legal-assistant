import { describe, expect, it } from "vitest";
import {
  STATE_GUIDES,
  computeStampDuty,
  formatINR,
  roundUp,
  stateFromLocation,
} from "@/lib/stamp-duty";

const rent = {
  instrument: "rent",
  monthlyRent: 18_500,
  months: 11,
  refundableDeposit: 55_500,
  nonRefundableDeposit: 0,
  urban: true,
} as const;

describe("Maharashtra leave & licence (Art. 36A)", () => {
  it("charges 0.25% on fee + 10% p.a. notional interest, rounded up to ₹100", () => {
    const r = computeStampDuty("MH", rent);
    // 18,500 × 11 = 2,03,500; 55,500 × 10% × 11/12 = 5,087.5 → 2,08,587.5 × 0.25% = 521.47 → ₹600
    expect(r?.lines[0]?.amount).toBe(600);
    expect(r?.lines[1]?.amount).toBe(1000);
    expect(r?.total).toBe(1600);
    expect(r?.registration).toMatch(/compulsory/i);
  });

  it("applies the ₹100 minimum and the rural registration fee", () => {
    const r = computeStampDuty("MH", { ...rent, monthlyRent: 1000, months: 2, refundableDeposit: 0, urban: false });
    expect(r?.lines.map((l) => l.amount)).toEqual([100, 500]);
  });
});

describe("sale deeds", () => {
  it("Maharashtra: 6% urban with 1% women rebate and ₹30k registration cap", () => {
    const man = computeStampDuty("MH", { instrument: "sale", value: 1_00_00_000, buyer: "male", urban: true });
    const woman = computeStampDuty("MH", { instrument: "sale", value: 1_00_00_000, buyer: "female", urban: true });
    expect(man?.lines[0]?.amount).toBe(6_00_000);
    expect(woman?.lines[0]?.amount).toBe(5_00_000);
    expect(man?.lines[1]?.amount).toBe(30_000);
  });

  it("Delhi: gendered rates plus ₹100 pasting fee", () => {
    const r = computeStampDuty("DL", { instrument: "sale", value: 50_00_000, buyer: "joint", urban: true });
    expect(r?.lines.map((l) => l.amount)).toEqual([2_50_000, 50_100]);
  });

  it("West Bengal steps up above ₹1 crore", () => {
    const r = computeStampDuty("WB", { instrument: "sale", value: 2_00_00_000, buyer: "male", urban: true });
    expect(r?.lines[0]?.amount).toBe(14_00_000);
  });
});

describe("lookup helpers", () => {
  it("returns undefined when a formula isn't in the offline table", () => {
    expect(computeStampDuty("KA", rent)).toBeUndefined();
    expect(computeStampDuty("ZZ", rent)).toBeUndefined();
  });

  it("maps free-text locations to states", () => {
    expect(stateFromLocation("Pune, Maharashtra")).toBe("MH");
    expect(stateFromLocation("Delhi (NCT), India")).toBe("DL");
    expect(stateFromLocation("Kochi, Kerala")).toBeUndefined();
  });

  it("every state links an official https portal and e-registration steps", () => {
    for (const s of STATE_GUIDES) {
      expect(s.portal.url).toMatch(/^https:\/\//);
      expect(s.steps.rent.length).toBeGreaterThan(0);
      expect(s.steps.sale.length).toBeGreaterThan(0);
    }
  });

  it("formats rupees in the Indian system", () => {
    expect(formatINR(1234567)).toBe("₹12,34,567");
    expect(roundUp(521.4, 100)).toBe(600);
  });
});
