import type { Metadata } from "next";
import { AuthExperience } from "@/components/auth-experience";

export const metadata: Metadata = { title: "Sign in", description: "Sign in to a provisioned SellPilot commerce workspace." };
export default function SignInPage() { return <AuthExperience mode="signin" />; }
