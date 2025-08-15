declare module 'react-plotly.js' {
  import * as React from 'react';

  export interface PlotlyDatum {
    [key: string]: unknown;
  }

  export type Data = Partial<PlotlyDatum>[];

  export interface Layout {
    [key: string]: unknown;
  }

  export interface Config {
    [key: string]: unknown;
  }

  export interface PlotParams {
    data: Data;
    layout: Partial<Layout>;
    config: Partial<Config>;
    divId?: string;
    className?: string;
    style?: React.CSSProperties;
    onUpdate?: (figure: { data: Data; layout: Layout }) => void;
    onInitialized?: (figure: { data: Data; layout: Layout }) => void;
    onRelayout?: (eventData: Record<string, unknown>) => void;
    [key: string]: unknown;
  }

  const Plot: React.FC<PlotParams>;
  export default Plot;
}

export interface IElectronAPI {
  minimizeWindow: () => void;
  maximizeWindow: () => void;
  closeWindow: () => void;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
