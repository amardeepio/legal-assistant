/**
 * Find-an-advocate helpers. LexClarity doesn't list or rank individual
 * lawyers — it points people to official directories and free legal-aid
 * channels, plus a pre-filled search for their specialty and city.
 */

export interface Specialty {
  readonly id: string;
  readonly label: string;
  /** Words an advocate in this field would use to describe their practice. */
  readonly search: string;
}

export const SPECIALTIES: readonly Specialty[] = [
  { id: "property", label: "Property & tenancy", search: "property rent tenancy advocate" },
  { id: "contract", label: "Contracts & commercial", search: "contract commercial dispute advocate" },
  { id: "employment", label: "Employment & labour", search: "employment labour law advocate" },
  { id: "consumer", label: "Consumer complaints", search: "consumer commission advocate" },
  { id: "family", label: "Family & matrimonial", search: "family court matrimonial advocate" },
  { id: "criminal", label: "Criminal", search: "criminal lawyer advocate" },
  { id: "cheque", label: "Cheque bounce (s.138 NI Act)", search: "cheque bounce section 138 advocate" },
  { id: "startup", label: "Startups, IP & data", search: "startup intellectual property DPDP advocate" },
  { id: "arbitration", label: "Arbitration", search: "arbitration advocate" },
];

export interface DirectoryLink {
  readonly label: string;
  readonly url: string;
  readonly note: string;
}

export function findSpecialty(id: string): Specialty | undefined {
  return SPECIALTIES.find((s) => s.id === id);
}

/** City part of "Pune, Maharashtra" → "Pune"; blank → "". */
export function cityFrom(location: string): string {
  return (location.split(",")[0] ?? "").replace(/\(.*\)/, "").trim();
}

export function advocateLinks(specialtyId: string, location: string): readonly DirectoryLink[] {
  const specialty = findSpecialty(specialtyId) ?? SPECIALTIES[0];
  const city = cityFrom(location);
  const query = `${specialty?.search ?? "advocate"} ${city || "India"} bar association`;
  return [
    {
      label: `Search: ${specialty?.label ?? "Advocates"} in ${city || "India"}`,
      url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
      note: "Check enrolment with the State Bar Council before engaging anyone.",
    },
    {
      label: "Free legal aid — NALSA / DLSA",
      url: "https://nalsa.gov.in/",
      note: "Free advocate for eligible people (women, children, SC/ST, low income…). Helpline 15100.",
    },
    {
      label: "Tele-Law (Ministry of Law & Justice)",
      url: "https://www.tele-law.in/",
      note: "Free pre-litigation advice from panel lawyers by video or phone.",
    },
    {
      label: "Nyaya Bandhu pro bono network",
      url: "https://probono-doj.in/",
      note: "Department of Justice pro bono advocates for eligible applicants.",
    },
    {
      label: "Bar Council of India — State Bar Councils",
      url: "https://www.barcouncilofindia.org/",
      note: "Verify an advocate's enrolment number and good standing.",
    },
    {
      label: "eCourts services",
      url: "https://ecourts.gov.in/",
      note: "Look up an advocate's listed cases in your district court.",
    },
  ];
}
