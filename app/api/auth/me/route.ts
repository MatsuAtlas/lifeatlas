import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../lib/supabase-server";

export async function GET() {
  try {
    const current = await getCurrentUser();
    if (!current) return NextResponse.json({ user: null }, { status: 401 });
    return NextResponse.json({ user: { id: current.user.id, email: current.user.email } });
  } catch (error) {
    if (error instanceof Error && error.message === "SUPABASE_NOT_CONFIGURED") return NextResponse.json({ user: null, configured: false }, { status: 503 });
    return NextResponse.json({ user: null }, { status: 500 });
  }
}
