'use client';

import { ReactNode } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { ChevronRight, Home } from "lucide-react"
import { cn } from "@/lib/utils"

interface PageHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  const pathname = usePathname()
  const pathSegments = pathname.split('/').filter(Boolean)

  return (
    <div className="relative border border-border/50 rounded-2xl overflow-hidden mb-8 shadow-sm bg-white">

      <div className="relative flex flex-col px-6 md:px-10 py-8 gap-5">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/50">
          <Link href="/" className="hover:text-primary transition-colors flex items-center gap-1.5 group">
            <Home className="h-3.5 w-3.5 group-hover:scale-110 transition-transform" />
            <span>Dashboard</span>
          </Link>
          {pathSegments.map((segment, index) => {
            const path = `/${pathSegments.slice(0, index + 1).join('/')}`
            const isLast = index === pathSegments.length - 1

            return (
              <div key={path} className="flex items-center gap-2">
                <ChevronRight className="h-3 w-3 opacity-20" />
                <Link
                  href={path}
                  className={cn(
                    "hover:text-primary transition-colors",
                    isLast ? "text-foreground/80 pointer-events-none" : ""
                  )}
                >
                  {segment.replace(/-/g, ' ')}
                </Link>
              </div>
            )
          })}
        </nav>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-2.5 flex-1">
            <div className="flex items-center gap-2.5">
              <div className="h-1.5 w-1.5 rounded-full bg-primary/60" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Interface Node</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground/90 leading-tight">
              {title}
            </h1>
            {description && (
              <p className="text-sm text-muted-foreground/80 font-medium max-w-2xl leading-relaxed">
                {description}
              </p>
            )}
          </div>

          {actions && (
            <div className="flex items-center gap-3 shrink-0 self-start sm:self-center">
              {actions}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
