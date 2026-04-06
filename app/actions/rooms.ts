"use server";
import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

export async function createRoom(name: string, userId: string) {
  const { data, error } = await supabase
    .from("room")
    .insert([{ name, creator_id: userId }])
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/chat");
  return data;
}