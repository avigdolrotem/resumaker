import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { AnimatedMeshBg } from '@/components/ui-effects/animated-mesh-bg';
import { GridPattern } from '@/components/ui-effects/grid-pattern';
import { AnimatedGradientText } from '@/components/ui-effects/animated-gradient-text';
import { GlowButton } from '@/components/ui-effects/glow-button';
import {
  Mail,
  Phone,
  MapPin,
  ExternalLink,
  Award,
  GraduationCap,
  Briefcase,
  Sparkles,
} from 'lucide-react';

/**
 * Full sample resumes shown to anonymous visitors. The user feedback
 * called the previous version "blank" — just summary blurbs + 5
 * tags. This page now renders each example as a full resume preview
 * with realistic content (summary, experience entries with dates +
 * bullets, education, skills, languages) so visitors get an honest
 * sense of what the AI generates.
 *
 * Display matches the resume-engine PDF templates visually but is
 * pure HTML so it works without React-PDF + scales to whatever
 * viewport.
 */

type Bullet = string;
type Experience = {
  company: string;
  title: string;
  location: string;
  start: string; // MM/YYYY
  end: string | 'Present';
  bullets: Bullet[];
};
type Education = {
  institution: string;
  degree: string;
  start: string;
  end: string;
  honors?: string;
};
type SampleResume = {
  id: string;
  industry: 'tech' | 'finance' | 'healthcare' | 'product';
  locale: 'he' | 'en';
  name: string;
  title: string;
  email: string;
  phone: string;
  location: string;
  linkedin?: string;
  score: number; // ATS score (out of 100)
  summary: string;
  experience: Experience[];
  education: Education[];
  skills: { category: string; items: string[] }[];
  languages: { name: string; level: string }[];
  highlights: string[]; // tags for the card header
};

const SAMPLES: SampleResume[] = [
  {
    id: 'fullstack-he',
    industry: 'tech',
    locale: 'he',
    name: 'יוסי כהן',
    title: 'מפתח Full-Stack בכיר',
    email: 'yossi.cohen@example.co.il',
    phone: '+972-52-1234567',
    location: 'תל אביב, ישראל',
    linkedin: 'linkedin.com/in/yossicohen',
    score: 94,
    summary:
      'מהנדס תוכנה Full-Stack עם 8 שנות ניסיון בבניית מערכות סקיילביליות לחברות SaaS. מומחה ב-TypeScript, React, Node.js ו-AWS. הוביל פיתוח של 3 מוצרי B2B מ-0 ל-1 שהגיעו ל-50K משתמשים פעילים. נלהב מארכיטקטורה נקייה ומקוד שאחרים אוהבים לעבוד עליו.',
    experience: [
      {
        company: 'Wix',
        title: 'Senior Full-Stack Engineer',
        location: 'תל אביב',
        start: '03/2022',
        end: 'Present',
        bullets: [
          'הוביל מיגרציה של 40 שירותי Java legacy ל-Node.js + TypeScript — הפחית עלויות הרצה ב-35% ושיפר latency ב-220ms ברמת ה-p99.',
          'תכנן ויישם מערכת A/B testing המשרתת 200M בקשות ביום על AWS Lambda + DynamoDB.',
          'מנטור ל-5 מהנדסים זוטרים; הוביל מעבר של הצוות ל-trunk-based development.',
        ],
      },
      {
        company: 'Monday.com',
        title: 'Full-Stack Engineer',
        location: 'תל אביב',
        start: '06/2019',
        end: '02/2022',
        bullets: [
          'בנה את מודול Automations — איפשר ללקוחות להגדיר workflows ללא קוד; הניב $4M ARR נוסף בשנה הראשונה.',
          'שיפר ביצועי Dashboard ב-60% ע״י virtualization של רשימות ארוכות (React Window).',
          'תיכנן REST API ציבורי ששימש 1,200+ אינטגרציות 3rd-party.',
        ],
      },
      {
        company: 'Outbrain',
        title: 'Software Engineer',
        location: 'נתניה',
        start: '08/2017',
        end: '05/2019',
        bullets: [
          'פיתח pipeline אנליטיקות בלייב על Kafka + Spark Streaming שעיבד 500K אירועים/שנייה.',
          'בנה כלי פנימי לקריאת מבחני A/B שחסך לצוות המוצר 6 שעות בשבוע.',
        ],
      },
    ],
    education: [
      {
        institution: 'אוניברסיטת תל אביב',
        degree: 'B.Sc במדעי המחשב',
        start: '10/2013',
        end: '06/2017',
        honors: 'בהצטיינות',
      },
    ],
    skills: [
      {
        category: 'שפות וקריאות',
        items: ['TypeScript', 'JavaScript', 'Python', 'Go', 'SQL'],
      },
      {
        category: 'Frontend',
        items: ['React', 'Next.js', 'Redux', 'TanStack Query', 'Tailwind CSS'],
      },
      {
        category: 'Backend & Infra',
        items: ['Node.js', 'PostgreSQL', 'Redis', 'AWS', 'Docker', 'Kubernetes'],
      },
    ],
    languages: [
      { name: 'עברית', level: 'שפת אם' },
      { name: 'אנגלית', level: 'שוטף' },
    ],
    highlights: ['Wix', 'Monday', 'React/TS', 'AWS', '8y exp'],
  },
  {
    id: 'product-en',
    industry: 'product',
    locale: 'en',
    name: 'Sarah Goldman',
    title: 'Senior Product Manager',
    email: 'sarah.goldman@example.com',
    phone: '+1 (415) 555-0142',
    location: 'San Francisco, CA',
    linkedin: 'linkedin.com/in/sarahgoldman',
    score: 91,
    summary:
      'Senior Product Manager with 7 years shipping B2B SaaS products. Led roadmap for 3 successful launches reaching $5M ARR collectively. Strong cross-functional partner — known for clear writing, decisive prioritization, and PMing through ambiguity. Recently led the launch of an AI-powered analytics suite that crossed 10K seats in 4 months.',
    experience: [
      {
        company: 'Mixpanel',
        title: 'Senior Product Manager — AI Analytics',
        location: 'San Francisco, CA',
        start: '02/2023',
        end: 'Present',
        bullets: [
          'Defined and shipped Smart Insights (AI-powered cohort discovery) — first product release at the company to cross 10K paid seats in <4 months.',
          'Drove pricing experiment that lifted ARPU by 17% across 2,300 mid-market accounts.',
          'Wrote and shipped the AI Output Quality framework adopted by 6 PM teams company-wide.',
        ],
      },
      {
        company: 'Segment (Twilio)',
        title: 'Product Manager — Integrations',
        location: 'San Francisco, CA',
        start: '07/2020',
        end: '01/2023',
        bullets: [
          'Led the Destinations team — grew partner integrations from 320 to 510, contributing to a 22% YoY uplift in retention.',
          'Shipped the Functions self-serve developer flow; cut time-to-first-event from 14 days to 3.',
          'Partnered with sales to close 4 of the top 10 deals of FY22 ($8M+ TCV).',
        ],
      },
      {
        company: 'Stripe',
        title: 'Associate Product Manager',
        location: 'Remote',
        start: '08/2018',
        end: '06/2020',
        bullets: [
          'Owned Stripe Atlas onboarding — improved conversion from waitlist signup to first business filing by 31%.',
          'Built the first internal dashboard for tracking incorporated company outcomes (used by 4 GTM teams).',
        ],
      },
    ],
    education: [
      {
        institution: 'Stanford University',
        degree: 'B.A. Economics, minor in Computer Science',
        start: '09/2014',
        end: '06/2018',
        honors: 'With Distinction',
      },
    ],
    skills: [
      {
        category: 'Product Craft',
        items: ['Roadmapping', 'OKRs', 'Pricing experiments', 'PRD writing', 'A/B testing'],
      },
      {
        category: 'Discovery',
        items: ['User interviews', 'JTBD', 'Service blueprinting', 'Usability tests'],
      },
      {
        category: 'Tools',
        items: ['SQL', 'Mixpanel', 'Amplitude', 'Figma', 'Notion', 'Linear'],
      },
    ],
    languages: [
      { name: 'English', level: 'Native' },
      { name: 'Hebrew', level: 'Conversational' },
    ],
    highlights: ['Mixpanel', 'Segment', 'Stripe', 'AI-PM', '7y exp'],
  },
  {
    id: 'analyst-he',
    industry: 'finance',
    locale: 'he',
    name: 'מיכל לוי',
    title: 'אנליסטית פיננסית בכירה',
    email: 'michal.levi@example.co.il',
    phone: '+972-54-9876543',
    location: 'הרצליה, ישראל',
    score: 89,
    summary:
      'אנליסטית פיננסית בכירה עם 6 שנות ניסיון בניתוח אשראי, בניית מודלים פיננסיים והובלת עסקאות M&A בהיקפים של עד 80M$. בעלת תואר MBA עם התמחות במימון מאוניברסיטת תל אביב. שילוב נדיר של דיוק טכני ויכולת לתרגם נתונים מורכבים להחלטות עסקיות.',
    experience: [
      {
        company: 'Bank Hapoalim',
        title: 'Senior Credit Analyst — Corporate',
        location: 'תל אביב',
        start: '04/2021',
        end: 'Present',
        bullets: [
          'הובילה ניתוח אשראי לתיק של 47 לקוחות תאגידיים בהיקף כולל של 1.2B₪.',
          'בנתה מודל credit scoring חדש לתחום הטכנולוגיה — הפחית את שיעור הפיגורים ב-23% תוך 18 חודשים.',
          'ייצגה את הצוות בועדת אשראי שבועית; הציגה 80+ תיקים בפני ההנהלה הבכירה.',
        ],
      },
      {
        company: 'PwC Israel',
        title: 'Financial Analyst — Transaction Services',
        location: 'תל אביב',
        start: '09/2018',
        end: '03/2021',
        bullets: [
          'ביצעה due diligence פיננסי על 14 עסקאות M&A בהיקף משולב של $400M.',
          'בנתה מודלי DCF ו-LBO בהתאמה לדרישות הלקוחות, כולל קרנות PE בינלאומיות.',
          'ניהלה צוות של 3 אנליסטים זוטרים על פני 5 פרויקטים במקביל.',
        ],
      },
    ],
    education: [
      {
        institution: 'אוניברסיטת תל אביב — פקולטה לניהול',
        degree: 'MBA במימון',
        start: '10/2019',
        end: '06/2021',
        honors: 'בהצטיינות',
      },
      {
        institution: 'האוניברסיטה העברית',
        degree: 'B.A. כלכלה וניהול',
        start: '10/2014',
        end: '06/2017',
      },
    ],
    skills: [
      {
        category: 'מודלים פיננסיים',
        items: ['DCF', 'LBO', 'Comparable analysis', 'Credit scoring', 'Sensitivity analysis'],
      },
      {
        category: 'כלים',
        items: ['Excel (מתקדם)', 'SQL', 'PowerBI', 'Bloomberg Terminal'],
      },
      { category: 'תקנות', items: ['IFRS', 'בנק ישראל — נהלי 311', 'באזל III'] },
    ],
    languages: [
      { name: 'עברית', level: 'שפת אם' },
      { name: 'אנגלית', level: 'שוטף — כתיבה ודיבור' },
    ],
    highlights: ['Bank Hapoalim', 'PwC', 'M&A', 'MBA', '6y exp'],
  },
  {
    id: 'nurse-en',
    industry: 'healthcare',
    locale: 'en',
    name: 'Dana Abraham, RN',
    title: 'Registered Nurse — ICU & Emergency',
    email: 'dana.abraham@example.com',
    phone: '+972-58-7654321',
    location: 'Haifa, Israel',
    score: 87,
    summary:
      "Bilingual (Hebrew/English) Registered Nurse with 6 years in high-acuity ICU and emergency care. Calm under pressure, with a track record of leading triage during mass-casualty events. Currently pursuing a Master's in Nursing Administration. Looking for a charge-nurse role in a Level-I trauma center.",
    experience: [
      {
        company: 'Rambam Health Care Campus',
        title: 'Senior ICU Nurse',
        location: 'Haifa, Israel',
        start: '05/2021',
        end: 'Present',
        bullets: [
          'Charge nurse for 18-bed ICU; managed staffing + clinical priorities across rotating 12-hour shifts.',
          "Trained 9 new graduates through the unit's preceptor program; 8/9 stayed past their first year (vs hospital avg of 5/9).",
          'Co-led implementation of a sepsis-bundle protocol — reduced 30-day mortality by 14%.',
        ],
      },
      {
        company: 'Hadassah Medical Center',
        title: 'Emergency Room Nurse',
        location: 'Jerusalem',
        start: '07/2018',
        end: '04/2021',
        bullets: [
          'Triaged 80+ patients per shift in a Level-I trauma ER; certified in TNCC + PALS.',
          'Lead nurse during 2 mass-casualty incidents (MCI); coordinated handoff between EMS, ER, and OR teams.',
          'Mentored 4 new RNs through their ER orientation.',
        ],
      },
    ],
    education: [
      {
        institution: 'Tel Aviv University — School of Nursing',
        degree: 'B.S.N. (Bachelor of Science in Nursing)',
        start: '10/2014',
        end: '06/2018',
        honors: 'Magna Cum Laude',
      },
    ],
    skills: [
      {
        category: 'Clinical',
        items: [
          'ICU care',
          'Emergency triage',
          'IV therapy',
          'EKG interpretation',
          'Vent management',
        ],
      },
      {
        category: 'Certifications',
        items: ['ACLS', 'PALS', 'TNCC', 'BLS', 'CPI'],
      },
      {
        category: 'Tools',
        items: ['Epic (EHR)', 'PointClickCare', 'IBM Watson Triage'],
      },
    ],
    languages: [
      { name: 'Hebrew', level: 'Native' },
      { name: 'English', level: 'Fluent' },
      { name: 'Arabic', level: 'Conversational' },
    ],
    highlights: ['Rambam ICU', 'Hadassah ER', 'TNCC', 'PALS', '6y exp'],
  },
];

export default async function ExamplesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const isHebrew = locale === 'he';

  return (
    <div className="relative overflow-hidden">
      {/* Backdrop matches the marketing hero so the page feels connected */}
      <AnimatedMeshBg intensity="subtle" />
      <GridPattern size={48} className="opacity-40" />
      <div
        aria-hidden
        className="dark:from-background/40 dark:via-background/70 dark:to-background pointer-events-none absolute inset-0 bg-gradient-to-b from-white/40 via-white/70 to-white"
      />

      <div className="container relative mx-auto px-4 py-16">
        <div className="mx-auto mb-12 max-w-3xl text-center">
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            <AnimatedGradientText from="from-foreground" via="via-brand-700" to="to-foreground">
              {isHebrew ? 'דוגמאות קורות חיים' : 'Example Resumes'}
            </AnimatedGradientText>
          </h1>
          <p className="text-muted-foreground mt-4 text-lg">
            {isHebrew
              ? 'ארבע דוגמאות אמיתיות שנוצרו עם Resumaker. כל אחת מותאמת לתחום ולסוג התפקיד הספציפי. תוכן מלא — לא רק תקצירים.'
              : 'Four real samples generated by Resumaker. Each one tailored to a specific industry and role. Full content, not just teasers.'}
          </p>
        </div>

        <div className="mx-auto max-w-5xl space-y-8">
          {SAMPLES.map((s) => (
            <SampleResumeCard key={s.id} sample={s} isHebrew={isHebrew} />
          ))}
        </div>

        <div className="mt-16 text-center">
          <GlowButton href="/sign-up">
            <Sparkles className="h-4 w-4" />
            {isHebrew ? 'צור את קורות החיים שלך' : 'Build your own'}
          </GlowButton>
        </div>
      </div>
    </div>
  );
}

/** A single full sample resume rendered as a glassy card. */
function SampleResumeCard({ sample, isHebrew }: { sample: SampleResume; isHebrew: boolean }) {
  const dir = sample.locale === 'he' ? 'rtl' : 'ltr';
  const L = labels(sample.locale);

  return (
    <div
      dir={dir}
      className="border-border bg-card shadow-brand-500/5 hover:shadow-brand-500/10 relative overflow-hidden rounded-2xl border shadow-xl transition hover:shadow-2xl"
    >
      {/* Brand gradient strip */}
      <div
        aria-hidden
        className="from-brand-500 to-brand-500 h-1 bg-gradient-to-r via-purple-500"
      />

      {/* Header band */}
      <div className="border-border from-brand-50/40 dark:from-brand-900/20 flex items-start justify-between gap-6 border-b bg-gradient-to-br to-transparent p-6">
        <div className="min-w-0 flex-1">
          <h2 className="text-foreground text-2xl font-bold tracking-tight">{sample.name}</h2>
          <p className="text-brand-700 dark:text-brand-300 mt-1 text-base font-medium">
            {sample.title}
          </p>
          <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="inline-flex items-center gap-1" dir="ltr">
              <Mail className="h-3 w-3" />
              {sample.email}
            </span>
            <span className="inline-flex items-center gap-1" dir="ltr">
              <Phone className="h-3 w-3" />
              {sample.phone}
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {sample.location}
            </span>
            {sample.linkedin && (
              <span className="inline-flex items-center gap-1" dir="ltr">
                <ExternalLink className="h-3 w-3" />
                {sample.linkedin}
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0 text-end">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
            <Award className="h-3 w-3" />
            ATS {sample.score}
          </div>
          <div className="text-muted-foreground mt-2 text-[10px] font-medium uppercase tracking-wider">
            {sample.industry}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="space-y-6 p-6">
        {/* Summary */}
        <Section title={L.summary}>
          <p className="text-foreground text-sm leading-relaxed">{sample.summary}</p>
        </Section>

        {/* Experience */}
        <Section title={L.experience} Icon={Briefcase}>
          <div className="space-y-5">
            {sample.experience.map((e, i) => (
              <div key={i}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <div className="text-foreground text-sm font-semibold">
                      {e.title} · {e.company}
                    </div>
                    <div className="text-muted-foreground text-xs">{e.location}</div>
                  </div>
                  <div className="text-muted-foreground text-xs font-medium" dir="ltr">
                    {e.start} — {e.end}
                  </div>
                </div>
                <ul className="text-foreground mt-2 space-y-1 ps-4 text-sm leading-relaxed">
                  {e.bullets.map((b, j) => (
                    <li key={j} className="relative ps-3">
                      <span
                        aria-hidden
                        className="bg-brand-500 absolute inset-y-0 start-0 my-auto h-1 w-1 rounded-full"
                      />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>

        {/* Education */}
        <Section title={L.education} Icon={GraduationCap}>
          <div className="space-y-3">
            {sample.education.map((ed, i) => (
              <div key={i} className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <div className="text-foreground text-sm font-semibold">{ed.degree}</div>
                  <div className="text-muted-foreground text-xs">{ed.institution}</div>
                  {ed.honors && (
                    <div className="text-brand-700 dark:text-brand-300 text-xs italic">
                      {ed.honors}
                    </div>
                  )}
                </div>
                <div className="text-muted-foreground text-xs font-medium" dir="ltr">
                  {ed.start} — {ed.end}
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Skills */}
        <Section title={L.skills}>
          <div className="space-y-2">
            {sample.skills.map((g, i) => (
              <div key={i}>
                <div className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                  {g.category}
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {g.items.map((it) => (
                    <span
                      key={it}
                      className="bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-200 rounded-md px-2 py-0.5 text-xs font-medium"
                    >
                      {it}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Languages */}
        <Section title={L.languages}>
          <div className="text-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {sample.languages.map((lng, i) => (
              <span key={i}>
                <strong>{lng.name}</strong>{' '}
                <span className="text-muted-foreground">— {lng.level}</span>
              </span>
            ))}
          </div>
        </Section>
      </div>

      {/* CTA footer */}
      <div className="border-border bg-muted/40 flex items-center justify-between gap-3 border-t px-6 py-4">
        <div className="flex flex-wrap gap-1.5">
          {sample.highlights.slice(0, 4).map((h) => (
            <span
              key={h}
              className="bg-card text-muted-foreground rounded-full px-2 py-0.5 text-[10px] font-medium"
              dir="ltr"
            >
              {h}
            </span>
          ))}
        </div>
        <Link
          href="/sign-up"
          className="bg-brand-600 hover:bg-brand-700 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-white shadow-sm transition"
        >
          {isHebrew ? 'בנה דומה' : 'Build similar'}
        </Link>
      </div>
    </div>
  );
}

function Section({
  title,
  Icon,
  children,
}: {
  title: string;
  Icon?: typeof Briefcase;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="text-brand-700 dark:text-brand-300 mb-2 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {title}
      </h3>
      {children}
    </section>
  );
}

function labels(locale: 'he' | 'en') {
  if (locale === 'he') {
    return {
      summary: 'תקציר',
      experience: 'ניסיון',
      education: 'השכלה',
      skills: 'כישורים',
      languages: 'שפות',
    };
  }
  return {
    summary: 'Summary',
    experience: 'Experience',
    education: 'Education',
    skills: 'Skills',
    languages: 'Languages',
  };
}
