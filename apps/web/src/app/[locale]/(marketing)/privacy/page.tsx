import { setRequestLocale } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import {
  COMPANY_ADDRESS_EN,
  COMPANY_ADDRESS_HE,
  COMPANY_LEGAL_NAME,
  COMPANY_TRADING_NAME,
  COMPANY_TYPE_EN,
  COMPANY_TYPE_HE,
  DB_REGISTRATION_NUMBER,
  DB_REGISTRATION_REQUIRED,
  DPO_EMAIL,
  PRIVACY_AUTHORITY_URL_EN,
  PRIVACY_AUTHORITY_URL_HE,
  PRIVACY_EMAIL,
} from '@/lib/constants/contact';

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const isHebrew = locale === 'he';

  return (
    <div className="relative overflow-hidden py-12">
      {/* Static, non-animated wash — legal text needs stillness, not
          drifting blobs. Just enough atmosphere to match the rest of
          the site without competing with the reading experience. */}
      <div
        aria-hidden
        className="from-brand-50/50 via-background to-background dark:from-brand-950/20 pointer-events-none absolute inset-0 bg-gradient-to-b"
      />
      <article className="glass-subtle prose prose-neutral dark:prose-invert relative mx-auto max-w-3xl rounded-3xl px-6 py-10 sm:px-10 sm:py-12">
        {isHebrew ? <PrivacyHe /> : <PrivacyEn />}
      </article>
    </div>
  );
}

function PrivacyHe() {
  const dbStatus = DB_REGISTRATION_REQUIRED
    ? `המאגר רשום אצל רשם מאגרי המידע במשרד המשפטים, מספר רישום ${DB_REGISTRATION_NUMBER ?? 'בהליך'}.`
    : 'מאגר המידע אינו חייב ברישום לפי תקנות הגנת הפרטיות, מאחר שמספר נושאי המידע פחות מ-10,000 ואין כולל מידע "מיוחד" כהגדרתו בחוק.';

  return (
    <>
      <h1>מדיניות פרטיות</h1>
      <p className="text-muted-foreground text-sm">עודכן לאחרונה: מאי 2026</p>

      <h2>1. כללי</h2>
      <p>
        ברוכים הבאים ל-{COMPANY_TRADING_NAME}. מסמך זה מתאר כיצד אנו אוספים, משתמשים ומגנים על המידע
        שלכם. אנו מחויבים להגנה על פרטיותכם בהתאם ל<strong>חוק הגנת הפרטיות, תשמ"א-1981</strong>{' '}
        ולתקנות הגנת הפרטיות (אבטחת מידע), תשע"ז-2017.
      </p>

      <h2>2. בעל מאגר המידע</h2>
      <ul>
        <li>
          <strong>{COMPANY_LEGAL_NAME}</strong> ({COMPANY_TYPE_HE}), בשם המסחרי{' '}
          {COMPANY_TRADING_NAME}.
        </li>
        <li>כתובת: {COMPANY_ADDRESS_HE}.</li>
        <li>
          ליצירת קשר בנושאי פרטיות: <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>
        </li>
        <li>
          ממונה הגנת פרטיות (DPO): <a href={`mailto:${DPO_EMAIL}`}>{DPO_EMAIL}</a>
        </li>
      </ul>

      <h2>3. רישום מאגר</h2>
      <p>{dbStatus}</p>

      <h2>4. מידע שאנו אוספים</h2>
      <ul>
        <li>פרטי חשבון: שם, כתובת דוא״ל, סיסמה (מוצפנת בפונקציית גיבוב חד-כיוונית).</li>
        <li>תוכן שיצרתם: תיאורי משרות שהדבקתם, פרופיל מקצועי, קורות חיים שיצרנו.</li>
        <li>
          מידע טכני: כתובת IP (מאוחסנת בצורה מגובבת בלבד, ללא יכולת היפוך), סוג דפדפן, זמני שימוש.
        </li>
        <li>נתוני חיוב: סטטוס מנוי בלבד; פרטי כרטיס אשראי נשמרים אצל ספק הסליקה ולא אצלנו.</li>
      </ul>

      <h2>5. שימוש במידע</h2>
      <p>אנו משתמשים במידע אך ורק לצורך:</p>
      <ul>
        <li>אספקת השירות (יצירת קורות חיים).</li>
        <li>שיפור השירות (מטרים מצטברים, ללא זיהוי אישי).</li>
        <li>תקשורת עם המשתמש (אימות, איפוס סיסמה, התראות חשבון).</li>
        <li>אכיפת תנאי השימוש ועמידה בחובות חוקיות.</li>
      </ul>

      <h2>6. שיתוף עם צד שלישי</h2>
      <p>
        תיאור המשרה ופרופיל המשתמש נשלחים לשירות Google Cloud Vertex AI (מודלים של Anthropic
        ו-Google, באזור europe-west1) לצורך יצירת קורות החיים. הספקים הללו אינם משתמשים בנתונים אלה
        לאימון מודלים. שירותים תפעוליים נוספים: Resend (אימייל), Sentry (ניטור שגיאות, ללא PII),
        Cloudflare (CDN ו-WAF), Google Cloud (תשתית). לא משתפים מידע עם גורמים נוספים אלא אם נדרש על
        פי חוק.
      </p>

      <h2>7. עוגיות (Cookies)</h2>
      <p>אנו משתמשים בעוגיות מהקטגוריות הבאות:</p>
      <ul>
        <li>
          <strong>הכרחיות</strong> — שמירת מצב התחברות (session cookie של Better Auth) ובחירת שפה
          וערכת נושא. אינן דורשות הסכמה לפי הדין.
        </li>
        <li>
          <strong>פונקציונליות</strong> — שמירת העדפות UI (טיוטות בנאי קו"ח). מאוחסנות בעיקר ב-
          localStorage, לא בעוגיות.
        </li>
        <li>
          <strong>אנליטיקה / שיווק</strong> — לא משתמשים בעוגיות מעקב צד-שלישי. אין Google
          Analytics, אין Facebook Pixel, אין Hotjar.
        </li>
      </ul>
      <p>בכל עת ניתן למחוק את כל העוגיות שלנו דרך הגדרות הדפדפן. מחיקה תאלץ אותך להתחבר מחדש.</p>

      <h2>8. תקופות שמירה</h2>
      <p>
        ראה <a href="/legal/data-retention">מדיניות שמירת הנתונים</a> לפרוט מלא לכל סוג נתון. תקציר:
        חשבונות שנמחקו נמחקים סופית תוך 30 ימים; יומן ביקורת נשמר עד שנה; קורות חיים נשמרים כל עוד
        החשבון פעיל.
      </p>

      <h2>9. אבטחה</h2>
      <ul>
        <li>הצפנה בתעבורה (TLS 1.3) ובמנוחה (AES-256, באמצעות הצפנת הדיסק של Google Cloud).</li>
        <li>הפרדה מלאה בין נתוני משתמשים.</li>
        <li>אימות דו-שלבי (2FA) זמין לכל המשתמשים.</li>
        <li>ביקורת אבטחה תקופתית; דוח אחרון: 26 במאי 2026.</li>
      </ul>

      <h2>10. זכויותיכם</h2>
      <p>בהתאם לסעיפים 13-14 לחוק הגנת הפרטיות, בכל עת תוכלו:</p>
      <ul>
        <li>לקבל עותק מהנתונים שלכם (ייצוא דרך הגדרות החשבון, או בכתב אל הכתובת מעלה).</li>
        <li>לתקן מידע שגוי.</li>
        <li>למחוק את חשבונכם (מחיקה מלאה תוך 30 ימים; ניתן לבטל בתוך תקופה זו).</li>
        <li>להגביל עיבוד או להתנגד לעיבוד.</li>
      </ul>

      <h2>11. הגשת תלונה</h2>
      <p>
        אם אתם סבורים שהפרנו את חוק הגנת הפרטיות, ניתן להגיש תלונה אל{' '}
        <a href={PRIVACY_AUTHORITY_URL_HE} target="_blank" rel="noopener noreferrer">
          הרשות להגנת הפרטיות במשרד המשפטים
        </a>{' '}
        או באמצעות פנייה אלינו ב-<a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>.
      </p>

      <h2>12. עדכוני מדיניות</h2>
      <p>
        נודיע על שינויים מהותיים לפחות 14 יום מראש באמצעות דוא״ל ובאתר. המשך השימוש לאחר תאריך
        התחילה מהווה הסכמה למדיניות המעודכנת.
      </p>

      <h2>13. יצירת קשר</h2>
      <p>
        שאלות פרטיות: <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>
      </p>
    </>
  );
}

function PrivacyEn() {
  const dbStatus = DB_REGISTRATION_REQUIRED
    ? `Our database is registered with the Israeli Database Registrar (Ministry of Justice), registration number ${DB_REGISTRATION_NUMBER ?? 'pending'}.`
    : 'Our database is not subject to mandatory registration under the Privacy Protection Regulations — we hold fewer than 10,000 data subjects and process no "special" data categories as defined in §7 of the Law.';

  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="text-muted-foreground text-sm">Last updated: May 2026</p>

      <h2>1. Overview</h2>
      <p>
        Welcome to {COMPANY_TRADING_NAME}. This document describes how we collect, use, and protect
        your information. We comply with the <strong>Israeli Privacy Protection Law (1981)</strong>{' '}
        and the 2017 Privacy Protection Regulations (Information Security), and we apply equivalent
        practices for users in the EU (GDPR) and elsewhere.
      </p>

      <h2>2. Data Controller</h2>
      <ul>
        <li>
          <strong>{COMPANY_LEGAL_NAME}</strong> ({COMPANY_TYPE_EN}), trading as{' '}
          {COMPANY_TRADING_NAME}.
        </li>
        <li>Address: {COMPANY_ADDRESS_EN}.</li>
        <li>
          Privacy contact: <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>
        </li>
        <li>
          Data Protection Officer: <a href={`mailto:${DPO_EMAIL}`}>{DPO_EMAIL}</a>
        </li>
      </ul>

      <h2>3. Database Registration</h2>
      <p>{dbStatus}</p>

      <h2>4. Information We Collect</h2>
      <ul>
        <li>Account: name, email, password (one-way hashed, never stored in plaintext).</li>
        <li>User-generated content: pasted job descriptions, profile data, generated resumes.</li>
        <li>Technical: hashed IP address (irreversible), browser type, usage timestamps.</li>
        <li>
          Billing: subscription status only. Card details live with the payment processor, not with
          us.
        </li>
      </ul>

      <h2>5. How We Use Information</h2>
      <ul>
        <li>Service delivery (generating resumes).</li>
        <li>Service improvement (aggregate metrics, no PII).</li>
        <li>User communication (verification, password reset, account alerts).</li>
        <li>Enforcing the Terms of Service and complying with legal obligations.</li>
      </ul>

      <h2>6. Third-Party Sharing</h2>
      <p>
        Job description and user profile are sent to Google Cloud Vertex AI (Anthropic and Google
        models, region europe-west1) for resume generation. These providers do not use this data for
        model training. Other operational services: Resend (email), Sentry (error monitoring, no
        PII), Cloudflare (CDN + WAF), Google Cloud (infrastructure). We do not share with others
        unless legally required.
      </p>

      <h2>7. Cookies</h2>
      <p>We use cookies in these categories:</p>
      <ul>
        <li>
          <strong>Strictly necessary</strong> — session cookie (Better Auth), language + theme
          preference. Do not require consent under Israeli law.
        </li>
        <li>
          <strong>Functional</strong> — UI preferences (resume builder drafts). Mostly stored in
          localStorage, not cookies.
        </li>
        <li>
          <strong>Analytics / Marketing</strong> — we use no third-party tracking cookies. No Google
          Analytics, no Facebook Pixel, no Hotjar.
        </li>
      </ul>
      <p>You can clear all our cookies in browser settings; doing so will sign you out.</p>

      <h2>8. Retention Periods</h2>
      <p>
        See our <a href="/legal/data-retention">Data Retention Policy</a> for the full per-data-type
        breakdown. Summary: deleted accounts purge within 30 days; audit log keeps up to 1 year;
        resumes retained while the account is active.
      </p>

      <h2>9. Security</h2>
      <ul>
        <li>TLS 1.3 in transit; AES-256 at rest via Google Cloud disk encryption.</li>
        <li>Strict tenant isolation.</li>
        <li>Two-factor authentication (2FA) available to all users.</li>
        <li>Periodic security review; last audit: 26 May 2026.</li>
      </ul>

      <h2>10. Your Rights</h2>
      <p>Under §§13-14 of the Privacy Protection Law, at any time you may:</p>
      <ul>
        <li>
          Request a copy of your data (export in account settings, or in writing to the address
          above).
        </li>
        <li>Correct inaccurate information.</li>
        <li>Delete your account (full purge within 30 days; reversible during that window).</li>
        <li>Restrict or object to processing.</li>
      </ul>

      <h2>11. Filing a Complaint</h2>
      <p>
        If you believe we have violated the Privacy Protection Law, you may file a complaint with
        the{' '}
        <a href={PRIVACY_AUTHORITY_URL_EN} target="_blank" rel="noopener noreferrer">
          Israeli Privacy Protection Authority (Ministry of Justice)
        </a>{' '}
        or by contacting us at <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>.
      </p>

      <h2>12. Policy Updates</h2>
      <p>
        We will give at least 14 days' notice before any material change, by email and on the site.
        Continued use after the effective date constitutes acceptance.
      </p>

      <h2>13. Contact</h2>
      <p>
        Privacy questions: <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>
      </p>
    </>
  );
}
