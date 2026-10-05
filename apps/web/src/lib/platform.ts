import { useState, useEffect } from "react";

export type Platform = "browser" | "desktop";

class PlatformManager {
  private override: Platform | null = null;

  setOverride(platform: Platform | null) {
    this.override = platform;
    window.dispatchEvent(new Event("arcane-platform-change"));
  }

  get(): Platform {
    if (this.override) return this.override;
    // VERY naive check for desktop environments for now
    if (typeof window !== "undefined" && (window as any).__TAURI__ || navigator.userAgent.toLowerCase().includes("electron")) {
      return "desktop";
    }
    return "browser";
  }
}

export const platformManager = new PlatformManager();

export function usePlatform(): Platform {
  const [platform, setPlatform] = useState<Platform>(platformManager.get());

  useEffect(() => {
    const handlePlatformChange = () => setPlatform(platformManager.get());
    window.addEventListener("arcane-platform-change", handlePlatformChange);
    return () => window.removeEventListener("arcane-platform-change", handlePlatformChange);
  }, []);

  return platform;
}
