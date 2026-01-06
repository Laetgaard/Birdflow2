import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { X, ArrowRight, ArrowLeft, Sparkles, Layout, Settings, Wand2, Upload, MousePointer } from "lucide-react";

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
    title: "Welcome to your website builder!",
    description: "Let's take a quick tour to help you get started. This will only take a minute.",
    position: "center",
    icon: <Sparkles className="w-8 h-8" />,
  },
  {
    id: "canvas",
    title: "This is your canvas",
    description: "Click on any section to select it. You can edit text directly by clicking on it.",
    targetSelector: "[data-preview-area]",
    position: "center",
    icon: <MousePointer className="w-8 h-8" />,
  },
  {
    id: "add-components",
    title: "Add new sections",
    description: "Click the 'Add' tab to browse and add new sections like headers, features, testimonials, and more.",
    targetSelector: "[data-testid='tab-components']",
    position: "bottom-left",
    icon: <Layout className="w-8 h-8" />,
  },
  {
    id: "edit-properties",
    title: "Customize your content",
    description: "When you select a section, switch to the 'Edit' tab to change colors, images, and other properties.",
    targetSelector: "[data-testid='tab-properties']",
    position: "bottom-left",
    icon: <Settings className="w-8 h-8" />,
  },
  {
    id: "ai-assistant",
    title: "AI-powered editing",
    description: "Use our AI assistant to make changes with natural language. Just describe what you want!",
    targetSelector: "[data-testid='tab-ai']",
    position: "bottom-left",
    icon: <Wand2 className="w-8 h-8" />,
  },
  {
    id: "publish",
    title: "Publish when ready",
    description: "Click 'Publish' to make your website live. You can always edit and republish later.",
    targetSelector: "[data-testid='button-publish']",
    position: "bottom-left",
    icon: <Upload className="w-8 h-8" />,
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
          className="absolute w-[360px] bg-card border rounded-xl shadow-2xl overflow-hidden"
          style={getTooltipPosition()}
        >
          <div className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                {step.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-lg mb-2" data-testid="coach-step-title">
                  {step.title}
                </h3>
                <p className="text-sm text-muted-foreground" data-testid="coach-step-description">
                  {step.description}
                </p>
              </div>
            </div>
          </div>

          <div className="px-6 pb-6">
            <div className="flex items-center gap-2 mb-4">
              {COACH_STEPS.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-1.5 rounded-full flex-1 transition-colors ${
                    idx <= currentStep ? "bg-primary" : "bg-muted"
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
                Skip tour
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
                    Back
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={handleNext}
                  data-testid="coach-next-button"
                >
                  {isLastStep ? (
                    "Get started"
                  ) : (
                    <>
                      Next
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
