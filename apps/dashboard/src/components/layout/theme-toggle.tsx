"use client";
/**
 * Light/dark switch for the merchant topbar.
 *
 * Uses the View Transitions API to wipe the new theme in as a circle growing
 * from the button, which reads as one deliberate change rather than a flash.
 * Browsers without it get a short colour cross-fade, and reduced-motion users
 * get neither.
 */
import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

type ViewTransitionDocument = Document & { startViewTransition?: (update: () => void) => { finished: Promise<void> } };

export function ThemeToggle() {
    const { resolvedTheme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    // The server cannot know the viewer's theme, so the real icons wait for mount.
    useEffect(() => setMounted(true), []);

    const dark = resolvedTheme === "dark";

    function switchTheme(event: React.MouseEvent<HTMLButtonElement>) {
        const next = dark ? "light" : "dark";
        const root = document.documentElement;
        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const doc = document as ViewTransitionDocument;

        if (reduceMotion || typeof doc.startViewTransition !== "function") {
            root.classList.add("theme-fade");
            window.setTimeout(() => root.classList.remove("theme-fade"), 420);
            setTheme(next);
            return;
        }

        // Grow the circle from the button, out to whichever corner is furthest.
        const rect = event.currentTarget.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
        root.style.setProperty("--theme-x", `${x}px`);
        root.style.setProperty("--theme-y", `${y}px`);
        root.style.setProperty("--theme-r", `${radius}px`);
        root.classList.add("theme-switching");

        const transition = doc.startViewTransition(() => flushSync(() => setTheme(next)));
        const clear = () => root.classList.remove("theme-switching");
        // A backgrounded tab can leave `finished` pending, so the class is not
        // left to depend on it alone.
        const safety = window.setTimeout(clear, 1200);
        transition.finished.finally(() => { window.clearTimeout(safety); clear(); });
    }

    return (
        <button
            type="button"
            className="theme-toggle"
            onClick={switchTheme}
            aria-label={mounted ? `Switch to ${dark ? "light" : "dark"} mode` : "Switch colour theme"}
            title={mounted ? `Switch to ${dark ? "light" : "dark"} mode` : undefined}
        >
            {mounted && (
                <>
                    <Sun size={16} className="icon-sun" aria-hidden />
                    <Moon size={16} className="icon-moon" aria-hidden />
                </>
            )}
        </button>
    );
}
