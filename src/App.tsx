import AppLayout from "./components/AppLayout";
import { ThemeProvider } from "./components/theme-provider";
import { TooltipProvider } from "./components/ui/tooltip";

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <TooltipProvider>
        <AppLayout />
      </TooltipProvider>
    </ThemeProvider>
  );
}

export default App;
