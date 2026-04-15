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

    const userId = session.user.id;
    
    const { room_id, from, to } = await req.json();
    const trimmedRoomId = String(room_id ?? "").trim();

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
      .select("*")
      .eq("room_id", room_id)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw error;

    return NextResponse.json({ data }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: "Could not fetch messages" }, { status: 500 });
  }
}