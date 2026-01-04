import type { BuilderStateData } from "./schema";

export type HistoryEntry = {
  timestamp: number;
  state: BuilderStateData;
  description: string;
};

export type BuilderHistory = {
  entries: HistoryEntry[];
  currentIndex: number;
  maxEntries: number;
};

export function createHistory(initialState: BuilderStateData, maxEntries = 50): BuilderHistory {
  return {
    entries: [{
      timestamp: Date.now(),
      state: structuredClone(initialState),
      description: 'Initial state',
    }],
    currentIndex: 0,
    maxEntries,
  };
}

export function pushHistory(
  history: BuilderHistory, 
  newState: BuilderStateData, 
  description: string
): BuilderHistory {
  const newEntries = history.entries.slice(0, history.currentIndex + 1);
  
  newEntries.push({
    timestamp: Date.now(),
    state: structuredClone(newState),
    description,
  });
  
  if (newEntries.length > history.maxEntries) {
    newEntries.shift();
  }
  
  return {
    ...history,
    entries: newEntries,
    currentIndex: newEntries.length - 1,
  };
}

export function undo(history: BuilderHistory): { history: BuilderHistory; state: BuilderStateData | null } {
  if (history.currentIndex <= 0) {
    return { history, state: null };
  }
  
  const newIndex = history.currentIndex - 1;
  return {
    history: { ...history, currentIndex: newIndex },
    state: structuredClone(history.entries[newIndex].state),
  };
}

export function redo(history: BuilderHistory): { history: BuilderHistory; state: BuilderStateData | null } {
  if (history.currentIndex >= history.entries.length - 1) {
    return { history, state: null };
  }
  
  const newIndex = history.currentIndex + 1;
  return {
    history: { ...history, currentIndex: newIndex },
    state: structuredClone(history.entries[newIndex].state),
  };
}

export function canUndo(history: BuilderHistory): boolean {
  return history.currentIndex > 0;
}

export function canRedo(history: BuilderHistory): boolean {
  return history.currentIndex < history.entries.length - 1;
}

export function getHistoryList(history: BuilderHistory): Array<{ index: number; description: string; timestamp: number; isCurrent: boolean }> {
  return history.entries.map((entry, index) => ({
    index,
    description: entry.description,
    timestamp: entry.timestamp,
    isCurrent: index === history.currentIndex,
  }));
}
