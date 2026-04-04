const AGENTMAIL_API = 'https://api.agentmail.to/v0';

export async function sendInviteEmail({
  to,
  fullName,
  tempPassword,
}: {
  to: string;
  fullName: string | null;
  tempPassword: string;
}) {
  const apiKey = process.env.AGENTMAIL_API_KEY;
  const inboxId = process.env.AGENTMAIL_INBOX_ID;

  if (!apiKey || !inboxId) {
    console.warn('sendInviteEmail: AGENTMAIL_API_KEY or AGENTMAIL_INBOX_ID not set — skipping.');
    return;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const displayName = fullName ?? to;

  const res = await fetch(`${AGENTMAIL_API}/inboxes/${encodeURIComponent(inboxId)}/messages/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      to: [to],
      subject: 'You have been invited to Crystal Ball Intelligence',
      text: [
        `Hi ${displayName},`,
        '',
        'You have been invited to access Crystal Ball Intelligence.',
        '',
        `Login URL: ${appUrl}`,
        `Email: ${to}`,
        `Temporary password: ${tempPassword}`,
        '',
        'Please log in and change your password as soon as possible.',
        '',
        'AMAST Sdn Bhd',
      ].join('\n'),
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f7f9f3;border-radius:12px;">
          <h2 style="color:#4f46e5;margin-bottom:8px;">Crystal Ball Intelligence</h2>
          <p style="color:#333;margin-bottom:24px;">Hi ${displayName},</p>
          <p style="color:#333;">You have been invited to access <strong>Crystal Ball Intelligence</strong>. Use the credentials below to log in.</p>
          <div style="background:#ffffff;border:1px solid #d4d4d4;border-radius:8px;padding:20px;margin:24px 0;">
            <p style="margin:0 0 8px;font-size:13px;color:#666;">Login URL</p>
            <a href="${appUrl}" style="color:#4f46e5;font-weight:600;">${appUrl}</a>
            <hr style="border:none;border-top:1px solid #eee;margin:16px 0;" />
            <p style="margin:0 0 4px;font-size:13px;color:#666;">Email</p>
            <p style="margin:0 0 16px;font-weight:600;color:#111;">${to}</p>
            <p style="margin:0 0 4px;font-size:13px;color:#666;">Temporary Password</p>
            <p style="margin:0;font-family:monospace;font-size:18px;font-weight:700;color:#4f46e5;letter-spacing:2px;">${tempPassword}</p>
          </div>
          <p style="color:#666;font-size:13px;">Please log in and change your password as soon as possible.</p>
          <p style="color:#999;font-size:12px;margin-top:32px;">AMAST Sdn Bhd · Internal Use Only</p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`sendInviteEmail: AgentMail API error ${res.status} — ${body}`);
  }
}
