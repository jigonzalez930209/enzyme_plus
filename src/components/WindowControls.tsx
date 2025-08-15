import React from "react";
import { Button } from "@/components/ui/button";
import { Minus, Square, X } from "lucide-react";

const WindowControls: React.FC = () => {
  const handleMinimize = () => window.electronAPI.minimizeWindow();
  const handleMaximize = () => window.electronAPI.maximizeWindow();
  const handleClose = () => window.electronAPI.closeWindow();

  return (
    <div className="flex gap-1 no-drag">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 no-drag hover:bg-accent hover:text-accent-foreground"
        onClick={handleMinimize}
      >
        <Minus size={18} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 no-drag hover:bg-accent hover:text-accent-foreground"
        onClick={handleMaximize}
      >
        <Square size={18} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 no-drag hover:bg-destructive hover:text-destructive-foreground"
        onClick={handleClose}
      >
        <X size={18} />
      </Button>
    </div>
  );
};

export default WindowControls;
