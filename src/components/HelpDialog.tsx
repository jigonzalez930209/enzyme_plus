import React, { useMemo, useState } from "react";
import { HelpCircle, XIcon } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTrigger,
  AlertDialogTitle,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { MDXProvider } from "@mdx-js/react";
import LocalMermaid from "@/components/Mermaid";

// MDX sections
import Bosquejo from "@/content/help/30-bosquejo-tecnica.mdx";
import ComoFunciona from "@/content/help/31-como-funciona-aplicacion.mdx";
import ValoresPantalla from "@/content/help/32-valores-en-pantalla.mdx";
import AlgoritmoDiagramas from "@/content/help/33-algoritmo-y-diagramas.mdx";
import PorQueOpt from "@/content/help/35-justificacion-optimizaciones.mdx";
import DiagramGeneral from "@/content/help/11-diagrama-general.mdx";
import DiagramPasos from "@/content/help/17-diagrama-pasos.mdx";
import SaltoTau from "@/content/help/13-salto-tau.mdx";
import Bloques from "@/content/help/14-bloques-detalle.mdx";
import UmbralesLineales from "@/content/help/12-umbrales-lineales.mdx";
import AlgoritmoYNota from "@/content/help/10-algoritmos-resumen-y-notacion.mdx";
import Optimizaciones from "@/content/help/18-optimizaciones.mdx";
import Validacion from "@/content/help/19-consejos-validacion.mdx";
import Pistas from "@/content/help/16-pistas-implementacion.mdx";

type Section = {
  id: string;
  label: string;
  component: React.ComponentType<Record<string, unknown>>;
};

export default function HelpDialog() {
  // Adapter to feed MDX's <Mermaid chart={`...`}/> into our local Mermaid component
  const MermaidAdapter = (props: { chart?: string; children?: any }) => {
    const code =
      typeof props.chart === "string"
        ? props.chart
        : typeof props.children === "string"
        ? props.children
        : "";
    return <LocalMermaid code={code} />;
  };

  const mdxComponents = useMemo(
    () => ({
      h1: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
        <h1 className="mb-2 text-xl font-semibold text-foreground" {...props} />
      ),
      h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
        <h2
          className="mt-4 mb-2 text-lg font-semibold text-foreground"
          {...props}
        />
      ),
      h3: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
        <h3
          className="text-base font-semibold text-foreground mt-3 mb-1.5"
          {...props}
        />
      ),
      p: (props: React.HTMLAttributes<HTMLParagraphElement>) => (
        <p
          className="mb-2 text-sm leading-relaxed text-foreground"
          {...props}
        />
      ),
      ul: (props: React.HTMLAttributes<HTMLUListElement>) => (
        <ul
          className="pl-5 space-y-1 text-sm list-disc text-foreground"
          {...props}
        />
      ),
      ol: (props: React.HTMLAttributes<HTMLOListElement>) => (
        <ol
          className="pl-5 space-y-1 text-sm list-decimal text-foreground"
          {...props}
        />
      ),
      li: (props: React.LiHTMLAttributes<HTMLLIElement>) => (
        <li className="marker:text-muted-foreground" {...props} />
      ),
      a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
        <a
          className="text-primary underline-offset-4 hover:underline"
          {...props}
        />
      ),
      code: (
        props: React.HTMLAttributes<HTMLElement> & {
          className?: string;
          children?: any;
        }
      ) => (
        <code
          className="font-mono text-xs bg-muted text-foreground px-1.5 py-0.5 rounded"
          {...props}
        />
      ),
      pre: (
        props: React.HTMLAttributes<HTMLPreElement> & {
          children?: any;
          className?: string;
        }
      ) => (
        <pre
          className="p-3 overflow-auto text-xs border rounded bg-muted text-foreground border-border"
          {...props}
        />
      ),
      // Map Mermaid tags in MDX to our local, theme-aware Mermaid renderer
      mermaid: MermaidAdapter as any,
      Mermaid: MermaidAdapter as any,

      hr: (props: React.HTMLAttributes<HTMLHRElement>) => (
        <hr className="my-4 border-border" {...props} />
      ),
      table: (props: React.TableHTMLAttributes<HTMLTableElement>) => (
        <div className="w-full overflow-auto">
          <table className="w-full text-sm border border-border" {...props} />
        </div>
      ),
      th: (props: React.ThHTMLAttributes<HTMLTableCellElement>) => (
        <th
          className="px-2 py-1 text-left border bg-muted text-foreground border-border"
          {...props}
        />
      ),
      td: (props: React.TdHTMLAttributes<HTMLTableCellElement>) => (
        <td className="px-2 py-1 border border-border" {...props} />
      ),
    }),
    []
  );
  const helpSections = useMemo<Section[]>(
    () => [
      // Introducción y uso de la app
      {
        id: "bosquejo",
        label: "Bosquejo general de la técnica",
        component: Bosquejo,
      },
      {
        id: "app-general",
        label: "Cómo funciona la aplicación",
        component: ComoFunciona,
      },
      {
        id: "valores",
        label: "Valores en pantalla",
        component: ValoresPantalla,
      },

      // Modelo y algoritmos
      {
        id: "algoritmo-y-notacion",
        label: "Algoritmos: resumen y notación",
        component: AlgoritmoYNota,
      },
      {
        id: "umbrales-lineales",
        label: "A) Umbrales lineales por paso",
        component: UmbralesLineales,
      },
      {
        id: "salto-tau",
        label: "B) Salto τ con riesgos competidores",
        component: SaltoTau,
      },
      {
        id: "bloques",
        label: "Detalle por bloques (B.1–B.3)",
        component: Bloques,
      },

      // Diagramas
      {
        id: "diagrama_general",
        label: "Diagrama general del diseño",
        component: DiagramGeneral,
      },
      {
        id: "diagrama_pasos",
        label: "Diagrama de pasos del ciclo",
        component: DiagramPasos,
      },
      {
        id: "algoritmo",
        label: "Algoritmo y diagramas (compacto)",
        component: AlgoritmoDiagramas,
      },

      // Optimizaciones y arquitectura
      {
        id: "optimizaciones-resumen",
        label: "Optimizaciones (resumen)",
        component: Optimizaciones,
      },
      {
        id: "optimizaciones-justificacion",
        label: "Justificación técnica de las optimizaciones",
        component: PorQueOpt,
      },

      // Validación y compatibilidad
      {
        id: "validacion",
        label: "Consejos de validación",
        component: Validacion,
      },
      // Para desarrolladores
      {
        id: "pistas",
        label: "Pistas de implementación (WASM)",
        component: Pistas,
      },
    ],
    []
  );
  const [active, setActive] = useState<string>(helpSections[0].id);
  const Active =
    helpSections.find((s) => s.id === active)?.component ?? Bosquejo;

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="w-8 h-8"
          title="Help / Tutorial"
        >
          <HelpCircle className="h-[1.2rem] w-[1.2rem]" />
          <span className="sr-only">Open Help</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="w-[90vw] max-w-[90vw] h-[90vh] max-h-[90vh] p-0 overflow-hidden">
        <AlertDialogHeader className="p-2">
          <AlertDialogTitle>Enzyme Plus</AlertDialogTitle>
          <AlertDialogDescription className="sr-only">
            Tutorial
          </AlertDialogDescription>
          <AlertDialogCancel
            className="absolute z-10 w-8 h-8 p-0 m-0 top-2 right-2"
            asChild
          >
            <Button variant="destructive" size="icon">
              <XIcon className="w-4 h-4 text-primary" />
              <span className="sr-only">Close Help</span>
            </Button>
          </AlertDialogCancel>
        </AlertDialogHeader>
        <div className="grid h-full grid-cols-1 md:grid-cols-[20%_80%]">
          <aside className="h-[calc(85vh)] p-4 grid grid-rows-[auto_1fr]  overflow-y-auto border-r bg-muted/40 md:p-6">
            <div className="mb-3 text-xs font-semibold text-muted-foreground">
              Ayuda
            </div>
            <nav className="flex flex-col gap-1 overflow-y-auto">
              {helpSections.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setActive(s.id)}
                  className={
                    "text-left rounded px-2 py-1.5 text-sm transition-colors " +
                    (active === s.id
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted text-foreground")
                  }
                >
                  {s.label}
                </button>
              ))}
            </nav>
          </aside>
          <main className="h-[calc(85vh)] p-4 grid grid-rows-[1fr_auto] overflow-y-auto">
            <div className="pb-4 space-y-3 overflow-auto text-sm leading-relaxed text-foreground">
              <MDXProvider components={mdxComponents}>
                <Active components={mdxComponents as any} />
              </MDXProvider>
            </div>
            <footer className="p-4 text-xs text-muted-foreground">
              <p>Enzyme Plus v0.2.3</p>
            </footer>
          </main>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
