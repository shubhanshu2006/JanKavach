import type { Metadata } from "next";
import "./globals.css";
import { ConfigProvider } from "@/lib/config-context";

export const metadata: Metadata = {
  title: "JanKavach — Crowd Safety Foresight System",
  description: "Predict crowd crush formation 90 seconds before it becomes lethal.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="h-screen w-screen overflow-hidden" style={{ background: "#04070A" }}>
        {/*
          THESIS: the station scoped like inbound air traffic — density plotted as a
          tracked contact and closure rate against fixed thresholds, refusing the
          neon-SaaS "AI dashboard" grid-of-stat-cards this category always ships.
          OWN-WORLD: near-black phosphor ground, sweep-green the one committed accent,
          amber/red reserved for threshold crossing; zones render as tracked contacts on
          a circular range-ringed scope, not bordered stat cards; hard numbers render as
          tactile stacked-digit readouts; Share Tech Mono carries all instrument type.
          STORY: a judge or operator reads severity and closure rate at a glance — the
          AI's sub-3s autonomous response visibly fires as a contact crosses a ring; the
          4-minute human baseline is legible by contrast in split-screen.
          FIRST VIEWPORT: full-bleed circular approach scope left-of-center as the
          dominant shape, five labeled range rings at the real 5.0/6.0/7.0/7.5/8.0
          density thresholds, a rotating sweep, contacts at fixed bearings per zone with
          predicted-trajectory vectors; a narrow contact log at right in the scope's own
          type; mission-clock header.
          FORM: Approach Control Scope, dealt lead of 7 grounded directions, seed key
          9caef073, raised by Nixie Instrument Bank (tactile digit readouts) and
          Precisionist Industrial Plate (flat hard-edged panel chrome, no glassmorphism).
          FINISH: unreviewed and undocumented is unfinished; this build ends with the
          finish review, the verdict, DESIGN.md, and every shipping raster carrying its
          provenance.
        */}
        <ConfigProvider>{children}</ConfigProvider>
      </body>
    </html>
  );
}
