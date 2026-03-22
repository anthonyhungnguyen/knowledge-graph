import { MantineProvider, createTheme } from "@mantine/core";
import { TopicExplorer } from "../components/topic-explorer";

const theme = createTheme({
  primaryColor: "blue",
  defaultRadius: "md",
  fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  headings: {
    fontFamily: '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif'
  }
});

export function App() {
  return (
    <MantineProvider theme={theme} defaultColorScheme="light">
      <TopicExplorer />
    </MantineProvider>
  );
}
