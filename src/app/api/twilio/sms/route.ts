import { NextResponse } from "next/server";

import { sendSms, TwilioConfigurationError } from "@/lib/twilio";

export const runtime = "nodejs";

type SmsRequestBody = {
  body?: unknown;
  to?: unknown;
};

function isE164PhoneNumber(value: string): boolean {
  return /^\+[1-9]\d{1,14}$/.test(value);
}

export async function POST(request: Request) {
  let payload: SmsRequestBody;

  try {
    payload = (await request.json()) as SmsRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const to = typeof payload.to === "string" ? payload.to.trim() : "";
  const body = typeof payload.body === "string" ? payload.body.trim() : "";

  if (!to || !isE164PhoneNumber(to)) {
    return NextResponse.json(
      { error: "Provide a destination phone number in E.164 format." },
      { status: 400 },
    );
  }

  if (!body) {
    return NextResponse.json(
      { error: "Provide a non-empty SMS body." },
      { status: 400 },
    );
  }

  if (body.length > 1600) {
    return NextResponse.json(
      { error: "SMS body must be 1600 characters or fewer." },
      { status: 400 },
    );
  }

  try {
    const message = await sendSms({ body, to });

    return NextResponse.json({
      sid: message.sid,
      status: message.status,
    });
  } catch (error) {
    if (error instanceof TwilioConfigurationError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.error("Twilio SMS send failed", error);

    return NextResponse.json(
      { error: "Unable to send SMS with Twilio." },
      { status: 502 },
    );
  }
}
