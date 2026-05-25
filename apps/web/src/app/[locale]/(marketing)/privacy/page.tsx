import { setRequestLocale } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const isHebrew = locale === 'he';

  return (
    <article className="prose mx-auto max-w-3xl px-4 py-12">
      {isHebrew ? <PrivacyHe /> : <PrivacyEn />}
    </article>
  );
}

function PrivacyHe() {
  return (
    <>
      <h1>מדיניות פרטיות</h1>
      <p className="text-muted-foreground text-sm">עודכן לאחרונה: מאי 2026</p>

      <h2>1. כללי</h2>
      <p>
        ברוכים הבאים ל-Resumaker. מסמך זה מתאר כיצד אנו אוספים, משתמשים ומגנים על המידע שלכם. אנו
        מחויבים להגנה על פרטיותכם בהתאם לחוק הגנת הפרטיות, תשמ"א-1981.
      </p>

      <h2>2. מידע שאנו אוספים</h2>
      <ul>
        <li>פרטי חשבון: שם, כתובת דוא״ל, סיסמה (מוצפנת).</li>
        <li>תוכן שיצרתם: תיאורי משרות שהדבקתם, פרופיל מקצועי, קורות חיים שיצרנו.</li>
        <li>מידע טכני: כתובת IP, סוג דפדפן, זמני שימוש.</li>
      </ul>

      <h2>3. שימוש במידע</h2>
      <p>אנו משתמשים במידע אך ורק לצורך:</p>
      <ul>
        <li>אספקת השירות (יצירת קורות חיים).</li>
        <li>שיפור השירות (מטרים מצטברים, ללא זיהוי אישי).</li>
        <li>תקשורת עם המשתמש (אימות, איפוס סיסמה).</li>
      </ul>

      <h2>4. שיתוף עם צד שלישי</h2>
      <p>
        תיאור המשרה ופרופיל המשתמש נשלחים ל-Anthropic (יצרנית מודל Claude) לצורך יצירת קורות החיים.
        Anthropic אינה משתמשת בנתונים אלה לאימון מודלים. לא משתפים מידע עם גורמים נוספים אלא אם נדרש
        על פי חוק.
      </p>

      <h2>5. אבטחה</h2>
      <ul>
        <li>הצפנה בתעבורה (TLS 1.3) ובמנוחה (AES-256).</li>
        <li>הפרדה מלאה בין נתוני משתמשים.</li>
        <li>ביקורת אבטחה רבעונית.</li>
      </ul>

      <h2>6. זכויותיכם</h2>
      <p>בכל עת תוכלו:</p>
      <ul>
        <li>לקבל עותק מהנתונים שלכם.</li>
        <li>לתקן מידע שגוי.</li>
        <li>למחוק את חשבונכם (מחיקה תוך 30 ימים).</li>
      </ul>

      <h2>7. יצירת קשר</h2>
      <p>
        שאלות: <a href="mailto:privacy@resumaker.co.il">privacy@resumaker.co.il</a>
      </p>
    </>
  );
}

function PrivacyEn() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="text-muted-foreground text-sm">Last updated: May 2026</p>

      <h2>1. Overview</h2>
      <p>
        Welcome to Resumaker. This document describes how we collect, use, and protect your
        information. We comply with the Israeli Privacy Protection Law (1981) and EU GDPR.
      </p>

      <h2>2. Information We Collect</h2>
      <ul>
        <li>Account: name, email, hashed password.</li>
        <li>User-generated content: pasted job descriptions, profile data, generated resumes.</li>
        <li>Technical: IP address, browser type, usage timestamps.</li>
      </ul>

      <h2>3. How We Use Information</h2>
      <ul>
        <li>Service delivery (generating resumes).</li>
        <li>Service improvement (aggregate metrics, no PII).</li>
        <li>User communication (verification, password reset).</li>
      </ul>

      <h2>4. Third-Party Sharing</h2>
      <p>
        Job description and user profile are sent to Anthropic (Claude model) for resume generation.
        Anthropic does not use this data for model training. We do not share with others unless
        legally required.
      </p>

      <h2>5. Security</h2>
      <ul>
        <li>TLS 1.3 in transit, AES-256 at rest.</li>
        <li>Strict tenant isolation.</li>
        <li>Quarterly security review.</li>
      </ul>

      <h2>6. Your Rights</h2>
      <ul>
        <li>Request a copy of your data.</li>
        <li>Correct inaccurate information.</li>
        <li>Delete your account (within 30 days).</li>
      </ul>

      <h2>7. Contact</h2>
      <p>
        Questions: <a href="mailto:privacy@resumaker.co.il">privacy@resumaker.co.il</a>
      </p>
    </>
  );
}
