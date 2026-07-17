import { setRequestLocale } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import {
  BILLING_EMAIL,
  COMPANY_ADDRESS_EN,
  COMPANY_ADDRESS_HE,
  COMPANY_LEGAL_NAME,
  COMPANY_TRADING_NAME,
  COMPANY_TYPE_EN,
  COMPANY_TYPE_HE,
  LEGAL_EMAIL,
} from '@/lib/constants/contact';

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
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
        {isHebrew ? <TermsHe /> : <TermsEn />}
      </article>
    </div>
  );
}

function TermsHe() {
  return (
    <>
      <h1>תנאי שימוש</h1>
      <p className="text-muted-foreground text-sm">עודכן לאחרונה: מאי 2026</p>

      <h2>1. זהות המפעיל</h2>
      <ul>
        <li>
          השירות מופעל על ידי <strong>{COMPANY_LEGAL_NAME}</strong> ({COMPANY_TYPE_HE}), בשם המסחרי{' '}
          {COMPANY_TRADING_NAME}.
        </li>
        <li>כתובת: {COMPANY_ADDRESS_HE}.</li>
        <li>
          שאלות משפטיות: <a href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a>
        </li>
        <li>
          שאלות חיוב: <a href={`mailto:${BILLING_EMAIL}`}>{BILLING_EMAIL}</a>
        </li>
      </ul>

      <h2>2. שימוש בשירות</h2>
      <p>
        השימוש ב-{COMPANY_TRADING_NAME} מותנה בקבלת תנאים אלה. השירות מיועד לבני 16+ ולשימוש אישי
        במסגרת חיפוש עבודה. משתמשים מתחת לגיל 18 נדרשים להסכמת הורה או אפוטרופוס.
      </p>

      <h2>3. תוכן שנוצר</h2>
      <p>
        תוכן שנוצר באמצעות AI ניתן לעריכה ובדיקה על ידכם. אתם אחראים על דיוק וחוקיות התוכן שאתם
        שולחים למעסיקים — כולל אימות פרטי השכלה, ניסיון ותעודות.
      </p>

      <h2>4. הגבלות</h2>
      <ul>
        <li>אסור להעלות מידע פרטי של אחרים ללא הסכמתם.</li>
        <li>אסור לנסות לפרוץ או לזייף תגובות מהמערכת.</li>
        <li>אסור להשתמש בשירות לתוכן בלתי חוקי, מטעה, או פוגעני.</li>
        <li>אסור להשתמש בשירות לכריית נתונים אוטומטית או scraping.</li>
      </ul>

      <h2>5. מסלולי תשלום ומחירים</h2>
      <p>
        {COMPANY_TRADING_NAME} מציעה מסלול חינמי + מסלולי פרימיום בתשלום (חודשי או שנתי). מאחר
        שהמפעיל הוא {COMPANY_TYPE_HE}, <strong>המחירים המוצגים אינם כוללים מע"מ</strong> ולא ייווסף
        מע"מ בעת התשלום. החשבונית שתקבלו תהיה <strong>קבלה</strong> (לא חשבונית מס) בהתאם למעמד
        העוסק הפטור.
      </p>
      <p>
        סכומי החיוב הם בשקלים חדשים (₪) ויחויבו מראש לתחילת כל מחזור חיוב באמצעות ספק סליקה (Stripe
        / LemonSqueezy).
      </p>

      <h2>6. ביטול עסקה וזכויות הצרכן</h2>
      <p>
        בהתאם ל<strong>חוק הגנת הצרכן, תשמ"א-1981</strong> ולתקנות הגנת הצרכן (ביטול עסקה),
        תשע"א-2010:
      </p>
      <ul>
        <li>
          <strong>14 ימי ביטול ראשוניים</strong> — ניתן לבטל עסקה תוך 14 ימים מיום ביצועה ולקבל החזר
          מלא, כל עוד לא נוצל השירות באופן מהותי (למשל יצירת קורות חיים בתשלום).
        </li>
        <li>
          <strong>ביטול שירות מתמשך</strong> — ניתן לבטל מנוי מתמשך בכל עת דרך עמוד החיוב. הביטול
          ייכנס לתוקף בסוף מחזור החיוב הנוכחי; לא תחויבו מחזור חיוב נוסף.
        </li>
        <li>
          <strong>ביטול תוך 30 יום</strong> — צרכנים מסוימים (אזרחים ותיקים, אנשים עם מוגבלות, עולים
          חדשים בשנתם הראשונה) זכאים ל-30 ימי ביטול במקום 14.
        </li>
        <li>
          לביטול עסקה: פנו ל-<a href={`mailto:${BILLING_EMAIL}`}>{BILLING_EMAIL}</a> או דרך עמוד
          החיוב בחשבון.
        </li>
      </ul>

      <h2>7. הפסקת שירות מצדנו</h2>
      <p>
        אנו רשאים להפסיק לספק את השירות לחשבונות שמפרים את התנאים, עם הודעה מראש סבירה (לא פחות מ-7
        ימים, אלא בהפרה חמורה). מחזור חיוב שלא נוצל יוחזר באופן יחסי.
      </p>

      <h2>8. אחריות</h2>
      <p>
        השירות מסופק "כמות שהוא". איננו אחראים לתוצאות מהשימוש בקורות החיים שנוצרו (כגון: התקבלת/לא
        התקבלת לעבודה). אחריותנו הכוללת מוגבלת לסכום ששולם על ידכם ב-12 החודשים שקדמו לאירוע.
      </p>

      <h2>9. נגישות</h2>
      <p>
        {COMPANY_TRADING_NAME} מחויבת לעקרונות הנגישות לפי{' '}
        <strong>חוק שוויון זכויות לאנשים עם מוגבלות, תשנ"ח-1998</strong> ולתקנות הנגישות לשירות,
        תשע"ג-2013. ראו <a href="/legal/accessibility">הצהרת הנגישות שלנו</a> לפרוט.
      </p>

      <h2>10. פרטיות</h2>
      <p>
        איסוף ועיבוד מידע אישי כפופים ל<a href="/privacy">מדיניות הפרטיות</a>, המהווה חלק בלתי נפרד
        מתנאים אלה.
      </p>

      <h2>11. שינויים בתנאים</h2>
      <p>נודיע על שינויים מהותיים לפחות 14 יום מראש בדוא״ל ובאתר.</p>

      <h2>12. דין חל ושיפוט</h2>
      <p>
        על תנאים אלה חלים <strong>חוקי מדינת ישראל</strong>. סמכות שיפוט בלעדית: בתי המשפט המוסמכים
        בתל אביב-יפו.
      </p>
    </>
  );
}

function TermsEn() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p className="text-muted-foreground text-sm">Last updated: May 2026</p>

      <h2>1. Operator Identity</h2>
      <ul>
        <li>
          The service is operated by <strong>{COMPANY_LEGAL_NAME}</strong> ({COMPANY_TYPE_EN}),
          trading as {COMPANY_TRADING_NAME}.
        </li>
        <li>Address: {COMPANY_ADDRESS_EN}.</li>
        <li>
          Legal: <a href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a>
        </li>
        <li>
          Billing: <a href={`mailto:${BILLING_EMAIL}`}>{BILLING_EMAIL}</a>
        </li>
      </ul>

      <h2>2. Service Use</h2>
      <p>
        Use of {COMPANY_TRADING_NAME} is contingent on accepting these terms. The service is
        intended for users 16+ for personal use in job searching. Users under 18 require parent or
        guardian consent.
      </p>

      <h2>3. Generated Content</h2>
      <p>
        AI-generated content is provided for your review and editing. You are responsible for the
        accuracy and legality of content you submit to employers — including verifying education,
        experience, and credentials.
      </p>

      <h2>4. Restrictions</h2>
      <ul>
        <li>Do not upload others' private information without consent.</li>
        <li>Do not attempt to break or manipulate the system.</li>
        <li>Do not use the service for illegal, deceptive, or harmful content.</li>
        <li>Do not use the service for automated data mining or scraping.</li>
      </ul>

      <h2>5. Pricing & Plans</h2>
      <p>
        {COMPANY_TRADING_NAME} offers a free tier plus paid premium tiers (monthly or yearly).
        Because the operator is a {COMPANY_TYPE_EN},{' '}
        <strong>prices shown do not include VAT</strong> and no VAT will be added at checkout. The
        receipt you receive will be a <strong>plain receipt (קבלה)</strong>, not a tax invoice
        (חשבונית מס), consistent with VAT-exempt status under Israeli tax law.
      </p>
      <p>
        Amounts are in New Israeli Shekels (₪) and are charged in advance at the start of each
        billing cycle via the payment processor (Stripe / LemonSqueezy).
      </p>

      <h2>6. Cancellation & Consumer Rights</h2>
      <p>
        In accordance with the <strong>Israeli Consumer Protection Law (1981)</strong> and the
        Consumer Protection (Cancellation of Transaction) Regulations 2010:
      </p>
      <ul>
        <li>
          <strong>14-day initial cancellation</strong> — you may cancel a transaction within 14 days
          of purchase and receive a full refund, provided the service has not been materially used
          (e.g. resume generation already consumed).
        </li>
        <li>
          <strong>Ongoing subscription cancellation</strong> — you may cancel a recurring
          subscription at any time from the billing page. Cancellation takes effect at the end of
          the current billing cycle; no further charges.
        </li>
        <li>
          <strong>Extended 30-day cancellation</strong> — certain consumers (senior citizens, people
          with disabilities, new immigrants in their first year) are entitled to 30 days instead of
          14.
        </li>
        <li>
          To cancel, contact <a href={`mailto:${BILLING_EMAIL}`}>{BILLING_EMAIL}</a> or use the
          billing page in your account.
        </li>
      </ul>

      <h2>7. Termination by Us</h2>
      <p>
        We may terminate accounts that violate these terms, with reasonable notice (at least 7 days,
        except in cases of serious breach). Any unused portion of a billing cycle will be refunded
        pro-rata.
      </p>

      <h2>8. Liability</h2>
      <p>
        The service is provided "as is". We are not liable for outcomes from using generated resumes
        (e.g., hiring decisions). Total liability is capped at the amount you paid in the 12 months
        preceding the incident.
      </p>

      <h2>9. Accessibility</h2>
      <p>
        {COMPANY_TRADING_NAME} is committed to accessibility under the{' '}
        <strong>Israeli Equal Rights for Persons with Disabilities Law (1998)</strong> and the 2013
        Accessibility Regulations. See our{' '}
        <a href="/legal/accessibility">Accessibility Statement</a>.
      </p>

      <h2>10. Privacy</h2>
      <p>
        Collection and processing of personal information are governed by our{' '}
        <a href="/privacy">Privacy Policy</a>, which is incorporated into these terms by reference.
      </p>

      <h2>11. Changes to Terms</h2>
      <p>
        We will notify of material changes at least 14 days in advance, by email and on the site.
      </p>

      <h2>12. Governing Law and Jurisdiction</h2>
      <p>
        These terms are governed by the <strong>laws of the State of Israel</strong>. Exclusive
        jurisdiction: the competent courts in Tel Aviv-Jaffa.
      </p>
    </>
  );
}
