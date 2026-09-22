import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SharedReport } from "@/components/shared-report";

export const metadata: Metadata = {
  title: "Shared report — LexClarity",
  description: "A read-only LexClarity report shared with you.",
  // The report lives in the URL fragment; nothing here is worth indexing.
  robots: { index: false, follow: false },
};

export default function SharePage(): ReactNode {
  return <SharedReport />;
}
