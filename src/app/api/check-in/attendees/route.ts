import { NextResponse } from "next/server";
import { listCheckInAttendees } from "@/lib/actions/check-in";

export async function POST(request: Request) {
  const payload = await request.json();
  const result = await listCheckInAttendees(payload);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
