import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { useLocation } from "wouter";
import { type User, type Session } from "@supabase/supabase-js";
import { getSupabase } from "./supabaseClient";

export type Profile = {
  id: string;
  email: string;
  fullName: string;
  phoneNumber: string;
  createdAt: string;
};

type AuthContextType = {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  isLoading: boolean;
  isEmailVerified: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (data: { email: string; password: string; fullName: string; phoneNumber: string }) => Promise<{ needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, setLocation] = useLocation();

  const isEmailVerified = user?.email_confirmed_at != null;

  useEffect(() => {
    const supabase = getSupabase();
    
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user && session.user.email_confirmed_at) {
        fetchProfile(session.user.id, session.access_token);
      } else {
        setIsLoading(false);
      }
    });

    // Listen for auth changes (including email confirmation callback)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user && session.user.email_confirmed_at) {
        fetchProfile(session.user.id, session.access_token);
        
        // Redirect to dashboard after email confirmation
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          const currentPath = window.location.pathname;
          if (currentPath === '/auth/callback' || currentPath === '/auth') {
            setLocation("/dashboard");
          }
        }
      } else {
        setProfile(null);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string, accessToken: string) => {
    try {
      const response = await fetch(`/api/profile/${userId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshSession = async () => {
    const supabase = getSupabase();
    const { data } = await supabase.auth.refreshSession();
    if (data.session) {
      setSession(data.session);
      setUser(data.user);
    }
  };

  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message);
      }

      const { user, profile, session } = result;
      setUser(user);
      setProfile(profile);
      setSession(session);
      
      const supabase = getSupabase();
      await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
      
      setLocation("/dashboard");
    } catch (error: any) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (data: { email: string; password: string; fullName: string; phoneNumber: string }) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message);
      }

      // If session exists, email confirmation is disabled
      if (result.session) {
        setUser(result.user);
        setSession(result.session);
        
        const supabase = getSupabase();
        await supabase.auth.setSession({
          access_token: result.session.access_token,
          refresh_token: result.session.refresh_token,
        });
        
        // Fetch profile with auth token
        await fetchProfile(result.user.id, result.session.access_token);
        setLocation("/dashboard");
        return { needsEmailConfirmation: false };
      }

      // Email confirmation required
      return { needsEmailConfirmation: true };
    } catch (error: any) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    const supabase = getSupabase();
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setSession(null);
    setIsLoading(false);
    setLocation("/");
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      session, 
      isLoading, 
      isEmailVerified,
      signIn, 
      signUp, 
      signOut,
      refreshSession
    }}>
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
