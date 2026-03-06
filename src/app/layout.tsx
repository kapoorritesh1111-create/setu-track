import "./globals.css";

import ThemeProvider from "../components/theme/ThemeProvider";

export const metadata = {
  title: "SETU TRACK",
  description: "SETU GROUPS — workforce time tracking & payroll command platform",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-32x32.png",
    apple: "/icons/app-icon-512.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="light" data-accent="blue" data-density="comfortable" data-radius="lg">
      <body><ThemeProvider>{children}</ThemeProvider></body>
    </html>
  );
}
