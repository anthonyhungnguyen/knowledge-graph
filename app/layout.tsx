import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Topic Knowledge Explorer",
  description: "Explore a topic through AI-generated answers and expandable knowledge bubbles."
};

type RootLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
