import dotenv from 'dotenv';
dotenv.config();

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@civicduty.app';

export async function sendAlertEmail(to: string, data: {
  module: string;
  keyword: string;
  itemTitle: string;
  itemUrl: string;
}) {
  if (!SENDGRID_API_KEY) {
    console.log('[Email] SENDGRID_API_KEY not set, skipping email send');
    return;
  }

  const subject = `CivicDuty Alert: ${data.module} — "${data.keyword}"`;
  const body = `New match for your watchlist:

Module: ${data.module}
Keyword: "${data.keyword}"
Match: ${data.itemTitle}

View details: ${data.itemUrl}

— CivicDuty`;

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: EMAIL_FROM },
        subject,
        content: [{ type: 'text/plain', value: body }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[Email] SendGrid error:', response.status, err);
    }
  } catch (err: any) {
    console.error('[Email] Failed to send:', err.message);
  }
}
