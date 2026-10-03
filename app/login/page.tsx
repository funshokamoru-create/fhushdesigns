"use client";

import { supabase } from "@/utils/supabase/client";

export default function LoginPage() {
  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) {
      alert(error.message);
    }
  };

  return (
    <main className="min-h-screen bg-black flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
        <h1 className="text-3xl font-semibold text-black">
          Welcome to FhushDesigns
        </h1>

        <p className="mt-3 text-sm text-black/60">
          Sign in to continue shopping with FhushDesigns.
        </p>

        <button
          type="button"
          onClick={signInWithGoogle}
          className="mt-8 w-full rounded-full border border-black bg-white px-6 py-4 text-sm font-semibold text-black transition hover:bg-black hover:text-white"
        >
          Continue with Google
        </button>

        <button
          type="button"
          onClick={() => (window.location.href = "/")}
          className="mt-4 text-sm text-black/60 underline underline-offset-4"
        >
          Back to FhushDesigns
        </button>
      </div>
    </main>
  );
}