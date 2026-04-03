import twilio from 'twilio';

const PORTAL_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://crystal-ball.vercel.app';

function getTwilioClient() {
  return twilio(
    process.env.TWILIO_ACCOUNT_SID!,
    process.env.TWILIO_AUTH_TOKEN!
  );
}

export async function sendWhatsAppAlert(params: {
  rank: number;
  title: string;
  score_total: number;
  velocity_explanation: string;
  opportunity_gap: string;
  alignment_notes: string;
  slug: string;
}): Promise<void> {
  const body = `🔮 *Crystal Ball Alert*

🚀 High-Priority Opportunity Detected!

*#${params.rank}. ${params.title}*
Score: ${params.score_total}/100

📊 Velocity: ${params.velocity_explanation}
🌏 SEA Gap: ${params.opportunity_gap}
💼 AMAST Fit: ${params.alignment_notes}

🔗 View Details: ${PORTAL_URL}/opportunity/${params.slug}

_Powered by Crystal Ball_`;

  await getTwilioClient().messages.create({
    from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,
    to: `whatsapp:${process.env.WHATSAPP_NOTIFY_TO}`,
    body,
  });
}

export async function sendFailureAlert(reason: string): Promise<void> {
  await getTwilioClient().messages.create({
    from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,
    to: `whatsapp:${process.env.WHATSAPP_NOTIFY_TO}`,
    body: `⚠️ Crystal Ball cron job failed after 3 retries. Please check the logs.\n\nReason: ${reason}`,
  });
}
