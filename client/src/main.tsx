import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Fetch Supabase config from server before initializing app
fetch("/api/config")
  .then((res) => res.json())
  .then((config) => {
    (window as any).__SUPABASE_URL__ = config.supabaseUrl;
    (window as any).__SUPABASE_ANON_KEY__ = config.supabaseAnonKey;
    
    createRoot(document.getElementById("root")!).render(<App />);
  })
  .catch((error) => {
    console.error("Failed to load config:", error);
    // Still render the app even if config fails
    createRoot(document.getElementById("root")!).render(<App />);
  });
