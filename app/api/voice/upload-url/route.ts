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

    const { roomId } = await req.json();
    const trimmedRoomId = String(roomId ?? "").trim();
    const user_id = session.user.id;

    if (!trimmedRoomId) {
      return NextResponse.json({ error: "roomId is required" }, { status: 400 });
    }

    const { data: participantData, error: participantError } = await supabaseAdmin
      .from("participant")
      .select("user_id")
      .eq("room_id", trimmedRoomId)
      .eq("user_id", user_id)
      .limit(1);

    if (participantError) throw participantError;
    
    if (!participantData || participantData.length === 0) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const path = `${user_id}/${Date.now()}.webm`;

    const { data, error } = await supabaseAdmin.storage
      .from("voice-messages")
      .createSignedUploadUrl(path);

    if (error) throw error;

    return NextResponse.json({ path, token: data.token }, { status: 200 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}