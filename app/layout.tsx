import type { Metadata, Viewport } from "next";
import { APP } from "@/lib/config";
import { AuthGate } from "@/components/auth/AuthGate";
import "./globals.css";

export const metadata: Metadata = {
  title: `${APP.name} — ${APP.tagline}`,
  description: `A ${APP.board} Class ${APP.grade} tutor that writes answers the way the marking scheme reads them.`,
  verification: { google: "Xgrw_-D9PHWwLR9nJgdwNZitZlx3iJUBVN1pQ9gK4GI" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
