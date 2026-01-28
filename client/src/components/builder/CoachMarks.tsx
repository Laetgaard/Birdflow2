import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { X, ArrowRight, ArrowLeft, Sparkles, Layout, Settings, Wand2, Upload, MousePointer, Rocket } from "lucide-react";

type CoachStep = {
  id: string;
  title: string;
  description: string;
  targetSelector?: string;
  position: "center" | "top-right" | "bottom-right" | "top-left" | "bottom-left";
  icon: React.ReactNode;
};

const COACH_STEPS: CoachStep[] = [
  {
    id: "welcome",
    title: "Velkommen til din hjemmesidebygger!",
    description: "Lad os tage en hurtig rundtur, så du kan komme godt i gang. Det tager kun et minut.",
    position: "center",
    icon: <Sparkles className="w-8 h-8" />,
  },
  {
    id: "canvas",
    title: "Dit arbejdsområde",
    description: "Klik på en sektion for at vælge den. Du kan redigere tekst direkte ved at klikke på den.",
    targetSelector: "[data-preview-area]",
    position: "center",
    icon: <MousePointer className="w-8 h-8" />,
  },
  {
    id: "add-components",
    title: "Tilføj nye sektioner",
    description: "Klik på 'Tilføj' for at gennemse og tilføje nye sektioner som overskrifter, funktioner, udtalelser og meget mere.",
    targetSelector: "[data-testid='tab-components']",
    position: "bottom-left",
    icon: <Layout className="w-8 h-8" />,
  },
  {
    id: "edit-properties",
    title: "Tilpas dit indhold",
    description: "Når du vælger en sektion, kan du skifte til 'Rediger' for at ændre farver, billeder og andre egenskaber.",
    targetSelector: "[data-testid='tab-properties']",
    position: "bottom-left",
    icon: <Settings className="w-8 h-8" />,
  },
  {
    id: "ai-assistant",
    title: "AI-drevet redigering",
    description: "Brug vores AI-assistent til at lave ændringer med naturligt sprog. Beskriv bare hvad du ønsker!",
    targetSelector: "[data-testid='tab-ai']",
    position: "bottom-left",
    icon: <Wand2 className="w-8 h-8" />,
  },
  {
    id: "publish",
    title: "Udgiv når du er klar",
    description: "Klik 'Udgiv' for at gøre din hjemmeside live. Du kan altid redigere og genudgive senere.",
    targetSelector: "[data-testid='button-publish']",
    position: "bottom-left",
    icon: <Upload className="w-8 h-8" />,
  },
  {
    id: "complete",
    title: "Du er klar!",
    description: "Det var det! Du er nu klar til at bygge din hjemmeside. Held og lykke!",
    position: "center",
    icon: <Rocket className="w-8 h-8" />,
  },
];

type CoachMarksProps = {
  onComplete: () => void;
  isFirstTime: boolean;
};

export default function CoachMarks({ onComplete, isFirstTime }: CoachMarksProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(isFirstTime);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!isVisible) return;

    const step = COACH_STEPS[currentStep];
    if (step.targetSelector) {
      const target = document.querySelector(step.targetSelector);
      if (target) {
        setTargetRect(target.getBoundingClientRect());
      } else {
        setTargetRect(null);
      }
    } else {
      setTargetRect(null);
    }
  }, [currentStep, isVisible]);

  const handleNext = () => {
    if (currentStep < COACH_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    setIsVisible(false);
    localStorage.setItem("builder_coach_marks_completed", "true");
    onComplete();
  };

  const handleSkip = () => {
    handleComplete();
  };

  if (!isVisible) return null;

  const step = COACH_STEPS[currentStep];
  const isLastStep = currentStep === COACH_STEPS.length - 1;
  const isFirstStep = currentStep === 0;

  const getTooltipPosition = () => {
    if (!targetRect || step.position === "center") {
      return {
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      };
    }

    const padding = 20;
    const tooltipWidth = 360;
    const tooltipHeight = 200;

    switch (step.position) {
      case "top-right":
        return {
          top: `${targetRect.bottom + padding}px`,
          left: `${targetRect.left}px`,
        };
      case "bottom-right":
        return {
          top: `${targetRect.top - tooltipHeight - padding}px`,
          left: `${targetRect.left}px`,
        };
      case "top-left":
        return {
          top: `${targetRect.bottom + padding}px`,
          right: `${window.innerWidth - targetRect.right}px`,
        };
      case "bottom-left":
        return {
          top: `${targetRect.bottom + padding}px`,
          right: `${window.innerWidth - targetRect.right}px`,
        };
      default:
        return {
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        };
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100]"
        data-testid="coach-marks-overlay"
      >
        <div className="absolute inset-0 bg-black/60" onClick={handleSkip} />

        {targetRect && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute bg-white/10 rounded-lg ring-4 ring-primary ring-offset-2 ring-offset-transparent pointer-events-none"
            style={{
              top: targetRect.top - 4,
              left: targetRect.left - 4,
              width: targetRect.width + 8,
              height: targetRect.height + 8,
            }}
          />
        )}

        <motion.div
          key={step.id}
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: "spring", duration: 0.5 }}
          className="absolute w-[380px] bg-card border rounded-xl shadow-2xl overflow-hidden"
          style={getTooltipPosition()}
        >
          <div className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shrink-0">
                {step.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-lg mb-2" data-testid="coach-step-title">
                  {step.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed" data-testid="coach-step-description">
                  {step.description}
                </p>
              </div>
            </div>
          </div>

          <div className="px-6 pb-6">
            <div className="flex items-center gap-1.5 mb-4">
              {COACH_STEPS.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-1.5 rounded-full flex-1 transition-colors ${
                    idx <= currentStep ? "bg-gradient-to-r from-indigo-500 to-purple-600" : "bg-muted"
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSkip}
                className="text-muted-foreground"
                data-testid="coach-skip-button"
              >
                Spring over
              </Button>

              <div className="flex items-center gap-2">
                {!isFirstStep && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrev}
                    data-testid="coach-prev-button"
                  >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Tilbage
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={handleNext}
                  className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
                  data-testid="coach-next-button"
                >
                  {isLastStep ? (
                    <>
                      Kom i gang
                      <Rocket className="w-4 h-4 ml-1" />
                    </>
                  ) : (
                    <>
                      Næste
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
