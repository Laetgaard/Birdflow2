import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { useLocation } from "wouter";

// Mock User Type
export type User = {
  id: string;
  email: string;
  full_name: string;
  phone_number?: string;
  confirmed_at?: string;
};

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string) => Promise<void>;
  signUp: (data: { email: string; full_name: string; phone_number: string }) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock Storage Key
const STORAGE_KEY = "mock_supabase_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Simulate checking session on load
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch (e) {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const signIn = async (email: string) => {
    setIsLoading(true);
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    // Mock login - in reality this would hit Supabase
    const mockUser: User = {
      id: "user_123",
      email,
      full_name: "Demo User",
      phone_number: "+1234567890",
      confirmed_at: new Date().toISOString(),
    };
    
    setUser(mockUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mockUser));
    setIsLoading(false);
    setLocation("/dashboard");
  };

  const signUp = async (data: { email: string; full_name: string; phone_number: string }) => {
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    // Mock signup
    const mockUser: User = {
      id: `user_${Math.random().toString(36).substr(2, 9)}`,
      email: data.email,
      full_name: data.full_name,
      phone_number: data.phone_number,
      // In real Supabase, this would be null until email confirmation
      // For this demo, we'll auto-confirm to let them in, 
      // but in a real app you'd show a "Check your email" screen.
      confirmed_at: new Date().toISOString(),
    };

    setUser(mockUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mockUser));
    setIsLoading(false);
    setLocation("/dashboard");
  };

  const signOut = async () => {
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
    setIsLoading(false);
    setLocation("/");
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
