"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { ChevronDown, Menu, X } from "lucide-react"
import { Brand, Action } from "./commerce-system"
import { LanguageSwitch } from "@/context/language-context"
import { ThemeToggle } from "./theme-toggle"

const navigation = [
  { label: "Products", links: [["AI Chatbot", "/products/ai-chatbot"], ["Store Builder", "/products/store-builder"]] },
  { label: "AI Assistant", href: "/test-ai" },
  { label: "Features", href: "/features" },
  { label: "Pricing", href: "/pricing" },
  { label: "Resources", links: [["Solutions", "/solutions"], ["About SellPilot", "/about"], ["Demo", "/demo"], ["Shop", "/shop"]] },
]

export function MarketingNav() {
  const [open, setOpen] = useState(false)
  const [dropdown, setDropdown] = useState<string | null>(null)
  const pathname = usePathname()

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); setDropdown(null) }
    }
    document.addEventListener("keydown", close)
    return () => document.removeEventListener("keydown", close)
  }, [])

  return <header className="reset-nav"><nav className="sp-wrap" aria-label="Main navigation">
    <Brand />
    <div className={`reset-nav-links ${open ? "is-open" : ""}`}>
      {navigation.map(item => item.links ? <div className="reset-nav-group" key={item.label} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setDropdown(null) }}>
        <button aria-expanded={dropdown === item.label} aria-controls={`nav-${item.label}`} onClick={() => setDropdown(dropdown === item.label ? null : item.label)}>{item.label}<ChevronDown size={12}/></button>
        {dropdown === item.label && <div className="reset-dropdown" id={`nav-${item.label}`}>{item.links.map(([label, href]) => <Link href={href} key={href} onClick={() => { setOpen(false); setDropdown(null) }}>{label}</Link>)}</div>}
      </div> : <Link key={item.label} href={item.href!} aria-current={pathname === item.href ? "page" : undefined}>{item.label}</Link>)}
      <div className="reset-nav-preferences"><LanguageSwitch inverse/><ThemeToggle/></div>
      <Link href="/signin">Log in</Link>
    </div>
    <div className="reset-nav-action"><Action href="/signup">Get started</Action></div>
    <button className="reset-menu" onClick={() => setOpen(!open)} aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open}>{open ? <X/> : <Menu/>}</button>
  </nav></header>
}
