"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import BrandLockup from "../../components/brand/BrandLockup";
import { BRAND } from "../../config/brand";
import { supabase } from "../../lib/supabaseBrowser";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) return setErrorMsg(error.message);
    router.push('/dashboard');
  }

  async function handleForgotPassword() {
    setErrorMsg(null); setInfoMsg(null);
    const cleanEmail = email.trim();
    if (!cleanEmail) return setErrorMsg('Enter your work email first, then use reset password.');
    setBusy(true);
    const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, { redirectTo });
    setBusy(false);
    if (error) return setErrorMsg(error.message);
    setInfoMsg('Password reset email sent. Open the link in your inbox to create a new password.');
  }

  return (
    <main className="setuLoginPage" aria-labelledby="setu-login-title">
      <section className="setuLoginHero">
        <div className="setuLoginHeroInner">
          <BrandLockup className="setuLoginLockup" showTagline={false} />
          <div className="setuLoginTagline">{BRAND.tagline}</div>
          <div className="setuLoginEyebrow">Payroll command platform</div>
          <h1 id="setu-login-title">Branded payroll operations, approvals, and export control in one SETU workspace.</h1>
          <p>Keep project time, payroll runs, receipts, and finance-ready exports aligned across admins, managers, and contractors.</p>
          <div className="setuLoginFeatureGrid">
            <div className="setuLoginFeatureCard"><ShieldCheck size={18} /><div><strong>Audit-ready payroll</strong><span>Closed periods, immutable runs, receipt history, and paid-state tracking.</span></div></div>
            <div className="setuLoginFeatureCard"><LockKeyhole size={18} /><div><strong>Secure org access</strong><span>Role-based admin, manager, and contractor access through Supabase auth.</span></div></div>
          </div>
        </div>
      </section>
      <section className="setuLoginPanelWrap" aria-label="Sign in panel">
        <div className="setuLoginPanel card">
          <div className="setuLoginPanelHeader">
            <div className="setuLoginMiniBadge">SETU TRACK</div>
            <h2>Sign in</h2>
            <p>Use your organization email to continue to the payroll workspace.</p>
          </div>
          <form className="setuLoginForm" onSubmit={handleLogin}>
            <label className="setuLoginField" htmlFor="email"><span>Email</span>
              <div className="setuInputIconWrap"><Mail size={16} />
                <input id="email" type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} autoComplete="email" placeholder="you@company.com" className="input setuLoginInput" />
              </div>
            </label>
            <label className="setuLoginField" htmlFor="password"><span>Password</span>
              <div className="setuInputIconWrap setuPasswordWrap"><LockKeyhole size={16} />
                <input id="password" type={showPassword ? 'text' : 'password'} required value={password} onChange={(e)=>setPassword(e.target.value)} autoComplete="current-password" placeholder="Enter your password" className="input setuLoginInput" />
                <button type="button" className="setuPasswordToggle" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
              </div>
            </label>
            <div className="setuLoginActionsRow"><button type="button" className="setuTextButton" onClick={handleForgotPassword} disabled={busy}>Reset password</button></div>
            <button type="submit" disabled={busy} className="btn btnPrimary btnMd setuLoginSubmit">{busy ? 'Signing in…' : 'Enter SETU TRACK'}</button>
          </form>
          {errorMsg ? <div className="alert alertError" role="alert">{errorMsg}</div> : null}
          {infoMsg ? <div className="alert alertInfo" role="status">{infoMsg}</div> : null}
          <div className="setuLoginFooter">A product of {BRAND.parentCompany}.</div>
        </div>
      </section>
    </main>
  );
}
