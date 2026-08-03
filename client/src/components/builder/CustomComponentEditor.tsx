import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Box as BoxIcon,
  Type as TypeIcon,
  Image as ImageIcon,
  MousePointerClick,
  Shapes,
  ChevronUp,
  ChevronDown,
  Copy,
  Trash2,
  Loader2,
  Monitor,
  Tablet,
  Smartphone,
  Upload,
} from "lucide-react";
import type { BuilderComponentData, ComponentProps, ComponentStyles } from "@shared/componentRegistry";
import {
  MAX_CUSTOM_TREE_NODES,
  countPrimitiveNodes,
  createDefaultCustomTree,
  createPrimitiveNode,
  duplicatePrimitiveNode,
  findPrimitiveNode,
  findPrimitiveParent,
  insertPrimitiveChild,
  movePrimitiveNode,
  removePrimitiveNode,
  updatePrimitiveNode,
  effectiveEditableSchema,
  isInsideBoundRepeater,
  type PrimitiveNode,
  type PrimitiveNodeType,
  type PrimitiveStyleKey,
  type PrimitiveButtonVariant,
  type PrimitiveTextTag,
} from "@shared/customComponents";
import { sanitizeSvg } from "@shared/svgSanitizer";
import { applySvgAssetColors, isSvgColorTokenRef } from "@shared/svgAssets";
import type { MotionSpec } from "@shared/motion";
import { resolveDesignTokens } from "@shared/designTokens";
import { uploadImage } from "@/lib/builderUpload";
import SemanticFieldsPanel from "./SemanticFieldsPanel";
import type { DesignTokens, SvgAsset } from "@shared/schema";

/**
 * Which style bucket the panel is editing. Hover sits alongside the device
 * buckets because it works the same way — declarations layered over the base
 * styles — and because the published site emits it as a real `:hover` rule.
 */
type DeviceKey = "styles" | "tabletStyles" | "mobileStyles" | "hoverStyles";

type Props = {
  component: BuilderComponentData;
  onUpdate: (updates: { props?: Partial<ComponentProps>; styles?: Partial<ComponentStyles> }) => void;
  websiteId: string;
  accessToken: string;
  selectedNodeId?: string | null;
  onNodeSelect?: (nodeId: string | null) => void;
  /** Design tokens so semantic colour fields can offer brand swatches. */
  globalStyles?: DesignTokens;
  /** Stored SVG illustrations by id — svg nodes reference them via svgAssetId. */
  svgAssets?: Record<string, SvgAsset>;
  /** Called after a new illustration is stored, so the caller refreshes the map. */
  onSvgAssetsChanged?: () => void;
};

const NODE_TYPE_META: Record<PrimitiveNodeType, { label: string; icon: typeof BoxIcon }> = {
  box: { label: "Boks", icon: BoxIcon },
  text: { label: "Tekst", icon: TypeIcon },
  image: { label: "Billede", icon: ImageIcon },
  button: { label: "Knap", icon: MousePointerClick },
  svg: { label: "Grafik", icon: Shapes },
};

const TAG_OPTIONS: { value: PrimitiveTextTag; label: string }[] = [
  { value: "h1", label: "Overskrift 1" },
  { value: "h2", label: "Overskrift 2" },
  { value: "h3", label: "Overskrift 3" },
  { value: "h4", label: "Overskrift 4" },
  { value: "p", label: "Brødtekst" },
  { value: "span", label: "Lille tekst" },
  { value: "blockquote", label: "Citat" },
];

const VARIANT_OPTIONS: { value: PrimitiveButtonVariant; label: string }[] = [
  { value: "primary", label: "Primær" },
  { value: "secondary", label: "Sekundær" },
  { value: "outline", label: "Kontur" },
  { value: "ghost", label: "Diskret" },
  { value: "link", label: "Link" },
];

const INHERIT = "__inherit__";

/**
 * Motion controls: preset names from the controlled vocabulary in
 * shared/motion.ts, with Danish labels. The default of every scale is the
 * calm option; picking it removes the key so specs stay minimal.
 */
const MOTION_DEFAULTS: Record<string, string> = {
  effect: "none",
  trigger: "scroll",
  duration: "normal",
  delay: "none",
  easing: "soft",
  distance: "medium",
  repeat: "once",
  stagger: "none",
  hover: "none",
};

const MOTION_FIELDS: { key: keyof MotionSpec; label: string; options: [string, string][]; boxOnly?: boolean; entranceOnly?: boolean }[] = [
  {
    key: "effect",
    label: "Indgang",
    options: [
      ["none", "Ingen"],
      ["fade-in", "Fade ind"],
      ["slide-up", "Glid op"],
      ["slide-down", "Glid ned"],
      ["slide-left", "Glid fra højre"],
      ["slide-right", "Glid fra venstre"],
      ["zoom-in", "Zoom ind"],
      ["zoom-out", "Zoom ud"],
      ["bounce", "Hop"],
      ["flip", "Flip"],
    ],
  },
  {
    key: "trigger",
    label: "Afspil",
    entranceOnly: true,
    options: [
      ["scroll", "Ved scroll"],
      ["load", "Ved indlæsning"],
    ],
  },
  {
    key: "duration",
    label: "Varighed",
    entranceOnly: true,
    options: [
      ["fast", "Hurtig"],
      ["normal", "Normal"],
      ["slow", "Langsom"],
      ["very-slow", "Meget langsom"],
    ],
  },
  {
    key: "delay",
    label: "Forsinkelse",
    entranceOnly: true,
    options: [
      ["none", "Ingen"],
      ["short", "Kort"],
      ["medium", "Mellem"],
      ["long", "Lang"],
    ],
  },
  {
    key: "easing",
    label: "Kurve",
    entranceOnly: true,
    options: [
      ["soft", "Blød"],
      ["ease-out", "Ease-out"],
      ["ease-in-out", "Jævn"],
      ["linear", "Lineær"],
      ["spring", "Fjedrende"],
    ],
  },
  {
    key: "distance",
    label: "Afstand",
    entranceOnly: true,
    options: [
      ["short", "Kort"],
      ["medium", "Mellem"],
      ["long", "Lang"],
    ],
  },
  {
    key: "repeat",
    label: "Gentagelse",
    entranceOnly: true,
    options: [
      ["once", "Én gang"],
      ["every-view", "Hver visning"],
    ],
  },
  {
    key: "stagger",
    label: "Børn forskudt",
    boxOnly: true,
    options: [
      ["none", "Ingen"],
      ["tight", "Tæt"],
      ["normal", "Normal"],
      ["relaxed", "Afslappet"],
    ],
  },
  {
    key: "hover",
    label: "Hover-effekt",
    options: [
      ["none", "Ingen"],
      ["lift", "Løft"],
      ["grow", "Forstør"],
      ["glow", "Glød"],
    ],
  },
];

/**
 * Brand roles an illustration colour can bind to. The value is stored as a
 * token reference (`{color.primary}`) on the node, so a later brand-colour
 * change flows into every bound drawing automatically.
 */
const SVG_BRAND_ROLES: { value: string; label: string }[] = [
  { value: "{color.primary}", label: "Primær farve" },
  { value: "{color.secondary}", label: "Sekundær farve" },
  { value: "{color.accent}", label: "Accentfarve" },
  { value: "{color.background}", label: "Baggrundsfarve" },
  { value: "{color.surface}", label: "Fladefarve" },
  { value: "{color.text}", label: "Tekstfarve" },
];

/** `<input type="color">` only accepts #rrggbb — coerce what we can. */
function toColorInputValue(value: string): string {
  const v = (value || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(v)) return v;
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(v);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
  return "#888888";
}

type StyleFieldDef = {
  key: PrimitiveStyleKey;
  label: string;
  kind: "text" | "color" | "select";
  placeholder?: string;
  options?: { value: string; label: string }[];
  boxOnly?: boolean;
};

const STYLE_FIELDS: StyleFieldDef[] = [
  { key: "flexDirection", label: "Retning", kind: "select", boxOnly: true, options: [
    { value: "column", label: "Lodret" },
    { value: "row", label: "Vandret" },
  ]},
  { key: "justifyContent", label: "Fordeling", kind: "select", boxOnly: true, options: [
    { value: "flex-start", label: "Start" },
    { value: "center", label: "Centreret" },
    { value: "flex-end", label: "Slut" },
    { value: "space-between", label: "Spred ud" },
  ]},
  { key: "alignItems", label: "Justering på tværs", kind: "select", boxOnly: true, options: [
    { value: "stretch", label: "Stræk" },
    { value: "flex-start", label: "Start" },
    { value: "center", label: "Centreret" },
    { value: "flex-end", label: "Slut" },
  ]},
  { key: "gap", label: "Afstand mellem elementer", kind: "text", placeholder: "16px", boxOnly: true },
  { key: "padding", label: "Indvendig afstand", kind: "text", placeholder: "16px eller 16px 24px" },
  { key: "margin", label: "Udvendig afstand", kind: "text", placeholder: "0 auto" },
  { key: "width", label: "Bredde", kind: "text", placeholder: "100% / 320px" },
  { key: "maxWidth", label: "Maks. bredde", kind: "text", placeholder: "640px" },
  { key: "height", label: "Højde", kind: "text", placeholder: "auto / 240px" },
  { key: "minHeight", label: "Min. højde", kind: "text", placeholder: "200px" },
  { key: "backgroundColor", label: "Baggrundsfarve", kind: "color" },
  { key: "color", label: "Tekstfarve", kind: "color" },
  { key: "fontSize", label: "Skriftstørrelse", kind: "text", placeholder: "16px" },
  { key: "fontWeight", label: "Skriftvægt", kind: "select", options: [
    { value: "400", label: "Normal" },
    { value: "500", label: "Medium" },
    { value: "600", label: "Halvfed" },
    { value: "700", label: "Fed" },
    { value: "800", label: "Ekstra fed" },
  ]},
  { key: "textAlign", label: "Tekstjustering", kind: "select", options: [
    { value: "left", label: "Venstre" },
    { value: "center", label: "Centreret" },
    { value: "right", label: "Højre" },
  ]},
  { key: "borderRadius", label: "Runde hjørner", kind: "text", placeholder: "12px" },
  { key: "boxShadow", label: "Skygge", kind: "select", options: [
    { value: "none", label: "Ingen" },
    { value: "0 1px 3px rgba(15, 23, 42, 0.1)", label: "Diskret" },
    { value: "0 10px 30px rgba(15, 23, 42, 0.12)", label: "Løftet" },
  ]},
  { key: "opacity", label: "Gennemsigtighed", kind: "text", placeholder: "0.8" },
];

export default function CustomComponentEditor({
  component,
  onUpdate,
  websiteId,
  accessToken,
  selectedNodeId,
  onNodeSelect,
  globalStyles,
  svgAssets,
  onSvgAssetsChanged,
}: Props) {
  const tree = component.props.customTree;
  const [deviceTab, setDeviceTab] = useState<DeviceKey>("styles");
  const [svgDraft, setSvgDraft] = useState<string | null>(null);
  const [svgError, setSvgError] = useState<string | null>(null);
  const [svgNotice, setSvgNotice] = useState<string | null>(null);
  const [savingSvg, setSavingSvg] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Named fields ("Overskrift", "Knap – link") are the default editing
  // surface; the raw node editor stays available as "Avanceret".
  const effective = useMemo(() => effectiveEditableSchema(component.props), [component.props]);

  useEffect(() => {
    setSvgDraft(null);
    setSvgError(null);
    setSvgNotice(null);
    setEditorError(null);
  }, [selectedNodeId]);

  // Same token resolution the canvas renderer uses, so colour previews here
  // match what the customer sees on the page.
  const svgTokens = useMemo(
    () => resolveDesignTokens((globalStyles ?? {}) as Parameters<typeof resolveDesignTokens>[0]),
    [globalStyles]
  );

  useEffect(() => {
    setShowAdvanced(false);
  }, [component.id]);

  const setTree = (next: PrimitiveNode) => {
    onUpdate({ props: { customTree: next } });
  };

  if (!tree) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">Denne komponent har ikke noget indhold endnu.</p>
        <Button size="sm" className="w-full" onClick={() => setTree(createDefaultCustomTree())} data-testid="button-create-custom-tree">
          Opret indhold
        </Button>
      </div>
    );
  }

  const semanticAvailable = Boolean(effective && effective.schema.fields.length > 0);

  const modeToggle = semanticAvailable ? (
    <div className="flex border rounded-md overflow-hidden">
      <button
        type="button"
        className={`flex-1 py-1.5 text-xs font-medium transition-colors ${!showAdvanced ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
        onClick={() => setShowAdvanced(false)}
        data-testid="custom-mode-fields"
      >
        Felter
      </button>
      <button
        type="button"
        className={`flex-1 py-1.5 text-xs font-medium transition-colors ${showAdvanced ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
        onClick={() => setShowAdvanced(true)}
        data-testid="custom-mode-advanced"
      >
        Avanceret
      </button>
    </div>
  ) : null;

  if (semanticAvailable && !showAdvanced && effective) {
    return (
      <div className="space-y-3">
        {modeToggle}
        {effective.source === "inferred" && (
          <p className="text-[11px] text-muted-foreground">
            Felterne er fundet automatisk ud fra komponentens indhold.
          </p>
        )}
        <SemanticFieldsPanel
          tree={tree}
          schema={effective.schema}
          onUpdate={onUpdate}
          websiteId={websiteId}
          accessToken={accessToken}
          selectedNodeId={selectedNodeId}
          onNodeSelect={onNodeSelect}
          globalStyles={globalStyles}
          onOpenAdvanced={() => setShowAdvanced(true)}
        />
      </div>
    );
  }

  const selected = selectedNodeId ? findPrimitiveNode(tree, selectedNodeId) : null;
  const parentInfo = selected && selected.id !== tree.id ? findPrimitiveParent(tree, selected.id) : null;
  const nodeCount = countPrimitiveNodes(tree);
  const isRootSelected = selected?.id === tree.id;

  const patchNode = (id: string, patch: Partial<PrimitiveNode>) => {
    setTree(updatePrimitiveNode(tree, id, (n) => ({ ...n, ...patch })));
  };

  const setNodeStyle = (id: string, deviceKey: DeviceKey, styleKey: PrimitiveStyleKey, value: string) => {
    setTree(
      updatePrimitiveNode(tree, id, (n) => {
        const current = { ...(n[deviceKey] ?? {}) };
        if (!value) {
          delete current[styleKey];
        } else {
          current[styleKey] = value;
        }
        return { ...n, [deviceKey]: current };
      })
    );
  };

  // Structural changes inside a STORED repeater's subtree can silently
  // re-target its positional (nodeType, nth) field bindings — the named
  // fields would start editing the wrong nodes. Refuse and point at the
  // repeater's own item controls in the Felter view.
  const structuralLock = (nodeId: string): boolean => {
    if (effective?.source !== "stored") return false;
    if (!isInsideBoundRepeater(tree, effective.schema, nodeId)) return false;
    setEditorError('Denne del af komponenten er en liste med navngivne felter. Tilføj, fjern eller flyt elementer under "Felter" i stedet.');
    return true;
  };

  const addChild = (type: PrimitiveNodeType) => {
    if (nodeCount >= MAX_CUSTOM_TREE_NODES) {
      setEditorError(`Komponenten kan højst indeholde ${MAX_CUSTOM_TREE_NODES} elementer.`);
      return;
    }
    const targetId = selected && selected.type === "box" ? selected.id : parentInfo?.parent.id ?? tree.id;
    if (structuralLock(targetId)) return;
    const node = createPrimitiveNode(type);
    setTree(insertPrimitiveChild(tree, targetId, node));
    onNodeSelect?.(node.id);
    setEditorError(null);
  };

  const handleDuplicate = () => {
    if (!selected || isRootSelected) return;
    if (nodeCount + countPrimitiveNodes(selected) > MAX_CUSTOM_TREE_NODES) {
      setEditorError(`Komponenten kan højst indeholde ${MAX_CUSTOM_TREE_NODES} elementer.`);
      return;
    }
    if (structuralLock(selected.id)) return;
    setTree(duplicatePrimitiveNode(tree, selected.id));
  };

  const handleDelete = () => {
    if (!selected || isRootSelected) return;
    if (structuralLock(selected.id)) return;
    setTree(removePrimitiveNode(tree, selected.id));
    onNodeSelect?.(null);
  };

  const handleMove = (direction: "up" | "down") => {
    if (!selected || isRootSelected) return;
    if (structuralLock(selected.id)) return;
    setTree(movePrimitiveNode(tree, selected.id, direction));
  };

  const handleImageFile = async (file: File) => {
    if (!selected) return;
    setUploadingImage(true);
    try {
      const { url, mediaId } = await uploadImage(websiteId, accessToken, file);
      patchNode(selected.id, { src: url, mediaId });
    } catch {
      setEditorError("Billedet kunne ikke uploades. Prøv igen.");
    } finally {
      setUploadingImage(false);
    }
  };

  /**
   * Store the drawing in the illustration library (svg_assets) and point the
   * node at it by id. If the store is unavailable the markup is kept inline
   * on the node instead — the customer is never stranded.
   */
  const applySvg = async () => {
    if (!selected) return;
    const currentMarkup =
      selected.svg ?? (selected.svgAssetId ? svgAssets?.[selected.svgAssetId]?.svg : "") ?? "";
    const raw = svgDraft ?? currentMarkup;
    const safe = sanitizeSvg(raw);
    if (!safe) {
      setSvgError("SVG-koden kunne ikke godkendes. Brug simpel SVG uden scripts eller eksterne links.");
      return;
    }
    setSavingSvg(true);
    setSvgError(null);
    setSvgNotice(null);
    try {
      const res = await fetch(`/api/websites/${websiteId}/svg-assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ svg: safe, name: selected.name || "Grafik" }),
      });
      if (res.ok) {
        const asset: SvgAsset = await res.json();
        patchNode(selected.id, { svgAssetId: asset.id, svg: undefined, svgColors: undefined });
        setSvgDraft(null);
        onSvgAssetsChanged?.();
      } else if (res.status === 400) {
        // Validation refusals carry a customer-readable Danish message
        // (too large, too complex, unreadable) — show it verbatim.
        const body = await res.json().catch(() => null);
        setSvgError(body?.message ?? "SVG-koden kunne ikke godkendes.");
      } else {
        patchNode(selected.id, { svg: safe, svgAssetId: undefined, svgColors: undefined });
        setSvgDraft(null);
        setSvgNotice("Gemt direkte i sektionen — grafikbiblioteket er ikke tilgængeligt lige nu.");
      }
    } catch {
      patchNode(selected.id, { svg: safe, svgAssetId: undefined, svgColors: undefined });
      setSvgDraft(null);
      setSvgNotice("Gemt direkte i sektionen — grafikbiblioteket er ikke tilgængeligt lige nu.");
    } finally {
      setSavingSvg(false);
    }
  };

  /** Set, replace or clear (value = null) one colour-slot override. */
  const setSvgColorOverride = (slotId: string, value: string | null) => {
    if (!selected) return;
    const next = { ...(selected.svgColors ?? {}) };
    if (value === null) delete next[slotId];
    else next[slotId] = value;
    patchNode(selected.id, { svgColors: Object.keys(next).length ? next : undefined });
  };

  const renderLayer = (node: PrimitiveNode, depth: number): ReactElement => {
    const meta = NODE_TYPE_META[node.type];
    const Icon = meta.icon;
    const isSelected = selectedNodeId === node.id;
    return (
      <div key={node.id}>
        <button
          type="button"
          onClick={() => onNodeSelect?.(node.id)}
          className={`w-full flex items-center gap-2 py-1.5 pr-2 rounded-md text-left transition-colors ${
            isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted/70 text-foreground/80"
          }`}
          style={{ paddingLeft: `${8 + depth * 14}px` }}
          data-testid={`layer-${node.id}`}
        >
          <Icon className="w-3.5 h-3.5 shrink-0" />
          <span className="text-xs truncate">{node.name || meta.label}</span>
        </button>
        {node.children?.map((child) => renderLayer(child, depth + 1))}
      </div>
    );
  };

  const deviceStyles = selected ? selected[deviceTab] ?? {} : {};

  const renderStyleField = (field: StyleFieldDef) => {
    if (!selected) return null;
    if (field.boxOnly && selected.type !== "box") return null;
    const value = (deviceStyles as Record<string, string>)[field.key] ?? "";

    if (field.kind === "select") {
      return (
        <div key={field.key} className="space-y-1">
          <Label className="text-xs">{field.label}</Label>
          <Select
            value={value || INHERIT}
            onValueChange={(v) => setNodeStyle(selected.id, deviceTab, field.key, v === INHERIT ? "" : v)}
          >
            <SelectTrigger className="h-8 text-xs" data-testid={`node-style-${field.key}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={INHERIT}>Standard</SelectItem>
              {field.options?.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    if (field.kind === "color") {
      return (
        <div key={field.key} className="space-y-1">
          <Label className="text-xs">{field.label}</Label>
          <div className="flex gap-1">
            <Input
              type="color"
              value={value || "#ffffff"}
              onChange={(e) => setNodeStyle(selected.id, deviceTab, field.key, e.target.value)}
              className="w-9 h-8 p-1 cursor-pointer"
              data-testid={`node-color-${field.key}`}
            />
            <Input
              value={value}
              onChange={(e) => setNodeStyle(selected.id, deviceTab, field.key, e.target.value)}
              placeholder="Nedarvet"
              className="flex-1 h-8 text-xs"
            />
          </div>
        </div>
      );
    }

    return (
      <div key={field.key} className="space-y-1">
        <Label className="text-xs">{field.label}</Label>
        <Input
          value={value}
          onChange={(e) => setNodeStyle(selected.id, deviceTab, field.key, e.target.value)}
          placeholder={field.placeholder}
          className="h-8 text-xs"
          data-testid={`node-style-${field.key}`}
        />
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {modeToggle}

      {/* Layer tree */}
      <div className="space-y-2">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Elementer</h4>
        <div className="border rounded-lg p-1.5 max-h-56 overflow-y-auto bg-muted/30">
          {renderLayer(tree, 0)}
        </div>
        <p className="text-[11px] text-muted-foreground">
          {nodeCount} elementer · Klik for at vælge, dobbeltklik på tekst i preview for at redigere.
        </p>
      </div>

      {/* Add elements */}
      <div className="space-y-2">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Tilføj {selected && selected.type === "box" ? `i "${selected.name || "Boks"}"` : "element"}
        </h4>
        <div className="grid grid-cols-5 gap-1">
          {(Object.keys(NODE_TYPE_META) as PrimitiveNodeType[]).map((type) => {
            const meta = NODE_TYPE_META[type];
            const Icon = meta.icon;
            return (
              <button
                key={type}
                type="button"
                onClick={() => addChild(type)}
                className="flex flex-col items-center gap-1 p-2 rounded-lg border bg-background hover:border-primary/40 hover:bg-primary/5 transition-all"
                title={meta.label}
                data-testid={`add-node-${type}`}
              >
                <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[10px] leading-none">{meta.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {editorError && <p className="text-xs text-destructive">{editorError}</p>}

      {selected ? (
        <>
          <Separator />

          {/* Node actions */}
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium flex-1 truncate">
              {selected.name || NODE_TYPE_META[selected.type].label}
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={isRootSelected} onClick={() => handleMove("up")} title="Flyt op" data-testid="node-move-up">
              <ChevronUp className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={isRootSelected} onClick={() => handleMove("down")} title="Flyt ned" data-testid="node-move-down">
              <ChevronDown className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={isRootSelected} onClick={handleDuplicate} title="Dupliker" data-testid="node-duplicate">
              <Copy className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" disabled={isRootSelected} onClick={handleDelete} title="Slet" data-testid="node-delete">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* Node name */}
          <div className="space-y-1">
            <Label className="text-xs">Navn</Label>
            <Input
              value={selected.name ?? ""}
              onChange={(e) => patchNode(selected.id, { name: e.target.value })}
              placeholder={NODE_TYPE_META[selected.type].label}
              className="h-8 text-xs"
              data-testid="node-name"
            />
          </div>

          {/* Type-specific fields */}
          {selected.type === "text" && (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Tekst</Label>
                <textarea
                  className="w-full min-h-[70px] p-2 text-sm border rounded-md resize-none bg-background"
                  value={selected.text ?? ""}
                  onChange={(e) => patchNode(selected.id, { text: e.target.value })}
                  data-testid="node-text"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Typografi</Label>
                <Select value={selected.tag ?? "p"} onValueChange={(v) => patchNode(selected.id, { tag: v as PrimitiveTextTag })}>
                  <SelectTrigger className="h-8 text-xs" data-testid="node-tag">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TAG_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {selected.type === "image" && (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Billede</Label>
                {selected.src && (
                  <img src={selected.src} alt={selected.alt ?? ""} className="w-full h-24 object-cover rounded-md border" />
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageFile(file);
                    e.target.value = "";
                  }}
                />
                <Button variant="outline" size="sm" className="w-full gap-2" disabled={uploadingImage} onClick={() => fileRef.current?.click()} data-testid="node-upload-image">
                  {uploadingImage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  {uploadingImage ? "Uploader..." : "Upload billede"}
                </Button>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Billed-URL</Label>
                <Input
                  value={selected.src ?? ""}
                  onChange={(e) => patchNode(selected.id, { src: e.target.value, mediaId: undefined })}
                  placeholder="https://..."
                  className="h-8 text-xs"
                  data-testid="node-image-src"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Alt-tekst</Label>
                <Input
                  value={selected.alt ?? ""}
                  onChange={(e) => patchNode(selected.id, { alt: e.target.value })}
                  placeholder="Beskrivelse af billedet"
                  className="h-8 text-xs"
                  data-testid="node-image-alt"
                />
              </div>
            </>
          )}

          {selected.type === "button" && (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Knaptekst</Label>
                <Input
                  value={selected.label ?? ""}
                  onChange={(e) => patchNode(selected.id, { label: e.target.value })}
                  className="h-8 text-xs"
                  data-testid="node-button-label"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Link</Label>
                <Input
                  value={selected.href ?? ""}
                  onChange={(e) => patchNode(selected.id, { href: e.target.value })}
                  placeholder="/kontakt eller https://..."
                  className="h-8 text-xs"
                  data-testid="node-button-href"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Stil</Label>
                <Select value={selected.variant ?? "primary"} onValueChange={(v) => patchNode(selected.id, { variant: v as PrimitiveButtonVariant })}>
                  <SelectTrigger className="h-8 text-xs" data-testid="node-button-variant">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VARIANT_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {selected.type === "svg" && (() => {
            const selectedAsset = selected.svgAssetId ? svgAssets?.[selected.svgAssetId] : undefined;
            const baseMarkup = selected.svg ?? selectedAsset?.svg ?? "";
            const previewMarkup = selectedAsset
              ? sanitizeSvg(
                  applySvgAssetColors(
                    selectedAsset.svg,
                    selectedAsset.colorSlots ?? undefined,
                    selected.svgColors,
                    svgTokens
                  )
                )
              : sanitizeSvg(selected.svg ?? "");
            const assetList = Object.values(svgAssets ?? {});
            return (
              <>
                <div className="space-y-1">
                  <Label className="text-xs">SVG-kode</Label>
                  <textarea
                    className="w-full min-h-[100px] p-2 text-xs font-mono border rounded-md resize-y bg-background"
                    value={svgDraft ?? baseMarkup}
                    onChange={(e) => setSvgDraft(e.target.value)}
                    placeholder='<svg viewBox="0 0 24 24">...</svg>'
                    data-testid="node-svg-code"
                  />
                  {svgError && <p className="text-xs text-destructive" data-testid="svg-error">{svgError}</p>}
                  {svgNotice && <p className="text-xs text-amber-600" data-testid="svg-notice">{svgNotice}</p>}
                  <Button size="sm" variant="outline" className="w-full" onClick={applySvg} disabled={svgDraft === null || savingSvg} data-testid="node-svg-apply">
                    {savingSvg ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    {savingSvg ? "Gemmer…" : "Anvend SVG"}
                  </Button>
                </div>
                {previewMarkup && !svgDraft && (
                  <div
                    className="border rounded-md p-3 bg-muted/30 flex items-center justify-center [&_svg]:max-h-16 [&_svg]:max-w-full"
                    dangerouslySetInnerHTML={{ __html: previewMarkup }}
                  />
                )}
                {selectedAsset?.colorSlots?.length ? (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Farver i grafikken</Label>
                    {selectedAsset.colorSlots.map((slot) => {
                      const override = selected.svgColors?.[slot.id] ?? "";
                      const isToken = isSvgColorTokenRef(override);
                      const effectiveColor = isToken
                        ? svgTokens[override.trim().slice(1, -1)] ?? slot.original
                        : override || slot.original;
                      const selectValue = !override ? "__original__" : isToken ? override.trim() : "__custom__";
                      return (
                        <div key={slot.id} className="flex items-center gap-1.5">
                          <Input
                            type="color"
                            value={toColorInputValue(effectiveColor)}
                            onChange={(e) => setSvgColorOverride(slot.id, e.target.value)}
                            className="w-9 h-8 p-1 cursor-pointer shrink-0"
                            data-testid={`svg-color-${slot.id}`}
                          />
                          <Select
                            value={selectValue}
                            onValueChange={(v) => {
                              if (v === "__original__") setSvgColorOverride(slot.id, null);
                              else if (v === "__custom__") setSvgColorOverride(slot.id, toColorInputValue(effectiveColor));
                              else setSvgColorOverride(slot.id, v);
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs flex-1" data-testid={`svg-color-role-${slot.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__original__">Original ({slot.label})</SelectItem>
                              {SVG_BRAND_ROLES.map((role) => (
                                <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                              ))}
                              <SelectItem value="__custom__">Egen farve</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      );
                    })}
                    <p className="text-[11px] text-muted-foreground">
                      Vælg en brandfarve, så følger grafikken automatisk med, når farverne ændres.
                    </p>
                  </div>
                ) : null}
                {assetList.length > 0 && (
                  <div className="space-y-1">
                    <Label className="text-xs">Genbrug gemt grafik</Label>
                    <div className="grid grid-cols-4 gap-1.5 max-h-40 overflow-y-auto pr-1">
                      {assetList.map((asset) => (
                        <button
                          key={asset.id}
                          type="button"
                          title={asset.name}
                          onClick={() => {
                            patchNode(selected.id, { svgAssetId: asset.id, svg: undefined, svgColors: undefined });
                            setSvgDraft(null);
                            setSvgError(null);
                            setSvgNotice(null);
                          }}
                          className={`border rounded-md p-1.5 bg-background hover:border-primary/40 transition-colors flex items-center justify-center aspect-square [&_svg]:max-w-full [&_svg]:max-h-full ${
                            selected.svgAssetId === asset.id ? "ring-2 ring-primary border-primary" : ""
                          }`}
                          data-testid={`svg-asset-${asset.id}`}
                          dangerouslySetInnerHTML={{ __html: sanitizeSvg(asset.svg) || "" }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            );
          })()}

          {selected.type === "box" && (
            <p className="text-[11px] text-muted-foreground">
              Brug felterne nedenfor til at styre layout, farver og afstand — pr. enhed.
            </p>
          )}

          <Separator />

          {/* Per-device styles */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Stilarter</h4>
              <div className="flex border rounded-md overflow-hidden">
                {([
                  { key: "styles" as DeviceKey, icon: Monitor, label: "Desktop" },
                  { key: "tabletStyles" as DeviceKey, icon: Tablet, label: "Tablet" },
                  { key: "mobileStyles" as DeviceKey, icon: Smartphone, label: "Mobil" },
                  { key: "hoverStyles" as DeviceKey, icon: MousePointerClick, label: "Hover" },
                ]).map(({ key, icon: Icon, label }) => (
                  <button
                    key={key}
                    type="button"
                    className={`p-1.5 transition-colors ${deviceTab === key ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
                    onClick={() => setDeviceTab(key)}
                    title={label}
                    data-testid={`device-tab-${key}`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>
            </div>
            {deviceTab !== "styles" && (
              <p className="text-[11px] text-muted-foreground">
                {deviceTab === "hoverStyles"
                  ? "Vises når musen holdes over elementet — udfyld kun det, der skal ændre sig."
                  : `Nedarver fra desktop — udfyld kun det, der skal ændres på ${deviceTab === "tabletStyles" ? "tablet" : "mobil"}.`}
              </p>
            )}
            <div className="space-y-3">
              {STYLE_FIELDS.map(renderStyleField)}
            </div>
          </div>

          <Separator />

          {/* Motion — controlled presets only; the canvas replays the
              entrance live whenever a value changes. */}
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Bevægelse</h4>
            <div className="space-y-2">
              {MOTION_FIELDS.filter((field) => {
                if (field.boxOnly && selected.type !== "box") return false;
                if (field.entranceOnly) {
                  const effect = (selected.motion?.effect as string | undefined) ?? "none";
                  if (effect === "none") return false;
                }
                return true;
              }).map((field) => {
                const current = ((selected.motion as Record<string, string> | undefined)?.[field.key] as string) ?? MOTION_DEFAULTS[field.key];
                return (
                  <div key={field.key} className="flex items-center gap-2">
                    <Label className="text-xs w-24 shrink-0">{field.label}</Label>
                    <Select
                      value={current}
                      onValueChange={(value) => {
                        const next = { ...(selected.motion ?? {}) } as Record<string, string>;
                        if (value === MOTION_DEFAULTS[field.key]) delete next[field.key];
                        else next[field.key] = value;
                        patchNode(selected.id, {
                          motion: Object.keys(next).length > 0 ? (next as MotionSpec) : undefined,
                        });
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs flex-1" data-testid={`node-motion-${field.key}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {field.options.map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Rolig bevægelse konverterer bedst — brug fade eller glid, og lad resten stå på standard.
            </p>
          </div>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          Vælg et element i listen ovenfor — eller klik direkte på det i preview — for at redigere indhold og stil.
        </p>
      )}
    </div>
  );
}
