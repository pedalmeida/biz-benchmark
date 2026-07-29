import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SignInButton } from "@/components/sign-in-button";

export default async function LoginPage() {
  const session = await auth();
  if (session) redirect("/dashboard");

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-white mb-2">AM Benchmark</h1>
        <p className="text-sm" style={{ color: "var(--ink-2)" }}>
          Competitor intelligence platform
        </p>
      </div>
      <div
        className="p-8 rounded-xl border flex flex-col items-center gap-6"
        style={{ background: "var(--bg-2)", borderColor: "var(--border)" }}
      >
        <p className="text-sm" style={{ color: "var(--ink-2)" }}>
          Sign in to access the admin
        </p>
        <SignInButton />
      </div>
    </div>
  );
}
