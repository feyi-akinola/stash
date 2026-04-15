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

    const { roomId, path } = await req.json();
    const trimmedRoomId = String(roomId ?? "").trim();
    const trimmedPath = String(path ?? "").trim();

    if (!trimmedRoomId || !trimmedPath) {
      return NextResponse.json({ error: "roomId and path are required" }, { status: 400 });
    }

    // Prevent spoofing other users' folder paths
    if (!trimmedPath.startsWith(`${session.user.id}/`)) {
      return NextResponse.json({ error: "Invalid path" }, { status: 403 });
    }

    const { data: publicData } = supabaseAdmin.storage
      .from("voice-messages")
      .getPublicUrl(trimmedPath);

    const { data, error } = await supabaseAdmin
      .from("message")
      .insert({
        room_id: trimmedRoomId,
        content: publicData.publicUrl,
        sender_id: session.user.id,
        role: 1,
        message_type: 2,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ message: data }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}