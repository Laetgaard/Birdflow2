import { useEffect, useState, useRef, useCallback } from "react";
import { User, Layout, Rocket } from "lucide-react";

interface StepData {
  icon: React.ReactNode;
  label: string;
}

const steps: StepData[] = [
  { icon: <User className="w-7 h-7" />, label: "Sign up" },
  { icon: <Layout className="w-7 h-7" />, label: "Create website" },
  { icon: <Rocket className="w-7 h-7" />, label: "Publish" },
];

const statuses = [
  "Creating account…",
  "Building website…",
  "Publishing site…",
];

function Arrow({ active }: { active: boolean }) {
  return (
    <svg
      className={`step-arrow ${active ? "active" : ""}`}
      viewBox="0 0 60 24"
      fill="none"
    >
      <path
        d="M2 12h44M36 4l10 8-10 8"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Step({
  step,
  index,
  currentStep,
  progress,
}: {
  step: StepData;
  index: number;
  currentStep: number;
  progress: number;
}) {
  const isActive = index === currentStep;
  const isDone = index < currentStep;
  const progressWidth = isActive ? progress : isDone ? 100 : 0;

  const getGradient = (idx: number) => {
    switch (idx) {
      case 0:
        return "from-cyan-400 to-blue-500";
      case 1:
        return "from-purple-500 to-pink-500";
      case 2:
        return "from-orange-500 to-red-500";
      default:
        return "from-indigo-500 to-purple-500";
    }
  };

  const getBgColor = (idx: number) => {
    switch (idx) {
      case 0:
        return "bg-cyan-50 dark:bg-cyan-950/30";
      case 1:
        return "bg-purple-50 dark:bg-purple-950/30";
      case 2:
        return "bg-orange-50 dark:bg-orange-950/30";
      default:
        return "bg-indigo-50";
    }
  };

  const getIconBg = (idx: number) => {
    switch (idx) {
      case 0:
        return "bg-gradient-to-br from-cyan-400 to-blue-500";
      case 1:
        return "bg-gradient-to-br from-purple-500 to-pink-500";
      case 2:
        return "bg-gradient-to-br from-orange-500 to-red-500";
      default:
        return "bg-gradient-to-br from-indigo-500 to-purple-500";
    }
  };

  return (
    <div
      className={`step-card ${getBgColor(index)} ${isActive ? "step-active" : ""} ${isDone ? "step-done" : ""}`}
      data-testid={`step-card-${index}`}
    >
      <div className="absolute -top-3 left-6">
        <span className={`px-3 py-1 text-xs font-bold text-white rounded-full bg-gradient-to-r ${getGradient(index)} shadow-lg`}>
          Step {String(index + 1).padStart(2, "0")}
        </span>
      </div>

      <div className={`step-icon ${getIconBg(index)}`}>
        {step.icon}
      </div>

      <span className="step-label">{step.label}</span>

      <div className="step-progress-track">
        <div
          className={`step-progress-bar bg-gradient-to-r ${getGradient(index)}`}
          style={{ width: `${progressWidth}%` }}
        />
      </div>
    </div>
  );
}

export default function AnimatedStepProgress() {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("Starting…");
  const [isComplete, setIsComplete] = useState(false);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const restartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  const animateProgress = useCallback((onComplete: () => void) => {
    const duration = 2600;
    startTimeRef.current = null;

    const frame = (time: number) => {
      if (!isMountedRef.current) return;
      
      if (startTimeRef.current === null) {
        startTimeRef.current = time;
      }

      const elapsed = time - startTimeRef.current;
      const p = Math.min(elapsed / duration, 1);
      setProgress(p * 100);

      if (p < 1) {
        animationRef.current = requestAnimationFrame(frame);
      } else {
        onComplete();
      }
    };

    animationRef.current = requestAnimationFrame(frame);
  }, []);

  const activateStep = useCallback((index: number) => {
    if (!isMountedRef.current) return;
    
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
    
    setCurrentStep(index);
    setProgress(0);
    setStatusText(statuses[index]);
    setIsComplete(false);

    animateProgress(() => {
      if (!isMountedRef.current) return;
      
      if (index < steps.length - 1) {
        activateStep(index + 1);
      } else {
        setIsComplete(true);
        setStatusText("Your website is live 🚀");

        restartTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            activateStep(0);
          }
        }, 2000);
      }
    });
  }, [animateProgress]);

  useEffect(() => {
    isMountedRef.current = true;
    
    const timer = setTimeout(() => {
      activateStep(0);
    }, 500);

    return () => {
      isMountedRef.current = false;
      clearTimeout(timer);
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [activateStep]);

  return (
    <div className="step-progress-wrapper">
      <div className="step-progress-container">
        {steps.map((step, index) => (
          <div key={index} className="step-with-arrow">
            <Step
              step={step}
              index={index}
              currentStep={currentStep}
              progress={progress}
            />
            {index < steps.length - 1 && (
              <Arrow active={index < currentStep} />
            )}
          </div>
        ))}
      </div>

      <div className="step-status">
        <span className={`step-status-dot ${isComplete ? "complete" : ""}`} />
        <span className="step-status-text" data-testid="step-status-text">
          {statusText}
        </span>
      </div>
    </div>
  );
}
