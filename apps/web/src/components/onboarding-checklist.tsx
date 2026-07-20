import { CheckCircle2, Circle, Sparkles } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';

interface ChecklistItem {
  /** Stable identifier (used as React key). */
  id: string;
  /** Display title in the active locale. */
  title: string;
  /** One-line helper text. */
  description: string;
  /** Whether the user has completed this step. */
  done: boolean;
  /** Link target — undefined for already-done items. */
  href?: '/builder' | '/cover-letters/new' | '/account/billing' | '/profile' | '/resumes';
}

/**
 * Dashboard onboarding checklist.
 *
 * Shown only when the user is new (no resumes yet). Auto-hides once
 * they've shipped their first resume. Keeps the empty dashboard from
 * feeling like a void.
 *
 * Steps are passed in by the dashboard server component so we don't
 * have to refetch state client-side.
 */
export function OnboardingChecklist({
  items,
  locale,
}: {
  items: ChecklistItem[];
  locale: 'he' | 'en';
}) {
  const completedCount = items.filter((i) => i.done).length;
  const total = items.length;
  const isComplete = completedCount === total;

  if (isComplete) return null;

  return (
    <Card className="border-brand-200 dark:border-brand-800/60 from-brand-50/40 to-card dark:from-brand-950/30 dark:to-card bg-gradient-to-br">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="text-brand-500 h-5 w-5" />
          {locale === 'he' ? 'בואו נתחיל' : "Let's get you set up"}
        </CardTitle>
        <CardDescription>
          {locale === 'he'
            ? `${completedCount} מתוך ${total} הושלם`
            : `${completedCount} of ${total} complete`}
        </CardDescription>
        {/* Progress bar */}
        <div className="bg-muted mt-3 h-1.5 overflow-hidden rounded-full">
          <div
            className="bg-brand-500 h-full rounded-full transition-all"
            style={{ width: `${(completedCount / total) * 100}%` }}
          />
        </div>
      </CardHeader>
      <CardContent>
        <ol className="space-y-3">
          {items.map((item, index) => {
            const Icon = item.done ? CheckCircle2 : Circle;
            const content = (
              <div className="flex items-start gap-3">
                <Icon
                  className={`mt-0.5 h-5 w-5 shrink-0 ${
                    item.done ? 'text-emerald-500' : 'text-muted-foreground/50'
                  }`}
                />
                <div className="flex-1">
                  <p
                    className={`text-sm font-medium ${
                      item.done ? 'text-muted-foreground line-through' : 'text-foreground'
                    }`}
                  >
                    {index + 1}. {item.title}
                  </p>
                  {!item.done && (
                    <p className="text-muted-foreground mt-0.5 text-xs">{item.description}</p>
                  )}
                </div>
              </div>
            );

            return (
              <li key={item.id}>
                {item.href && !item.done ? (
                  <Link
                    href={item.href}
                    className="hover:bg-brand-50/40 dark:hover:bg-brand-950/30 ease-smooth -mx-2 block rounded-xl px-2 py-1.5 transition-colors duration-300"
                  >
                    {content}
                  </Link>
                ) : (
                  <div className="-mx-2 px-2 py-1.5">{content}</div>
                )}
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
