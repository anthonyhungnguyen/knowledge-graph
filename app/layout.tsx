import type { Metadata } from "next";
import { ColorSchemeScript, MantineProvider, createTheme } from "@mantine/core";
import "@mantine/core/styles.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Topic Knowledge Explorer",
  description: "Explore a topic through AI-generated answers and expandable knowledge bubbles."
};

type RootLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

const theme = createTheme({
  primaryColor: "cyan",
  defaultRadius: "xl",
  fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  headings: {
    fontFamily: '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif'
  }
});

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <head>
        <ColorSchemeScript defaultColorScheme="light" />
      </head>
      <body>
        <MantineProvider theme={theme} defaultColorScheme="light">
          {children}
        </MantineProvider>
      </body>
    </html>
  );
}
