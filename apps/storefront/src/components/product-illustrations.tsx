import React from "react";

export function SneakerIllustration({ className = "w-full h-auto" }: { className?: string }) {
  return (
    <svg 
      viewBox="15 12 245 124" 
      className={className} 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        {/* Upper Leather & Engineered Mesh Gradients */}
        <linearGradient id="snk-upper-base" x1="240" y1="32" x2="20" y2="105" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="40%" stopColor="#F8FAFC" />
          <stop offset="80%" stopColor="#F1F5F9" />
          <stop offset="100%" stopColor="#E2E8F0" />
        </linearGradient>
        <linearGradient id="snk-toe-mesh" x1="24" y1="75" x2="95" y2="92" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="60%" stopColor="#F8FAFC" />
          <stop offset="100%" stopColor="#E2E8F0" />
        </linearGradient>

        {/* Dynamic Speed Swoosh Gradients */}
        <linearGradient id="snk-swoosh-grad" x1="215" y1="54" x2="60" y2="82" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#C084FC" />
          <stop offset="35%" stopColor="#9333EA" />
          <stop offset="70%" stopColor="#7C3AED" />
          <stop offset="100%" stopColor="#4F46E5" />
        </linearGradient>
        <linearGradient id="snk-swoosh-ridge" x1="70" y1="75" x2="210" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="50%" stopColor="#F5D0FE" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#C084FC" stopOpacity="0.7" />
        </linearGradient>

        {/* Sculpted Foam Midsole Gradients */}
        <linearGradient id="snk-midsole-body" x1="248" y1="82" x2="20" y2="124" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="30%" stopColor="#F8FAFC" />
          <stop offset="70%" stopColor="#F1F5F9" />
          <stop offset="100%" stopColor="#E2E8F0" />
        </linearGradient>
        <linearGradient id="snk-sole-accent" x1="240" y1="92" x2="145" y2="104" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#C084FC" />
          <stop offset="45%" stopColor="#8B5CF6" />
          <stop offset="100%" stopColor="#6D28D9" />
        </linearGradient>

        {/* High-Contrast Obsidian Black Heel Counter */}
        <linearGradient id="snk-heel-obsidian" x1="250" y1="32" x2="150" y2="92" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#252638" />
          <stop offset="30%" stopColor="#121320" />
          <stop offset="75%" stopColor="#0B0C14" />
          <stop offset="100%" stopColor="#050608" />
        </linearGradient>

        {/* Contact Shadow & Bloom Filters */}
        <filter id="snk-ground-blur" x="5" y="118" width="270" height="30" filterUnits="userSpaceOnUse">
          <feGaussianBlur stdDeviation="5.5" />
        </filter>
        <filter id="snk-tight-shadow" x="15" y="122" width="250" height="20" filterUnits="userSpaceOnUse">
          <feGaussianBlur stdDeviation="2.5" />
        </filter>
        <filter id="snk-ambient-glow" x="35" y="55" width="210" height="75" filterUnits="userSpaceOnUse">
          <feGaussianBlur stdDeviation="10" />
        </filter>
      </defs>

      {/* Ambient Violet Contact Aura behind shoe */}
      <ellipse cx="140" cy="124" rx="95" ry="12" fill="#8B5CF6" opacity="0.25" filter="url(#snk-ambient-glow)" />

      {/* Ground Contact Shadow (2-stage realistic weight) */}
      <ellipse cx="140" cy="130" rx="112" ry="7" fill="#000000" opacity="0.5" filter="url(#snk-ground-blur)" />
      <ellipse cx="145" cy="129" rx="80" ry="3.5" fill="#000000" opacity="0.75" filter="url(#snk-tight-shadow)" />

      {/* Outsole: Durable Black Rubber Traction Tread with Toe Spring Curve */}
      <path
        d="M248 118 C 220 123, 145 123, 85 122 C 52 121, 30 114, 20 102 C 22 108, 34 120, 72 123 C 135 127, 220 127, 248 118 Z"
        fill="#080911"
      />
      {/* Outsole Grip Flex Grooves */}
      <g stroke="#334155" strokeWidth="2.2" strokeLinecap="round">
        <path d="M232 123 L230 119" />
        <path d="M202 124 L200 120" />
        <path d="M172 124 L170 120" />
        <path d="M142 123 L140 119" />
        <path d="M112 122 L110 118" />
        <path d="M82 120 L80 116" />
      </g>

      {/* Midsole: Sculpted Ergonomic Performance Foam (Heel Flare, Arch Scoop, Toe Spring) */}
      <path
        d="M248 90 C 257 100, 258 111, 248 118 C 220 123, 145 123, 80 120 C 44 117, 26 107, 20 98 C 22 91, 38 88, 72 90 C 125 93, 185 93, 248 90 Z"
        fill="url(#snk-midsole-body)"
        stroke="#CBD5E1"
        strokeWidth="0.8"
      />
      {/* Midsole Top Chamfer Highlight */}
      <path
        d="M26 95 C 38 91, 72 91, 125 93 C 180 93, 235 90, 248 90"
        stroke="#FFFFFF"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.95"
      />

      {/* Midsole Heel Cushion Insert: Electric Violet Ergonomic Pod */}
      <path
        d="M240 97 C 216 97, 175 95, 142 93 C 134 97, 142 106, 168 108 C 200 110, 232 107, 240 97 Z"
        fill="url(#snk-sole-accent)"
      />
      <path
        d="M230 98 C 208 98, 175 96, 146 94"
        stroke="#F5D0FE"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.9"
      />

      {/* Main Upper: Aerodynamic White Engineered Upper */}
      <path
        d="M23 92 C 17 84, 21 75, 33 70 C 50 63, 76 60, 112 52 C 138 47, 158 40, 178 35 C 188 40, 198 44, 208 42 C 216 38, 222 32, 228 30 C 239 44, 250 68, 248 90 C 218 92, 142 93, 72 90 C 42 89, 26 91, 23 92 Z"
        fill="url(#snk-upper-base)"
        stroke="#CBD5E1"
        strokeWidth="0.8"
      />

      {/* Toe Box Mesh Layer Overlay */}
      <path
        d="M23 92 C 18 85, 22 76, 33 71 C 48 65, 70 62, 98 58 C 93 75, 80 87, 52 90 C 35 91, 25 91, 23 92 Z"
        fill="url(#snk-toe-mesh)"
        opacity="0.75"
      />

      {/* Obsidian Black Heel Counter & Collar Notch */}
      <path
        d="M152 92 C 164 71, 180 50, 200 43 C 213 43, 222 35, 228 30 C 239 44, 250 68, 248 90 C 218 92, 180 92, 152 92 Z"
        fill="url(#snk-heel-obsidian)"
      />
      {/* Heel Counter Specular Rim */}
      <path
        d="M154 90 C 165 69, 181 49, 200 43"
        stroke="#475569"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.75"
      />

      {/* Padded Sockliner / Collar Opening */}
      <path
        d="M178 35 C 185 42, 195 46, 205 46 C 215 46, 223 37, 228 30 C 221 35, 211 42, 198 42 C 188 42, 178 35, 178 35 Z"
        fill="#080812"
      />
      {/* Purple Achilles Pull-Tab Loop */}
      <path 
        d="M228 30 C 234 22, 230 14, 223 15 C 218 16, 216 22, 218 29 Z" 
        fill="#9333EA" 
        stroke="#C084FC"
        strokeWidth="1"
      />

      {/* Dynamic Purple Speed Swoosh / Lateral Wave */}
      <path
        d="M68 76 C 94 74, 126 69, 158 64 C 182 60, 204 61, 214 65 C 202 72, 172 75, 142 75 C 108 75, 82 76, 68 76 Z"
        fill="url(#snk-swoosh-grad)"
      />
      {/* Swoosh Top Luminous Ridge Highlight */}
      <path
        d="M76 75 C 103 73, 133 68, 163 63 C 184 60, 204 61, 212 64"
        stroke="url(#snk-swoosh-ridge)"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* Clean White Athletic Toe Cap Reinforcement Overlay */}
      <path
        d="M23 92 C 19 87, 19 80, 27 73 C 36 71, 45 77, 47 84 C 47 89, 34 91, 23 92 Z"
        fill="url(#snk-toe-mesh)"
        stroke="#CBD5E1"
        strokeWidth="0.8"
      />

      {/* Obsidian Tongue */}
      <path 
        d="M130 54 C 143 47, 158 41, 170 36 C 167 42, 161 49, 158 54 Z" 
        fill="#0D0F1C" 
      />

      {/* Crisp White Athletic Laces */}
      <g stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M102 65 L119 59" />
        <path d="M119 58 L136 52" />
        <path d="M136 51 L153 45" />
        <path d="M153 44 L170 38" />
      </g>
      {/* Eyelet Reinforcement Accents */}
      <circle cx="102" cy="65" r="2" fill="#9333EA" />
      <circle cx="119" cy="58" r="2" fill="#9333EA" />
      <circle cx="136" cy="51" r="2" fill="#9333EA" />
      <circle cx="153" cy="44" r="2" fill="#9333EA" />

      {/* Perforation Ventilation Dots on Toe Box */}
      <g fill="#94A3B8" opacity="0.65">
        <circle cx="58" cy="77" r="1.2" />
        <circle cx="51" cy="79" r="1.2" />
        <circle cx="44" cy="81" r="1.2" />
        <circle cx="37" cy="83" r="1.2" />
        <circle cx="54" cy="73" r="1.2" />
        <circle cx="47" cy="75" r="1.2" />
        <circle cx="40" cy="77" r="1.2" />
      </g>
    </svg>
  );
}

export function HoodieIllustration({ className = "w-full h-auto" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="hd-grad" x1="20" y1="20" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#334155" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
      </defs>
      {/* Hood */}
      <path d="M42 22 C 45 12, 75 12, 78 22 C 85 30, 80 40, 75 42 C 60 45, 45 42, 42 22 Z" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
      {/* Drawstrings */}
      <path d="M54 38 L53 58 M66 38 L67 58" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="53" cy="59" r="1" fill="#cbd5e1" />
      <circle cx="67" cy="59" r="1" fill="#cbd5e1" />
      {/* Body & Sleeves */}
      <path d="M38 38 L18 65 L28 72 L38 56 L38 102 L82 102 L82 56 L92 72 L102 65 L82 38 C 75 42, 45 42, 38 38 Z" fill="url(#hd-grad)" />
      {/* Kangaroo Pocket */}
      <path d="M46 76 L74 76 L78 94 L42 94 Z" fill="#1e293b" stroke="#475569" strokeWidth="1" />
      {/* Hem Ribbing */}
      <rect x="38" y="98" width="44" height="4" fill="#1e293b" />
    </svg>
  );
}

export function WatchIllustration({ className = "w-full h-auto" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Strap */}
      <rect x="52" y="10" width="16" height="100" rx="3" fill="#1e1e2d" stroke="#334155" strokeWidth="1" />
      {/* Watch Case */}
      <circle cx="60" cy="60" r="26" fill="#0f172a" stroke="#64748b" strokeWidth="2.5" />
      <circle cx="60" cy="60" r="22" fill="#020617" stroke="#1e293b" strokeWidth="1" />
      {/* Dial Hour Markers */}
      <line x1="60" y1="42" x2="60" y2="46" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
      <line x1="60" y1="74" x2="60" y2="78" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
      <line x1="42" y1="60" x2="46" y2="60" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
      <line x1="74" y1="60" x2="78" y2="60" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
      {/* Hands */}
      <line x1="60" y1="60" x2="60" y2="48" stroke="#f8fafc" strokeWidth="2" strokeLinecap="round" />
      <line x1="60" y1="60" x2="70" y2="60" stroke="#f8fafc" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="60" y1="60" x2="52" y2="68" stroke="#8b5cf6" strokeWidth="1" strokeLinecap="round" />
      <circle cx="60" cy="60" r="2" fill="#8b5cf6" />
    </svg>
  );
}

export function BagIllustration({ className = "w-full h-auto" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg-grad" x1="30" y1="40" x2="90" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#334155" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
      </defs>
      {/* Strap */}
      <path d="M25 30 Q 60 15, 95 30" stroke="#475569" strokeWidth="5" strokeLinecap="round" fill="none" />
      {/* Main Bag Flap & Body */}
      <rect x="30" y="42" width="60" height="48" rx="8" fill="url(#bg-grad)" stroke="#475569" strokeWidth="1.5" />
      <path d="M30 42 Q 60 62, 90 42 L90 66 Q 60 76, 30 66 Z" fill="#1e293b" stroke="#334155" strokeWidth="1" />
      {/* Metal Clasp / Buckle */}
      <rect x="55" y="68" width="10" height="8" rx="2" fill="#94a3b8" />
      <rect x="57" y="70" width="6" height="4" rx="1" fill="#475569" />
    </svg>
  );
}

export function PackageIllustration({ className = "w-full h-auto" }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 200 160" 
      className={className} 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        {/* Isometric Box Face Gradients with Physical Light Falloff */}
        <linearGradient id="pkg-top-light" x1="100" y1="20" x2="100" y2="76" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#D8B4FE" />
          <stop offset="45%" stopColor="#C084FC" />
          <stop offset="85%" stopColor="#A855F7" />
          <stop offset="100%" stopColor="#9333EA" />
        </linearGradient>
        <linearGradient id="pkg-left-shade" x1="44" y1="50" x2="100" y2="126" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#8B5CF6" />
          <stop offset="40%" stopColor="#7C3AED" />
          <stop offset="85%" stopColor="#6D28D9" />
          <stop offset="100%" stopColor="#581C87" />
        </linearGradient>
        <linearGradient id="pkg-right-shade" x1="100" y1="50" x2="156" y2="126" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6D28D9" />
          <stop offset="45%" stopColor="#581C87" />
          <stop offset="85%" stopColor="#4C1D95" />
          <stop offset="100%" stopColor="#3B0764" />
        </linearGradient>

        {/* Glossy Translucent Ribbons */}
        <linearGradient id="pkg-ribbon-top-h" x1="44" y1="50" x2="156" y2="50" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F5D0FE" stopOpacity="0.95" />
          <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#E879F9" stopOpacity="0.8" />
        </linearGradient>
        <linearGradient id="pkg-ribbon-top-v" x1="100" y1="24" x2="100" y2="76" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="60%" stopColor="#F5D0FE" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#C084FC" stopOpacity="0.75" />
        </linearGradient>
        <linearGradient id="pkg-ribbon-left" x1="72" y1="63" x2="72" y2="113" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#E9D5FF" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#A855F7" stopOpacity="0.75" />
        </linearGradient>
        <linearGradient id="pkg-ribbon-right" x1="128" y1="63" x2="128" y2="113" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#C084FC" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#7C3AED" stopOpacity="0.65" />
        </linearGradient>

        {/* Filters */}
        <filter id="pkg-ambient-aura" x="15" y="15" width="170" height="130" filterUnits="userSpaceOnUse">
          <feGaussianBlur stdDeviation="16" />
        </filter>
        <filter id="pkg-ground-shadow" x="15" y="116" width="170" height="32" filterUnits="userSpaceOnUse">
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>

      {/* Ground Contact Shadow (2-tier realistic occlusion) */}
      <ellipse cx="100" cy="132" rx="72" ry="10" fill="#000000" opacity="0.55" filter="url(#pkg-ground-shadow)" />
      <ellipse cx="100" cy="130" rx="45" ry="5.5" fill="#000000" opacity="0.65" filter="url(#pkg-ground-shadow)" />

      {/* Ambient Purple Luminous Core behind Box */}
      <circle cx="100" cy="78" r="50" fill="#9333EA" opacity="0.35" filter="url(#pkg-ambient-aura)" />

      {/* 3D Isometric Parcel Body */}
      {/* Top Plane (Illuminated diamond) */}
      <polygon 
        points="100,24 156,50 100,76 44,50" 
        fill="url(#pkg-top-light)" 
        stroke="#F3E8FF" 
        strokeWidth="0.8" 
      />
      {/* Top Ribbons (Intersecting Cross) */}
      <polygon points="93,27 107,33 107,73 93,67" fill="url(#pkg-ribbon-top-v)" />
      <polygon points="48,52 62,46 152,48 138,54" fill="url(#pkg-ribbon-top-h)" />

      {/* Left Shaded Plane */}
      <polygon 
        points="44,50 100,76 100,126 44,100" 
        fill="url(#pkg-left-shade)" 
        stroke="#7C3AED" 
        strokeWidth="0.6" 
      />
      {/* Left Vertical Ribbon Band */}
      <polygon points="66,60 78,66 78,116 66,110" fill="url(#pkg-ribbon-left)" />

      {/* Right Shaded Plane (Deep volume shadow) */}
      <polygon 
        points="100,76 156,50 156,100 100,126" 
        fill="url(#pkg-right-shade)" 
        stroke="#4C1D95" 
        strokeWidth="0.6" 
      />
      {/* Right Vertical Ribbon Band */}
      <polygon points="122,66 134,60 134,110 122,116" fill="url(#pkg-ribbon-right)" />

      {/* Ridge Bevel Highlights (Key light catching the isometric edges) */}
      <line x1="100" y1="77" x2="100" y2="124" stroke="#D8B4FE" strokeWidth="1.2" strokeLinecap="round" opacity="0.85" />
      <line x1="45" y1="50" x2="99" y2="76" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" opacity="0.9" />
      <line x1="101" y1="76" x2="155" y2="50" stroke="#C084FC" strokeWidth="0.9" strokeLinecap="round" opacity="0.75" />
      {/* Specular Vertex Glints */}
      <circle cx="100" cy="76" r="1.5" fill="#FFFFFF" opacity="0.95" />
      <circle cx="100" cy="24" r="1.2" fill="#FFFFFF" opacity="0.95" />

    </svg>
  );
}

export function DeliveryTruckIllustration({ className = "w-full h-auto" }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 240 130" 
      className={className} 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        {/* Cargo Box Gradients */}
        <linearGradient id="trk-box-body" x1="30" y1="20" x2="140" y2="90" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="65%" stopColor="#F1F5F9" />
          <stop offset="100%" stopColor="#CBD5E1" />
        </linearGradient>
        <linearGradient id="trk-box-roof" x1="30" y1="12" x2="140" y2="25" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#E2E8F0" />
        </linearGradient>
        
        {/* Cabin Gradients */}
        <linearGradient id="trk-cab-body" x1="135" y1="35" x2="195" y2="90" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#8B5CF6" />
          <stop offset="50%" stopColor="#7C3AED" />
          <stop offset="100%" stopColor="#581C87" />
        </linearGradient>
        <linearGradient id="trk-cab-front" x1="180" y1="40" x2="202" y2="90" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#7C3AED" />
          <stop offset="100%" stopColor="#4C1D95" />
        </linearGradient>
        
        {/* Headlight Conical Beam */}
        <linearGradient id="trk-light-beam" x1="192" y1="78" x2="238" y2="85" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FEF08A" stopOpacity="0.9" />
          <stop offset="45%" stopColor="#FDE047" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#FDE047" stopOpacity="0" />
        </linearGradient>

        <filter id="trk-ground-shadow" x="15" y="98" width="200" height="25" filterUnits="userSpaceOnUse">
          <feGaussianBlur stdDeviation="4.5" />
        </filter>
      </defs>

      {/* Ground Contact Shadow */}
      <ellipse cx="118" cy="112" rx="95" ry="8" fill="#000000" opacity="0.55" filter="url(#trk-ground-shadow)" />

      {/* Motion Speed Streaks Behind Cargo Box (Speeding to the right) */}
      <g className="truck-speed-lines" strokeLinecap="round" opacity="0.85">
        <path d="M-5 42 L32 42" stroke="#D946EF" strokeWidth="2.8" />
        <path d="M-15 58 L28 58" stroke="#38BDF8" strokeWidth="2.2" />
        <path d="M2 74 L36 74" stroke="#A855F7" strokeWidth="2.8" />
        <path d="M-8 86 L22 86" stroke="#818CF8" strokeWidth="2" />
      </g>

      {/* Headlight Conical Light Beam Projecting Forward */}
      <polygon points="194,76 238,62 238,98 194,86" fill="url(#trk-light-beam)" />

      {/* 3D Cargo Box Roof Bevel */}
      <polygon 
        points="32,26 42,19 144,19 144,26" 
        fill="url(#trk-box-roof)" 
        stroke="#CBD5E1" 
        strokeWidth="0.8" 
      />

      {/* Cargo Box Main Side Panel */}
      <rect 
        x="32" 
        y="26" 
        width="112" 
        height="64" 
        rx="2" 
        fill="url(#trk-box-body)" 
        stroke="#94A3B8" 
        strokeWidth="0.8" 
      />

      {/* Box Violet Horizontal Branding Band */}
      <rect x="32" y="50" width="112" height="15" fill="#7C3AED" />
      <line x1="32" y1="52" x2="144" y2="52" stroke="#C084FC" strokeWidth="1.2" />
      <line x1="32" y1="63" x2="144" y2="63" stroke="#6D28D9" strokeWidth="1" />
      {/* White Logo Accent Bar */}
      <rect x="44" y="55" width="28" height="5" rx="1.5" fill="#FFFFFF" opacity="0.95" />

      {/* Cargo Box Seam Lines & Rivets */}
      <line x1="88" y1="26" x2="88" y2="90" stroke="#CBD5E1" strokeWidth="1" />
      <line x1="32" y1="26" x2="144" y2="26" stroke="#FFFFFF" strokeWidth="1" />

      {/* Heavy-Duty Undercarriage Chassis Rail */}
      <rect x="36" y="88" width="154" height="8" rx="2" fill="#0F172A" />

      {/* Cabin Side Assembly in Glossy Violet */}
      <path 
        d="M144,34 L176,34 C184,34 190,40 193,48 L198,66 C200,72 196,78 190,78 L144,78 Z" 
        fill="url(#trk-cab-body)" 
        stroke="#581C87" 
        strokeWidth="0.8" 
      />

      {/* Wraparound Tinted Windshield & Glass Specular Highlights */}
      <path 
        d="M150,38 L174,38 C180,38 184,42 186,48 L188,58 L150,58 Z" 
        fill="#0B0F19" 
        stroke="#1E293B" 
        strokeWidth="1" 
      />
      {/* Windshield Reflection Line */}
      <line x1="154" y1="41" x2="178" y2="55" stroke="#FFFFFF" strokeWidth="1.6" opacity="0.5" strokeLinecap="round" />

      {/* Side Driver Window */}
      <rect x="150" y="42" width="18" height="14" rx="2" fill="#0F172A" opacity="0.85" />
      {/* Side Mirror in Dark Slate */}
      <rect x="174" y="50" width="4.5" height="10" rx="1.5" fill="#1E293B" stroke="#475569" strokeWidth="0.8" />

      {/* Cabin Front Grille & Bumper */}
      <path 
        d="M192,66 L198,66 C201,66 203,69 203,72 L203,84 C203,86 201,88 198,88 L190,88 Z" 
        fill="url(#trk-cab-front)" 
      />
      {/* Front Heavy Bumper */}
      <rect x="190" y="83" width="14" height="8" rx="2.5" fill="#334155" stroke="#64748B" strokeWidth="0.8" />

      {/* Glowing Dual Headlight Assemblies */}
      <g>
        <circle cx="196" cy="78" r="4" fill="#FEF08A" stroke="#FDE047" strokeWidth="1.2" />
        <circle cx="196" cy="78" r="2.2" fill="#FFFFFF" />
      </g>

      {/* Realistic Heavy-Duty Wheel Wells & Fenders */}
      <path d="M44 94 C 44 83, 80 83, 80 94 Z" fill="#0B0E17" />
      <path d="M150 94 C 150 83, 186 83, 186 94 Z" fill="#0B0E17" />

      {/* Realistic Heavy-Duty Wheels */}
      {/* Rear Wheel Pair (Under Box) */}
      <g className="truck-wheel truck-wheel-rear">
        <circle cx="62" cy="96" r="14.5" fill="#0A0C14" stroke="#1E293B" strokeWidth="1.2" />
        <circle cx="62" cy="96" r="9" fill="#334155" />
        <circle cx="62" cy="96" r="5" fill="#E2E8F0" />
        {/* Lug nuts / Spoke accents */}
        <circle cx="62" cy="92.5" r="0.9" fill="#0F172A" />
        <circle cx="62" cy="99.5" r="0.9" fill="#0F172A" />
        <circle cx="58.5" cy="96" r="0.9" fill="#0F172A" />
        <circle cx="65.5" cy="96" r="0.9" fill="#0F172A" />
        <circle cx="62" cy="96" r="2" fill="#475569" />
      </g>
      {/* Front Wheel (Under Cab) */}
      <g className="truck-wheel truck-wheel-front">
        <circle cx="168" cy="96" r="14.5" fill="#0A0C14" stroke="#1E293B" strokeWidth="1.2" />
        <circle cx="168" cy="96" r="9" fill="#334155" />
        <circle cx="168" cy="96" r="5" fill="#E2E8F0" />
        {/* Lug nuts / Spoke accents */}
        <circle cx="168" cy="92.5" r="0.9" fill="#0F172A" />
        <circle cx="168" cy="99.5" r="0.9" fill="#0F172A" />
        <circle cx="164.5" cy="96" r="0.9" fill="#0F172A" />
        <circle cx="171.5" cy="96" r="0.9" fill="#0F172A" />
        <circle cx="168" cy="96" r="2" fill="#475569" />
      </g>
    </svg>
  );
}

export function HeadphonesIllustration({ className = "w-full h-auto" }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 200 200" 
      className={className} 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        {/* Headband Arch Gradients */}
        <linearGradient id="hp-headband" x1="40" y1="20" x2="160" y2="120" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#334155" />
          <stop offset="40%" stopColor="#1E293B" />
          <stop offset="70%" stopColor="#0F172A" />
          <stop offset="100%" stopColor="#020617" />
        </linearGradient>
        <linearGradient id="hp-headband-cushion" x1="50" y1="25" x2="150" y2="70" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1E1B4B" />
          <stop offset="50%" stopColor="#0F172A" />
          <stop offset="100%" stopColor="#18181B" />
        </linearGradient>
        
        {/* Metallic Sliders */}
        <linearGradient id="hp-metal" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#E2E8F0" />
          <stop offset="45%" stopColor="#94A3B8" />
          <stop offset="70%" stopColor="#475569" />
          <stop offset="100%" stopColor="#CBD5E1" />
        </linearGradient>

        {/* Earcup Volume Gradients */}
        <radialGradient id="hp-cup-left" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#2E1065" />
          <stop offset="40%" stopColor="#1E1B4B" />
          <stop offset="75%" stopColor="#090A1A" />
          <stop offset="100%" stopColor="#030712" />
        </radialGradient>
        <radialGradient id="hp-cup-right" cx="40%" cy="30%" r="65%">
          <stop offset="0%" stopColor="#3B0764" />
          <stop offset="35%" stopColor="#1E1B4B" />
          <stop offset="80%" stopColor="#090A1A" />
          <stop offset="100%" stopColor="#030712" />
        </radialGradient>

        {/* Cushion Foam Texture */}
        <linearGradient id="hp-cushion-left" x1="20" y1="90" x2="65" y2="160" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1E293B" />
          <stop offset="50%" stopColor="#0F172A" />
          <stop offset="100%" stopColor="#020617" />
        </linearGradient>
        <linearGradient id="hp-cushion-right" x1="135" y1="90" x2="180" y2="160" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#334155" />
          <stop offset="60%" stopColor="#0F172A" />
          <stop offset="100%" stopColor="#020617" />
        </linearGradient>

        {/* Violet Specular Ring */}
        <linearGradient id="hp-glow-ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#C084FC" stopOpacity="0.9" />
          <stop offset="50%" stopColor="#818CF8" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#4F46E5" stopOpacity="0.4" />
        </linearGradient>

        <filter id="hp-shadow" x="15" y="150" width="170" height="40" filterUnits="userSpaceOnUse">
          <feGaussianBlur stdDeviation="7" />
        </filter>
        <filter id="hp-aura" x="30" y="30" width="140" height="140" filterUnits="userSpaceOnUse">
          <feGaussianBlur stdDeviation="15" />
        </filter>
      </defs>

      {/* Ambient Violet Backlight Aura */}
      <circle cx="100" cy="100" r="55" fill="#8B5CF6" opacity="0.22" filter="url(#hp-aura)" />

      {/* Ground Contact Shadow */}
      <ellipse cx="100" cy="172" rx="68" ry="10" fill="#000000" opacity="0.65" filter="url(#hp-shadow)" />
      <ellipse cx="100" cy="170" rx="42" ry="5" fill="#000000" opacity="0.8" />

      {/* Headband Outer Arc */}
      <path
        d="M38 110 C 36 60, 60 22, 100 22 C 140 22, 164 60, 162 110"
        stroke="url(#hp-headband)"
        strokeWidth="15"
        strokeLinecap="round"
      />
      {/* Headband Specular Highlight Edge */}
      <path
        d="M48 95 C 48 58, 68 28, 100 28 C 132 28, 152 58, 152 95"
        stroke="#94A3B8"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.6"
      />

      {/* Headband Underside Ergonomic Cushion Padding */}
      <path
        d="M56 90 C 58 54, 74 34, 100 34 C 126 34, 142 54, 144 90"
        stroke="url(#hp-headband-cushion)"
        strokeWidth="8"
        strokeLinecap="round"
        opacity="0.9"
      />

      {/* Left Slider / Yoke Fork */}
      <g>
        <rect x="36" y="98" width="6" height="18" rx="2" fill="url(#hp-metal)" />
        <path d="M39 114 C 34 118, 30 126, 30 134" stroke="url(#hp-metal)" strokeWidth="3" strokeLinecap="round" />
      </g>

      {/* Right Slider / Yoke Fork */}
      <g>
        <rect x="158" y="98" width="6" height="18" rx="2" fill="url(#hp-metal)" />
        <path d="M161 114 C 166 118, 170 126, 170 134" stroke="url(#hp-metal)" strokeWidth="3" strokeLinecap="round" />
      </g>

      {/* LEFT EARCUP (Slight Perspective Facing Inward) */}
      <g transform="rotate(-6 50 135)">
        {/* Memory Foam Cushion */}
        <ellipse cx="56" cy="135" rx="16" ry="28" fill="url(#hp-cushion-left)" stroke="#090D16" strokeWidth="1.5" />
        {/* Earcup Outer Shell */}
        <ellipse cx="48" cy="135" rx="18" ry="26" fill="url(#hp-cup-left)" stroke="#334155" strokeWidth="1" />
        {/* Beveled Rim Accent Ring */}
        <ellipse cx="48" cy="135" rx="14" ry="22" stroke="url(#hp-glow-ring)" strokeWidth="1.8" opacity="0.8" />
        {/* Center Cap Disc */}
        <ellipse cx="48" cy="135" rx="9" ry="15" fill="#0A0B14" stroke="#475569" strokeWidth="0.8" />
        {/* Specular Vertex Highlight */}
        <ellipse cx="45" cy="128" rx="4" ry="7" fill="#FFFFFF" opacity="0.25" />
      </g>

      {/* RIGHT EARCUP (Facing Viewer More Directly) */}
      <g transform="rotate(6 150 135)">
        {/* Memory Foam Cushion Inner Depth */}
        <ellipse cx="144" cy="135" rx="16" ry="28" fill="url(#hp-cushion-right)" stroke="#090D16" strokeWidth="1.5" />
        {/* Earcup Outer Shell */}
        <ellipse cx="152" cy="135" rx="18" ry="26" fill="url(#hp-cup-right)" stroke="#334155" strokeWidth="1" />
        {/* Luminous Violet Outer Accent Ring */}
        <ellipse cx="152" cy="135" rx="14" ry="22" stroke="url(#hp-glow-ring)" strokeWidth="1.8" opacity="0.85" />
        {/* Center Cap Disc */}
        <ellipse cx="152" cy="135" rx="9" ry="15" fill="#0A0B14" stroke="#475569" strokeWidth="0.8" />
        {/* Micro Indicator LED Dot */}
        <circle cx="158" cy="148" r="1.2" fill="#38BDF8" opacity="0.9" />
        {/* Specular Vertex Highlight */}
        <ellipse cx="154" cy="128" rx="4" ry="7" fill="#FFFFFF" opacity="0.3" />
      </g>
    </svg>
  );
}

