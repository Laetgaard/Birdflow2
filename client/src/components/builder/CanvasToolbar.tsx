/**
 * The bar above an open canvas: add elements, arrange the selection, save.
 * Pure presentation — every action is handed in by the overlay, which owns
 * the geometry.
 */

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalDistributeCenter,
  ArrowDownToLine,
  ArrowUpToLine,
  BringToFront,
  Circle,
  Copy,
  Grid3X3,
  Group,
  Image as ImageIcon,
  Magnet,
  Minus,
  MousePointerClick,
  Save,
  SendToBack,
  Shapes,
  Sparkles,
  Square,
  Trash2,
  Type as TypeIcon,
  Ungroup,
} from 'lucide-react';
import type { AlignMode, CanvasElementKind, CanvasElementOptions, ReorderOp } from '@shared/customComponents';
import { SVG_SHAPES } from '@shared/svgShapes';

export type CanvasToolbarProps = {
  selectionCount: number;
  canUngroup: boolean;
  showGrid: boolean;
  snapEnabled: boolean;
  onToggleGrid: () => void;
  onToggleSnap: () => void;
  onAdd: (kind: CanvasElementKind, opts?: CanvasElementOptions) => void;
  onAddImage: () => void;
  onAddLogo?: () => void;
  onAlign: (mode: AlignMode) => void;
  onDistribute: (axis: 'x' | 'y') => void;
  onReorder: (op: ReorderOp) => void;
  onGroup: () => void;
  onUngroup: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onSaveCanvas?: () => void;
  onSaveSelection?: () => void;
};

const ALIGN: Array<{ mode: AlignMode; label: string; icon: typeof AlignStartVertical }> = [
  { mode: 'left', label: 'Venstre', icon: AlignStartVertical },
  { mode: 'center', label: 'Centrér vandret', icon: AlignCenterVertical },
  { mode: 'right', label: 'Højre', icon: AlignEndVertical },
  { mode: 'top', label: 'Top', icon: AlignStartHorizontal },
  { mode: 'middle', label: 'Centrér lodret', icon: AlignCenterHorizontal },
  { mode: 'bottom', label: 'Bund', icon: AlignEndHorizontal },
];

const SHAPE_IDS = Object.keys(SVG_SHAPES);

function Tool({ title, onClick, disabled, active, children, testId }: { title: string; onClick?: () => void; disabled?: boolean; active?: boolean; children: React.ReactNode; testId?: string }) {
  return (
    <Button variant={active ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" title={title} onClick={onClick} disabled={disabled} data-testid={testId}>
      {children}
    </Button>
  );
}

export default function CanvasToolbar(p: CanvasToolbarProps) {
  const has = p.selectionCount > 0;
  const many = p.selectionCount > 1;
  return (
    <div className="flex items-center gap-0.5 rounded-lg border bg-card/95 px-1 py-0.5 shadow-md backdrop-blur" data-testid="canvas-toolbar">
      <Tool title="Tilføj tekst" onClick={() => p.onAdd('text')} testId="canvas-add-text"><TypeIcon className="h-4 w-4" /></Tool>
      <Tool title="Tilføj billede" onClick={p.onAddImage} testId="canvas-add-image"><ImageIcon className="h-4 w-4" /></Tool>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Tilføj form" data-testid="canvas-add-shape"><Square className="h-4 w-4" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => p.onAdd('rect')}><Square className="mr-2 h-4 w-4" />Rektangel</DropdownMenuItem>
          <DropdownMenuItem onClick={() => p.onAdd('ellipse')}><Circle className="mr-2 h-4 w-4" />Ellipse</DropdownMenuItem>
          <DropdownMenuItem onClick={() => p.onAdd('line')}><Minus className="mr-2 h-4 w-4" />Linje</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Tool title="Tilføj knap" onClick={() => p.onAdd('button')} testId="canvas-add-button"><MousePointerClick className="h-4 w-4" /></Tool>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Tilføj figur" data-testid="canvas-add-figure"><Shapes className="h-4 w-4" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
          <DropdownMenuLabel>Figurer</DropdownMenuLabel>
          {SHAPE_IDS.map((id) => (
            <DropdownMenuItem key={id} onClick={() => p.onAdd('svg', { shapeId: id })}>{SVG_SHAPES[id].name}</DropdownMenuItem>
          ))}
          {p.onAddLogo && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={p.onAddLogo}><Sparkles className="mr-2 h-4 w-4" />Jeres logo</DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <span className="mx-1 h-5 w-px bg-border" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Justér" disabled={!has} data-testid="canvas-align"><AlignCenterVertical className="h-4 w-4" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>{many ? 'Justér markeringen' : 'Justér til kanvas'}</DropdownMenuLabel>
          {ALIGN.map(({ mode, label, icon: Icon }) => (
            <DropdownMenuItem key={mode} onClick={() => p.onAlign(mode)}><Icon className="mr-2 h-4 w-4" />{label}</DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={p.selectionCount < 3} onClick={() => p.onDistribute('x')}><AlignHorizontalDistributeCenter className="mr-2 h-4 w-4" />Fordel vandret</DropdownMenuItem>
          <DropdownMenuItem disabled={p.selectionCount < 3} onClick={() => p.onDistribute('y')}><AlignVerticalDistributeCenter className="mr-2 h-4 w-4" />Fordel lodret</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Lag" disabled={!has} data-testid="canvas-layers"><BringToFront className="h-4 w-4" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => p.onReorder('front')}><ArrowUpToLine className="mr-2 h-4 w-4" />Forrest <span className="ml-auto text-xs text-muted-foreground">⌘]</span></DropdownMenuItem>
          <DropdownMenuItem onClick={() => p.onReorder('forward')}><BringToFront className="mr-2 h-4 w-4" />Ét lag frem <span className="ml-auto text-xs text-muted-foreground">]</span></DropdownMenuItem>
          <DropdownMenuItem onClick={() => p.onReorder('backward')}><SendToBack className="mr-2 h-4 w-4" />Ét lag tilbage <span className="ml-auto text-xs text-muted-foreground">[</span></DropdownMenuItem>
          <DropdownMenuItem onClick={() => p.onReorder('back')}><ArrowDownToLine className="mr-2 h-4 w-4" />Bagerst <span className="ml-auto text-xs text-muted-foreground">⌘[</span></DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {p.canUngroup ? (
        <Tool title="Ophæv gruppe (⌘⇧G)" onClick={p.onUngroup} testId="canvas-ungroup"><Ungroup className="h-4 w-4" /></Tool>
      ) : (
        <Tool title="Gruppér (⌘G)" onClick={p.onGroup} disabled={!many} testId="canvas-group"><Group className="h-4 w-4" /></Tool>
      )}
      <Tool title="Dupliker (⌘D)" onClick={p.onDuplicate} disabled={!has} testId="canvas-duplicate"><Copy className="h-4 w-4" /></Tool>
      <Tool title="Slet" onClick={p.onDelete} disabled={!has} testId="canvas-delete"><Trash2 className="h-4 w-4" /></Tool>

      <span className="mx-1 h-5 w-px bg-border" />

      <Tool title="Snap til kanter og midte" onClick={p.onToggleSnap} active={p.snapEnabled} testId="canvas-snap"><Magnet className="h-4 w-4" /></Tool>
      <Tool title="Gitter (8 px)" onClick={p.onToggleGrid} active={p.showGrid} testId="canvas-grid"><Grid3X3 className="h-4 w-4" /></Tool>

      {(p.onSaveCanvas || p.onSaveSelection) && <span className="mx-1 h-5 w-px bg-border" />}
      {p.onSaveSelection && (
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs" onClick={p.onSaveSelection} data-testid="canvas-save-selection"><Save className="h-3.5 w-3.5" />Gem markering</Button>
      )}
      {p.onSaveCanvas && (
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs" onClick={p.onSaveCanvas} data-testid="canvas-save"><Save className="h-3.5 w-3.5" />Gem kanvas</Button>
      )}
    </div>
  );
}
