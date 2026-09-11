import { useEffect, useMemo, useState } from "react";
import type { BuilderStateData } from "@shared/schema";
import { componentRegistry, type BuilderComponentData, type ComponentProps, type ComponentStyles } from "@shared/componentRegistry";
import type { PrimitiveNode } from "@shared/customComponents";
import { updatePrimitiveNode, sanitizeCapabilityConfig, CAPABILITY_LABELS } from "@shared/customComponents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import PropertiesPanel from "./PropertiesPanel";
import {
  ArrowLeft, Box, ChevronDown, ChevronRight, CircleAlert, EyeOff,
  FileBox, FileText, Image, Layers3, Lock, MousePointer2, Search,
  Settings2, SquareDashed, Type, WandSparkles, X,
} from "lucide-react";

type SelectedKey = { kind: "component"; id: string } | { kind: "node"; componentId: string; id: string } | null;

type Props = {
  state: BuilderStateData;
  activePageId: string;
  components: BuilderComponentData[];
  selectedComponentId: string | null;
  selectedNodeId: string | null;
  hoveredComponentId: string | null;
  onSelectComponent: (id: string | null) => void;
  onSelectPage: (id: string) => void;
  onSelectNode: (componentId: string, nodeId: string | null) => void;
  onHoverComponent: (id: string | null) => void;
  onUpdate: (updates: { props?: Partial<ComponentProps>; styles?: Partial<ComponentStyles> }) => void;
  onDelete: () => void;
  onMove: (direction: "up" | "down") => void;
  onSaveComponent?: () => void;
  onClose: () => void;
  focusItemIndex?: number | null;
  onFocusItemHandled?: () => void;
  websiteId: string;
  accessToken: string;
  device: "desktop" | "tablet" | "mobile";
  svgAssets?: Record<string, import("@shared/schema").SvgAsset>;
  onSvgAssetsChanged?: () => void;
};

type TreeItem = {
  key: string;
  label: string;
  kind: "page" | "chrome" | "component" | "node";
  id: string;
  componentId?: string;
  node?: PrimitiveNode;
  pageId?: string;
  depth: number;
  state?: "hidden" | "locked" | "missing" | "unknown";
  children?: TreeItem[];
};

const labels: Record<string, string> = {
  hero: "Hero", header: "Header", footer: "Footer", cta: "Call to action",
  features: "Features", testimonials: "Testimonials", "text-image": "Text + image",
  "product-grid": "Produktgitter", booking: "Booking", "contact-form": "Kontaktformular",
  "rich-text": "Brødtekst", custom: "Custom sektion", container: "Container",
};

function nodeLabel(node: PrimitiveNode) {
  if (node.name) return node.name;
  if (node.type === "text") return node.text?.slice(0, 28) || "Tekst";
  if (node.type === "button") return node.label || "Knap";
  if (node.type === "capability") return CAPABILITY_LABELS[node.capability as keyof typeof CAPABILITY_LABELS] || "Widget";
  return ({ box: "Boks", image: "Billede", svg: "Grafik" } as Record<string, string>)[node.type] || node.type;
}

function IconFor({ type }: { type: string }) {
  const Icon = type === "text" ? Type : type === "image" ? Image : type === "button" ? MousePointer2 :
    type === "capability" ? WandSparkles : type === "box" ? Box : type === "svg" ? SquareDashed : Layers3;
  return <Icon className="h-3.5 w-3.5 shrink-0" />;
}

function primitiveItems(node: PrimitiveNode, componentId: string, depth: number): TreeItem {
  return {
    key: `${componentId}:${node.id}`, id: node.id, componentId, kind: "node",
    label: nodeLabel(node), node, depth,
    state: (node as PrimitiveNode & { locked?: boolean }).locked ? "locked" :
      node.styles?.display === "none" ? "hidden" :
      node.type === "svg" && !node.svg && !node.svgAssetId ? "missing" : undefined,
    children: (node.children ?? []).map((child) => primitiveItems(child, componentId, depth + 1)),
  };
}

export default function BuilderInspector({
  state, activePageId, components, selectedComponentId, selectedNodeId,
  hoveredComponentId, onSelectComponent, onSelectNode, onHoverComponent,
  onUpdate, onDelete, onMove, websiteId, accessToken, svgAssets, onSvgAssetsChanged,
  onSaveComponent, onSelectPage, onClose, device, focusItemIndex, onFocusItemHandled,
}: Props) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [mobileDetail, setMobileDetail] = useState(false);
  useEffect(() => setMobileDetail(Boolean(selectedComponentId)), [selectedComponentId]);

  const activePage = state.pages.find((page) => page.id === activePageId);
  const tree = useMemo<TreeItem[]>(() => {
    const chromeIds = new Set(
      [state.siteChrome?.header?.id, state.siteChrome?.footer?.id].filter(Boolean)
    );
    const pages: TreeItem[] = state.pages.map((page) => ({
      key: `page:${page.id}`, id: page.id, kind: "page", label: page.name, depth: 0,
      state: page.hidden ? "hidden" : undefined,
      children: page.id === activePageId ? components.filter((component) => !chromeIds.has(component.id)).map((component) => ({
        key: `component:${component.id}`, id: component.id, kind: "component",
        componentId: component.id, label: labels[component.type] || component.type,
        depth: 1,
        state: (component as unknown as { locked?: boolean }).locked ? "locked" :
          !component.props || (component.type === "custom" && !component.props.customTree) ? "missing" :
          !componentRegistry[component.type] ? "unknown" : undefined,
        children: component.type === "custom" && component.props.customTree
          ? [primitiveItems(component.props.customTree, component.id, 2)] : [],
      })) : [],
    }));
    return pages;
  }, [state.pages, state.siteChrome, activePageId, components]);

  const chromeItems: TreeItem[] = [
    state.siteChrome?.header && { key: "chrome:header", id: state.siteChrome.header.id, kind: "chrome", componentId: state.siteChrome.header.id, label: "Fælles header", depth: 0, children: [] },
    state.siteChrome?.footer && { key: "chrome:footer", id: state.siteChrome.footer.id, kind: "chrome", componentId: state.siteChrome.footer.id, label: "Fælles footer", depth: 0, children: [] },
  ].filter(Boolean) as TreeItem[];

  const matches = (item: TreeItem) => {
    if (!query.trim()) return true;
    const haystack = `${item.label} ${item.id} ${item.node?.type ?? ""}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase()) ||
      Boolean(item.children?.some(matches));
  };

  const selectedKey: SelectedKey = selectedNodeId && selectedComponentId
    ? { kind: "node", componentId: selectedComponentId, id: selectedNodeId }
    : selectedComponentId ? { kind: "component", id: selectedComponentId } : null;
  const selectedComponent =
    components.find((component) => component.id === selectedComponentId) ||
    (state.siteChrome?.header?.id === selectedComponentId ? state.siteChrome.header : undefined) ||
    (state.siteChrome?.footer?.id === selectedComponentId ? state.siteChrome.footer : undefined);
  const selectedNode = selectedComponent?.props.customTree
    ? findNode(selectedComponent.props.customTree, selectedNodeId)
    : undefined;
  const selectedNodePath = selectedComponent?.props.customTree
    ? findNodePath(selectedComponent.props.customTree, selectedNodeId)
    : [];

  useEffect(() => {
    if (!selectedComponentId) return;
    setExpanded((current) => {
      const next = {
        ...current,
        [`page:${activePageId}`]: true,
        [`component:${selectedComponentId}`]: true,
      };
      selectedNodePath.forEach((node) => {
        next[`${selectedComponentId}:${node.id}`] = true;
      });
      return next;
    });
  }, [activePageId, selectedComponentId, selectedNodeId]);

  const selectItem = (item: TreeItem) => {
    if (item.kind === "page") {
      onSelectPage(item.id);
      onSelectComponent(null);
      onSelectNode("", null);
      setMobileDetail(false);
    } else if (item.kind === "component" || item.kind === "chrome") {
      onSelectComponent(item.componentId || item.id);
      onSelectNode(item.componentId || item.id, null);
      setMobileDetail(true);
    } else if (item.kind === "node" && item.componentId) {
      onSelectComponent(item.componentId);
      onSelectNode(item.componentId, item.id);
      setMobileDetail(true);
    }
  };

  const toggle = (key: string) => setExpanded((current) => ({ ...current, [key]: current[key] === false }));

  const renderItem = (item: TreeItem): React.ReactNode => {
    if (!matches(item)) return null;
    const isSelected = (selectedKey?.kind === "component" && item.kind !== "node" && selectedKey.id === item.id) ||
      (selectedKey?.kind === "node" && item.kind === "node" && selectedKey.id === item.id);
    const hasChildren = Boolean(item.children?.length);
    const isOpen = query.trim() ? true : expanded[item.key] !== false;
    return (
      <div key={item.key}>
        <button
          type="button"
          className={`w-full flex items-center gap-1.5 rounded-md pr-2 py-1.5 text-left text-xs transition-colors ${isSelected ? "bg-primary/10 text-primary" : hoveredComponentId === item.componentId ? "bg-muted" : "hover:bg-muted/70"} ${item.state ? "opacity-70" : ""}`}
          style={{ paddingLeft: `${8 + item.depth * 14}px` }}
          onClick={() => selectItem(item)}
          onMouseEnter={() => item.componentId && onHoverComponent(item.componentId)}
          onMouseLeave={() => onHoverComponent(null)}
          data-testid={`inspector-tree-${item.key}`}
        >
          {hasChildren ? (
            <span onClick={(event) => { event.stopPropagation(); toggle(item.key); }}>
              {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </span>
          ) : <span className="w-3" />}
          {item.kind === "page" ? <FileText className="h-3.5 w-3.5 shrink-0" /> : item.kind === "chrome" ? <Layers3 className="h-3.5 w-3.5 shrink-0" /> : <IconFor type={item.node?.type || "section"} />}
          <span className="truncate flex-1">{item.label}</span>
          {item.state === "hidden" && <EyeOff className="h-3 w-3" />}
          {item.state === "locked" && <Lock className="h-3 w-3" />}
          {item.state === "missing" && <CircleAlert className="h-3 w-3 text-amber-600" />}
          {item.state === "unknown" && <Badge variant="outline" className="h-4 px-1 text-[9px] text-amber-700">Ukendt</Badge>}
        </button>
        {hasChildren && isOpen && <div>{item.children?.map(renderItem)}</div>}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col min-h-0" data-testid="builder-inspector">
      <div className="px-3 pt-3 pb-2 border-b shrink-0">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            {mobileDetail && <Button variant="ghost" size="icon" className="h-7 w-7 md:hidden" onClick={() => setMobileDetail(false)}><ArrowLeft className="h-4 w-4" /></Button>}
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Inspektør</p>
              <h2 className="font-semibold text-sm truncate">{mobileDetail && selectedComponent ? (labels[selectedComponent.type] || selectedComponent.type) : "Lag og elementer"}</h2>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} aria-label="Luk inspektør"><X className="h-4 w-4" /></Button>
        </div>
        <div className={mobileDetail ? "hidden md:block" : "block"}>
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Søg i struktur…" className="h-8 pl-8 text-xs" data-testid="inspector-search" />
          </div>
        </div>
      </div>

      <div className={mobileDetail ? "hidden md:flex md:h-[38%] md:min-h-0" : "flex-1 min-h-0 md:flex-none md:h-[38%]"}>
        <ScrollArea className="h-full w-full md:border-b">
          <div className="p-2 space-y-1">
            <div className="px-2 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">Sidehierarki</div>
            {tree.length ? tree.map(renderItem) : <p className="p-3 text-xs text-muted-foreground">Ingen sider at vise.</p>}
            {chromeItems.length > 0 && (
              <>
                <div className="px-2 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">Delt på tværs af sider</div>
                {chromeItems.map(renderItem)}
              </>
            )}
          </div>
        </ScrollArea>
      </div>
      <div className={mobileDetail ? "flex-1 min-h-0" : "hidden md:flex md:flex-1 md:min-h-0"}>
        <ScrollArea className="h-full w-full">
          <div className="p-3 space-y-3">
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <span>{activePage?.name || "Side"}</span><ChevronRight className="h-3 w-3" />
              {selectedComponent && (
                <>
                  <span className="truncate max-w-20">{labels[selectedComponent.type] || selectedComponent.type}</span>
                  {selectedNodePath.map((node, index) => (
                    <span key={node.id} className={`contents ${index === selectedNodePath.length - 1 ? "text-foreground" : ""}`}>
                      <ChevronRight className="h-3 w-3 shrink-0" />
                      <span className="truncate max-w-24">{nodeLabel(node)}</span>
                    </span>
                  ))}
                </>
              )}
              {!selectedComponent && <span className="text-foreground">Intet valgt</span>}
            </div>
            {selectedNode && <NodeMetadata node={selectedNode} device={device} />}
            {selectedNode?.type === "capability" && (selectedNode.capability === 'booking' && selectedComponent?.props.customTree ?
              <BookingCapabilitySettings node={selectedNode} onChange={config => onUpdate({ props: { customTree: updatePrimitiveNode(selectedComponent.props.customTree!, selectedNode.id, current => ({ ...current, capabilityConfig: sanitizeCapabilityConfig('booking', config) })) } })} /> :
              <CapabilitySample node={selectedNode} />)}
            {selectedComponent ? (
              componentRegistry[selectedComponent.type] ? (
                <>
                  {onSaveComponent && <Button variant="outline" size="sm" className="w-full gap-2" onClick={onSaveComponent}><FileBox className="h-4 w-4" />Gem som komponent</Button>}
                  <PropertiesPanel component={selectedComponent} onUpdate={onUpdate} onDelete={onDelete} onMove={onMove} websiteId={websiteId} accessToken={accessToken} globalStyles={state.globalStyles} selectedNodeId={selectedNodeId} onNodeSelect={(id) => onSelectNode(selectedComponent.id, id)} svgAssets={svgAssets} onSvgAssetsChanged={onSvgAssetsChanged} focusItemIndex={focusItemIndex} onFocusItemHandled={onFocusItemHandled} />
                </>
              ) : <GenericDetails component={selectedComponent} />
            ) : <EmptyDetails />}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function findNode(root: PrimitiveNode, id: string | null): PrimitiveNode | undefined {
  if (!id) return undefined;
  if (root.id === id) return root;
  for (const child of root.children ?? []) {
    const result = findNode(child, id);
    if (result) return result;
  }
  return undefined;
}

function findNodePath(root: PrimitiveNode, id: string | null): PrimitiveNode[] {
  if (!id) return [];
  if (root.id === id) return [root];
  for (const child of root.children ?? []) {
    const childPath = findNodePath(child, id);
    if (childPath.length) return [root, ...childPath];
  }
  return [];
}

function NodeMetadata({ node, device }: { node: PrimitiveNode; device: "desktop" | "tablet" | "mobile" }) {
  const activeStyles = device === "desktop" ? node.styles : device === "tablet" ? node.tabletStyles : node.mobileStyles;
  const inherited = !activeStyles || Object.keys(activeStyles).length === 0;
  const inheritedFrom = device === "mobile" && node.tabletStyles && Object.keys(node.tabletStyles).length > 0
    ? "tablet"
    : "desktop";
  return <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
    <div className="flex items-center gap-2"><IconFor type={node.type} /><span className="font-medium text-sm">{nodeLabel(node)}</span><Badge variant="secondary" className="ml-auto text-[10px]">{node.type}</Badge></div>
    <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
      <span>Node-ID</span><code className="text-right truncate">{node.id}</code>
      <span>Aktiv preset</span><span className="text-right capitalize">{device}</span>
      <span>Responsive status</span><span className={`text-right ${inherited ? "text-muted-foreground" : "text-primary font-medium"}`}>{inherited ? (device === "desktop" ? "Bruger standard" : `Arver ${inheritedFrom}`) : `Override på ${device}`}</span>
      {node.behavior && <><span>Adfærd</span><span className="text-right">Deklarativ</span></>}
    </div>
  </div>;
}

function GenericDetails({ component }: { component: BuilderComponentData }) {
  const propKeys = Object.keys(component.props || {});
  const styleKeys = Object.keys(component.styles || {});
  return <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
    <div className="flex items-center gap-2"><Settings2 className="h-4 w-4" /><span className="font-medium text-sm">Struktur og metadata</span></div>
    <p className="text-xs text-muted-foreground">Denne type har ingen redigerbar inspektør endnu. Indholdet vises sikkert som skrivebeskyttet metadata.</p>
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-xs">
      <dt className="text-muted-foreground">Type</dt><dd className="text-right">{component.type}</dd>
      <dt className="text-muted-foreground">ID</dt><dd className="text-right truncate">{component.id}</dd>
      <dt className="text-muted-foreground">Felter</dt><dd className="text-right">{Object.keys(component.props || {}).length}</dd>
      <dt className="text-muted-foreground">Stilregler</dt><dd className="text-right">{Object.keys(component.styles || {}).length}</dd>
    </dl>
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Prop-nøgler</p>
      <div className="flex flex-wrap gap-1">{propKeys.length ? propKeys.map((key) => <Badge key={key} variant="outline" className="text-[10px]">{key}</Badge>) : <span className="text-xs text-muted-foreground">Ingen</span>}</div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground pt-1">Style-nøgler</p>
      <div className="flex flex-wrap gap-1">{styleKeys.length ? styleKeys.map((key) => <Badge key={key} variant="outline" className="text-[10px]">{key}</Badge>) : <span className="text-xs text-muted-foreground">Ingen</span>}</div>
    </div>
  </div>;
}

function EmptyDetails() {
  return <div className="py-16 text-center text-muted-foreground"><FileBox className="h-8 w-8 mx-auto mb-3 opacity-35" /><p className="text-sm font-medium">Vælg et objekt</p><p className="text-xs mt-1">Hierarkiet viser præcis, hvad AI’en har bygget.</p></div>;
}

function CapabilitySample({ node }: { node: PrimitiveNode }) {
  const [mode, setMode] = useState<"idle" | "submitted">("idle");
  const label = CAPABILITY_LABELS[node.capability as keyof typeof CAPABILITY_LABELS] || "Widget";
  return (
    <div className="rounded-lg border border-primary/20 bg-primary/[0.04] p-3 space-y-2" data-testid="capability-sample">
      <div className="flex items-center gap-2">
        <WandSparkles className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold">Sikker prøvevisning</span>
        <Badge variant="outline" className="ml-auto text-[10px]">Kun editor</Badge>
      </div>
      <p className="text-[11px] text-muted-foreground">{label} reagerer lokalt her. Ingen data gemmes og ingen produktions-API kaldes.</p>
      {node.capability === "booking" ? (
        <div className="flex gap-1.5">
          {["I dag", "I morgen", "Fredag"].map((day) => (
            <button key={day} type="button" className="rounded border bg-background px-2 py-1 text-[11px] hover:border-primary/50" onClick={() => setMode("submitted")}>{day}</button>
          ))}
        </div>
      ) : node.capability === "product_grid" ? (
        <div className="grid grid-cols-2 gap-1.5">
          {["Eksempelvare", "Ny service"].map((name) => <div key={name} className="rounded border bg-background px-2 py-2 text-[11px]"><div className="h-5 rounded bg-muted mb-1" />{name}</div>)}
        </div>
      ) : (
        <div className="flex gap-1.5">
          <Input className="h-7 text-[11px] bg-background" placeholder={node.capability === "newsletter" ? "din@email.dk" : "Skriv en besked"} onChange={() => setMode("idle")} />
          <Button type="button" size="sm" className="h-7 text-[11px]" onClick={() => setMode("submitted")}>Test</Button>
        </div>
      )}
      {mode === "submitted" && <p className="text-[11px] text-primary font-medium">Prøvehandling gennemført lokalt.</p>}
    </div>
  );
}
function BookingCapabilitySettings({ node, onChange }: { node: PrimitiveNode; onChange: (config: Record<string, string | number | boolean>) => void }) {
  const config = node.capabilityConfig || {};
  const change = (key: string, value: string | boolean) => onChange({ ...config, [key]: value });
  return <div className="rounded-lg border p-3 space-y-3" data-testid="booking-capability-settings">
    <p className="text-sm font-medium">Bookingdesign</p>
    {([['title', 'Overskrift'], ['description', 'Beskrivelse'], ['buttonText', 'Knaptekst']] as const).map(([key, label]) =>
      <label key={key} className="block text-xs space-y-1"><span>{label}</span><Input value={String(config[key] || '')} maxLength={200} onChange={event => change(key, event.target.value)} /></label>)}
    <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={config.headingVisible !== false} onChange={event => change('headingVisible', event.target.checked)} />Vis overskrift</label>
    <label className="block text-xs">Layout<select className="block w-full border rounded p-2 mt-1" value={String(config.variant || 'default')} onChange={event => change('variant', event.target.value)}>
      <option value="default">Standard</option><option value="compact">Kompakt</option><option value="inline">Fuld bredde</option></select></label>
    <label className="block text-xs">Datovælger<select className="block w-full border rounded p-2 mt-1" value={String(config.displayMode || 'calendar')} onChange={event => change('displayMode', event.target.value)}>
      <option value="calendar">Kalender</option><option value="list">Enkel datovælger</option></select></label>
    <p className="text-xs text-muted-foreground">Ydelser og ledige tider kommer fra bookingopsætningen. Prøvevisning opretter ingen reservation.</p>
  </div>;
}
