# SellPilot homepage continuation — September 7, 2026

Continued the existing `ChatAiHome` implementation after inspecting the dirty worktree, recent homepage files, the running page, the original Chat AI Landing preview, and the supplied 31-second investment-platform video. The video informed the centered phone composition, floating elements, and scroll pacing.

## Homepage changes

- Replaced the layered dashboard hero with a centered AI sales phone and compact customer notifications. Six desktop positions rotate through 18 Banglish/English inquiries with avatars, channel badges, and optional product thumbnails. Three positions remain visible on small screens, covering Messenger, WhatsApp, and Website without obscuring the phone conversation.
- Each position changes every seven seconds, staggered across the scene, with enter/exit transitions. The phone loops through a customer inquiry, catalog lookup, product recommendation, and collection of order details.
- Added ambient floating, dotted connection paths, scroll parallax, progressive headline emphasis, and section reveals. Preview motion can be paused/resumed. Timers stop outside the hero and skip updates in hidden tabs; reduced-motion preferences show the complete phone example without continuous motion.
- Kept the existing typography families and violet palette, improved secondary text sizes, animated the existing product-tour controls, restored the `#workflow` anchor, and added a native disclosure FAQ.
- WhatsApp remains marked coming soon, based on the existing channel configuration. Conversations and products are labeled illustrative.

## Scope

Implementation is limited to the homepage component, its new animation component, homepage-only CSS, and the homepage CSS import. Existing navigation, auth, trial, catalog, checkout, dashboard, API, and backend code were preserved. No packages were added to the repository, and no deployment or data mutation was performed.

## Validation

- Storefront TypeScript, ESLint, and optimized production build passed.
- Browser checks at 1920×1080, 1440×900, 1280×800, 768×1024, 390×844, and 320×740 found no horizontal document overflow.
- Visually inspected desktop and mobile hero, product tour, and FAQ. Product thumbnails loaded and inquiries changed over time.
- Verified pause preserves notification content over an extended interval and pauses CSS floating; resume restores motion.
- Verified Recommend / Take action selected states, the workflow anchor, and FAQ expansion.
- Reduced-motion behavior was checked in code; the connected browser does not expose media-preference emulation.

This completes this homepage continuation. The broader dashboard and secondary-route audit described in `sellpilot-visual-reset-status.md` remains a separate scope.


## Hero interaction revision — latest request

The subsequent attached brief supersedes the original hero sizing and seven-second cadence above.

- Headline: “Customers are waiting. Your competitors are replying.” The desktop composition keeps the complete phone visible on load at 1280×800 and larger.
- Replaced the former 214–246 px wide / 72 px tall panels with content-sized profile notifications, approximately 125–195 px wide and 44 px tall on desktop (41 px tall on mobile). Notifications have a 24–27 px avatar, a tiny platform badge, a name, and a short inquiry. Product thumbnails remain optional.
- Two inquiries appear immediately, with the remaining tracks introduced over 2.45 seconds. Each track cycles every 4.6 seconds: directional entrance, gentle drift, a readable hold, and a fade toward the phone. Platforms rotate within each track across all three channels.
- The shared preview clock coordinates understanding, reply, recommendation, buying intent, and order initiation. The order beat begins at 4.2 seconds; a timed browser observation confirmed the order visible by 4.9 seconds after initial render.
- Phone, notification, channel-icon, and timeline logic are reusable components under `src/components/hero`. The clock pauses offscreen, in hidden tabs, on manual pause, and with reduced motion.
- The hero transitions into a continuous navy section with a progressive text reveal before the existing product narrative. Existing product pages, backend, and business flows remain intact.
- TypeScript, ESLint, and the optimized storefront build passed. Seven responsive checks (1920, 1440, 1280, 1051, 768, 390, and 320 px wide) showed no horizontal overflow and 10 px clearance between the order draft and phone composer. Browser observations confirmed changing platforms and pause/resume stability.
