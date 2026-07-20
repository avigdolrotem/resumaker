/**
 * Email templates — HE + EN.
 *
 * Plain HTML (no React Email lib) to keep things simple and avoid
 * cross-rendering surprises. All inline styles for max client support.
 */

import { env } from '@/lib/env';

type Locale = 'he' | 'en';

// L4 palette swap — indigo-violet midpoint to match the in-app
// brand-600 token (hsl(252 70% 47%)). Email clients don't read our
// CSS, so we keep the hex literal here and just bump the value.
const BRAND = '#6d28d9';
const BRAND_DARK = '#5b21b6';

function layout({
  title,
  dir,
  body,
  preview,
}: {
  title: string;
  dir: 'ltr' | 'rtl';
  body: string;
  preview: string;
}): string {
  return `<!DOCTYPE html>
<html lang="${dir === 'rtl' ? 'he' : 'en'}" dir="${dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width">
<meta name="color-scheme" content="light">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Heebo',sans-serif;color:#0f172a;direction:${dir};">
<span style="display:none;visibility:hidden;opacity:0;height:0;width:0;font-size:0;">${escapeHtml(preview)}</span>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f8fafc;padding:32px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="560" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <tr>
          <td style="background:linear-gradient(135deg,${BRAND} 0%,${BRAND_DARK} 100%);padding:24px 32px;">
            <div style="color:#fff;font-size:24px;font-weight:700;letter-spacing:-0.02em;">Resumaker</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">${body}</td>
        </tr>
        <tr>
          <td style="padding:24px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;text-align:center;">
            <p style="margin:0 0 8px 0;">
              <a href="${env.APP_URL}" style="color:${BRAND};text-decoration:none;">resumaker.co.il</a>
              · <a href="mailto:hello@resumaker.co.il" style="color:${BRAND};text-decoration:none;">hello@resumaker.co.il</a>
            </p>
            <p style="margin:0;">© ${new Date().getFullYear()} Resumaker™</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function button(label: string, href: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;">
  <tr><td style="background:${BRAND};border-radius:8px;">
    <a href="${escapeAttr(href)}" style="display:inline-block;padding:14px 28px;color:#fff;font-weight:600;font-size:16px;text-decoration:none;">${escapeHtml(label)}</a>
  </td></tr>
</table>`;
}

/**
 * Escape HTML special chars. Exported so any route building user-supplied
 * HTML email content (support inbox relay, admin broadcast, HR invites,
 * onboarding drips) can use it. Covers &, <, >, ", ' — the full set
 * needed to prevent attribute-context AND element-context XSS.
 */
export function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}

// ─── Templates ───────────────────────────────────────────────────────

export function emailVerification({ locale, verifyUrl }: { locale: Locale; verifyUrl: string }) {
  if (locale === 'he') {
    return {
      subject: 'אמת את הדוא״ל שלך · Resumaker',
      html: layout({
        title: 'אמת את הדוא״ל שלך',
        preview: 'לחץ כדי לאמת את כתובת הדוא״ל שלך',
        dir: 'rtl',
        body: `
          <h1 style="margin:0 0 16px 0;font-size:22px;">ברוכים הבאים ל-Resumaker 👋</h1>
          <p style="margin:0 0 16px 0;line-height:1.6;color:#475569;">
            תודה שנרשמת. לסיום ההרשמה, אנא אמת את כתובת הדוא״ל שלך:
          </p>
          ${button('אמת דוא״ל', verifyUrl)}
          <p style="margin:0;font-size:12px;color:#94a3b8;">
            לא אתה? אפשר להתעלם מהמייל הזה — לא ייווצר חשבון.
          </p>`,
      }),
    };
  }
  return {
    subject: 'Verify your email · Resumaker',
    html: layout({
      title: 'Verify your email',
      preview: 'Click to verify your email address',
      dir: 'ltr',
      body: `
        <h1 style="margin:0 0 16px 0;font-size:22px;">Welcome to Resumaker 👋</h1>
        <p style="margin:0 0 16px 0;line-height:1.6;color:#475569;">
          Thanks for signing up. Please verify your email address to finish:
        </p>
        ${button('Verify email', verifyUrl)}
        <p style="margin:0;font-size:12px;color:#94a3b8;">
          Not you? You can safely ignore this — no account will be created.
        </p>`,
    }),
  };
}

export function passwordReset({ locale, resetUrl }: { locale: Locale; resetUrl: string }) {
  if (locale === 'he') {
    return {
      subject: 'איפוס סיסמה · Resumaker',
      html: layout({
        title: 'איפוס סיסמה',
        preview: 'קישור לאיפוס הסיסמה שלך',
        dir: 'rtl',
        body: `
          <h1 style="margin:0 0 16px 0;font-size:22px;">איפוס סיסמה</h1>
          <p style="margin:0 0 16px 0;line-height:1.6;color:#475569;">
            ביקשת לאפס את הסיסמה לחשבון Resumaker שלך. לחץ כדי לבחור סיסמה חדשה:
          </p>
          ${button('אפס סיסמה', resetUrl)}
          <p style="margin:0 0 8px 0;font-size:12px;color:#94a3b8;">
            הקישור תקף לשעה אחת. לא ביקשת איפוס? התעלם מהמייל הזה.
          </p>`,
      }),
    };
  }
  return {
    subject: 'Reset your password · Resumaker',
    html: layout({
      title: 'Reset your password',
      preview: 'Link to reset your password',
      dir: 'ltr',
      body: `
        <h1 style="margin:0 0 16px 0;font-size:22px;">Password reset</h1>
        <p style="margin:0 0 16px 0;line-height:1.6;color:#475569;">
          You requested a password reset for your Resumaker account. Click to choose a new password:
        </p>
        ${button('Reset password', resetUrl)}
        <p style="margin:0 0 8px 0;font-size:12px;color:#94a3b8;">
          Link valid for one hour. Didn't request this? Ignore this email.
        </p>`,
    }),
  };
}

export function paidWelcome({
  locale,
  name,
  tier,
}: {
  locale: Locale;
  name?: string;
  tier: 'plus' | 'pro';
}) {
  const tierLabel =
    locale === 'he' ? (tier === 'plus' ? 'פלוס' : 'פרו') : tier === 'plus' ? 'Plus' : 'Pro';
  if (locale === 'he') {
    return {
      subject: `התשלום אושר — הצטרפת ל-${tierLabel} 🎉`,
      html: layout({
        title: 'התשלום אושר',
        preview: `המנוי ${tierLabel} שלך פעיל`,
        dir: 'rtl',
        body: `
          <h1 style="margin:0 0 16px 0;font-size:22px;">תודה ${escapeHtml(name ?? '')} 🚀</h1>
          <p style="margin:0 0 16px 0;line-height:1.6;color:#475569;">
            התשלום עבור מסלול <strong>${tierLabel}</strong> אושר. המנוי שלך פעיל מעכשיו.
          </p>
          <p style="margin:0 0 16px 0;line-height:1.6;color:#475569;">
            את החשבונית תקבל ישירות מ-LemonSqueezy (ספק הסליקה שלנו). ניתן לנהל את המנוי, להוריד חשבוניות, או לבטל בכל רגע מתוך אזור החיוב.
          </p>
          ${button('פתח את אזור החיוב', `${env.APP_URL}/he/account/billing`)}
          <p style="margin:24px 0 0 0;font-size:12px;color:#94a3b8;">
            שאלות? פשוט תענה למייל הזה — אנחנו עונים תוך 24 שעות.
          </p>`,
      }),
    };
  }
  return {
    subject: `Payment confirmed — welcome to ${tierLabel} 🎉`,
    html: layout({
      title: 'Payment confirmed',
      preview: `Your ${tierLabel} subscription is active`,
      dir: 'ltr',
      body: `
        <h1 style="margin:0 0 16px 0;font-size:22px;">Thanks ${escapeHtml(name ?? '')} 🚀</h1>
        <p style="margin:0 0 16px 0;line-height:1.6;color:#475569;">
          Your <strong>${tierLabel}</strong> subscription is now active.
        </p>
        <p style="margin:0 0 16px 0;line-height:1.6;color:#475569;">
          You'll receive an invoice directly from LemonSqueezy (our payment provider). You can manage your subscription, download invoices, or cancel any time from the billing dashboard.
        </p>
        ${button('Open billing dashboard', `${env.APP_URL}/en/account/billing`)}
        <p style="margin:24px 0 0 0;font-size:12px;color:#94a3b8;">
          Questions? Just reply to this email — we answer within 24h.
        </p>`,
    }),
  };
}

export function emailChangeConfirmation({
  locale,
  confirmUrl,
}: {
  locale: Locale;
  confirmUrl: string;
}) {
  if (locale === 'he') {
    return {
      subject: 'אשר את כתובת המייל החדשה שלך · Resumaker',
      html: layout({
        title: 'אשר את כתובת המייל החדשה',
        preview: 'לחץ כדי לאשר את כתובת המייל החדשה שלך',
        dir: 'rtl',
        body: `
          <h1 style="margin:0 0 16px 0;font-size:22px;">אישור כתובת מייל חדשה</h1>
          <p style="margin:0 0 16px 0;line-height:1.6;color:#475569;">
            ביקשת לשנות את כתובת המייל בחשבון Resumaker שלך לכתובת הזו. לחץ כדי לאשר:
          </p>
          ${button('אשר כתובת מייל', confirmUrl)}
          <p style="margin:0;font-size:12px;color:#94a3b8;">
            הקישור תקף לשעה אחת. לא ביקשת את זה? אפשר להתעלם מהמייל הזה — כתובת המייל בחשבון לא תשתנה.
          </p>`,
      }),
    };
  }
  return {
    subject: 'Confirm your new Resumaker email',
    html: layout({
      title: 'Confirm your new email',
      preview: 'Click to confirm your new email address',
      dir: 'ltr',
      body: `
        <h1 style="margin:0 0 16px 0;font-size:22px;">Confirm your new email</h1>
        <p style="margin:0 0 16px 0;line-height:1.6;color:#475569;">
          You requested to change your Resumaker account's email to this address. Click to confirm:
        </p>
        ${button('Confirm email', confirmUrl)}
        <p style="margin:0;font-size:12px;color:#94a3b8;">
          Link valid for one hour. Didn't request this? You can safely ignore this — your account email won't change.
        </p>`,
    }),
  };
}

export function welcome({ locale, name }: { locale: Locale; name?: string }) {
  if (locale === 'he') {
    return {
      subject: 'ברוכים הבאים ל-Resumaker 🎉',
      html: layout({
        title: 'ברוכים הבאים',
        preview: 'תודה שהצטרפת ל-Resumaker',
        dir: 'rtl',
        body: `
          <h1 style="margin:0 0 16px 0;font-size:22px;">שלום ${escapeHtml(name ?? '')} 👋</h1>
          <p style="margin:0 0 16px 0;line-height:1.6;color:#475569;">
            ברוכים הבאים ל-Resumaker. אנחנו שמחים שהצטרפת.
          </p>
          <p style="margin:0 0 16px 0;line-height:1.6;color:#475569;">
            <strong>איך מתחילים:</strong>
          </p>
          <ol style="margin:0 0 16px 0;padding-inline-start:20px;color:#475569;line-height:1.8;">
            <li>הדבק תיאור משרה שאתה רוצה להגיש אליה</li>
            <li>מלא את הפרופיל שלך (או ייבא מ-PDF)</li>
            <li>קבל קורות חיים מותאמים אישית</li>
          </ol>
          ${button('צור קורות חיים ראשונים', `${env.APP_URL}/he/builder`)}`,
      }),
    };
  }
  return {
    subject: 'Welcome to Resumaker 🎉',
    html: layout({
      title: 'Welcome',
      preview: 'Thanks for joining Resumaker',
      dir: 'ltr',
      body: `
        <h1 style="margin:0 0 16px 0;font-size:22px;">Hi ${escapeHtml(name ?? '')} 👋</h1>
        <p style="margin:0 0 16px 0;line-height:1.6;color:#475569;">
          Welcome to Resumaker. We're glad you're here.
        </p>
        <p style="margin:0 0 16px 0;line-height:1.6;color:#475569;">
          <strong>Getting started:</strong>
        </p>
        <ol style="margin:0 0 16px 0;padding-inline-start:20px;color:#475569;line-height:1.8;">
          <li>Paste the job description you're applying to</li>
          <li>Fill in your profile (or import from PDF)</li>
          <li>Get a tailored resume in seconds</li>
        </ol>
        ${button('Build my first resume', `${env.APP_URL}/en/builder`)}`,
    }),
  };
}
