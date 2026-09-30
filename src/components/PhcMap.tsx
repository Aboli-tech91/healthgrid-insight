import { useEffect, useRef, useState } from "react";
import type { Map as LMap, LayerGroup } from "leaflet";
import type { Risk } from "@/lib/forecast";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBox } from "./bits";

export type Marker = { id: string; name: string; lat: number; lng: number; risk: Risk; info: string };

export function PhcMap({ markers }: { markers: Marker[] }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LMap | null>(null);
  const layer = useRef<LayerGroup | null>(null);
  const L = useRef<typeof import("leaflet") | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let dead = false;
    import("leaflet").then((mod) => {
      if (dead || !el.current) return;
      L.current = (mod as unknown as { default: typeof import("leaflet") }).default ?? mod;
      map.current = L.current.map(el.current, { scrollWheelZoom: false }).setView([21, 79], 5);
      L.current.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap" }).addTo(map.current);
      layer.current = L.current.layerGroup().addTo(map.current);
      setState("ready");
    }).catch(() => setState("error"));
    return () => { dead = true; map.current?.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    if (state !== "ready" || !L.current || !layer.current || !map.current) return;
    const css = getComputedStyle(document.documentElement);
    layer.current.clearLayers();
    markers.forEach((m) => {
      L.current!.circleMarker([m.lat, m.lng], { radius: 8, weight: 2, color: "white", fillColor: css.getPropertyValue(`--risk-${m.risk}`), fillOpacity: 0.95 })
        .bindPopup(`<b>${m.name}</b><br/>${m.info}<br/><a href="/phc/${m.id}">Open details →</a>`).addTo(layer.current!);
    });
    if (markers.length) map.current.fitBounds(markers.map((m) => [m.lat, m.lng] as [number, number]), { padding: [30, 30], maxZoom: 9 });
  }, [markers, state]);

  if (state === "error") return <ErrorBox msg="Map could not load. Check your connection." onRetry={() => location.reload()} />;
  return (
    <div className="relative h-[360px] overflow-hidden rounded-md md:h-[440px]">
      {state === "loading" && <Skeleton className="absolute inset-0 z-10" />}
      <div ref={el} className="h-full w-full" />
    </div>
  );
}
