// Choropleth world map for the analytics dashboard.
// Hand-rolled with d3-geo + topojson (react-simple-maps is not React 19
// compatible). Country geometry loads lazily from world-atlas.
import { useEffect, useMemo, useRef, useState } from "react";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import countriesLib from "i18n-iso-countries";
// @ts-ignore - JSON module without type declarations
import daLocale from "i18n-iso-countries/langs/da.json";
import { Loader2 } from "lucide-react";
import type { CountryVisitors } from "@shared/schema";

countriesLib.registerLocale(daLocale as any);

/** Danish display name for an ISO alpha-2 code (falls back to the code). */
export function countryNameDa(alpha2: string | null): string {
  if (!alpha2) return "Ukendt";
  const name = countriesLib.getName(alpha2.toUpperCase(), "da");
  return name || alpha2.toUpperCase();
}

type MapFeature = {
  type: "Feature";
  id?: string | number;
  properties?: { name?: string };
  geometry: any;
};

type HoverInfo = { name: string; visitors: number; x: number; y: number };

const WIDTH = 800;
const HEIGHT = 400;

export function WorldMap({ countries }: { countries: CountryVisitors[] }) {
  const [features, setFeatures] = useState<MapFeature[] | null>(null);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    // @ts-ignore - JSON module without type declarations
    import("world-atlas/countries-110m.json")
      .then((mod: any) => {
        if (cancelled) return;
        const topo = mod.default ?? mod;
        const collection: any = feature(topo, topo.objects.countries);
        setFeatures(collection.features as MapFeature[]);
      })
      .catch(() => {
        if (!cancelled) setFeatures([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // numeric ISO id (zero-padded string) -> visitors + alpha2
  const byNumeric = useMemo(() => {
    const map: Record<string, { visitors: number; alpha2: string }> = {};
    for (let i = 0; i < countries.length; i++) {
      const entry = countries[i];
      if (!entry.country) continue;
      const alpha2 = entry.country.toUpperCase();
      const numeric = countriesLib.alpha2ToNumeric(alpha2);
      if (numeric) {
        map[String(numeric).padStart(3, "0")] = { visitors: entry.visitors, alpha2 };
      }
    }
    return map;
  }, [countries]);

  const maxVisitors = useMemo(() => {
    let max = 0;
    for (let i = 0; i < countries.length; i++) {
      if (countries[i].visitors > max) max = countries[i].visitors;
    }
    return max;
  }, [countries]);

  const path = useMemo(() => {
    const projection = geoNaturalEarth1()
      .scale(155)
      .translate([WIDTH / 2, HEIGHT / 2 + 15]);
    return geoPath(projection);
  }, []);

  if (features === null) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        <span className="text-sm">Indlæser kort...</span>
      </div>
    );
  }

  const handleMove = (e: React.MouseEvent, f: MapFeature) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const numericId = f.id != null ? String(f.id).padStart(3, "0") : "";
    const data = byNumeric[numericId];
    const alpha2 = data?.alpha2 || countriesLib.numericToAlpha2(numericId) || null;
    const name = alpha2 ? countryNameDa(alpha2) : f.properties?.name || "Ukendt";
    setHover({
      name,
      visitors: data?.visitors || 0,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <div ref={containerRef} className="relative" data-testid="world-map">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto select-none" role="img" aria-label="Verdenskort over besøgende">
        {features
          .filter((f) => String(f.id).padStart(3, "0") !== "010") // skip Antarctica
          .map((f, idx) => {
            const numericId = f.id != null ? String(f.id).padStart(3, "0") : `x${idx}`;
            const data = byNumeric[numericId];
            const intensity = data && maxVisitors > 0 ? data.visitors / maxVisitors : 0;
            const d = path(f as any) || undefined;
            return (
              <path
                key={numericId + "-" + idx}
                d={d}
                style={{
                  fill: data ? "hsl(var(--primary))" : "hsl(var(--muted))",
                  fillOpacity: data ? 0.25 + 0.75 * intensity : 0.6,
                  stroke: "hsl(var(--background))",
                  strokeWidth: 0.5,
                  cursor: data ? "pointer" : "default",
                  transition: "fill-opacity 150ms",
                }}
                onMouseMove={(e) => handleMove(e, f)}
                onMouseLeave={() => setHover(null)}
              />
            );
          })}
      </svg>
      {hover && (
        <div
          className="pointer-events-none absolute z-10 rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md"
          style={{
            left: Math.min(hover.x + 12, (containerRef.current?.clientWidth || WIDTH) - 140),
            top: hover.y - 8,
          }}
        >
          <p className="font-medium text-popover-foreground">{hover.name}</p>
          <p className="text-muted-foreground">
            {hover.visitors === 1 ? "1 besøgende" : `${new Intl.NumberFormat("da-DK").format(hover.visitors)} besøgende`}
          </p>
        </div>
      )}
    </div>
  );
}
