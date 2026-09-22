// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("ThemeToggle", () => {
  it("toggles between dark and light with an accurate label", async () => {
    window.localStorage.clear();
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    const btn = screen.getByRole("button", {
      name: "Switch to light theme",
    });
    await user.click(btn);
    expect(
      screen.getByRole("button", { name: "Switch to dark theme" }),
    ).toBeInTheDocument();
    expect(window.localStorage.getItem("lexclarity-theme")).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});
