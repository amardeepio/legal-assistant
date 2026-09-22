import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ToolPage } from "@/components/studio/tool-page";

export const metadata: Metadata = {
  title: "Compare — LexClarity",
  description: "Compare two documents side-by-side, with AI verdict and instant redline.",
};

export default function ComparePage(): ReactNode {
  return <ToolPage tool="compare" />;
}
