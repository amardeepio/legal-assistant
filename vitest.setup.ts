import "@testing-library/jest-dom/vitest";

// jsdom does not implement matchMedia; the theme provider guards for it,
// but stub it anyway so component tests control the value explicitly.
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  const stub = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: (): void => undefined,
      removeListener: (): void => undefined,
      addEventListener: (): void => undefined,
      removeEventListener: (): void => undefined,
      dispatchEvent: (): boolean => false,
    }) as unknown as MediaQueryList;
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: stub,
  });
}
