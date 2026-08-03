import { useEffect, useRef, useState, type ReactElement } from "react";
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
  type PrimitiveNode,
  type PrimitiveNodeType,
  type PrimitiveStyleKey,
  type PrimitiveButtonVariant,
  type PrimitiveTextTag,
} from "@shared/customComponents";
import { sanitizeSvg } from "@shared/svgSanitizer";
import { uploadImage } from "@/lib/builderUpload";

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
}: Props) {
  const tree = component.props.customTree;
  const [deviceTab, setDeviceTab] = useState<DeviceKey>("styles");
  const [svgDraft, setSvgDraft] = useState<string | null>(null);
  const [svgError, setSvgError] = useState<string | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setSvgDraft(null);
    setSvgError(null);
    setEditorError(null);
  }, [selectedNodeId]);

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

  const addChild = (type: PrimitiveNodeType) => {
    if (nodeCount >= MAX_CUSTOM_TREE_NODES) {
      setEditorError(`Komponenten kan højst indeholde ${MAX_CUSTOM_TREE_NODES} elementer.`);
      return;
    }
    const targetId = selected && selected.type === "box" ? selected.id : parentInfo?.parent.id ?? tree.id;
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
    setTree(duplicatePrimitiveNode(tree, selected.id));
  };

  const handleDelete = () => {
    if (!selected || isRootSelected) return;
    setTree(removePrimitiveNode(tree, selected.id));
    onNodeSelect?.(null);
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

  const applySvg = () => {
    if (!selected) return;
    const raw = svgDraft ?? selected.svg ?? "";
    const safe = sanitizeSvg(raw);
    if (!safe) {
      setSvgError("SVG-koden kunne ikke godkendes. Brug simpel SVG uden scripts eller eksterne links.");
      return;
    }
    patchNode(selected.id, { svg: safe });
    setSvgDraft(null);
    setSvgError(null);
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
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={isRootSelected} onClick={() => setTree(movePrimitiveNode(tree, selected.id, "up"))} title="Flyt op" data-testid="node-move-up">
              <ChevronUp className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={isRootSelected} onClick={() => setTree(movePrimitiveNode(tree, selected.id, "down"))} title="Flyt ned" data-testid="node-move-down">
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

          {selected.type === "svg" && (
            <>
              <div className="space-y-1">
                <Label className="text-xs">SVG-kode</Label>
                <textarea
                  className="w-full min-h-[100px] p-2 text-xs font-mono border rounded-md resize-y bg-background"
                  value={svgDraft ?? selected.svg ?? ""}
                  onChange={(e) => setSvgDraft(e.target.value)}
                  placeholder='<svg viewBox="0 0 24 24">...</svg>'
                  data-testid="node-svg-code"
                />
                {svgError && <p className="text-xs text-destructive">{svgError}</p>}
                <Button size="sm" variant="outline" className="w-full" onClick={applySvg} disabled={svgDraft === null} data-testid="node-svg-apply">
                  Anvend SVG
                </Button>
              </div>
              {selected.svg && !svgDraft && (
                <div
                  className="border rounded-md p-3 bg-muted/30 flex items-center justify-center [&_svg]:max-h-16 [&_svg]:max-w-full"
                  dangerouslySetInnerHTML={{ __html: sanitizeSvg(selected.svg) || "" }}
                />
              )}
            </>
          )}

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
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          Vælg et element i listen ovenfor — eller klik direkte på det i preview — for at redigere indhold og stil.
        </p>
      )}
    </div>
  );
}
