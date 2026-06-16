import twilio from "twilio";

type SmsInput = {
  body: string;
  to: string;
};

type TwilioSender =
  | {
      from: string;
    }
  | {
      messagingServiceSid: string;
    };

export class TwilioConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TwilioConfigurationError";
  }
}

function readRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new TwilioConfigurationError(`Missing ${name}.`);
  }

  return value;
}

function readSender(): TwilioSender {
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim();
  const from = process.env.TWILIO_FROM_NUMBER?.trim();

  if (messagingServiceSid) {
    return { messagingServiceSid };
  }

  if (from) {
    return { from };
  }

  throw new TwilioConfigurationError(
    "Missing TWILIO_FROM_NUMBER or TWILIO_MESSAGING_SERVICE_SID.",
  );
}

export async function sendSms({ body, to }: SmsInput) {
  const accountSid = readRequiredEnv("TWILIO_ACCOUNT_SID");
  const authToken = readRequiredEnv("TWILIO_AUTH_TOKEN");
  const client = twilio(accountSid, authToken);

  return client.messages.create({
    body,
    to,
    ...readSender(),
  });
}
