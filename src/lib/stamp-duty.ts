/**
 * Offline stamp-duty + registration-fee estimates for common instruments.
 *
 * Rates are INDICATIVE — last reviewed September 2026 against state IGR
 * portals and public rate tables. They change by notification, vary by city
 * (metro cess, LBT) and are applied to the higher of the agreed value and the
 * ready-reckoner / guideline value. The UI always pairs an estimate with the
 * official portal and a live "verify" action.
 */

export const RATES_REVIEWED = "September 2026";

export type Instrument = "rent" | "sale";
export type BuyerType = "male" | "female" | "joint";

export interface RentInput {
  readonly instrument: "rent";
  readonly monthlyRent: number;
  readonly months: number;
  readonly refundableDeposit: number;
  readonly nonRefundableDeposit: number;
  readonly urban: boolean;
}

export interface SaleInput {
  readonly instrument: "sale";
  /** Higher of agreed consideration and ready-reckoner / guideline value. */
  readonly value: number;
  readonly buyer: BuyerType;
  /** Municipal corporation / metro area vs. council or rural area. */
  readonly urban: boolean;
}

export type StampInput = RentInput | SaleInput;

export interface StampLine {
  readonly label: string;
  readonly amount: number;
  readonly basis: string;
}

export interface StampEstimate {
  readonly lines: readonly StampLine[];
  readonly total: number;
  readonly registration: string;
  readonly notes: readonly string[];
}

export interface StateGuide {
  readonly code: string;
  readonly name: string;
  readonly portal: { readonly label: string; readonly url: string };
  readonly steps: Readonly<Record<Instrument, readonly string[]>>;
  readonly rent?: (input: RentInput) => StampEstimate;
  readonly sale?: (input: SaleInput) => StampEstimate;
}

const ESTAMP = "https://www.shcilestamp.com/";

export function roundUp(amount: number, to: number): number {
  return Math.ceil(amount / to) * to;
}

function pct(value: number, rate: number): number {
  return Math.round((value * rate) / 100);
}

export function formatINR(amount: number): string {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

function estimate(
  lines: readonly StampLine[],
  registration: string,
  notes: readonly string[],
): StampEstimate {
  return {
    lines,
    total: lines.reduce((sum, l) => sum + l.amount, 0),
    registration,
    notes,
  };
}

function genericSaleSteps(portal: string): readonly string[] {
  return [
    `Check the guideline / circle-rate value for the property on ${portal}; duty is charged on the higher of that and the sale price.`,
    "Pay stamp duty via e-stamp paper (SHCIL / authorised vendor) or the state's online challan.",
    "Book a Sub-Registrar appointment online and upload the draft deed, ID and PAN of both parties.",
    "Buyer, seller and two witnesses attend for biometrics and signing; collect the registered deed.",
    "Apply for mutation (khata / property-card transfer) with the local body after registration.",
  ];
}

/** Maharashtra Stamp Act, Schedule I, Article 36A — leave & licence. */
function maharashtraRent(i: RentInput): StampEstimate {
  const years = i.months / 12;
  const totalFee = i.monthlyRent * i.months;
  const notionalInterest = i.refundableDeposit * 0.1 * years;
  const base = totalFee + notionalInterest + i.nonRefundableDeposit;
  const duty = Math.max(100, roundUp(base * 0.0025, 100));
  const reg = i.urban ? 1000 : 500;
  return estimate(
    [
      {
        label: "Stamp duty (Art. 36A)",
        amount: duty,
        basis: `0.25% of ${formatINR(base)} = licence fee ${formatINR(totalFee)} + 10% p.a. notional interest on deposit ${formatINR(notionalInterest)}${i.nonRefundableDeposit > 0 ? ` + non-refundable amount ${formatINR(i.nonRefundableDeposit)}` : ""}; rounded up to ₹100, minimum ₹100`,
      },
      {
        label: "Registration fee",
        amount: reg,
        basis: i.urban ? "Municipal corporation / council area" : "Rural (gram panchayat) area",
      },
    ],
    "Compulsory — s.55 Maharashtra Rent Control Act, 1999 requires every leave & licence agreement to be registered, whatever the term.",
    [
      "Online e-registration adds document-handling charges (a few hundred rupees) collected by the service provider.",
      "Unregistered L&L agreements are hard to rely on in eviction or deposit disputes, and the licensor can be penalised.",
    ],
  );
}

function maharashtraSale(i: SaleInput): StampEstimate {
  // 5% duty + 1% metro cess / LBT in municipal-corporation areas; 4% in councils.
  const rate = i.urban ? 6 : 4;
  const womanRebate = i.buyer === "female" ? 1 : 0;
  const duty = pct(i.value, rate - womanRebate);
  const reg = Math.min(30_000, pct(i.value, 1));
  return estimate(
    [
      {
        label: "Stamp duty",
        amount: duty,
        basis: `${rate - womanRebate}% of ${formatINR(i.value)}${womanRebate ? " (incl. 1% rebate for a sole woman buyer)" : ""}${i.urban ? " — includes 1% metro cess; Pune/PCMC and some cities levy another 1% LBT" : ""}`,
      },
      { label: "Registration fee", amount: reg, basis: "1% of value, capped at ₹30,000" },
    ],
    "Compulsory — sale of immovable property worth ₹100 or more (Registration Act, 1908, s.17).",
    ["Duty is charged on the higher of the agreement value and the ready-reckoner (ASR) rate."],
  );
}

/** Indian Stamp Act, Art. 35 as applicable in Delhi. */
function delhiRent(i: RentInput): StampEstimate {
  const totalRent = i.monthlyRent * i.months;
  const annual = i.months < 12 ? totalRent : totalRent / (i.months / 12);
  const duty = pct(annual + i.nonRefundableDeposit, 2);
  return estimate(
    [
      {
        label: "Stamp duty (Art. 35)",
        amount: duty,
        basis: `2% of ${i.months < 12 ? "total rent for the term" : "average annual rent"} ${formatINR(annual)}${i.nonRefundableDeposit > 0 ? ` + premium ${formatINR(i.nonRefundableDeposit)}` : ""} (terms up to 5 years)`,
      },
    ],
    i.months >= 12
      ? "Compulsory — leases of one year or more must be registered (Registration Act, s.17). Fee is roughly 1% of rent + ₹100 pasting fee; confirm at the Sub-Registrar."
      : "Optional for leases under 12 months, but a notarised e-stamped agreement is still needed for police verification.",
    ["Refundable security deposits are generally not charged separately — confirm if the deed calls it an advance or premium."],
  );
}

function delhiSale(i: SaleInput): StampEstimate {
  const rate = i.buyer === "female" ? 4 : i.buyer === "joint" ? 5 : 6;
  return estimate(
    [
      { label: "Stamp duty", amount: pct(i.value, rate), basis: `${rate}% of ${formatINR(i.value)} (men 6% · women 4% · joint 5%)` },
      { label: "Registration fee", amount: pct(i.value, 1) + 100, basis: "1% of value + ₹100 pasting fee" },
    ],
    "Compulsory — Registration Act, 1908, s.17.",
    ["Duty is charged on the higher of the sale price and the Delhi circle rate."],
  );
}

function karnatakaSale(i: SaleInput): StampEstimate {
  const rate = i.value <= 20_00_000 ? 2 : i.value <= 45_00_000 ? 3 : 5;
  const duty = pct(i.value, rate);
  const cess = i.urban ? Math.round(duty * 0.1) : 0;
  return estimate(
    [
      { label: "Stamp duty", amount: duty, basis: `${rate}% of ${formatINR(i.value)} (≤₹20L 2% · ≤₹45L 3% · above 5%)` },
      ...(cess > 0 ? [{ label: "Surcharge / cess", amount: cess, basis: "≈10% of duty in BBMP / urban areas" }] : []),
      { label: "Registration fee", amount: pct(i.value, 2), basis: "2% of value (revised 31 Aug 2025)" },
    ],
    "Compulsory — Registration Act, 1908, s.17.",
    ["Lower slabs are commonly limited to specific property types — confirm the slab for your deed on Kaveri."],
  );
}

function tamilNaduSale(i: SaleInput): StampEstimate {
  return estimate(
    [
      { label: "Stamp + transfer duty", amount: pct(i.value, 7), basis: `7% of ${formatINR(i.value)} (5% stamp + 2% transfer duty)` },
      { label: "Registration fee", amount: pct(i.value, 2), basis: "2% of value (as shown on TNREGINET)" },
    ],
    "Compulsory — Registration Act, 1908, s.17.",
    ["Charged on the higher of sale price and guideline value. Some sources still quote a 4% registration fee — check the current TNREGINET fee table."],
  );
}

function gujaratSale(i: SaleInput): StampEstimate {
  return estimate(
    [
      { label: "Stamp duty", amount: pct(i.value, 4.9), basis: `4.9% of ${formatINR(i.value)}` },
      {
        label: "Registration fee",
        amount: i.buyer === "female" ? 0 : pct(i.value, 1),
        basis: i.buyer === "female" ? "Waived for women buyers" : "1% of value",
      },
    ],
    "Compulsory — Registration Act, 1908, s.17.",
    ["Charged on the higher of sale price and jantri (ready-reckoner) value."],
  );
}

function westBengalSale(i: SaleInput): StampEstimate {
  const high = i.value > 1_00_00_000;
  const rate = (i.urban ? 6 : 5) + (high ? 1 : 0);
  return estimate(
    [
      { label: "Stamp duty", amount: pct(i.value, rate), basis: `${rate}% of ${formatINR(i.value)} (${i.urban ? "corporation / municipal" : "other"} area, ${high ? "above" : "up to"} ₹1 crore)` },
      { label: "Registration fee", amount: pct(i.value, 1), basis: "1% of value" },
    ],
    "Compulsory — Registration Act, 1908, s.17.",
    ["Charged on the higher of sale price and market value assessed by the registering officer."],
  );
}

function uttarPradeshSale(i: SaleInput): StampEstimate {
  const rebate = i.buyer === "female" && i.value <= 1_00_00_000 ? 1 : 0;
  const rate = 7 - rebate;
  return estimate(
    [
      { label: "Stamp duty", amount: pct(i.value, rate), basis: `${rate}% of ${formatINR(i.value)}${rebate ? " (1% rebate for a woman buyer, property up to ₹1 crore)" : ""}` },
      { label: "Registration fee", amount: pct(i.value, 1), basis: "1% of value" },
    ],
    "Compulsory — Registration Act, 1908, s.17.",
    ["Charged on the higher of sale price and circle rate. Joint-ownership concessions vary — confirm on IGRSUP."],
  );
}

export const STATE_GUIDES: readonly StateGuide[] = [
  {
    code: "MH",
    name: "Maharashtra",
    portal: { label: "IGR Maharashtra", url: "https://igrmaharashtra.gov.in/" },
    rent: maharashtraRent,
    sale: maharashtraSale,
    steps: {
      rent: [
        "Open the IGR Maharashtra e-registration (leave & licence) service or use an authorised online service provider.",
        "Enter property, licensor, licensee and term details; the portal computes Art. 36A duty.",
        "Pay stamp duty and the registration fee online through GRAS (gras.mahakosh.gov.in).",
        "Licensor, licensee and two witnesses complete Aadhaar-based biometric e-KYC — no Sub-Registrar visit needed.",
        "Download the registered agreement and share a copy with the local police for tenant verification.",
      ],
      sale: genericSaleSteps("IGR Maharashtra (ready reckoner)"),
    },
  },
  {
    code: "DL",
    name: "Delhi",
    portal: { label: "Delhi Revenue Department", url: "https://revenue.delhi.gov.in/" },
    rent: delhiRent,
    sale: delhiSale,
    steps: {
      rent: [
        `Buy e-stamp paper for the computed duty from SHCIL (${ESTAMP}) or an authorised collection centre.`,
        "Print the agreement on the e-stamp, sign with two witnesses, and notarise it.",
        "For a term of 12 months or more, book a Sub-Registrar appointment and register it.",
        "Submit tenant details for Delhi Police verification (online via the Delhi Police portal).",
      ],
      sale: genericSaleSteps("the Delhi circle-rate notification"),
    },
  },
  {
    code: "KA",
    name: "Karnataka",
    portal: { label: "Kaveri Online Services", url: "https://kaveri.karnataka.gov.in/" },
    sale: karnatakaSale,
    steps: {
      rent: [
        "Buy e-stamp paper (Karnataka Stamp Act, Art. 30) for the lease.",
        "Leases of 12 months or more must be registered through Kaveri Online Services.",
      ],
      sale: genericSaleSteps("Kaveri Online Services"),
    },
  },
  {
    code: "TN",
    name: "Tamil Nadu",
    portal: { label: "TNREGINET", url: "https://tnreginet.gov.in/" },
    sale: tamilNaduSale,
    steps: {
      rent: [
        "Under the Tamil Nadu Regulation of Rights and Responsibilities of Landlords and Tenants Act, 2017 the tenancy must be registered with the Rent Authority.",
        "Pay duty and file through TNREGINET.",
      ],
      sale: genericSaleSteps("TNREGINET (guideline value)"),
    },
  },
  {
    code: "GJ",
    name: "Gujarat",
    portal: { label: "Garvi (IGR Gujarat)", url: "https://garvi.gujarat.gov.in/" },
    sale: gujaratSale,
    steps: {
      rent: ["Buy e-stamp paper, execute the agreement, and register leases of 12 months or more via Garvi."],
      sale: genericSaleSteps("Garvi (jantri rates)"),
    },
  },
  {
    code: "WB",
    name: "West Bengal",
    portal: { label: "WB Registration", url: "https://wbregistration.gov.in/" },
    sale: westBengalSale,
    steps: {
      rent: ["Pay duty on GRIPS, execute the agreement, and register leases of 12 months or more via wbregistration.gov.in."],
      sale: genericSaleSteps("wbregistration.gov.in (market value)"),
    },
  },
  {
    code: "UP",
    name: "Uttar Pradesh",
    portal: { label: "IGRS Uttar Pradesh", url: "https://igrsup.gov.in/" },
    sale: uttarPradeshSale,
    steps: {
      rent: ["Buy e-stamp paper, execute the agreement, and register leases of 12 months or more via IGRSUP."],
      sale: genericSaleSteps("IGRSUP (circle rates)"),
    },
  },
] as const;

export function findState(code: string): StateGuide | undefined {
  return STATE_GUIDES.find((s) => s.code === code);
}

/** Best guess at a state code from a free-text location like "Pune, Maharashtra". */
export function stateFromLocation(location: string): string | undefined {
  const l = location.toLowerCase();
  return STATE_GUIDES.find((s) => l.includes(s.name.toLowerCase()))?.code;
}

/** Offline estimate, or undefined when this state/instrument isn't in the table. */
export function computeStampDuty(code: string, input: StampInput): StampEstimate | undefined {
  const state = findState(code);
  if (state === undefined) return undefined;
  return input.instrument === "rent" ? state.rent?.(input) : state.sale?.(input);
}
