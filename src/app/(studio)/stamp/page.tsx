import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ToolPage } from "@/components/studio/tool-page";

export const metadata: Metadata = {
  title: "Stamp Duty — LexClarity",
  description: "Estimate stamp duty and registration fees, verified with live sources.",
};

export default function StampPage(): ReactNode {
  return <ToolPage tool="stamp" />;
}
