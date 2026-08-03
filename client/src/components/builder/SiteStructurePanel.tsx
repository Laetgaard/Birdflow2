/**
 * The structure panel: pages, their order, what each one is for, its SEO,
 * and the menu the visitor navigates with.
 *
 * All of this used to be implicit. The order of the pages was whatever
 * order they happened to be created in, the menu was derived from that
 * order with no way to rename a link, and the header and footer existed as
 * a copy on every page. This panel is where the customer takes control of
 * all four without touching a section.
 */

import { useState } from 'react';
import type { BuilderPage, BuilderStateData, NavLink } from '@shared/schema';
import {
  PAGE_ROLES,
  PAGE_ROLE_LABELS,
  deriveNavigation,
  pageRole,
  reorderPages,
  syncNavigationWithPages,
  usesSharedFooter,
  usesSharedHeader,
} from '@shared/siteStructure';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  GripVertical,
  Link2,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';

interface SiteStructurePanelProps {
  state: BuilderStateData;
  /** Every change goes through the builder's history, hence the label. */
  onChange: (next: BuilderStateData, description: string) => void;
  activePageId?: string;
  onSelectPage: (pageId: string) => void;
}

/** Search engines cut titles around here; the counter turns amber first. */
const TITLE_LIMIT = 60;
const DESCRIPTION_LIMIT = 155;

export function SiteStructurePanel({
  state,
  onChange,
  activePageId,
  onSelectPage,
}: SiteStructurePanelProps) {
  const [expandedPageId, setExpandedPageId] = useState<string | null>(activePageId ?? null);
  const [dragPageId, setDragPageId] = useState<string | null>(null);
  const [dragNavId, setDragNavId] = useState<string | null>(null);

  // A website that predates stored navigation still has to be editable, so
  // the panel shows what the renderers would derive and stores it the
  // moment the customer changes anything.
  const navigation = state.navigation ?? deriveNavigation(state.pages);

  const setPages = (pages: BuilderPage[], description: string) => {
    onChange(
      {
        ...state,
        pages,
        navigation: state.navigation
          ? syncNavigationWithPages(state.navigation, pages)
          : undefined,
      },
      description
    );
  };

  const patchPage = (pageId: string, patch: Partial<BuilderPage>, description: string) => {
    setPages(
      state.pages.map((page) => (page.id === pageId ? { ...page, ...patch } : page)),
      description
    );
  };

  const movePage = (pageId: string, direction: -1 | 1) => {
    const order = state.pages.map((page) => page.id);
    const from = order.indexOf(pageId);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= order.length) return;
    order.splice(to, 0, order.splice(from, 1)[0]);
    setPages(reorderPages(state.pages, order), 'Ændre siderækkefølge');
  };

  const dropPageOn = (targetId: string) => {
    if (!dragPageId || dragPageId === targetId) return;
    const order = state.pages.map((page) => page.id).filter((id) => id !== dragPageId);
    order.splice(order.indexOf(targetId), 0, dragPageId);
    setPages(reorderPages(state.pages, order), 'Ændre siderækkefølge');
    setDragPageId(null);
  };

  const setNavItems = (items: NavLink[], description: string) => {
    onChange({ ...state, navigation: { items } }, description);
  };

  const patchNavItem = (itemId: string, patch: Partial<NavLink>, description: string) => {
    setNavItems(
      navigation.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
      description
    );
  };

  const moveNavItem = (itemId: string, direction: -1 | 1) => {
    const items = [...navigation.items];
    const from = items.findIndex((item) => item.id === itemId);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= items.length) return;
    items.splice(to, 0, items.splice(from, 1)[0]);
    setNavItems(items, 'Flytte menupunkt');
  };

  const dropNavOn = (targetId: string) => {
    if (!dragNavId || dragNavId === targetId) return;
    const items = navigation.items.filter((item) => item.id !== dragNavId);
    const dragged = navigation.items.find((item) => item.id === dragNavId);
    if (!dragged) return;
    items.splice(items.findIndex((item) => item.id === targetId), 0, dragged);
    setNavItems(items, 'Flytte menupunkt');
    setDragNavId(null);
  };

  const addNavLink = () => {
    // A link to nowhere is useless, so a new one starts on the first page
    // that is not already in the menu, or on the front page.
    const linked = new Set(navigation.items.map((item) => item.pageId).filter(Boolean));
    const candidate = state.pages.find((page) => !linked.has(page.id)) ?? state.pages[0];
    if (!candidate) return;
    setNavItems(
      [
        ...navigation.items,
        {
          id: `nav-${candidate.id}-${Date.now()}`,
          label: candidate.name,
          target: candidate.path,
          pageId: candidate.id,
        },
      ],
      'Tilføje menupunkt'
    );
  };

  const chromeHeader = state.siteChrome?.header;
  const chromeFooter = state.siteChrome?.footer;

  return (
    <div className="space-y-6" data-testid="panel-site-structure">
      {/* ───────── pages ───────── */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Sider</h3>
          <span className="text-xs text-muted-foreground">Rækkefølgen styrer menuen</span>
        </div>

        <div className="space-y-1.5">
          {state.pages.map((page, index) => {
            const role = pageRole(page);
            const expanded = expandedPageId === page.id;
            const seoTitle = page.seo?.title ?? '';
            const seoDescription = page.seo?.description ?? '';

            return (
              <div
                key={page.id}
                className={`rounded-lg border bg-background ${
                  dragPageId === page.id ? 'opacity-50' : ''
                }`}
                draggable
                onDragStart={() => setDragPageId(page.id)}
                onDragEnd={() => setDragPageId(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => dropPageOn(page.id)}
                data-testid={`structure-page-${page.id}`}
              >
                <div className="flex items-center gap-1.5 p-2">
                  <GripVertical className="w-4 h-4 text-muted-foreground shrink-0 cursor-grab" />
                  <button
                    className="flex-1 min-w-0 text-left"
                    onClick={() => {
                      onSelectPage(page.id);
                      setExpandedPageId(expanded ? null : page.id);
                    }}
                    data-testid={`structure-page-open-${page.id}`}
                  >
                    <span
                      className={`text-sm truncate ${
                        activePageId === page.id ? 'font-semibold' : ''
                      }`}
                    >
                      {page.name}
                    </span>
                    <span className="text-xs text-muted-foreground ml-1.5">{page.path}</span>
                  </button>
                  <Badge variant="secondary" className="text-[10px] shrink-0">
                    {PAGE_ROLE_LABELS[role]}
                  </Badge>
                  <button
                    className="p-1 rounded hover:bg-muted disabled:opacity-30"
                    onClick={() => movePage(page.id, -1)}
                    disabled={index === 0}
                    title="Flyt op"
                    data-testid={`structure-page-up-${page.id}`}
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    className="p-1 rounded hover:bg-muted disabled:opacity-30"
                    onClick={() => movePage(page.id, 1)}
                    disabled={index === state.pages.length - 1}
                    title="Flyt ned"
                    data-testid={`structure-page-down-${page.id}`}
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                {expanded && (
                  <div className="border-t p-3 space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Sidens rolle</Label>
                      <Select
                        value={role}
                        onValueChange={(value) =>
                          patchPage(page.id, { role: value as BuilderPage['role'] }, 'Ændre sidens rolle')
                        }
                      >
                        <SelectTrigger className="h-8" data-testid={`structure-role-${page.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PAGE_ROLES.map((value) => (
                            <SelectItem key={value} value={value}>
                              {PAGE_ROLE_LABELS[value]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs flex items-center gap-1">
                          <Search className="w-3 h-3" /> Titel i Google
                        </Label>
                        <span
                          className={`text-[10px] ${
                            seoTitle.length > TITLE_LIMIT ? 'text-amber-600' : 'text-muted-foreground'
                          }`}
                        >
                          {seoTitle.length}/{TITLE_LIMIT}
                        </span>
                      </div>
                      <Input
                        className="h-8"
                        value={seoTitle}
                        placeholder={page.path === '/' ? page.name : `${page.name} – dit website`}
                        onChange={(e) =>
                          patchPage(
                            page.id,
                            { seo: { ...page.seo, title: e.target.value } },
                            'Ændre SEO-titel'
                          )
                        }
                        data-testid={`structure-seo-title-${page.id}`}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Beskrivelse i Google</Label>
                        <span
                          className={`text-[10px] ${
                            seoDescription.length > DESCRIPTION_LIMIT
                              ? 'text-amber-600'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {seoDescription.length}/{DESCRIPTION_LIMIT}
                        </span>
                      </div>
                      <Textarea
                        rows={2}
                        value={seoDescription}
                        placeholder="Kort beskrivelse af siden – vises under titlen i søgeresultatet."
                        onChange={(e) =>
                          patchPage(
                            page.id,
                            { seo: { ...page.seo, description: e.target.value } },
                            'Ændre SEO-beskrivelse'
                          )
                        }
                        data-testid={`structure-seo-description-${page.id}`}
                      />
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                      <Label className="text-xs" htmlFor={`hidden-${page.id}`}>
                        Skjul i menuen
                      </Label>
                      <Switch
                        id={`hidden-${page.id}`}
                        checked={page.hidden === true}
                        onCheckedChange={(checked) =>
                          patchPage(page.id, { hidden: checked }, 'Skjule/vise side i menuen')
                        }
                        data-testid={`structure-hidden-${page.id}`}
                      />
                    </div>

                    {chromeHeader && (
                      <div className="flex items-center justify-between">
                        <Label className="text-xs" htmlFor={`header-${page.id}`}>
                          Brug den delte header
                        </Label>
                        <Switch
                          id={`header-${page.id}`}
                          checked={usesSharedHeader(page, state.siteChrome)}
                          onCheckedChange={(checked) =>
                            patchPage(
                              page.id,
                              { useSharedHeader: checked },
                              'Delt header til/fra på siden'
                            )
                          }
                          data-testid={`structure-shared-header-${page.id}`}
                        />
                      </div>
                    )}

                    {chromeFooter && (
                      <div className="flex items-center justify-between">
                        <Label className="text-xs" htmlFor={`footer-${page.id}`}>
                          Brug den delte footer
                        </Label>
                        <Switch
                          id={`footer-${page.id}`}
                          checked={usesSharedFooter(page, state.siteChrome)}
                          onCheckedChange={(checked) =>
                            patchPage(
                              page.id,
                              { useSharedFooter: checked },
                              'Delt footer til/fra på siden'
                            )
                          }
                          data-testid={`structure-shared-footer-${page.id}`}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ───────── navigation ───────── */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Menu</h3>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={addNavLink}
            data-testid="structure-add-nav"
          >
            <Plus className="w-3.5 h-3.5" /> Tilføj link
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Teksten i menuen er din egen – den behøver ikke hedde det samme som siden.
        </p>

        <div className="space-y-1.5">
          {navigation.items.length === 0 && (
            <p className="text-xs text-muted-foreground py-2">
              Ingen menupunkter. Tilføj et link, eller vis en side i menuen igen.
            </p>
          )}
          {navigation.items.map((item, index) => (
            <div
              key={item.id}
              className={`rounded-lg border bg-background p-2 space-y-1.5 ${
                dragNavId === item.id ? 'opacity-50' : ''
              }`}
              draggable
              onDragStart={() => setDragNavId(item.id)}
              onDragEnd={() => setDragNavId(null)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => dropNavOn(item.id)}
              data-testid={`structure-nav-${item.id}`}
            >
              <div className="flex items-center gap-1.5">
                <GripVertical className="w-4 h-4 text-muted-foreground shrink-0 cursor-grab" />
                <Input
                  className="h-8"
                  value={item.label}
                  onChange={(e) => patchNavItem(item.id, { label: e.target.value }, 'Omdøbe menupunkt')}
                  data-testid={`structure-nav-label-${item.id}`}
                />
                <button
                  className="p-1 rounded hover:bg-muted disabled:opacity-30"
                  onClick={() => moveNavItem(item.id, -1)}
                  disabled={index === 0}
                  title="Flyt op"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button
                  className="p-1 rounded hover:bg-muted disabled:opacity-30"
                  onClick={() => moveNavItem(item.id, 1)}
                  disabled={index === navigation.items.length - 1}
                  title="Flyt ned"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                <button
                  className="p-1 rounded hover:bg-muted"
                  onClick={() =>
                    patchNavItem(item.id, { hidden: !item.hidden }, 'Skjule/vise menupunkt')
                  }
                  title={item.hidden ? 'Vis i menuen' : 'Skjul i menuen'}
                  data-testid={`structure-nav-hidden-${item.id}`}
                >
                  {item.hidden ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                </button>
                <button
                  className="p-1 rounded hover:bg-destructive/10 text-destructive"
                  onClick={() =>
                    setNavItems(
                      navigation.items.filter((other) => other.id !== item.id),
                      'Fjerne menupunkt'
                    )
                  }
                  title="Fjern fra menuen"
                  data-testid={`structure-nav-remove-${item.id}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-1.5 pl-5">
                <Link2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <Select
                  value={item.pageId ?? '__external__'}
                  onValueChange={(value) => {
                    if (value === '__external__') {
                      patchNavItem(item.id, { pageId: undefined }, 'Ændre menupunktets mål');
                      return;
                    }
                    const page = state.pages.find((p) => p.id === value);
                    if (!page) return;
                    patchNavItem(
                      item.id,
                      { pageId: page.id, target: page.path },
                      'Ændre menupunktets mål'
                    );
                  }}
                >
                  <SelectTrigger className="h-8 flex-1" data-testid={`structure-nav-target-${item.id}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {state.pages.map((page) => (
                      <SelectItem key={page.id} value={page.id}>
                        {page.name} ({page.path})
                      </SelectItem>
                    ))}
                    <SelectItem value="__external__">Andet link…</SelectItem>
                  </SelectContent>
                </Select>
                {!item.pageId && (
                  <Input
                    className="h-8 flex-1"
                    value={item.target}
                    placeholder="https://…"
                    onChange={(e) =>
                      patchNavItem(item.id, { target: e.target.value }, 'Ændre menupunktets mål')
                    }
                    data-testid={`structure-nav-url-${item.id}`}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ───────── shared chrome ───────── */}
      <section className="space-y-2">
        <h3 className="font-semibold text-sm">Fælles header og footer</h3>
        <p className="text-xs text-muted-foreground">
          {chromeHeader || chromeFooter
            ? 'Rediger dem på lærredet – ændringen slår igennem på alle sider, der bruger dem.'
            : 'Dette website har endnu ingen fælles header eller footer. Hver side har sin egen.'}
        </p>
        {(chromeHeader || chromeFooter) && (
          <div className="text-xs text-muted-foreground space-y-1">
            {chromeHeader && (
              <p>
                Header: bruges på{' '}
                {state.pages.filter((page) => usesSharedHeader(page, state.siteChrome)).length} af{' '}
                {state.pages.length} sider
              </p>
            )}
            {chromeFooter && (
              <p>
                Footer: bruges på{' '}
                {state.pages.filter((page) => usesSharedFooter(page, state.siteChrome)).length} af{' '}
                {state.pages.length} sider
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
