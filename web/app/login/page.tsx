"use client";
// /login — dedicated sign-in page. On success the user is sent inside:
// admins to the dashboard, doctors and staff to chat. Already signed in?
// Straight inside, no form.
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import LoginForm from "../components/LoginForm";
import { useAuth } from "../lib/auth";

function destinationFor(role: string): string {
  return role === "admin" ? "/dashboard" : "/chat";
}

export default function LoginPage() {
  const { user, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && user) router.replace(destinationFor(user.role));
  }, [ready, user, router]);

  return (
    <div className="pb-20 md:pb-0">
      <section className="bg-gradient-to-b from-lavender via-[#0e1a10] to-lavender-deep">
        <div className="max-w-3xl mx-auto px-4 py-12 md:py-16">
          <p className="text-xs font-bold tracking-[0.18em] text-brand-deep uppercase">Sunrise Family Clinic • Sign in</p>
          <h1 className="mt-4 text-3xl md:text-4xl font-bold text-ink">Welcome back</h1>
          <p className="mt-4 text-muted leading-relaxed">
            Sign in to the clinic assistant — chat, patients, uploads and the admin dashboard
            all live behind your account.
          </p>

          {!ready ? (
            <p className="mt-10 text-center text-muted text-sm">Loading…</p>
          ) : !user ? (
            <div className="mt-10">
              <LoginForm />
              <p className="text-sm text-muted mt-4 text-center">
                No account yet?{" "}
                <Link href="/signup" className="text-brand-deep font-semibold hover:underline">
                  Create a staff account →
                </Link>
              </p>
              <p className="text-xs text-muted mt-3 text-center">
                Decision-support only — not a replacement for a doctor. Synthetic demo data.
              </p>
            </div>
          ) : (
            <p className="mt-10 text-center text-muted text-sm">Signing you in…</p>
          )}
        </div>
      </section>
    </div>
  );
}
