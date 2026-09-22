import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ToolPage } from "@/components/studio/tool-page";

export const metadata: Metadata = {
  title: "Risk X-Ray — LexClarity",
  description: "Spot risky clauses, risk score and missing protections before you sign.",
};

export default function RisksPage(): ReactNode {
  return <ToolPage tool="risks" />;
}
