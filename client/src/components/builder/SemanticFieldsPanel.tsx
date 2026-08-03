import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ChevronDown,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Plus,
  Trash2,
  Upload,
  Loader2,
  Image as ImageIcon,
} from "lucide-react";
import type { ComponentProps, ComponentStyles } from "@shared/componentRegistry";
import {
  applySemanticEdit,
  resolveSemanticTarget,
  getRepeaterItems,
  repeaterItemForNode,
  fieldBindingForNode,
  type EditableField,
  type EditableSchema,
  type RepeaterItemField,
  type SemanticEdit,
  type SemanticTarget,
  type PrimitiveNode,
  type ColorStyleKey,
  type PrimitiveStyleKey,
} from "@shared/customComponents";
import { resolveDesignTokens, isTokenRef, resolveTokenRefs, type TokenPath } from "@shared/designTokens";
import type { DesignTokens } from "@shared/schema";
import { uploadImage } from "@/lib/builderUpload";

/**
 * Schema-driven editing for custom components: the customer edits named
 * fields ("Overskrift", "Knap – link"), never raw nodes. Every change goes
 * through applySemanticEdit — the exact same path the inline canvas editor
 * uses — so the two surfaces cannot disagree about what is editable.
 */

type Props = {
  tree: PrimitiveNode;
  schema: EditableSchema;
  onUpdate: (updates: { props?: Partial<ComponentProps>; styles?: Partial<ComponentStyles> }) => void;
  websiteId: string;
  accessToken: string;
  selectedNodeId?: string | null;
  onNodeSelect?: (nodeId: string | null) => void;
  globalStyles?: DesignTokens;
  /** Offered when the selected node is not covered by any field. */
  onOpenAdvanced?: () => void;
};

const BRAND_COLOR_PATHS: { path: TokenPath; label: string }[] = [
  { path: "color.primary", label: "Primær" },
  { path: "color.secondary", label: "Sekundær" },
  { path: "color.accent", label: "Accent" },
  { path: "color.background", label: "Baggrund" },
  { path: "color.surface", label: "Flade" },
  { path: "color.text", label: "Tekst" },
];

function nodeTextValue(node: PrimitiveNode): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "button") return node.label ?? "";
  return "";
}

export default function SemanticFieldsPanel({
  tree,
  schema,
  onUpdate,
  websiteId,
  accessToken,
  selectedNodeId,
  onNodeSelect,
  globalStyles,
  onOpenAdvanced,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Record<string, number | null>>({});
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const pendingUploadTarget = useRef<SemanticTarget | null>(null);

  const resolvedTokens = useMemo(() => resolveDesignTokens(globalStyles), [globalStyles]);

  // Which field does the node selected on the canvas belong to? Highlight
  // it, and auto-expand the repeater item that contains the selection so
  // clicking "Kort 2" on the canvas opens Kort 2 here.
  const selectedBinding = useMemo(
    () => (selectedNodeId ? fieldBindingForNode(tree, schema, selectedNodeId) : null),
    [tree, schema, selectedNodeId]
  );
  const selectedItemHit = useMemo(
    () => (selectedNodeId ? repeaterItemForNode(tree, schema, selectedNodeId) : null),
    [tree, schema, selectedNodeId]
  );
  useEffect(() => {
    if (selectedItemHit) {
      setExpandedItems((prev) =>
        prev[selectedItemHit.field.key] === selectedItemHit.itemIndex
          ? prev
          : { ...prev, [selectedItemHit.field.key]: selectedItemHit.itemIndex }
      );
    }
  }, [selectedItemHit]);

  const apply = (edit: SemanticEdit) => {
    const result = applySemanticEdit(tree, schema, edit);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    onUpdate({ props: { customTree: result.tree } });
    if (result.selectNodeId && (edit.kind === "add-item" || edit.kind === "remove-item" || edit.kind === "move-item")) {
      onNodeSelect?.(result.selectNodeId);
    }
  };

  const resolveNode = (target: SemanticTarget): PrimitiveNode | null => {
    const result = resolveSemanticTarget(tree, schema, target);
    return result.ok ? result.resolved.node : null;
  };

  const handleUploadClick = (target: SemanticTarget, key: string) => {
    pendingUploadTarget.current = target;
    setUploadingKey(key);
    fileRef.current?.click();
  };

  const handleFileChosen = async (file: File | undefined) => {
    const target = pendingUploadTarget.current;
    pendingUploadTarget.current = null;
    if (!file || !target) {
      setUploadingKey(null);
      return;
    }
    try {
      const { url, mediaId } = await uploadImage(websiteId, accessToken, file);
      apply({ kind: "set-image", target, src: url, mediaId });
    } catch {
      setError("Billedet kunne ikke uploades. Prøv igen.");
    } finally {
      setUploadingKey(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const isFieldHighlighted = (fieldKey: string): boolean =>
    selectedBinding?.target.fieldKey === fieldKey || selectedItemHit?.field.key === fieldKey;

  // ---- shared input renderers (top-level and repeater items) ----

  const renderTextInput = (
    target: SemanticTarget,
    label: string,
    testId: string,
    highlighted: boolean
  ) => {
    const node = resolveNode(target);
    if (!node) return null;
    const value = nodeTextValue(node);
    const multiline = node.type === "text" && (node.tag === "p" || node.tag === "blockquote" || value.length > 80);
    return (
      <div key={testId} className={`space-y-1 rounded-md ${highlighted ? "ring-1 ring-primary/60 p-1 -m-1" : ""}`}>
        <Label className="text-xs">{label}</Label>
        {multiline ? (
          <textarea
            className="w-full min-h-[64px] p-2 text-xs border rounded-md resize-y bg-background"
            value={value}
            onChange={(e) => apply({ kind: "set-text", target, value: e.target.value })}
            onFocus={() => onNodeSelect?.(node.id)}
            data-testid={testId}
          />
        ) : (
          <Input
            value={value}
            onChange={(e) => apply({ kind: "set-text", target, value: e.target.value })}
            onFocus={() => onNodeSelect?.(node.id)}
            className="h-8 text-xs"
            data-testid={testId}
          />
        )}
      </div>
    );
  };

  const renderLinkInput = (target: SemanticTarget, label: string, testId: string, highlighted: boolean) => {
    const node = resolveNode(target);
    if (!node) return null;
    return (
      <div key={testId} className={`space-y-1 rounded-md ${highlighted ? "ring-1 ring-primary/60 p-1 -m-1" : ""}`}>
        <Label className="text-xs">{label}</Label>
        <Input
          value={node.href ?? ""}
          onChange={(e) => apply({ kind: "set-link", target, href: e.target.value })}
          onFocus={() => onNodeSelect?.(node.id)}
          placeholder="/kontakt eller https://..."
          className="h-8 text-xs"
          data-testid={testId}
        />
      </div>
    );
  };

  const renderImageInput = (target: SemanticTarget, label: string, testId: string, highlighted: boolean) => {
    const node = resolveNode(target);
    if (!node) return null;
    const uploading = uploadingKey === testId;
    return (
      <div key={testId} className={`space-y-1 rounded-md ${highlighted ? "ring-1 ring-primary/60 p-1 -m-1" : ""}`}>
        <Label className="text-xs">{label}</Label>
        <div className="flex items-center gap-2">
          {node.src ? (
            <img src={node.src} alt={node.alt ?? ""} className="w-12 h-12 rounded-md object-cover border shrink-0" />
          ) : (
            <div className="w-12 h-12 rounded-md border border-dashed flex items-center justify-center text-muted-foreground shrink-0">
              <ImageIcon className="w-4 h-4" />
            </div>
          )}
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            disabled={uploading}
            onClick={() => {
              onNodeSelect?.(node.id);
              handleUploadClick(target, testId);
            }}
            data-testid={`${testId}-upload`}
          >
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {node.src ? "Skift billede" : "Vælg billede"}
          </Button>
        </div>
        <Input
          value={node.alt ?? ""}
          onChange={(e) => apply({ kind: "set-image", target, src: node.src ?? "", alt: e.target.value })}
          placeholder="Alt-tekst (beskriv billedet)"
          className="h-8 text-xs"
          data-testid={`${testId}-alt`}
        />
      </div>
    );
  };

  const renderColorInput = (
    target: SemanticTarget,
    label: string,
    styleKey: ColorStyleKey,
    testId: string,
    highlighted: boolean
  ) => {
    const node = resolveNode(target);
    if (!node) return null;
    const raw = node.styles?.[styleKey] ?? "";
    const displayed = isTokenRef(raw) ? resolveTokenRefs(raw, resolvedTokens) : raw;
    return (
      <div key={testId} className={`space-y-1 rounded-md ${highlighted ? "ring-1 ring-primary/60 p-1 -m-1" : ""}`}>
        <div className="flex items-center justify-between">
          <Label className="text-xs">{label}</Label>
          {isTokenRef(raw) && (
            <span className="text-[10px] font-medium text-primary bg-primary/10 rounded px-1.5 py-0.5">Brand</span>
          )}
        </div>
        <div className="flex gap-1 flex-wrap">
          {BRAND_COLOR_PATHS.map(({ path, label: swatchLabel }) => {
            const hex = resolvedTokens[path];
            if (!hex) return null;
            const ref = `{${path}}`;
            return (
              <button
                key={path}
                type="button"
                title={swatchLabel}
                className={`w-6 h-6 rounded-md border ${raw === ref ? "ring-2 ring-primary ring-offset-1" : ""}`}
                style={{ backgroundColor: hex }}
                onClick={() => apply({ kind: "set-color", target, value: ref })}
                data-testid={`${testId}-token-${path}`}
              />
            );
          })}
        </div>
        <div className="flex gap-1">
          <Input
            type="color"
            value={/^#[0-9a-fA-F]{6}$/.test(displayed) ? displayed : "#ffffff"}
            onChange={(e) => apply({ kind: "set-color", target, value: e.target.value })}
            className="w-9 h-8 p-1 cursor-pointer"
            data-testid={`${testId}-picker`}
          />
          <Input
            value={raw}
            onChange={(e) => apply({ kind: "set-color", target, value: e.target.value })}
            placeholder="#f4f4f4 eller tom for standard"
            className="flex-1 h-8 text-xs"
            data-testid={testId}
          />
        </div>
      </div>
    );
  };

  const renderStyleGroup = (field: Extract<EditableField, { type: "styleGroup" }>, highlighted: boolean) => {
    const target: SemanticTarget = { fieldKey: field.key };
    const node = resolveNode(target);
    if (!node) return null;
    return (
      <div key={field.key} className={`space-y-2 rounded-md ${highlighted ? "ring-1 ring-primary/60 p-1 -m-1" : ""}`}>
        <Label className="text-xs">{field.label}</Label>
        {field.keys.map((styleKey: PrimitiveStyleKey) => {
          const value = node.styles?.[styleKey] ?? "";
          const isColor = /color/i.test(styleKey);
          return (
            <div key={styleKey} className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground w-24 shrink-0 truncate">{styleKey}</span>
              {isColor && (
                <Input
                  type="color"
                  value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#ffffff"}
                  onChange={(e) => apply({ kind: "set-style", target, styleKey, value: e.target.value })}
                  className="w-9 h-8 p-1 cursor-pointer"
                />
              )}
              <Input
                value={value}
                onChange={(e) => apply({ kind: "set-style", target, styleKey, value: e.target.value })}
                placeholder="Nedarvet"
                className="flex-1 h-8 text-xs"
                data-testid={`semantic-style-${field.key}-${styleKey}`}
              />
            </div>
          );
        })}
      </div>
    );
  };

  const renderItemField = (repeaterKey: string, itemIndex: number, itemField: RepeaterItemField) => {
    const target: SemanticTarget = { fieldKey: repeaterKey, itemIndex, itemFieldKey: itemField.key };
    const testId = `semantic-item-${repeaterKey}-${itemIndex}-${itemField.key}`;
    switch (itemField.type) {
      case "text":
        return renderTextInput(target, itemField.label, testId, false);
      case "link":
        return renderLinkInput(target, itemField.label, testId, false);
      case "image":
        return renderImageInput(target, itemField.label, testId, false);
      case "color":
        return renderColorInput(target, itemField.label, itemField.styleKey ?? "color", testId, false);
    }
  };

  const renderRepeater = (field: Extract<EditableField, { type: "repeater" }>) => {
    const items = getRepeaterItems(tree, field);
    const expanded = expandedItems[field.key] ?? null;
    const itemLabel = field.itemLabel || "Element";
    const highlighted = isFieldHighlighted(field.key);
    return (
      <div key={field.key} className={`space-y-2 rounded-md ${highlighted ? "ring-1 ring-primary/60 p-1 -m-1" : ""}`}>
        <Label className="text-xs">{field.label}</Label>
        <div className="space-y-1.5">
          {items.map((item, index) => {
            const isOpen = expanded === index;
            const isItemSelected = selectedItemHit?.field.key === field.key && selectedItemHit.itemIndex === index;
            return (
              <div
                key={item.id}
                className={`border rounded-md bg-muted/40 ${isItemSelected ? "border-primary/60" : ""}`}
              >
                <div className="flex items-center gap-1 pr-1">
                  <button
                    type="button"
                    className="flex-1 flex items-center gap-1.5 py-1.5 pl-2 text-left"
                    onClick={() => {
                      setExpandedItems((prev) => ({ ...prev, [field.key]: isOpen ? null : index }));
                      onNodeSelect?.(item.id);
                    }}
                    data-testid={`semantic-rep-${field.key}-item-${index}`}
                  >
                    {isOpen ? (
                      <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                    <span className="text-xs font-medium">
                      {itemLabel} {index + 1}
                    </span>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    disabled={index === 0}
                    onClick={() => apply({ kind: "move-item", fieldKey: field.key, itemIndex: index, direction: "up" })}
                    data-testid={`semantic-rep-${field.key}-up-${index}`}
                  >
                    <ArrowUp className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    disabled={index === items.length - 1}
                    onClick={() => apply({ kind: "move-item", fieldKey: field.key, itemIndex: index, direction: "down" })}
                    data-testid={`semantic-rep-${field.key}-down-${index}`}
                  >
                    <ArrowDown className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive"
                    disabled={items.length <= 1}
                    onClick={() => apply({ kind: "remove-item", fieldKey: field.key, itemIndex: index })}
                    data-testid={`semantic-rep-${field.key}-remove-${index}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                {isOpen && (
                  <div className="px-2 pb-2 space-y-2">
                    {field.itemFields.map((itemField) => (
                      <div key={itemField.key}>{renderItemField(field.key, index, itemField)}</div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={() => {
            apply({ kind: "add-item", fieldKey: field.key });
            setExpandedItems((prev) => ({ ...prev, [field.key]: items.length }));
          }}
          data-testid={`semantic-rep-${field.key}-add`}
        >
          <Plus className="w-3.5 h-3.5" />
          Tilføj {itemLabel.toLowerCase()}
        </Button>
      </div>
    );
  };

  const renderField = (field: EditableField) => {
    const highlighted = isFieldHighlighted(field.key);
    switch (field.type) {
      case "text":
        return renderTextInput({ fieldKey: field.key }, field.label, `semantic-field-${field.key}`, highlighted);
      case "link":
        return renderLinkInput({ fieldKey: field.key }, field.label, `semantic-field-${field.key}`, highlighted);
      case "image":
        return renderImageInput({ fieldKey: field.key }, field.label, `semantic-field-${field.key}`, highlighted);
      case "color":
        return renderColorInput({ fieldKey: field.key }, field.label, field.styleKey, `semantic-field-${field.key}`, highlighted);
      case "styleGroup":
        return renderStyleGroup(field, highlighted);
      case "repeater":
        return renderRepeater(field);
    }
  };

  const selectionOutsideSchema = Boolean(selectedNodeId && !selectedBinding && !selectedItemHit && selectedNodeId !== tree.id);

  return (
    <div className="space-y-4" data-testid="semantic-fields-panel">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFileChosen(e.target.files?.[0])}
      />
      {error && (
        <p className="text-xs text-destructive" data-testid="semantic-error">
          {error}
        </p>
      )}
      {selectionOutsideSchema && onOpenAdvanced && (
        <div className="text-[11px] text-muted-foreground border rounded-md p-2 space-y-1.5">
          <p>Det valgte element er ikke et af komponentens felter.</p>
          <Button size="sm" variant="outline" className="w-full h-7" onClick={onOpenAdvanced} data-testid="semantic-open-advanced">
            Redigér frit
          </Button>
        </div>
      )}
      {schema.fields.map((field) => (
        <div key={field.key}>{renderField(field)}</div>
      ))}
    </div>
  );
}
