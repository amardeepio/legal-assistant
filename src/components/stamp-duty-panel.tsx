"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import type { BuyerType, Instrument, StampEstimate, StampInput } from "@/lib/stamp-duty";
import {
  RATES_REVIEWED,
  STATE_GUIDES,
  computeStampDuty,
  findState,
  formatINR,
  stateFromLocation,
} from "@/lib/stamp-duty";
import { ExternalIcon, SpinnerIcon } from "./icons";

export interface StampVerifyRequest {
  readonly state: string;
  readonly instrument: Instrument;
  readonly details: string;
}

interface StampDutyPanelProps {
  readonly location: string;
  readonly busy: boolean;
  readonly onVerify: (req: StampVerifyRequest) => void;
}

function num(value: string): number {
  const n = Number(value.replaceAll(/[,\s₹]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function describe(stateName: string, input: StampInput, est: StampEstimate | undefined): string {
  const facts =
    input.instrument === "rent"
      ? `Monthly rent ${formatINR(input.monthlyRent)}, term ${input.months} months, refundable deposit ${formatINR(input.refundableDeposit)}, non-refundable ${formatINR(input.nonRefundableDeposit)}, ${input.urban ? "urban" : "rural"} area.`
      : `Property value ${formatINR(input.value)}, buyer ${input.buyer}, ${input.urban ? "municipal corporation / urban" : "rural / council"} area.`;
  const estimate =
    est === undefined
      ? "No offline formula for this state — please compute from current official rates."
      : `${est.lines.map((l) => `${l.label}: ${formatINR(l.amount)} (${l.basis})`).join("; ")}. Total ${formatINR(est.total)}.`;
  return `State: ${stateName}. ${facts} Offline estimate: ${estimate}`.slice(0, 2000);
}

/** State-wise stamp duty + registration fee estimate with e-registration steps. */
export function StampDutyPanel({ location, busy, onVerify }: StampDutyPanelProps): ReactNode {
  const [stateCode, setStateCode] = useState(() => stateFromLocation(location) ?? "MH");
  const [instrument, setInstrument] = useState<Instrument>("rent");
  const [monthlyRent, setMonthlyRent] = useState("18500");
  const [months, setMonths] = useState("11");
  const [deposit, setDeposit] = useState("55500");
  const [nonRefundable, setNonRefundable] = useState("");
  const [value, setValue] = useState("7500000");
  const [buyer, setBuyer] = useState<BuyerType>("male");
  const [urban, setUrban] = useState(true);

  const state = findState(stateCode);
  const input: StampInput =
    instrument === "rent"
      ? {
          instrument,
          monthlyRent: num(monthlyRent),
          months: Math.min(120, Math.max(1, Math.round(num(months)) || 1)),
          refundableDeposit: num(deposit),
          nonRefundableDeposit: num(nonRefundable),
          urban,
        }
      : { instrument, value: num(value), buyer, urban };
  const ready = instrument === "rent" ? num(monthlyRent) > 0 : num(value) > 0;
  const est = ready ? computeStampDuty(stateCode, input) : undefined;

  const field = "field w-full rounded-lg px-2.5 py-1.5 text-sm";
  const label = "t2 grid gap-1 text-[11px] font-semibold";

  return (
    <div className="grid gap-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className={label}>
          State
          <select value={stateCode} onChange={(e) => setStateCode(e.target.value)} className={field}>
            {STATE_GUIDES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <div className={label} role="radiogroup" aria-label="Document type">
          Document
          <div className="flex gap-1">
            {(
              [
                ["rent", "Rent / leave & licence"],
                ["sale", "Sale deed"],
              ] as const
            ).map(([id, text]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={instrument === id}
                onClick={() => setInstrument(id)}
                className={`flex-1 rounded-lg px-2 py-1.5 text-xs ${
                  instrument === id ? "btn-gold" : "chip"
                }`}
              >
                {text}
              </button>
            ))}
          </div>
        </div>
      </div>

      {instrument === "rent" ? (
        <div className="grid grid-cols-2 gap-2">
          <label className={label}>
            Monthly rent (₹)
            <input inputMode="numeric" value={monthlyRent} onChange={(e) => setMonthlyRent(e.target.value)} className={field} />
          </label>
          <label className={label}>
            Term (months)
            <input inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value)} className={field} />
          </label>
          <label className={label}>
            Refundable deposit (₹)
            <input inputMode="numeric" value={deposit} onChange={(e) => setDeposit(e.target.value)} className={field} />
          </label>
          <label className={label}>
            Non-refundable amount (₹)
            <input inputMode="numeric" value={nonRefundable} placeholder="0" onChange={(e) => setNonRefundable(e.target.value)} className={field} />
          </label>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <label className={`${label} col-span-2`}>
            Property value (₹) — higher of price and ready-reckoner / circle rate
            <input inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} className={field} />
          </label>
          <label className={label}>
            Buyer
            <select value={buyer} onChange={(e) => setBuyer(e.target.value as BuyerType)} className={field}>
              <option value="male">Man</option>
              <option value="female">Woman (sole)</option>
              <option value="joint">Joint (man + woman)</option>
            </select>
          </label>
        </div>
      )}
      <label className="t2 flex items-center gap-2 text-xs font-semibold">
        <input type="checkbox" checked={urban} onChange={(e) => setUrban(e.target.checked)} className="accent-amber-500" />
        Municipal corporation / city area
      </label>

      <div className="thread grid gap-2 rounded-2xl p-3" aria-live="polite">
        {est === undefined ? (
          <p className="t2 text-xs">
            {ready
              ? `No offline ${instrument === "rent" ? "rent" : "sale"} formula for ${state?.name ?? "this state"} yet — use “Verify with live sources” for current rates.`
              : "Enter the amounts to see an estimate."}
          </p>
        ) : (
          <>
            <table className="w-full text-xs">
              <caption className="sr-only">Estimated charges</caption>
              <tbody>
                {est.lines.map((l) => (
                  <tr key={l.label} className="align-top">
                    <th scope="row" className="t1 py-1 pr-2 text-left font-semibold">
                      {l.label}
                      <span className="t3 block text-[11px] font-normal">{l.basis}</span>
                    </th>
                    <td className="t1 py-1 text-right font-bold tabular-nums">{formatINR(l.amount)}</td>
                  </tr>
                ))}
                <tr className="border-t bl">
                  <th scope="row" className="accent py-1.5 text-left text-sm font-bold">
                    Estimated total
                  </th>
                  <td className="accent py-1.5 text-right text-sm font-black tabular-nums">
                    {formatINR(est.total)}
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="t2 text-[11px]">
              <strong className="t1">Registration:</strong> {est.registration}
            </p>
            {est.notes.map((n) => (
              <p key={n} className="t3 text-[11px]">
                {n}
              </p>
            ))}
          </>
        )}
      </div>

      {state !== undefined && (
        <details className="thread rounded-2xl px-3 py-2">
          <summary className="t1 cursor-pointer text-xs font-bold">
            e-Registration steps · {state.name}
          </summary>
          <ol className="t2 mt-2 grid list-decimal gap-1 pl-5 text-[12px] leading-relaxed">
            {state.steps[instrument].map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <a
            href={state.portal.url}
            target="_blank"
            rel="noopener noreferrer"
            className="accent mt-2 inline-flex items-center gap-1 text-[12px] font-semibold hover:underline"
          >
            {state.portal.label} <ExternalIcon className="h-3 w-3" />
          </a>
        </details>
      )}

      <button
        type="button"
        disabled={busy || !ready}
        onClick={() =>
          onVerify({
            state: state?.name ?? stateCode,
            instrument,
            details: describe(state?.name ?? stateCode, input, est),
          })
        }
        className="btn-gold flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm transition disabled:cursor-wait disabled:opacity-60"
      >
        {busy ? (
          <>
            <SpinnerIcon className="h-4 w-4" /> Checking current rates…
          </>
        ) : (
          "Verify with live sources →"
        )}
      </button>
      <p className="t3 -mt-1 text-center text-[11px]">
        Indicative rates, reviewed {RATES_REVIEWED}. Rates change by notification and
        vary by city — confirm on the official portal before paying.
      </p>
    </div>
  );
}
