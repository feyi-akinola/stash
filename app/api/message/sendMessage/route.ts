import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { room_id, content, message_type = 1, role = 1 } = await req.json();
    const trimmedRoomId = String(room_id ?? "").trim();
    const trimmedContent = String(content ?? "").trim();

    if (!trimmedRoomId || !trimmedContent) {
      return NextResponse.json({ error: "roomId and content are required" }, { status: 400 });
    }

    const userId = session.user.id;

    const { data: participantData, error: participantError } = await supabaseAdmin
      .from("participant")
      .select("user_id")
      .eq("room_id", trimmedRoomId)
      .eq("user_id", userId)
      .limit(1);

    if (participantError) throw participantError;

    if (!participantData || participantData.length === 0) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from("message")
      .insert({
        room_id: trimmedRoomId,
        content: trimmedContent,
        sender_id: userId,
        message_type,
        role,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}