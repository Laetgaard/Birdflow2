import { useRef, useEffect, useCallback, useMemo, useState } from "react";
import type React from "react";
import { Check, ImageIcon } from "lucide-react";
import type { BuilderComponentData, ComponentStyles } from "@shared/componentRegistry";
import {
  resolvePrimitiveStyles,
  sanitizeLinkHref,
  PRIMITIVE_TEXT_TAGS,
  effectiveEditableSchema,
  fieldBindingForNode,
  CAPABILITY_LABELS,
  CAPABILITY_ICONS,
  BEHAVIOR_LABELS,
  type PrimitiveNode,
  type CapabilityType,
  type BehaviorType,
} from "@shared/customComponents";
import { sanitizeSvg } from "@shared/svgSanitizer";
import { TOKEN_FALLBACKS, readableTextOn, resolveDesignTokens } from "@shared/designTokens";
import { applySvgAssetColors, type SvgAssetLike } from "@shared/svgAssets";
import { MOTION_TABLES, computeMotion, staggerChildSpec, type MotionSpec } from "@shared/motion";
import { useMotionPhase } from "./useMotionPhase";

type DeviceMode = "desktop" | "tablet" | "mobile";

type GlobalStylesLike = {
  primaryColor?: string;
  secondaryColor?: string;
  backgroundColor?: string;
  fontFamily?: string;
  textColor?: string;
  fontPair?: { heading: string; body: string };
  borderRadius?: string;
};

type Props = {
  component: BuilderComponentData;
  isSelected?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  isPreview?: boolean;
  deviceMode?: DeviceMode;
  selectedNodeId?: string | null;
  onNodeSelect?: (nodeId: string | null) => void;
  onTextChange?: (field: string, value: string) => void;
  editingField?: string | null;
  onEditField?: (field: string | null) => void;
  globalStyles?: GlobalStylesLike;
  /** Stored illustrations by id — svg nodes with svgAssetId resolve here. */
  svgAssets?: Record<string, SvgAssetLike>;
};

/** Ensure inline SVG scales to its wrapper node. */
function fitSvg(svg: string): string {
  const rootMatch = svg.match(/^<svg\b[^>]*>/i);
  if (!rootMatch) return svg;
  if (/style="/i.test(rootMatch[0])) {
    return svg.replace(
      /^(<svg\b[^>]*?)style="([^"]*)"/i,
      '$1style="$2;width:100%;height:100%;display:block"'
    );
  }
  return svg.replace(/^<svg\b/i, '<svg style="width:100%;height:100%;display:block"');
}

function buttonVariantStyles(
  variant: PrimitiveNode["variant"],
  globalStyles?: GlobalStylesLike
): React.CSSProperties {
  const primary = globalStyles?.primaryColor || TOKEN_FALLBACKS.primaryColor;
  const secondary = globalStyles?.secondaryColor || TOKEN_FALLBACKS.secondaryColor;
  const radius = globalStyles?.borderRadius || TOKEN_FALLBACKS.borderRadius;
  // The label colour follows the button colour rather than being white for
  // ever: a pale brand colour with white text on it is unreadable, and it is
  // the customer's brand that decides, not this file. Same rule (the same
  // shared function) on the published site.
  const onPrimary = readableTextOn(primary);
  const onSecondary = readableTextOn(secondary);
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    padding: "12px 24px",
    borderRadius: radius,
    fontWeight: 600,
    fontSize: "15px",
    lineHeight: 1.2,
    textDecoration: "none",
    border: "2px solid transparent",
    cursor: "pointer",
    transition: "opacity 0.15s ease, transform 0.15s ease",
  };
  switch (variant) {
    case "secondary":
      return { ...base, backgroundColor: secondary, color: onSecondary };
    case "outline":
      return { ...base, backgroundColor: "transparent", color: primary, borderColor: primary };
    case "ghost":
      return { ...base, backgroundColor: "transparent", color: primary };
    case "link":
      return { ...base, backgroundColor: "transparent", color: primary, padding: "0", textDecoration: "underline" };
    case "primary":
    default:
      return { ...base, backgroundColor: primary, color: onPrimary };
  }
}

type NodeEditableTextProps = {
  value: string;
  field: string;
  isEditing: boolean;
  onEdit?: (field: string | null) => void;
  onChange?: (field: string, value: string) => void;
  style: React.CSSProperties;
  tag: PrimitiveNode["tag"];
  isPreview?: boolean;
};

function NodeEditableText({ value, field, isEditing, onEdit, onChange, style, tag, isPreview }: NodeEditableTextProps) {
  const ref = useRef<HTMLElement>(null);
  const originalRef = useRef(value);

  useEffect(() => {
    if (isEditing) {
      originalRef.current = value;
      // Focus and place caret at the end
      requestAnimationFrame(() => {
        const el = ref.current;
        if (!el) return;
        el.focus();
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        selection?.removeAllRanges();
        selection?.addRange(range);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  const commit = useCallback(() => {
    const el = ref.current;
    if (el) {
      const next = el.innerText;
      if (next !== originalRef.current) {
        onChange?.(field, next);
      }
    }
    onEdit?.(null);
  }, [field, onChange, onEdit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        commit();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        if (ref.current) ref.current.innerText = originalRef.current;
        onEdit?.(null);
      }
    },
    [commit, onEdit]
  );

  const safeTag = tag && (PRIMITIVE_TEXT_TAGS as readonly string[]).includes(tag) ? tag : "p";
  const Tag = safeTag as any;

  return (
    <Tag
      ref={ref as any}
      data-editable-field={field}
      style={{ margin: 0, ...style, ...(isEditing ? { outline: "2px solid #6366f1", outlineOffset: "2px", borderRadius: "2px", cursor: "text" } : {}) }}
      contentEditable={isEditing}
      suppressContentEditableWarning
      onBlur={isEditing ? commit : undefined}
      onKeyDown={isEditing ? handleKeyDown : undefined}
      onDoubleClick={
        !isPreview && onEdit
          ? (e: React.MouseEvent) => {
              e.stopPropagation();
              onEdit(field);
            }
          : undefined
      }
    >
      {value}
    </Tag>
  );
}

type NodeRendererProps = {
  node: PrimitiveNode;
  isPreview?: boolean;
  deviceMode?: DeviceMode;
  selectedNodeId?: string | null;
  onNodeSelect?: (nodeId: string | null) => void;
  onTextChange?: (field: string, value: string) => void;
  editingField?: string | null;
  onEditField?: (field: string | null) => void;
  globalStyles?: GlobalStylesLike;
  /**
   * When present (component has a STORED editable schema), inline editing is
   * limited to nodes bound to a text field — the same contract the panel
   * enforces. Absent for legacy components: everything stays editable.
   */
  canInlineEdit?: (nodeId: string) => boolean;
  svgAssets?: Record<string, SvgAssetLike>;
  /** Resolved design tokens for {color.*} refs in svg colour overrides. */
  svgTokens?: Record<string, string>;
  depth: number;
  /**
   * Set when the parent box staggers its children: the parent's motion spec
   * plus this node's position among its siblings. A child with its own
   * entrance opts out (staggerChildSpec returns null for it).
   */
  staggerParent?: { spec: MotionSpec; index: number };
};

function SafeCapabilityPreview({
  label,
  isPreview,
  onClick,
  dataAttrs,
  selectionStyles,
}: {
  label: string;
  isPreview?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  dataAttrs: Record<string, unknown>;
  selectionStyles: React.CSSProperties;
}) {
  const [complete, setComplete] = useState(false);
  return (
    <div
      {...dataAttrs}
      onClick={onClick}
      style={{
        minHeight: "112px",
        padding: "16px",
        backgroundColor: "#eff6ff",
        border: "2px dashed #60a5fa",
        borderRadius: "12px",
        color: "#1e3a8a",
        ...selectionStyles,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
        <strong style={{ fontSize: "13px" }}>{label}</strong>
        <span style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "999px", background: "#dbeafe" }}>
          Kun editor
        </span>
      </div>
      <p style={{ margin: "8px 0", fontSize: "11px", color: "#3b82f6" }}>
        Sikker prøvevisning med eksempeldata. Intet gemmes eller sendes.
      </p>
      {!isPreview && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setComplete(true);
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            border: "1px solid #93c5fd",
            borderRadius: "6px",
            background: "#fff",
            color: "#1d4ed8",
            padding: "6px 10px",
            fontSize: "11px",
            cursor: "pointer",
          }}
        >
          {complete && <Check style={{ width: 12, height: 12 }} />}
          {complete ? "Prøvehandling gennemført" : "Prøv widget"}
        </button>
      )}
    </div>
  );
}

function NodeRenderer({
  node,
  isPreview,
  deviceMode,
  selectedNodeId,
  onNodeSelect,
  onTextChange,
  editingField,
  onEditField,
  globalStyles,
  canInlineEdit,
  svgAssets,
  svgTokens,
  depth,
  staggerParent,
}: NodeRendererProps) {
  // Hover is a real style layer, not an editor nicety: the published site
  // emits the same declarations as a `:hover` rule, so what the customer
  // sees here is what visitors get. A hover PRESET from the motion
  // vocabulary counts too — resolvePrimitiveStyles merges it in.
  const [isHovered, setIsHovered] = useState(false);
  const hasHover =
    (!!node.hoverStyles && Object.keys(node.hoverStyles).length > 0) ||
    !!(node.motion?.hover && node.motion.hover !== "none");
  const resolved = resolvePrimitiveStyles(node, deviceMode, hasHover && isHovered) as React.CSSProperties;

  // Entrance motion — same shared model as the published site. A box with
  // `stagger` set does not hide itself: its children inherit its entrance,
  // one after another, via staggerParent.
  const ownMotion = node.motion;
  const hasOwnEntrance = !!ownMotion?.effect && ownMotion.effect !== "none";
  const staggerStepMs =
    node.type === "box" && ownMotion?.stagger ? MOTION_TABLES.staggers[ownMotion.stagger] ?? 0 : 0;
  const isStaggerBox = staggerStepMs > 0;
  const inheritedSpec =
    !hasOwnEntrance && staggerParent ? staggerChildSpec(staggerParent.spec, ownMotion) : null;
  const entranceSpec = isStaggerBox ? null : hasOwnEntrance ? ownMotion : inheritedSpec;
  const entranceResolved = computeMotion(
    MOTION_TABLES,
    entranceSpec,
    inheritedSpec && staggerParent ? staggerParent.index : undefined
  );
  // Changing any motion property replays the entrance — the live preview
  // while editing in the panel.
  const motion = useMotionPhase(entranceResolved, JSON.stringify(ownMotion ?? null));
  const motionProps = motion.active ? { ref: motion.ref, "data-motion": "" } : {};
  const motionStyle = motion.active ? motion.style : {};
  const hoverHandlers = hasHover
    ? {
        onMouseEnter: () => setIsHovered(true),
        onMouseLeave: () => setIsHovered(false),
      }
    : {};
  const isNodeSelected = !isPreview && selectedNodeId === node.id;

  const selectionStyles: React.CSSProperties = isNodeSelected
    ? { outline: "2px solid #6366f1", outlineOffset: "-1px" }
    : {};

  const handleNodeClick =
    !isPreview && onNodeSelect
      ? (e: React.MouseEvent) => {
          e.stopPropagation();
          onNodeSelect(node.id);
        }
      : undefined;

  const dataAttrs = {
    "data-node-id": node.id,
    "data-node-type": node.type,
    ...hoverHandlers,
  };

  switch (node.type) {
    case "box": {
      const style: React.CSSProperties = {
        display: "flex",
        flexDirection: "column",
        ...resolved,
        ...selectionStyles,
        ...motionStyle,
      };
      return (
        <div {...dataAttrs} {...motionProps} style={style} onClick={handleNodeClick}>
          {/* Behavior badge — editor-only indicator showing the interaction type */}
          {!isPreview && node.behavior && (
            <div
              style={{
                alignSelf: "flex-start",
                backgroundColor: "#7c3aed",
                color: "#fff",
                fontSize: "10px",
                fontWeight: 700,
                padding: "2px 6px",
                borderRadius: "4px",
                marginBottom: "4px",
                lineHeight: "16px",
                pointerEvents: "none",
                letterSpacing: "0.03em",
                flexShrink: 0,
              }}
            >
              {BEHAVIOR_LABELS[(node.behavior as { type: BehaviorType }).type] || (node.behavior as { type: string }).type}
            </div>
          )}
          {(node.children ?? []).map((child, childIndex) => (
            <NodeRenderer
              key={child.id}
              node={child}
              isPreview={isPreview}
              deviceMode={deviceMode}
              selectedNodeId={selectedNodeId}
              onNodeSelect={onNodeSelect}
              onTextChange={onTextChange}
              editingField={editingField}
              onEditField={onEditField}
              globalStyles={globalStyles}
              canInlineEdit={canInlineEdit}
              svgAssets={svgAssets}
              svgTokens={svgTokens}
              depth={depth + 1}
              staggerParent={
                isStaggerBox && ownMotion ? { spec: ownMotion, index: childIndex } : undefined
              }
            />
          ))}
          {!isPreview && (node.children ?? []).length === 0 && (
            <div
              style={{
                padding: "16px",
                border: "1px dashed #cbd5e1",
                borderRadius: "8px",
                color: "#94a3b8",
                fontSize: "13px",
                textAlign: "center",
              }}
            >
              Tom boks — tilføj elementer i panelet
            </div>
          )}
        </div>
      );
    }

    case "text": {
      const isHeading = node.tag && ["h1", "h2", "h3", "h4"].includes(node.tag);
      // Use the token-resolved stacks ('Lato, sans-serif', 'Playfair Display, serif')
      // rather than raw fontPair strings ('Lato', 'Playfair Display') so the builder
      // preview matches the published site and the font-pairing parity tests hold.
      // svgTokens is optional when NodeRenderer is called without a token map.
      const fontFamily =
        resolved.fontFamily ||
        (isHeading
          ? (svgTokens?.['font.heading'] as string | undefined)
          : (svgTokens?.['font.body'] as string | undefined)) ||
        undefined;
      const field = `node:${node.id}:text`;
      const inlineEditable = !canInlineEdit || canInlineEdit(node.id);
      return (
        <div {...dataAttrs} {...motionProps} style={{ ...selectionStyles, ...motionStyle }} onClick={handleNodeClick}>
          <NodeEditableText
            value={node.text ?? ""}
            field={field}
            isEditing={editingField === field}
            onEdit={inlineEditable ? onEditField : undefined}
            onChange={onTextChange}
            style={{ ...resolved, fontFamily }}
            tag={node.tag || "p"}
            isPreview={isPreview}
          />
        </div>
      );
    }

    case "image": {
      const style: React.CSSProperties = {
        display: "block",
        maxWidth: "100%",
        ...resolved,
        ...selectionStyles,
        ...motionStyle,
      };
      if (!node.src) {
        if (isPreview) return null;
        return (
          <div
            {...dataAttrs}
            onClick={handleNodeClick}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              minHeight: "120px",
              backgroundColor: "#f1f5f9",
              border: "1px dashed #cbd5e1",
              color: "#94a3b8",
              fontSize: "13px",
              ...resolved,
              ...selectionStyles,
            }}
          >
            <ImageIcon style={{ width: 24, height: 24 }} />
            <span>Vælg billede i panelet</span>
          </div>
        );
      }
      return <img {...dataAttrs} {...motionProps} src={node.src} alt={node.alt ?? ""} style={style} onClick={handleNodeClick} />;
    }

    case "button": {
      const field = `node:${node.id}:label`;
      const style: React.CSSProperties = {
        ...buttonVariantStyles(node.variant, globalStyles),
        ...resolved,
        ...selectionStyles,
      };
      const isEditing = editingField === field;
      if (isEditing) {
        return (
          <span {...dataAttrs} style={style} onClick={handleNodeClick}>
            <NodeEditableText
              value={node.label ?? ""}
              field={field}
              isEditing
              onEdit={onEditField}
              onChange={onTextChange}
              style={{ color: "inherit", fontWeight: "inherit" as any, fontSize: "inherit" }}
              tag="span"
              isPreview={isPreview}
            />
          </span>
        );
      }
      if (isPreview) {
        return (
          <a {...dataAttrs} {...motionProps} href={sanitizeLinkHref(node.href)} style={{ ...style, ...motionStyle }}>
            {node.label ?? ""}
          </a>
        );
      }
      const inlineEditable = !canInlineEdit || canInlineEdit(node.id);
      return (
        <span
          {...dataAttrs}
          {...motionProps}
          style={{ ...style, ...motionStyle }}
          onClick={handleNodeClick}
          onDoubleClick={
            onEditField && inlineEditable
              ? (e) => {
                  e.stopPropagation();
                  onEditField(field);
                }
              : undefined
          }
        >
          {node.label ?? ""}
        </span>
      );
    }

    case "svg": {
      // Asset-backed nodes resolve their reference here; legacy nodes keep
      // rendering their inline markup. A referenced asset that is not in
      // the map (store unreachable, stale id) falls back to the same
      // placeholder an empty node gets — never a broken canvas.
      const asset = node.svgAssetId && svgAssets ? svgAssets[node.svgAssetId] : undefined;
      const markup = asset
        ? applySvgAssetColors(asset.svg, asset.colorSlots ?? undefined, node.svgColors, svgTokens)
        : node.svg;
      const safe = sanitizeSvg(markup);
      const style: React.CSSProperties = {
        display: "block",
        lineHeight: 0,
        ...resolved,
        ...selectionStyles,
      };
      if (!safe) {
        if (isPreview) return null;
        return (
          <div
            {...dataAttrs}
            onClick={handleNodeClick}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: "48px",
              minHeight: "48px",
              backgroundColor: "#f1f5f9",
              border: "1px dashed #cbd5e1",
              color: "#94a3b8",
              fontSize: "12px",
              padding: "8px",
              ...resolved,
              ...selectionStyles,
            }}
          >
            SVG
          </div>
        );
      }
      return (
        <div
          {...dataAttrs}
          {...motionProps}
          style={{ ...style, ...motionStyle }}
          onClick={handleNodeClick}
          dangerouslySetInnerHTML={{ __html: fitSvg(safe) }}
        />
      );
    }

    case "capability": {
      // Capability nodes embed trusted Birdflow functionality. In the builder
      // canvas they render as a labelled placeholder — Birdflow owns the full
      // implementation; the publisher generates it. Clicking selects the node
      // so the user can reposition or wrap it.
      const capType = node.capability as CapabilityType | undefined;
      const label = (capType && CAPABILITY_LABELS[capType]) || String(capType || "Widget");
      if (isPreview) {
        const icon = (capType && CAPABILITY_ICONS[capType]) || "⚙️";
        return (
          <div
            {...dataAttrs}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              minHeight: "100px",
              padding: "20px 16px",
              backgroundColor: "#eff6ff",
              border: "2px dashed #60a5fa",
              borderRadius: "12px",
              color: "#1d4ed8",
              fontWeight: 600,
              fontSize: "14px",
              textAlign: "center",
            }}
          >
            <span style={{ fontSize: "28px", lineHeight: 1 }}>{icon}</span>
            <span>{label}</span>
            <span style={{ fontSize: "11px", color: "#3b82f6", fontWeight: 400, opacity: 0.75, marginTop: "2px" }}>
              Birdflow-widget · kun placering her
            </span>
          </div>
        );
      }
      return (
        <SafeCapabilityPreview
          label={label}
          isPreview={false}
          onClick={handleNodeClick}
          dataAttrs={dataAttrs}
          selectionStyles={selectionStyles}
        />
      );
    }

    default:
      if (isPreview) return null;
      return (
        <div
          {...dataAttrs}
          onClick={handleNodeClick}
          style={{
            minHeight: "72px",
            padding: "12px",
            border: "1px dashed #f59e0b",
            borderRadius: "8px",
            background: "#fffbeb",
            color: "#92400e",
            fontSize: "12px",
            ...selectionStyles,
          }}
        >
          Ukendt objekttype: {String((node as { type?: unknown }).type ?? "ukendt")}
        </div>
      );
  }
}

/**
 * Renders a custom component (tree of primitive nodes) on the builder
 * canvas. The same data is rendered by the published site via the
 * generated ComponentRenderer template (see server/publisher/templates.ts) —
 * keep the two in visual parity.
 */
export default function CustomComponentRenderer({
  component,
  isSelected,
  onClick,
  isPreview,
  deviceMode,
  selectedNodeId,
  onNodeSelect,
  onTextChange,
  editingField,
  onEditField,
  globalStyles,
  svgAssets,
}: Props) {
  const tree = component.props.customTree;
  const sectionStyles: ComponentStyles = component.styles || {};

  // Flat token map for {color.*} refs in svg colour overrides — same
  // resolution the publisher runs at generation time.
  const svgTokens = useMemo(
    () => resolveDesignTokens((globalStyles ?? {}) as Parameters<typeof resolveDesignTokens>[0]),
    [globalStyles]
  );

  // Only a STORED schema gates inline editing: legacy components without one
  // keep every text node editable exactly as before.
  const canInlineEdit = useMemo(() => {
    if (isPreview || !tree) return undefined;
    const effective = effectiveEditableSchema(component.props);
    if (!effective || effective.source !== "stored") return undefined;
    const cache = new Map<string, boolean>();
    return (nodeId: string) => {
      const cached = cache.get(nodeId);
      if (cached !== undefined) return cached;
      const binding = fieldBindingForNode(tree, effective.schema, nodeId);
      const editable = !!binding && (binding.itemField?.type ?? binding.field.type) === "text";
      cache.set(nodeId, editable);
      return editable;
    };
  }, [component.props, tree, isPreview]);

  // Use the token-resolved body font so paired-font sites get 'Lato, sans-serif'
  // rather than the stored fontFamily literal — the same resolution that every
  // other section runs via resolveFontFamily(styles, globalStyles) in
  // ComponentRenderer.tsx, which reads fontPair.body first.
  // svgTokens is optional when the renderer is called without a token map.
  const wrapperStyle: React.CSSProperties = {
    backgroundColor: sectionStyles.backgroundColor || "transparent",
    padding: sectionStyles.padding || "0px",
    fontFamily: (svgTokens?.['font.body'] as string | undefined) || globalStyles?.fontFamily,
    color: globalStyles?.textColor,
    position: "relative",
  };

  if (!tree) {
    return (
      <section style={wrapperStyle} onClick={onClick} data-custom-render-state="empty">
        <div
          style={{
            padding: "48px 24px",
            textAlign: "center",
            color: "#94a3b8",
            border: "1px dashed #cbd5e1",
            borderRadius: "12px",
            margin: "16px",
            fontSize: "14px",
          }}
        >
          Tom komponent — indholdet mangler
        </div>
      </section>
    );
  }

  return (
    <section
      style={wrapperStyle}
      onClick={(e) => {
        // Clicking outside a node clears node selection but keeps the
        // component selected.
        if (!isPreview && onNodeSelect && selectedNodeId) {
          onNodeSelect(null);
        }
        onClick?.(e);
      }}
    >
      <NodeRenderer
        node={tree}
        isPreview={isPreview}
        deviceMode={deviceMode}
        selectedNodeId={selectedNodeId}
        onNodeSelect={onNodeSelect}
        onTextChange={onTextChange}
        editingField={editingField}
        onEditField={onEditField}
        globalStyles={globalStyles}
        canInlineEdit={canInlineEdit}
        svgAssets={svgAssets}
        svgTokens={svgTokens}
        depth={0}
      />
    </section>
  );
}
