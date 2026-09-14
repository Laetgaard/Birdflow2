/**
 * The properties of one canvas element, in design pixels.
 *
 * The tree stores percent of the artboard and cqw of the root; this panel
 * speaks pixels at the artboard's design width and converts through the
 * geometry module, so what the designer types matches what the overlay's
 * badge shows. Placement and type size go to the artboard being edited
 * (desktop or mobile); content, colours and shape go to the element itself.
 */

import { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowDownToLine, ArrowUpToLine, BringToFront, Loader2, SendToBack, Upload } from 'lucide-react';
import { resolveDesignTokens, tokenRef, type TokenPath } from '@shared/designTokens';
import type { DesignTokens } from '@shared/schema';
import { uploadImage } from '@/lib/builderUpload';
import {
  applyBoxToStyles,
  artboardFrame,
  containingBox,
  cqwToPx,
  nodeBox,
  parseCqw,
  parsePercent,
  pxToCqw,
  reorderNode,
  updatePrimitiveNode,
  type CanvasDevice,
  type PrimitiveNode,
  type PrimitiveStyles,
  type ReorderOp,
} from '@shared/customComponents';

type Props = {
  /** The canvas root (the subtree this element lives in). */
  root: PrimitiveNode;
  node: PrimitiveNode;
  device: CanvasDevice;
  onChange: (nextRoot: PrimitiveNode) => void;
  globalStyles?: DesignTokens;
  websiteId: string;
  accessToken: string;
};

const COLOR_ROLES: Array<{ path: TokenPath; label: string }> = [
  { path: 'color.primary', label: 'Primær' },
  { path: 'color.secondary', label: 'Sekundær' },
  { path: 'color.accent', label: 'Accent' },
  { path: 'color.text', label: 'Tekst' },
  { path: 'color.background', label: 'Baggrund' },
  { path: 'color.surface', label: 'Flade' },
];

const WEIGHTS = ['300', '400', '500', '600', '700', '800'];

const round1 = (n: number) => Math.round(n * 10) / 10;

function bucketOf(device: CanvasDevice): 'styles' | 'mobileStyles' {
  return device === 'mobile' ? 'mobileStyles' : 'styles';
}

function effective(node: PrimitiveNode, device: CanvasDevice): PrimitiveStyles {
  return device === 'mobile' ? { ...(node.styles ?? {}), ...(node.mobileStyles ?? {}) } : (node.styles ?? {});
}

/** A colour that may be a literal or a brand role, with the brand roles as chips. */
function ColorField({ label, value, onChange, tokens, testId }: { label: string; value: string | undefined; onChange: (v: string) => void; tokens: Record<string, string>; testId: string }) {
  const isRef = typeof value === 'string' && /^\{color\.[a-zA-Z]+\}$/.test(value);
  const literal = !isRef && value && /^#[0-9a-fA-F]{6}$/.test(value) ? value : (isRef ? tokens[value!.slice(1, -1)] ?? '#000000' : '#000000');
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-1.5">
        <Input type="color" value={literal} onChange={(e) => onChange(e.target.value)} className="h-8 w-9 shrink-0 cursor-pointer p-1" data-testid={testId} />
        <div className="flex flex-wrap gap-1">
          {COLOR_ROLES.map((role) => {
            const ref = tokenRef(role.path);
            return (
              <button
                key={role.path}
                type="button"
                title={role.label}
                onClick={() => onChange(ref)}
                className={`h-5 w-5 rounded-full border ${value === ref ? 'ring-2 ring-primary ring-offset-1' : ''}`}
                style={{ background: tokens[role.path] ?? '#ccc' }}
                data-testid={`${testId}-role-${role.path.split('.')[1]}`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function NumberField({ label, value, onCommit, placeholder, step = 1, testId, suffix }: { label: string; value: number | null; onCommit: (v: number | null) => void; placeholder?: string; step?: number; testId: string; suffix?: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value === null ? '' : String(round1(value)));
  const commit = () => {
    if (draft === null) return;
    const trimmed = draft.trim();
    onCommit(trimmed === '' ? null : Number.isFinite(Number(trimmed)) ? Number(trimmed) : value);
    setDraft(null);
  };
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}{suffix ? ` (${suffix})` : ''}</Label>
      <Input
        type="number"
        step={step}
        value={shown}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') { commit(); (e.target as HTMLInputElement).blur(); } }}
        className="h-8 text-xs"
        data-testid={testId}
      />
    </div>
  );
}

export default function CanvasNodeFields({ root, node, device, onChange, globalStyles, websiteId, accessToken }: Props) {
  const tokens = useMemo(() => resolveDesignTokens(globalStyles ?? {}), [globalStyles]);
  const frame = useMemo(() => artboardFrame(root, device), [root, device]);
  const container = useMemo(() => containingBox(root, node.id, frame, device), [root, node.id, frame, device]);
  const containerFrame = container ? { width: container.w, height: container.h } : frame;
  const styles = effective(node, device);
  const box = nodeBox(node, containerFrame, device);
  const hasHeight = parsePercent(styles.height) !== null;
  const bucket = bucketOf(device);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const patch = (updater: (n: PrimitiveNode) => PrimitiveNode) => onChange(updatePrimitiveNode(root, node.id, updater));
  const setStyle = (key: keyof PrimitiveStyles, value: string | undefined, target: 'styles' | 'mobileStyles' = 'styles') =>
    patch((n) => {
      const next = { ...(n[target] ?? {}) };
      if (value === undefined || value === '') delete next[key];
      else next[key] = value;
      return { ...n, [target]: next };
    });
  const setPlacement = (partial: Partial<{ x: number; y: number; w: number; h: number | null; rotate: number }>) => {
    if (!box) return;
    const next = { x: partial.x ?? box.x, y: partial.y ?? box.y, w: Math.max(1, partial.w ?? box.w), rotate: partial.rotate ?? box.rotate };
    const h = partial.h === undefined ? (hasHeight ? box.h : undefined) : partial.h === null ? undefined : Math.max(1, partial.h);
    patch((n) => ({ ...n, [bucket]: applyBoxToStyles(n[bucket], { ...next, h }, containerFrame) }));
  };
  const fontPx = cqwToPx(styles.fontSize, frame);
  const setFontPx = (px: number | null) => setStyle('fontSize', px === null ? undefined : pxToCqw(px, frame), bucket);
  const radiusPx = cqwToPx(styles.borderRadius, frame);
  const opacity = styles.opacity !== undefined ? Math.round(Number(styles.opacity) * 100) : 100;
  const border = /^(\S+)\s+solid\s+(.+)$/.exec(styles.border ?? '');
  const borderPx = border ? cqwToPx(border[1], frame) : null;
  const borderColor = border ? border[2] : undefined;

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const { url, mediaId } = await uploadImage(websiteId, accessToken, file);
      patch((n) => ({ ...n, src: url, mediaId }));
    } catch (error) {
      console.error('Upload failed', error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3" data-testid="canvas-node-fields">
      <div className="space-y-1">
        <Label className="text-xs">Navn</Label>
        <Input value={node.name ?? ''} onChange={(e) => patch((n) => ({ ...n, name: e.target.value }))} className="h-8 text-xs" data-testid="canvas-node-name" />
      </div>

      {box && (
        <>
          <div className="grid grid-cols-4 gap-1.5">
            <NumberField label="X" value={box.x} onCommit={(v) => v !== null && setPlacement({ x: v })} testId="canvas-field-x" />
            <NumberField label="Y" value={box.y} onCommit={(v) => v !== null && setPlacement({ y: v })} testId="canvas-field-y" />
            <NumberField label="B" value={box.w} onCommit={(v) => v !== null && setPlacement({ w: v })} testId="canvas-field-w" />
            <NumberField label="H" value={hasHeight ? box.h : null} placeholder="auto" onCommit={(v) => setPlacement({ h: v })} testId="canvas-field-h" />
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <NumberField label="Rotation" suffix="°" value={box.rotate ?? 0} onCommit={(v) => setPlacement({ rotate: v ?? 0 })} testId="canvas-field-rotate" />
            <NumberField label="Synlighed" suffix="%" value={opacity} onCommit={(v) => setStyle('opacity', v === null || v >= 100 ? undefined : String(Math.max(0, Math.min(100, v)) / 100))} testId="canvas-field-opacity" />
          </div>
          {device === 'mobile' && (
            <p className="text-[11px] text-muted-foreground">Du redigerer mobil-artboardet — kun det, du ændrer her, afviger fra desktop.</p>
          )}
        </>
      )}

      <div className="flex items-center gap-1">
        <span className="flex-1 text-[11px] text-muted-foreground">Lag</span>
        {([['front', 'Forrest', ArrowUpToLine], ['forward', 'Frem', BringToFront], ['backward', 'Tilbage', SendToBack], ['back', 'Bagerst', ArrowDownToLine]] as Array<[ReorderOp, string, typeof BringToFront]>).map(([op, title, Icon]) => (
          <Button key={op} variant="ghost" size="icon" className="h-7 w-7" title={title} onClick={() => onChange(reorderNode(root, node.id, op))} data-testid={`canvas-layer-${op}`}>
            <Icon className="h-3.5 w-3.5" />
          </Button>
        ))}
      </div>

      {node.type === 'text' && (
        <>
          <div className="space-y-1">
            <Label className="text-xs">Tekst</Label>
            <textarea value={node.text ?? ''} onChange={(e) => patch((n) => ({ ...n, text: e.target.value }))} className="min-h-[72px] w-full resize-y rounded-md border bg-background p-2 text-xs" data-testid="canvas-node-text" />
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Type</Label>
              <Select value={node.tag ?? 'p'} onValueChange={(v) => patch((n) => ({ ...n, tag: v as PrimitiveNode['tag'] }))}>
                <SelectTrigger className="h-8 text-xs" data-testid="canvas-node-tag"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="h1">Overskrift 1</SelectItem><SelectItem value="h2">Overskrift 2</SelectItem><SelectItem value="h3">Overskrift 3</SelectItem><SelectItem value="h4">Overskrift 4</SelectItem>
                  <SelectItem value="p">Brødtekst</SelectItem><SelectItem value="span">Lille tekst</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <NumberField label="Størrelse" suffix="px" value={fontPx} onCommit={setFontPx} testId="canvas-field-font-size" />
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Vægt</Label>
              <Select value={styles.fontWeight ?? '400'} onValueChange={(v) => setStyle('fontWeight', v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{WEIGHTS.map((w) => <SelectItem key={w} value={w}>{w}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Justering</Label>
              <Select value={styles.textAlign ?? 'left'} onValueChange={(v) => setStyle('textAlign', v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="left">Venstre</SelectItem><SelectItem value="center">Centreret</SelectItem><SelectItem value="right">Højre</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <ColorField label="Farve" value={styles.color} onChange={(v) => setStyle('color', v)} tokens={tokens} testId="canvas-field-color" />
          <NumberField label="Linjehøjde" value={styles.lineHeight ? Number(styles.lineHeight) : 1.3} step={0.1} onCommit={(v) => setStyle('lineHeight', v === null ? undefined : String(v))} testId="canvas-field-line-height" />
        </>
      )}

      {node.type === 'button' && (
        <>
          <div className="space-y-1">
            <Label className="text-xs">Knaptekst</Label>
            <Input value={node.label ?? ''} onChange={(e) => patch((n) => ({ ...n, label: e.target.value }))} className="h-8 text-xs" data-testid="canvas-node-label" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Link</Label>
            <Input value={node.href ?? ''} placeholder="/kontakt eller https://…" onChange={(e) => patch((n) => ({ ...n, href: e.target.value }))} className="h-8 text-xs" data-testid="canvas-node-href" />
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Stil</Label>
              <Select value={node.variant ?? 'primary'} onValueChange={(v) => patch((n) => ({ ...n, variant: v as PrimitiveNode['variant'] }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="primary">Primær</SelectItem><SelectItem value="secondary">Sekundær</SelectItem><SelectItem value="outline">Kontur</SelectItem><SelectItem value="ghost">Diskret</SelectItem><SelectItem value="link">Link</SelectItem></SelectContent>
              </Select>
            </div>
            <NumberField label="Størrelse" suffix="px" value={fontPx} onCommit={setFontPx} testId="canvas-field-button-size" />
          </div>
        </>
      )}

      {node.type === 'image' && (
        <>
          <div className="space-y-1">
            <Label className="text-xs">Billede</Label>
            <div className="flex gap-1.5">
              <Input value={node.src ?? ''} placeholder="https://… eller upload" onChange={(e) => patch((n) => ({ ...n, src: e.target.value }))} className="h-8 flex-1 text-xs" data-testid="canvas-node-src" />
              <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" title="Upload" disabled={uploading} onClick={() => fileRef.current?.click()} data-testid="canvas-node-upload">
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              </Button>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void uploadFile(f); }} />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Alt-tekst</Label>
            <Input value={node.alt ?? ''} onChange={(e) => patch((n) => ({ ...n, alt: e.target.value }))} className="h-8 text-xs" data-testid="canvas-node-alt" />
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Tilpasning</Label>
              <Select value={styles.objectFit ?? 'cover'} onValueChange={(v) => setStyle('objectFit', v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="cover">Fyld (beskær)</SelectItem><SelectItem value="contain">Vis alt</SelectItem></SelectContent>
              </Select>
            </div>
            <NumberField label="Hjørner" suffix="px" value={radiusPx} onCommit={(v) => setStyle('borderRadius', v === null ? undefined : pxToCqw(v, frame))} testId="canvas-field-radius" />
          </div>
        </>
      )}

      {node.type === 'box' && (
        <>
          <ColorField label="Fyld" value={styles.backgroundColor} onChange={(v) => setStyle('backgroundColor', v)} tokens={tokens} testId="canvas-field-fill" />
          {styles.borderRadius !== '50%' && (
            <NumberField label="Hjørner" suffix="px" value={radiusPx} onCommit={(v) => setStyle('borderRadius', v === null ? undefined : pxToCqw(v, frame))} testId="canvas-field-radius" />
          )}
          <div className="grid grid-cols-2 gap-1.5">
            <NumberField label="Kant" suffix="px" value={borderPx} placeholder="ingen" onCommit={(v) => setStyle('border', v === null || v <= 0 ? undefined : `${pxToCqw(v, frame)} solid ${borderColor ?? tokenRef('color.text')}`)} testId="canvas-field-border" />
            {borderPx !== null && (
              <ColorField label="Kantfarve" value={borderColor} onChange={(v) => setStyle('border', `${border![1]} solid ${v}`)} tokens={tokens} testId="canvas-field-border-color" />
            )}
          </div>
        </>
      )}

      {node.type === 'svg' && parseCqw(styles.height) === null && (
        <p className="text-[11px] text-muted-foreground">Figurens farver redigeres under "Avanceret".</p>
      )}
    </div>
  );
}
