import AppLayout from "./components/AppLayout";
import { ThemeProvider } from "./components/theme-provider";
import { TooltipProvider } from "./components/ui/tooltip";
import { Toaster } from "./components/ui/sonner";

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <TooltipProvider>
        <AppLayout />
      </TooltipProvider>
      <Toaster />
    </ThemeProvider>
  );
}

export default App;
