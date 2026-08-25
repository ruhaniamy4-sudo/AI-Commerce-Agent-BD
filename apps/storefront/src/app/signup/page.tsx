import type { Metadata } from "next";
import { AuthExperience } from "@/components/auth-experience";

export const metadata: Metadata = { title: "Start free", description: "Request early access to SellPilot, the AI sales agent for Bangladesh commerce." };
export default function SignUpPage() { return <AuthExperience mode="signup" />; }
