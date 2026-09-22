import { z } from "zod";
import { ACTION_LABELS, ActionKind } from "@/lib/legal";

/**
 * Full reports and read-only share links.
 *
 * A share link carries the whole report, compressed, in the URL fragment
 * (`/share#r=…`). Browsers never send the fragment to the server, so shared
 * reports stay out of server logs and there's still no database — anyone
 * holding the link can read it, nobody can edit it.
 */

export const ReportSectionSchema = z.object({
  action: ActionKind,
  markdown: z.string().max(60_000),
  grounded: z.boolean(),
});
export type ReportSection = z.infer<typeof ReportSectionSchema>;

export const ReportSchema = z.object({
  v: z.literal(1),
  title: z.string().max(200),
  createdAt: z.number(),
  jurisdiction: z.string().max(120).optional(),
  sections: z.array(ReportSectionSchema).min(1).max(10),
});
export type Report = z.infer<typeof ReportSchema>;

export const SHARE_PARAM = "r";

const REPORT_ORDER: readonly ActionKind[] = [
  "handoff",
  "simplify",
  "risks",
  "playbook",
  "compare",
  "action",
  "stamp",
];

/** Sections in reading order: brief first, then explanation, risks, next steps. */
export function orderSections(sections: readonly ReportSection[]): readonly ReportSection[] {
  return [...sections].sort(
    (a, b) => REPORT_ORDER.indexOf(a.action) - REPORT_ORDER.indexOf(b.action),
  );
}

/** Demote the section's own `##` headings under a `#`-level tool heading. */
function nest(markdown: string): string {
  return markdown.replaceAll(/^## /gm, "### ");
}

export function buildReportMarkdown(report: Report): string {
  const date = new Date(report.createdAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const header = [
    `# ${report.title}`,
    "",
    `LexClarity report · ${date}${report.jurisdiction ? ` · ${report.jurisdiction}` : ""}`,
    "",
    "> Information only — not legal advice. Confirm with an advocate enrolled with the Bar Council of India.",
  ];
  const body = orderSections(report.sections).flatMap((s) => [
    "",
    "---",
    "",
    `## ${ACTION_LABELS[s.action]}`,
    "",
    nest(s.markdown.trim()),
  ]);
  return [...header, ...body, ""].join("\n");
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  const b64 = text.replaceAll("-", "+").replaceAll("_", "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

/** `z.` + deflate-raw + base64url when compression is available, else `j.` + base64url JSON. */
export async function encodeReport(report: Report): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(report));
  if (typeof CompressionStream === "function") {
    try {
      return `z.${toBase64Url(await pipe(json, new CompressionStream("deflate-raw")))}`;
    } catch {
      // fall through to the uncompressed form
    }
  }
  return `j.${toBase64Url(json)}`;
}

export async function decodeReport(token: string): Promise<Report | null> {
  try {
    const [kind, data = ""] = [token.slice(0, 2), token.slice(2)];
    let bytes = fromBase64Url(data);
    if (kind === "z.") {
      bytes = await pipe(bytes, new DecompressionStream("deflate-raw"));
    } else if (kind !== "j.") {
      return null;
    }
    const parsed = ReportSchema.safeParse(JSON.parse(new TextDecoder().decode(bytes)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function shareUrl(origin: string, token: string): string {
  return `${origin}/share#${SHARE_PARAM}=${token}`;
}

/** The report token from a location hash like `#r=z.abc`. */
export function tokenFromHash(hash: string): string | undefined {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  return params.get(SHARE_PARAM) ?? undefined;
}

export function reportFileName(title: string): string {
  const slug = title
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "")
    .slice(0, 50);
  return `lexclarity-report${slug ? `-${slug}` : ""}.md`;
}
