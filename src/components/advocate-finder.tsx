"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { SPECIALTIES, advocateLinks, cityFrom } from "@/lib/advocate";
import { ExternalIcon } from "./icons";

interface AdvocateFinderProps {
  readonly specialty: string;
  readonly onSpecialty: (id: string) => void;
  readonly location: string;
}

/** Specialty + city → official directories, free legal aid and a pre-filled search. */
export function AdvocateFinder({ specialty, onSpecialty, location }: AdvocateFinderProps): ReactNode {
  const [city, setCity] = useState(() => cityFrom(location));
  const links = advocateLinks(specialty, city);

  return (
    <section aria-labelledby="find-advocate" className="thread grid gap-2.5 rounded-2xl px-4 py-3">
      <p id="find-advocate" className="t1 text-xs font-bold">
        Find an advocate
      </p>
      <div className="flex flex-wrap gap-2">
        <select
          value={specialty}
          onChange={(e) => onSpecialty(e.target.value)}
          aria-label="Specialty"
          className="field rounded-lg px-2 py-1.5 text-xs"
        >
          {SPECIALTIES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          aria-label="City"
          placeholder="City"
          className="field w-32 flex-1 rounded-lg px-2 py-1.5 text-xs"
        />
      </div>
      <ul className="grid gap-1.5">
        {links.map((l) => (
          <li key={l.url} className="text-[12px]">
            <a
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="accent inline-flex items-center gap-1 font-semibold underline-offset-2 hover:underline"
            >
              {l.label}
              <ExternalIcon className="h-3 w-3" />
            </a>
            <span className="t3 block text-[11px]">{l.note}</span>
          </li>
        ))}
      </ul>
      <p className="t3 text-[10px]">
        LexClarity doesn&apos;t recommend or rank individual advocates. Advocates in
        India may not advertise — verify enrolment with your State Bar Council.
      </p>
    </section>
  );
}
