import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ToolPage } from "@/components/studio/tool-page";

export const metadata: Metadata = {
  title: "Simplify — LexClarity",
  description: "Plain-language summary of contracts and legal documents under Indian law.",
};

export default function SimplifyPage(): ReactNode {
  return <ToolPage tool="simplify" />;
}
