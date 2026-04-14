"use client";

import { useFormStatus } from "react-dom";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

type AuthSubmitButtonProps = {
  idleText: string;
  pending: boolean;
  pendingText: string;
};

const AuthSubmitButton = ({ idleText, pending, pendingText }: AuthSubmitButtonProps) => {
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 bg-white text-black/80 rounded-2xl py-4 px-16 flex-center cursor-pointer
      hover:bg-white/70 transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <p className="text-lg font-bold">{pending ? pendingText : idleText}</p>
    </button>
  );
};

export default AuthSubmitButton;
