import { useRef, useEffect, useCallback, useState } from "react";
import type React from "react";
import { ImageIcon } from "lucide-react";
import type { BuilderComponentData, ComponentStyles } from "@shared/componentRegistry";
import {
  resolvePrimitiveStyles,
  sanitizeLinkHref,
  PRIMITIVE_TEXT_TAGS,
  type PrimitiveNode,
} from "@shared/customComponents";
import { sanitizeSvg } from "@shared/svgSanitizer";
import { TOKEN_FALLBACKS, readableTextOn } from "@shared/designTokens";

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
  depth: number;
};

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
  depth,
}: NodeRendererProps) {
  // Hover is a real style layer, not an editor nicety: the published site
  // emits the same declarations as a `:hover` rule, so what the customer
  // sees here is what visitors get.
  const [isHovered, setIsHovered] = useState(false);
  const hasHover = !!node.hoverStyles && Object.keys(node.hoverStyles).length > 0;
  const resolved = resolvePrimitiveStyles(node, deviceMode, hasHover && isHovered) as React.CSSProperties;
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
      };
      return (
        <div {...dataAttrs} style={style} onClick={handleNodeClick}>
          {(node.children ?? []).map((child) => (
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
              depth={depth + 1}
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
      const fontFamily =
        resolved.fontFamily ||
        (isHeading ? globalStyles?.fontPair?.heading : globalStyles?.fontPair?.body) ||
        undefined;
      const field = `node:${node.id}:text`;
      return (
        <div {...dataAttrs} style={{ ...selectionStyles }} onClick={handleNodeClick}>
          <NodeEditableText
            value={node.text ?? ""}
            field={field}
            isEditing={editingField === field}
            onEdit={onEditField}
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
      return <img {...dataAttrs} src={node.src} alt={node.alt ?? ""} style={style} onClick={handleNodeClick} />;
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
          <a {...dataAttrs} href={sanitizeLinkHref(node.href)} style={style}>
            {node.label ?? ""}
          </a>
        );
      }
      return (
        <span
          {...dataAttrs}
          style={style}
          onClick={handleNodeClick}
          onDoubleClick={
            onEditField
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
      const safe = sanitizeSvg(node.svg);
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
          style={style}
          onClick={handleNodeClick}
          dangerouslySetInnerHTML={{ __html: fitSvg(safe) }}
        />
      );
    }

    default:
      return null;
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
}: Props) {
  const tree = component.props.customTree;
  const sectionStyles: ComponentStyles = component.styles || {};

  const wrapperStyle: React.CSSProperties = {
    backgroundColor: sectionStyles.backgroundColor || "transparent",
    padding: sectionStyles.padding || "0px",
    fontFamily: globalStyles?.fontFamily,
    color: globalStyles?.textColor,
    position: "relative",
  };

  if (!tree) {
    return (
      <section style={wrapperStyle} onClick={onClick}>
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
        depth={0}
      />
    </section>
  );
}
