import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface SectionStylePresetsProps {
  componentId: string;
  currentStyles: {
    backgroundColor?: string;
    textColor?: string;
    buttonColor?: string;
  };
  onApplyPreset: (styles: { backgroundColor: string; textColor: string; buttonColor: string }) => void;
}

interface StylePreset {
  name: string;
  backgroundColor: string;
  textColor: string;
  buttonColor: string;
}

const STYLE_PRESETS: StylePreset[] = [
  { name: 'Lys', backgroundColor: '#ffffff', textColor: '#1e293b', buttonColor: '#3b82f6' },
  { name: 'Mørk', backgroundColor: '#0f172a', textColor: '#f8fafc', buttonColor: '#60a5fa' },
  { name: 'Blød', backgroundColor: '#f8fafc', textColor: '#334155', buttonColor: '#6366f1' },
  { name: 'Varm', backgroundColor: '#fffbeb', textColor: '#78350f', buttonColor: '#f59e0b' },
  { name: 'Kølig', backgroundColor: '#ecfeff', textColor: '#164e63', buttonColor: '#06b6d4' },
  { name: 'Natur', backgroundColor: '#f0fdf4', textColor: '#14532d', buttonColor: '#22c55e' },
  { name: 'Elegant', backgroundColor: '#faf5ff', textColor: '#3b0764', buttonColor: '#a855f7' },
  { name: 'Bold', backgroundColor: '#1e293b', textColor: '#ffffff', buttonColor: '#ef4444' },
  {
    name: 'Gradient',
    backgroundColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    textColor: '#ffffff',
    buttonColor: '#f59e0b',
  },
];

function normalizeColor(value: string | undefined): string {
  if (!value) return '';
  return value.toLowerCase().trim();
}

function isPresetActive(
  preset: StylePreset,
  currentStyles: SectionStylePresetsProps['currentStyles']
): boolean {
  const bgMatch = normalizeColor(currentStyles.backgroundColor) === normalizeColor(preset.backgroundColor);
  const textMatch = normalizeColor(currentStyles.textColor) === normalizeColor(preset.textColor);
  const btnMatch = normalizeColor(currentStyles.buttonColor) === normalizeColor(preset.buttonColor);
  return bgMatch && textMatch && btnMatch;
}

export default function SectionStylePresets({
  componentId,
  currentStyles,
  onApplyPreset,
}: SectionStylePresetsProps) {
  const activeIndex = useMemo(() => {
    return STYLE_PRESETS.findIndex((preset) => isPresetActive(preset, currentStyles));
  }, [currentStyles]);

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
        Stil
      </span>
      <div
        className="flex gap-2 overflow-x-auto pb-1"
        style={{ scrollbarWidth: 'thin' }}
      >
        {STYLE_PRESETS.map((preset, index) => {
          const active = index === activeIndex;

          return (
            <button
              key={`${componentId}-preset-${preset.name}`}
              type="button"
              onClick={() =>
                onApplyPreset({
                  backgroundColor: preset.backgroundColor,
                  textColor: preset.textColor,
                  buttonColor: preset.buttonColor,
                })
              }
              className={cn(
                'flex-shrink-0 flex flex-col items-center gap-0.5 group focus:outline-none'
              )}
            >
              <div
                className={cn(
                  'w-16 h-11 rounded-md border overflow-hidden flex flex-col items-start justify-center px-2 gap-[3px] transition-all cursor-pointer',
                  active
                    ? 'ring-2 ring-blue-500 ring-offset-1 border-blue-400'
                    : 'border-border hover:border-blue-300 hover:ring-1 hover:ring-blue-200'
                )}
                style={{
                  background: preset.backgroundColor,
                }}
              >
                {/* Simulated text lines */}
                <div
                  className="rounded-sm"
                  style={{
                    width: '70%',
                    height: 3,
                    backgroundColor: preset.textColor,
                    opacity: 0.85,
                  }}
                />
                <div
                  className="rounded-sm"
                  style={{
                    width: '50%',
                    height: 3,
                    backgroundColor: preset.textColor,
                    opacity: 0.55,
                  }}
                />
                {/* Simulated button */}
                <div
                  className="rounded-sm mt-[1px]"
                  style={{
                    width: '40%',
                    height: 5,
                    backgroundColor: preset.buttonColor,
                  }}
                />
              </div>
              <span
                className={cn(
                  'text-[10px] leading-tight',
                  active ? 'text-blue-600 font-medium' : 'text-muted-foreground'
                )}
              >
                {preset.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
