"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A slim bar across the top of the window while a page is on its way.
 *
 * The App Router in this version publishes no navigation events, so the bar
 * starts from the click that will actually navigate and ends when the new path
 * has painted. It watches the document rather than wrapping every link, so a
 * row in a table, the sidebar and a breadcrumb all behave the same without
 * anyone having to remember to use a special component.
 *
 * It deliberately never reaches 100% on its own: the bar creeps towards the end
 * and only completes when the page is really there, so a slow route looks slow
 * instead of looking finished and then hanging.
 */

const CREEP_INTERVAL_MS = 220;
const CREEP_CEILING = 92;
/** A navigation that produces no path change would otherwise leave the bar up forever. */
const ABANDON_AFTER_MS = 10_000;

export function NavigationProgress() {
    const pathname = usePathname();
    const [progress, setProgress] = useState(0);
    const [visible, setVisible] = useState(false);
    const creep = useRef<ReturnType<typeof setInterval>>();
    const abandon = useRef<ReturnType<typeof setTimeout>>();
    const settle = useRef<ReturnType<typeof setTimeout>>();
    const running = useRef(false);

    const stop = useCallback(() => {
        clearInterval(creep.current);
        clearTimeout(abandon.current);
        running.current = false;
    }, []);

    const finish = useCallback(() => {
        if (!running.current) return;
        stop();
        setProgress(100);
        settle.current = setTimeout(() => {
            setVisible(false);
            setProgress(0);
        }, 260);
    }, [stop]);

    const start = useCallback(() => {
        if (running.current) return;
        running.current = true;
        clearTimeout(settle.current);
        setVisible(true);
        setProgress(12);
        // Each tick covers a smaller share of what is left, so the bar slows as it fills.
        creep.current = setInterval(() => {
            setProgress((current) => (current >= CREEP_CEILING ? current : current + (CREEP_CEILING - current) * 0.18));
        }, CREEP_INTERVAL_MS);
        abandon.current = setTimeout(finish, ABANDON_AFTER_MS);
    }, [finish]);

    // The destination has painted.
    useEffect(() => {
        finish();
    }, [pathname, finish]);

    useEffect(() => () => {
        clearInterval(creep.current);
        clearTimeout(abandon.current);
        clearTimeout(settle.current);
    }, []);

    useEffect(() => {
        function onClick(event: MouseEvent) {
            // Anything the browser will not handle as a plain in-page navigation.
            if (event.defaultPrevented || event.button !== 0) return;
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

            const anchor = (event.target as Element | null)?.closest?.("a");
            if (!anchor) return;
            const href = anchor.getAttribute("href");
            if (!href || anchor.hasAttribute("download") || anchor.getAttribute("target") === "_blank") return;
            if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;

            const destination = new URL(anchor.href, window.location.href);
            if (destination.origin !== window.location.origin) return;
            // Re-clicking the page you are already on navigates nowhere to wait for.
            if (destination.pathname === window.location.pathname && destination.search === window.location.search) return;

            start();
        }

        // Back and forward are navigations too, and they can be just as slow.
        function onPopState() {
            start();
        }

        document.addEventListener("click", onClick, { capture: true });
        window.addEventListener("popstate", onPopState);
        return () => {
            document.removeEventListener("click", onClick, { capture: true });
            window.removeEventListener("popstate", onPopState);
        };
    }, [start]);

    if (!visible) return null;
    return (
        <div className="sp-progress" aria-hidden>
            <span style={{ width: `${progress}%` }} />
        </div>
    );
}
