import "./globals.css";

import ThemeProvider from "../components/theme/ThemeProvider";

export const metadata = {
  title: "SETU TRACK",
  description: "SETU TRACK by SETU GROUPS — branded workforce time tracking, payroll operations, and export control.",
  manifest: "/site.webmanifest",
  applicationName: "SETU Track",
  appleWebApp: {
    title: "SETU Track",
    statusBarStyle: "default",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    shortcut: "/favicon-32x32.png",
    apple: "/apple-touch-icon.png",
    other: [
      { rel: "android-chrome", url: "/android-chrome-192x192.png" },
      { rel: "android-chrome", url: "/android-chrome-512x512.png" },
    ],
  },
  openGraph: {
    title: "SETU TRACK",
    description: "Finance-ready timesheets, payroll runs, exports, and contractor operations in one command workspace.",
    images: ["/social/og-image.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "SETU TRACK",
    description: "Finance-ready timesheets, payroll runs, exports, and contractor operations in one command workspace.",
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
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
