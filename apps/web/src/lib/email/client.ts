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
    // Dev mode: log a structured representation
    console.warn(
      '\n┌─────────────────────────────────────────────────────────────\n' +
        '│ 📧 [email/dev] No RESEND_API_KEY — logging instead of sending\n' +
        `│ To:      ${input.to}\n` +
        `│ Subject: ${input.subject}\n` +
        '├─────────────────────────────────────────────────────────────\n' +
        `${input.text ?? stripHtml(input.html)}\n` +
        '└─────────────────────────────────────────────────────────────\n',
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
      console.error('[email] resend error:', result.error);
      return { ok: false, error: result.error.message };
    }
    return { ok: true, id: result.data?.id };
  } catch (err) {
    console.error('[email] unexpected error:', err);
    return { ok: false, error: (err as Error).message };
  }
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
