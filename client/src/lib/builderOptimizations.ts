import { useMemo, useCallback } from 'react';
import type { BuilderComponentData } from '@shared/componentRegistry';

export type BuilderPage = {
  id: string;
  name: string;
  path: string;
  components: BuilderComponentData[];
};

export type BuilderStateData = {
  pages: BuilderPage[];
  activePage: string;
  globalStyles: {
    primaryColor: string;
    secondaryColor: string;
    fontFamily: string;
    backgroundColor: string;
  };
};

export type ComponentMap = Map<string, BuilderComponentData>;
export type ComponentIndex = Map<string, { pageId: string; index: number }>;

export function createComponentMap(state: BuilderStateData | null): ComponentMap {
  const map = new Map<string, BuilderComponentData>();
  if (!state) return map;
  
  for (const page of state.pages) {
    for (const component of page.components) {
      map.set(component.id, component);
    }
  }
  
  return map;
}

export function createComponentIndex(state: BuilderStateData | null): ComponentIndex {
  const index = new Map<string, { pageId: string; index: number }>();
  if (!state) return index;
  
  for (const page of state.pages) {
    page.components.forEach((component, idx) => {
      index.set(component.id, { pageId: page.id, index: idx });
    });
  }
  
  return index;
}

export function getActivePageComponents(state: BuilderStateData | null): BuilderComponentData[] {
  if (!state) return [];
  const activePage = state.pages.find(p => p.id === state.activePage);
  return activePage?.components || [];
}

export function getComponentById(
  state: BuilderStateData | null, 
  componentId: string
): BuilderComponentData | undefined {
  if (!state) return undefined;
  
  for (const page of state.pages) {
    const component = page.components.find(c => c.id === componentId);
    if (component) return component;
  }
  
  return undefined;
}

export function updateComponentInState(
  state: BuilderStateData,
  componentId: string,
  updates: { 
    props?: Partial<BuilderComponentData['props']>; 
    styles?: Partial<BuilderComponentData['styles']>;
  }
): BuilderStateData {
  return {
    ...state,
    pages: state.pages.map(page => ({
      ...page,
      components: page.components.map(comp =>
        comp.id === componentId
          ? {
              ...comp,
              props: { ...comp.props, ...updates.props },
              styles: { ...comp.styles, ...updates.styles },
            }
          : comp
      ),
    })),
  };
}

export function deleteComponentFromState(
  state: BuilderStateData,
  componentId: string
): BuilderStateData {
  return {
    ...state,
    pages: state.pages.map(page => ({
      ...page,
      components: page.components.filter(comp => comp.id !== componentId),
    })),
  };
}

export function addComponentToState(
  state: BuilderStateData,
  component: BuilderComponentData,
  pageId?: string
): BuilderStateData {
  const targetPageId = pageId || state.activePage;
  
  return {
    ...state,
    pages: state.pages.map(page =>
      page.id === targetPageId
        ? { ...page, components: [...page.components, component] }
        : page
    ),
  };
}

export function moveComponentInState(
  state: BuilderStateData,
  componentId: string,
  direction: 'up' | 'down'
): BuilderStateData {
  return {
    ...state,
    pages: state.pages.map(page => {
      const index = page.components.findIndex(c => c.id === componentId);
      if (index === -1) return page;
      
      const newIndex = direction === 'up' 
        ? Math.max(0, index - 1) 
        : Math.min(page.components.length - 1, index + 1);
      
      if (newIndex === index) return page;
      
      const newComponents = [...page.components];
      [newComponents[index], newComponents[newIndex]] = [newComponents[newIndex], newComponents[index]];
      
      return { ...page, components: newComponents };
    }),
  };
}

export function duplicateComponentInState(
  state: BuilderStateData,
  componentId: string,
  newId: string
): BuilderStateData {
  return {
    ...state,
    pages: state.pages.map(page => {
      const index = page.components.findIndex(c => c.id === componentId);
      if (index === -1) return page;
      
      const original = page.components[index];
      const duplicate: BuilderComponentData = {
        ...original,
        id: newId,
        props: { ...original.props },
        styles: { ...original.styles },
      };
      
      const newComponents = [...page.components];
      newComponents.splice(index + 1, 0, duplicate);
      
      return { ...page, components: newComponents };
    }),
  };
}

export function useBuilderSelectors(state: BuilderStateData | null) {
  const activePageComponents = useMemo(
    () => getActivePageComponents(state),
    [state?.activePage, state?.pages]
  );
  
  const activePage = useMemo(
    () => state?.pages.find(p => p.id === state?.activePage),
    [state?.activePage, state?.pages]
  );
  
  const componentMap = useMemo(
    () => createComponentMap(state),
    [state?.pages]
  );
  
  const getComponent = useCallback(
    (id: string) => componentMap.get(id),
    [componentMap]
  );
  
  return {
    activePageComponents,
    activePage,
    componentMap,
    getComponent,
  };
}
