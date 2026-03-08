import "./globals.css";

import ThemeProvider from "../components/theme/ThemeProvider";

export const metadata = {
  title: "SETU TRACK",
  description:
    "SETU TRACK by SETU GROUP — branded workforce time tracking, payroll operations, and export control.",
  manifest: "/site.webmanifest",
  applicationName: "SETU Track",
  themeColor: "#0e2f63",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/brand/setu-symbol-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "SETU TRACK",
    description:
      "Finance-ready timesheets, payroll runs, exports, and contractor operations in one command workspace.",
    images: ["/social/og-image.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "SETU TRACK",
    description:
      "Finance-ready timesheets, payroll runs, exports, and contractor operations in one command workspace.",
    images: ["/social/twitter-card.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="light" data-accent="blue" data-density="comfortable" data-radius="lg">
      <body>
        <a className="skipLink" href="#main-content">Skip to content</a>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
