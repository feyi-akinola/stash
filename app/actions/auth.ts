"use server";

import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

const toMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

export async function signUpAction(_: any, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!name || !email || !password) {
    return { error: "Please fill all fields" };
  }

  try {
    await auth.api.signUpEmail({ body: { name, email, password } });
    
    return { success: true };
  } catch (error) {
    let msg = toMessage(error, "Invalid credentials");

    if (password.length < 8) {
      msg = "Password must be at least 8 characters";
    }

    if (
      msg.includes("ENOTFOUND") ||
      msg.includes("fetch failed") ||
      msg.includes("network") ||
      msg.includes("Failed to fetch")
    ) {
      msg = "Unable to sign up right now. Check your internet or try again later.";
    }

    return { error: msg };
  }
};

export async function signInAction(_: any, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Please provide email and password" };
  }

  try {
    await auth.api.signInEmail({ body: { email, password } });
  } catch (error) {
    let msg = toMessage(error, "Invalid credentials");

    if (
      msg.includes("ENOTFOUND") ||
      msg.includes("fetch failed") ||
      msg.includes("network") ||
      msg.includes("Failed to fetch")
    ) {
      msg = "Unable to connect. Check your internet or try again later.";
    }

    return { error: msg };
  }

  
  revalidatePath("/");
  redirect("/");
}

export async function signOutAction() {
  try {
    await auth.api.signOut({
      headers: await headers(),
    });
  } catch (error) {
    const msg = toMessage(error, "Sign out failed");
    
    return msg;
  }

  redirect("/");
};