import React from "react";
import { ThemeToggle } from "./ThemeToggle";
import HelpDialog from "./HelpDialog";
import WindowControls from "./WindowControls";
import logo from "../assets/logo.svg";
// import FitDialog from "./content/FitDialog";

const TitleBar: React.FC = () => {
  const isElectron =
    typeof window !== "undefined" &&
    (!!(window as unknown as { electronAPI?: unknown }).electronAPI ||
      !!(window as unknown as { isElectron?: unknown }).isElectron ||
      /electron/i.test(navigator.userAgent));

  // const [fitOpen, setFitOpen] = React.useState(false);

  return (
    <div className="flex items-center justify-between h-10 p-2 border-b select-none bg-muted drag-region">
      <div className="flex items-center gap-4">
        <h1 className="flex flex-row items-center gap-2 text-lg font-bold text-foreground">
          {" "}
          <img
            src={logo}
            alt="logo"
            className="object-fill object-center w-8 h-8"
          ></img>{" "}
          Enzyme Plus
        </h1>
        <nav className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="no-drag">
            <HelpDialog />
          </div>
          <div className="no-drag">
            <ThemeToggle />
          </div>
          {/* <div className="no-drag">
            <FitDialog open={fitOpen} setOpen={setFitOpen} />
          </div> */}
        </nav>
      </div>
      {isElectron && <WindowControls />}
    </div>
  );
};

export default TitleBar;
