import { NextResponse } from "next/server";
import { getCurrentUser, isSupabaseNotConfiguredError } from "../../../../lib/supabase-server";

export async function GET() {
  try {
    const current = await getCurrentUser();
    if (!current) return NextResponse.json({ user: null, configured: true }, { status: 401 });
    return NextResponse.json({ user: { id: current.user.id, email: current.user.email }, configured: true });
  } catch (error) {
    if (isSupabaseNotConfiguredError(error)) return NextResponse.json({ user: null, configured: false }, { status: 503 });
    return NextResponse.json({ user: null }, { status: 500 });
  }
}
