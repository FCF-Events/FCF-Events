import { NextResponse } from "next/server";
import { getCheckInContext } from "@/lib/actions/check-in";

export async function GET() {
  const result = await getCheckInContext();
  return NextResponse.json(result, { status: result.ok ? 200 : 401 });
}
