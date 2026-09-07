"use client";
import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OAuthButtons } from "@/components/oauth-buttons";
import { PASSWORD_MIN_LENGTH } from "@edutechs/shared";
import { AuthVisual } from "@/components/auth-visual";
export default function SignupPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setForm((current) => ({
      ...current,
      name: params.get("name") || "",
      email: params.get("email") || "",
    }));
    const trial = params.get("trial");
    if (trial) {
      try {
        const handoff = JSON.parse(window.name || "{}");
        const parsed =
          handoff?.kind === "sellpilot-trial"
            ? handoff.payload
            : trial !== "1"
              ? JSON.parse(trial)
              : null;
        if (parsed && typeof parsed === "object") {
          sessionStorage.setItem(
            "sellpilot:pending-trial",
            JSON.stringify(parsed),
          );
          window.name = "";
        }
      } catch {
        sessionStorage.removeItem("sellpilot:pending-trial");
        window.name = "";
      }
    }
  }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (form.password.length < PASSWORD_MIN_LENGTH)
      return setError(
        `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
      );
    if (form.password !== form.confirm)
      return setError("Passwords do not match.");
    setLoading(true);
    const response = await fetch("/api/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error || "Could not create account.");
      setLoading(false);
      return;
    }
    if (body.verificationRequired) {
      if (body.verificationEmailSent) {
        setNotice(
          "Account created. Check your email to verify it before signing in.",
        );
      } else {
        setError(
          "Account created, but the verification email could not be sent. Use resend verification after email delivery is configured.",
        );
      }
      setLoading(false);
      return;
    }
    const result = await signIn("credentials", {
      redirect: false,
      email: form.email,
      password: form.password,
    });
    if (result?.error) setError("Account created. Please sign in.");
    else {
      router.push("/onboarding");
      router.refresh();
    }
    setLoading(false);
  }
  const update =
    (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
      setForm({ ...form, [key]: event.target.value });
return <main className="auth-reset"><AuthVisual mode="signup"/><section className="auth-reset-form"><div><p className="sp-eyebrow">Your next chapter</p><h1>Build your workspace.</h1><p className="auth-copy">Create your account. Then make SellPilot your own.</p><OAuthButtons/><div className="my-6 text-center text-[10px] tracking-widest text-[#9293a5]">OR USE YOUR EMAIL</div><form onSubmit={submit} className="space-y-4">{error&&<p role="alert" className="auth-error">{error}</p>}{notice&&<p role="status" className="auth-notice">{notice}</p>}<label>Full name<Input autoComplete="name" value={form.name} onChange={update("name")} required/></label><label>Email address<Input type="email" autoComplete="email" value={form.email} onChange={update("email")} required/></label><label>Password<Input type="password" autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} value={form.password} onChange={update("password")} required/><span className="block mt-1.5 text-[10px] font-normal text-[#9192a5]">At least {PASSWORD_MIN_LENGTH} characters</span></label><label>Confirm password<Input type="password" autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} value={form.confirm} onChange={update("confirm")} required/></label><Button className="w-full" disabled={loading}>{loading?"Creating account…":"Create account"}</Button></form><div className="mt-7 pt-5 border-t border-[#e3e1ed] text-xs text-[#77798e] flex justify-between gap-4"><span>Already registered? <Link href="/login">Sign in</Link></span><Link href="/resend-verification">Resend verification</Link></div></div></section></main>;}
