import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "SCS Admin", description: "Sunshine Computer Solution administration" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
