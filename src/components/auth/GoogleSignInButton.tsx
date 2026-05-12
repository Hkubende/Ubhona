import * as React from "react";
import { appConfig } from "../../lib/config";

const GOOGLE_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (options: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              theme: "outline" | "filled_blue" | "filled_black";
              size: "large" | "medium" | "small";
              type: "standard" | "icon";
              shape: "rectangular" | "pill" | "circle" | "square";
              text: "signin_with" | "signup_with" | "continue_with" | "signin";
              width?: number;
            }
          ) => void;
        };
      };
    };
  }
}

let googleScriptPromise: Promise<void> | null = null;

function loadGoogleScript() {
  if (typeof window === "undefined") return Promise.reject(new Error("Google Sign-In requires a browser."));
  if (window.google?.accounts?.id) return Promise.resolve();
  if (googleScriptPromise) return googleScriptPromise;

  googleScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GOOGLE_SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Google Sign-In.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = GOOGLE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Sign-In."));
    document.head.appendChild(script);
  });

  return googleScriptPromise;
}

export function GoogleSignInButton({
  label = "signin_with",
  onCredential,
  onError,
}: {
  label?: "signin_with" | "signup_with" | "continue_with" | "signin";
  onCredential: (credential: string) => void;
  onError: (message: string) => void;
}) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const clientId = appConfig.googleClientId;
    if (!clientId) return;

    loadGoogleScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.google?.accounts?.id) return;
        containerRef.current.innerHTML = "";
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            const credential = String(response.credential || "").trim();
            if (!credential) {
              onError("Google Sign-In did not return a credential.");
              return;
            }
            onCredential(credential);
          },
        });
        window.google.accounts.id.renderButton(containerRef.current, {
          theme: "outline",
          size: "large",
          type: "standard",
          shape: "pill",
          text: label,
          width: 360,
        });
      })
      .catch((error) => {
        if (!cancelled) {
          onError(error instanceof Error ? error.message : "Failed to load Google Sign-In.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [label, onCredential, onError]);

  if (!appConfig.googleClientId) {
    return (
      <div className="rounded-2xl border border-border bg-[color:var(--ui-note-icon-bg)] px-3 py-2 text-center text-xs text-text-secondary/78">
        Google Sign-In is not configured for this environment.
      </div>
    );
  }

  return <div ref={containerRef} className="flex min-h-11 justify-center" />;
}
