import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Devanagari } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
// Hindi / Marathi output: Inter has no Devanagari glyphs, so pair it with a
// matching humanist sans instead of the OS fallback.
const devanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  variable: "--font-deva",
  display: "swap",
});

// Runs before first paint: applies the stored / preferred theme so there is
// no dark↔light flash. React does not manage `data-theme`, and
// suppressHydrationWarning covers the attribute itself.
const themeInit = `(function(){try{var s=localStorage.getItem('lexclarity-theme');var t=(s==='light'||s==='dark')?s:(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme='dark';}})();`;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#070b16" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL("https://lexclarity.example.com"),
  title: "LexClarity — AI Legal Information Studio for India",
  description:
    "Simplify, compare, risk-scan and ask questions about legal documents under Indian law. Answers checked against live sources. Information only — not legal advice.",
  applicationName: "LexClarity",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "LexClarity",
  },
  formatDetection: {
    telephone: true,
    email: false,
    address: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.ReactElement {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning className={`${inter.variable} ${devanagari.variable}`}>
      <body className="min-h-full antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
