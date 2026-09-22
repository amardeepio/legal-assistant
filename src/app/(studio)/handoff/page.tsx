import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ToolPage } from "@/components/studio/tool-page";

export const metadata: Metadata = {
  title: "Advocate Brief — LexClarity",
  description: "Build a handoff packet for your advocate and find where to get help.",
};

export default function HandoffPage(): ReactNode {
  return <ToolPage tool="handoff" />;
}
