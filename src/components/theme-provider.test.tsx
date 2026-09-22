// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ThemeProvider, useTheme } from "@/components/theme-provider";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

function Probe(): React.JSX.Element {
  const { theme } = useTheme();
  return <p data-testid="theme">{theme}</p>;
}

describe("ThemeProvider", () => {
  it("defaults to dark and renders children", () => {
    window.localStorage.clear();
    render(
      <ThemeProvider>
        <Probe />
        <p>child</p>
      </ThemeProvider>,
    );
    expect(screen.getByText("child")).toBeInTheDocument();
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
  });

  it("honours a stored light preference", () => {
    window.localStorage.setItem("lexclarity-theme", "light");
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("theme")).toHaveTextContent("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    window.localStorage.clear();
  });

  it("throws when used outside the provider", () => {
    const errSpy = window.console.error;
    window.console.error = (): void => undefined;
    try {
      expect(() => render(<Probe />)).toThrow(
        "useTheme must be used within ThemeProvider",
      );
    } finally {
      window.console.error = errSpy;
    }
  });
});
