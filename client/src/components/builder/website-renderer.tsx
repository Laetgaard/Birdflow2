import type { BuilderStateData, BuilderComponent, BuilderPage } from "@shared/schema";
import { renderComponent, HeaderBlock, FooterBlock } from "./blocks";

type DeviceType = 'desktop' | 'tablet' | 'mobile';

interface WebsiteRendererProps {
  state: BuilderStateData;
  pageId?: string;
  device?: DeviceType;
  selectedComponentId?: string | null;
  onComponentClick?: (componentId: string) => void;
  showNavigation?: boolean;
  className?: string;
}

function isComponentVisible(component: BuilderComponent, device: DeviceType): boolean {
  if (!component.visibility) return true;
  return component.visibility[device] !== false;
}

export function WebsiteRenderer({
  state,
  pageId,
  device = 'desktop',
  selectedComponentId,
  onComponentClick,
  showNavigation = true,
  className = '',
}: WebsiteRendererProps) {
  const activePage = state.pages.find((p) => p.id === (pageId || state.activePage)) || state.pages[0];
  
  if (!activePage) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        No pages found
      </div>
    );
  }

  const visibleComponents = activePage.components.filter((c) => isComponentVisible(c, device));

  return (
    <div
      data-testid="website-renderer"
      className={`min-h-full ${className}`}
      style={{
        backgroundColor: state.theme.colors.background,
        fontFamily: state.theme.fonts.body,
      }}
    >
      {showNavigation && (
        <HeaderBlock navigation={state.navigation} theme={state.theme} />
      )}
      
      <main>
        {visibleComponents.map((component) => (
          <div
            key={component.id}
            className={`relative transition-all ${
              selectedComponentId === component.id ? 'ring-2 ring-blue-500 ring-offset-2' : ''
            } ${onComponentClick ? 'cursor-pointer hover:ring-2 hover:ring-blue-300' : ''}`}
            onClick={onComponentClick ? () => onComponentClick(component.id) : undefined}
          >
            {renderComponent(
              component,
              state.theme,
              selectedComponentId === component.id,
            )}
          </div>
        ))}
        
        {visibleComponents.length === 0 && (
          <div className="flex items-center justify-center py-32 text-gray-400">
            <div className="text-center">
              <p className="text-lg mb-2">This page is empty</p>
              <p className="text-sm">Add components from the sidebar</p>
            </div>
          </div>
        )}
      </main>
      
      {showNavigation && (
        <FooterBlock navigation={state.navigation} theme={state.theme} />
      )}
    </div>
  );
}

export const deviceWidths: Record<DeviceType, string> = {
  desktop: '100%',
  tablet: '768px',
  mobile: '375px',
};
