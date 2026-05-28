import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Root League",
  description: "Leaderboard e histórico de partidas de Root."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
