import { useState, useEffect, useRef, useCallback } from "react";
import { Calendar, LayoutGrid, Type, Image, Rocket, CheckCircle2 } from "lucide-react";
import { useReducedMotion } from "framer-motion";

const CYCLE_DURATION = 8000;
const PHASE_TIMINGS = {
  idle: 800,
  moveToSidebar: 1200,
  clickBooking: 600,
  moveToCanvas: 1000,
  revealWidget: 1200,
  moveToPublish: 1000,
  clickPublish: 600,
  success: 1600,
};

type Phase = 
  | "idle"
  | "moveToSidebar"
  | "clickBooking"
  | "moveToCanvas"
  | "revealWidget"
  | "moveToPublish"
  | "clickPublish"
  | "success";

const phases: Phase[] = [
  "idle",
  "moveToSidebar",
  "clickBooking",
  "moveToCanvas",
  "revealWidget",
  "moveToPublish",
  "clickPublish",
  "success",
];

interface CursorPosition {
  x: number;
  y: number;
}

const cursorPositions: Record<Phase, CursorPosition> = {
  idle: { x: 55, y: 45 },
  moveToSidebar: { x: 12, y: 55 },
  clickBooking: { x: 12, y: 55 },
  moveToCanvas: { x: 55, y: 70 },
  revealWidget: { x: 55, y: 70 },
  moveToPublish: { x: 88, y: 12 },
  clickPublish: { x: 88, y: 12 },
  success: { x: 88, y: 12 },
};

function Cursor({ x, y, clicking }: { x: number; y: number; clicking: boolean }) {
  return (
    <div
      className="absolute z-50 pointer-events-none transition-all duration-700 ease-out"
      style={{ left: `${x}%`, top: `${y}%`, transform: "translate(-2px, -2px)" }}
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        className={`drop-shadow-lg transition-transform duration-150 ${clicking ? "scale-90" : "scale-100"}`}
      >
        <path
          d="M5.5 3.21V20.8c0 .45.54.67.86.35l4.86-4.86a.5.5 0 01.35-.15h6.87c.48 0 .72-.58.38-.92L6.38 2.88a.5.5 0 00-.88.33z"
          fill="#fff"
          stroke="#1e293b"
          strokeWidth="1.5"
        />
      </svg>
      {clicking && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="w-8 h-8 rounded-full bg-indigo-500/30 animate-ping" />
        </div>
      )}
    </div>
  );
}

function SidebarItem({ 
  icon: Icon, 
  label, 
  highlighted,
  selected 
}: { 
  icon: React.ElementType; 
  label: string; 
  highlighted?: boolean;
  selected?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-all duration-300 ${
        selected
          ? "bg-indigo-500 text-white shadow-md scale-105"
          : highlighted
          ? "bg-indigo-100 text-indigo-700"
          : "text-gray-600 hover:bg-gray-100"
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      <span className="font-medium">{label}</span>
    </div>
  );
}

function BookingWidget({ visible }: { visible: boolean }) {
  return (
    <div
      className={`bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-3 transition-all duration-500 ${
        visible
          ? "opacity-100 translate-y-0 scale-100"
          : "opacity-0 translate-y-4 scale-95"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center">
          <Calendar className="w-3 h-3 text-white" />
        </div>
        <span className="text-xs font-semibold text-gray-700">Booking</span>
      </div>
      <div className="space-y-1.5">
        <div className="h-2 bg-purple-200/50 rounded w-3/4" />
        <div className="flex gap-1">
          <div className="h-6 w-12 bg-purple-100 rounded border border-purple-200" />
          <div className="h-6 w-12 bg-purple-100 rounded border border-purple-200" />
          <div className="h-6 w-12 bg-indigo-500 rounded" />
        </div>
      </div>
    </div>
  );
}

export default function AnimatedBuilderDemo() {
  const shouldReduceMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("idle");
  const [cursorPos, setCursorPos] = useState<CursorPosition>(cursorPositions.idle);
  const [showBooking, setShowBooking] = useState(false);
  const [published, setPublished] = useState(false);
  const isMountedRef = useRef(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isClicking = phase === "clickBooking" || phase === "clickPublish";

  const runAnimation = useCallback(() => {
    if (!isMountedRef.current) return;

    let elapsed = 0;
    
    const schedulePhase = (phaseIndex: number) => {
      if (!isMountedRef.current || phaseIndex >= phases.length) {
        timeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            setShowBooking(false);
            setPublished(false);
            setPhase("idle");
            setCursorPos(cursorPositions.idle);
            runAnimation();
          }
        }, 500);
        return;
      }

      const currentPhase = phases[phaseIndex];
      const duration = PHASE_TIMINGS[currentPhase];

      timeoutRef.current = setTimeout(() => {
        if (!isMountedRef.current) return;

        setPhase(currentPhase);
        setCursorPos(cursorPositions[currentPhase]);

        if (currentPhase === "revealWidget") {
          setShowBooking(true);
        }
        if (currentPhase === "success") {
          setPublished(true);
        }

        schedulePhase(phaseIndex + 1);
      }, duration);

      elapsed += duration;
    };

    schedulePhase(0);
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    
    if (shouldReduceMotion) {
      setShowBooking(true);
      setPublished(true);
      setPhase("success");
      return;
    }
    
    const startTimer = setTimeout(() => {
      runAnimation();
    }, 500);

    return () => {
      isMountedRef.current = false;
      clearTimeout(startTimer);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [runAnimation, shouldReduceMotion]);

  return (
    <div className="relative w-full max-w-2xl mx-auto" data-testid="animated-builder-demo">
      <div className="absolute -top-4 -left-6 w-4 h-4 rounded-full bg-purple-400/60" />
      <div className="absolute -top-2 -right-8 w-3 h-3 rounded-full bg-indigo-400/60" />
      <div className="absolute -bottom-6 -left-4 w-5 h-5 rounded-full bg-cyan-400/40" />
      <div className="absolute -bottom-4 -right-6 w-3 h-3 rounded-full bg-orange-400/50" />
      <div className="absolute top-1/2 -right-10 w-2 h-2 rounded-full bg-green-400/50" />

      <div className="relative bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200">
        <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-yellow-400" />
            <div className="w-3 h-3 rounded-full bg-green-400" />
          </div>
          
          <div className="flex-1 flex justify-center">
            <div className="flex bg-gray-200/80 rounded-lg p-0.5">
              <button
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  !published ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                }`}
              >
                Build
              </button>
              <button
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1 ${
                  published ? "bg-green-500 text-white shadow-sm" : "text-gray-500"
                }`}
              >
                <Rocket className="w-3 h-3" />
                Publish
                {published && <CheckCircle2 className="w-3 h-3" />}
              </button>
            </div>
          </div>
          
          <div className="w-16" />
        </div>

        <div className="flex min-h-[280px]">
          <div className="w-28 bg-gray-50 border-r border-gray-200 p-2 space-y-1">
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-2 mb-2">
              Components
            </div>
            <SidebarItem 
              icon={Type} 
              label="Hero" 
              highlighted={false}
            />
            <SidebarItem 
              icon={Calendar} 
              label="Booking" 
              highlighted={phase === "moveToSidebar"}
              selected={phase === "clickBooking" || showBooking}
            />
            <SidebarItem 
              icon={LayoutGrid} 
              label="Features" 
              highlighted={false}
            />
            <SidebarItem 
              icon={Image} 
              label="Gallery" 
              highlighted={false}
            />
          </div>

          <div className="flex-1 p-4 bg-gradient-to-br from-gray-100 to-gray-50">
            <div className="space-y-3">
              <div className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-5 h-5 rounded bg-gradient-to-br from-cyan-400 to-blue-500" />
                  <div className="h-2.5 bg-gray-200 rounded w-24" />
                </div>
                <div className="h-2 bg-gray-100 rounded w-full mb-1" />
                <div className="h-2 bg-gray-100 rounded w-3/4" />
              </div>

              <BookingWidget visible={showBooking} />

              <div className="bg-white/50 rounded-lg p-3 border border-dashed border-gray-300">
                <div className="flex items-center justify-center gap-2 text-gray-400">
                  <LayoutGrid className="w-4 h-4" />
                  <span className="text-xs">Drop component here</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Cursor x={cursorPos.x} y={cursorPos.y} clicking={isClicking} />

        {published && (
          <div className="absolute inset-0 bg-green-500/10 pointer-events-none animate-pulse" />
        )}
      </div>

      <div className="mt-6 flex justify-center">
        <div className="flex items-center gap-3 px-5 py-2.5 bg-white/80 backdrop-blur rounded-full border shadow-sm">
          <span
            className={`w-2.5 h-2.5 rounded-full transition-colors duration-300 ${
              published ? "bg-green-500" : "bg-indigo-500 animate-pulse"
            }`}
          />
          <span className="text-sm font-medium text-gray-600">
            {phase === "idle" && "Ready to build..."}
            {phase === "moveToSidebar" && "Selecting component..."}
            {phase === "clickBooking" && "Adding Booking..."}
            {phase === "moveToCanvas" && "Placing on canvas..."}
            {phase === "revealWidget" && "Component added!"}
            {phase === "moveToPublish" && "Ready to publish..."}
            {phase === "clickPublish" && "Publishing..."}
            {phase === "success" && "Website is live! 🚀"}
          </span>
        </div>
      </div>
    </div>
  );
}
