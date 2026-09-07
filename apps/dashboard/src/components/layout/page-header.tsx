"use client";
import type {ReactNode} from "react";
interface PageHeaderProps{title:string;description?:string;actions?:ReactNode}
export function PageHeader({title,description,actions}:PageHeaderProps){return <header className="merchant-page-header"><div><p className="workspace-kicker">Merchant workspace</p><h1>{title}</h1>{description&&<p>{description}</p>}</div>{actions&&<div className="merchant-page-actions">{actions}</div>}</header>;}
