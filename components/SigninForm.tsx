"use client";

import { useActionState, useState } from "react";
import { signInAction } from "@/app/actions/auth";
import AuthSubmitButton from "@/components/AuthSubmitButton";
import GoogleAuthButton from "@/components/GoogleAuthButton";

export default function SignInForm() {
  const [email, setEmail] = useState<string>("");
  const [state, action, pending] = useActionState(signInAction, null);

  return (
    <div className="w-[460px] flex flex-col gap-12 p-6">
      <h2 className="text-2xl font-semibold text-white text-center">
        Log In to Your Account
      </h2>
      
      {state?.error && (
        <p className="text-red-400 text-sm text-center bg-red-950/40 border border-red-900 rounded-lg p-2">
          {state.error}
        </p>
      )}

      <form action={action} className="flex flex-col gap-5 w-full">
        <input
          name="email"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={pending}
          className="w-full px-4 py-3 rounded-xl bg-zinc-900 text-white 
          ring-2 ring-zinc-800 outline-none focus:ring-zinc-300"
        />

        <input
          name="password"
          type="password"
          placeholder="Password"
          disabled={pending}
          className="w-full px-4 py-3 rounded-xl bg-zinc-900 text-white 
          ring-2 ring-zinc-800 outline-none focus:ring-zinc-300"
        />

        <AuthSubmitButton
          idleText="Sign In"
          pendingText="Signing In..."
          pending={pending}
        />
      </form>

      <GoogleAuthButton label="Sign in with Google" />
    </div>
  );
}