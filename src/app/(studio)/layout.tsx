import type { ReactNode } from "react";
import { WorkspaceProvider } from "@/components/studio/workspace";
import { StudioShell } from "@/components/studio/studio-shell";

export default function StudioLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <WorkspaceProvider>
      <StudioShell>{children}</StudioShell>
    </WorkspaceProvider>
  );
}
