/**
 * Email client wrapper.
 *
 * Uses Resend if RESEND_API_KEY is configured, otherwise logs to console
 * (dev mode). This lets us build + test the password-reset / verification
 * flow locally without signing up for a service.
 *
 * When you're ready to send real emails:
 *   1. Sign up at https://resend.com (3K emails/mo free)
 *   2. Verify your sending domain (resumaker.co.il)
 *   3. Add RESEND_API_KEY=re_xxx to .env
 *   4. No code change needed — sender flips from console to live
 */

import { Resend } from 'resend';
import { env } from '@/lib/env';

interface SendInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

const apiKey = env.RESEND_API_KEY;
const fromAddress = env.EMAIL_FROM;
const isLive = Boolean(apiKey);

const resend = apiKey ? new Resend(apiKey) : null;

export async function sendEmail(
  input: SendInput,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!resend) {
    // Dev mode: log a redacted representation. NEVER print the full
    // recipient or the body — password-reset / verification tokens
    // live in the body and forwarded shell history is a real exfil
    // vector for credential leaks.
    const recipientHint = maskEmail(input.to);
    console.warn(
      `[email/dev] No RESEND_API_KEY — would have sent "${input.subject}" to ${recipientHint}`,
    );
    return { ok: true, id: 'dev-stub' };
  }

  try {
    const result = await resend.emails.send({
      from: fromAddress,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text ?? stripHtml(input.html),
    });
    if (result.error) {
      // Log only the error name — Resend error messages sometimes echo
      // the recipient address back. Caller gets a generic code.
      console.error('[email] resend error:', result.error.name);
      return { ok: false, error: 'email_send_failed' };
    }
    return { ok: true, id: result.data?.id };
  } catch (err) {
    console.error('[email] unexpected error:', (err as Error).name);
    return { ok: false, error: 'email_send_failed' };
  }
}

function maskEmail(addr: string): string {
  const [local, domain] = addr.split('@');
  if (!local || !domain) return '***';
  return `${local.slice(0, 1)}***@${domain}`;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const emailConfig = {
  isLive,
  fromAddress,
};
