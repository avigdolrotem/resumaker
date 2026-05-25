'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { CheckCircle2, AlertCircle, AlertTriangle, Target } from 'lucide-react';

interface ATSScore {
  overall: number;
  matched_keywords: string[];
  missing_keywords: string[];
  suggestions: Array<{ type: string; severity: string; message: string }>;
}

/**
 * Visualizes an ATS score with animated ring + keyword chips.
 */
export function AtsScoreCard({ score, isHebrew }: { score: ATSScore; isHebrew: boolean }) {
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    const target = score.overall;
    const duration = 800;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [score.overall]);

  const color =
    score.overall >= 80
      ? {
          ring: '#10b981',
          bg: 'bg-emerald-50',
          text: 'text-emerald-700',
          border: 'border-emerald-200',
        }
      : score.overall >= 60
        ? {
            ring: '#6366f1',
            bg: 'bg-indigo-50',
            text: 'text-indigo-700',
            border: 'border-indigo-200',
          }
        : score.overall >= 40
          ? {
              ring: '#f59e0b',
              bg: 'bg-amber-50',
              text: 'text-amber-700',
              border: 'border-amber-200',
            }
          : { ring: '#ef4444', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' };

  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (displayScore / 100) * circumference;

  const label =
    score.overall >= 80
      ? isHebrew
        ? 'מצוין'
        : 'Excellent'
      : score.overall >= 60
        ? isHebrew
          ? 'טוב'
          : 'Good'
        : score.overall >= 40
          ? isHebrew
            ? 'בינוני'
            : 'Fair'
          : isHebrew
            ? 'דורש שיפור'
            : 'Needs work';

  return (
    <Card className={color.border}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="h-4 w-4" />
          {isHebrew ? 'ניקוד ATS' : 'ATS Score'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score ring */}
        <div className="flex items-center gap-4">
          <div className="relative h-24 w-24 flex-shrink-0">
            <svg className="-rotate-90" width="96" height="96" viewBox="0 0 96 96">
              <circle cx="48" cy="48" r="40" stroke="#e5e7eb" strokeWidth="8" fill="none" />
              <circle
                cx="48"
                cy="48"
                r="40"
                stroke={color.ring}
                strokeWidth="8"
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.1s linear' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold">{displayScore}</span>
              <span className="text-muted-foreground text-xs">/ 100</span>
            </div>
          </div>
          <div>
            <p className={`text-lg font-semibold ${color.text}`}>{label}</p>
            <p className="text-muted-foreground text-sm">
              {isHebrew
                ? `${score.matched_keywords.length} התאמות, ${score.missing_keywords.length} חסרות`
                : `${score.matched_keywords.length} matches, ${score.missing_keywords.length} missing`}
            </p>
          </div>
        </div>

        {/* Missing keywords */}
        {score.missing_keywords.length > 0 && (
          <div>
            <p className="text-muted-foreground mb-2 text-xs font-semibold uppercase tracking-wider">
              {isHebrew ? 'מילות מפתח חסרות' : 'Missing keywords'}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {score.missing_keywords.slice(0, 12).map((kw) => (
                <span
                  key={kw}
                  className={`rounded-full ${color.bg} px-2.5 py-1 text-xs font-medium ${color.text}`}
                >
                  {kw}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Suggestions */}
        {score.suggestions.length > 0 && (
          <div className="space-y-2">
            <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
              {isHebrew ? 'המלצות לשיפור' : 'Suggestions'}
            </p>
            {score.suggestions.map((s, i) => {
              const Icon =
                s.severity === 'high'
                  ? AlertTriangle
                  : s.severity === 'medium'
                    ? AlertCircle
                    : CheckCircle2;
              const iconColor =
                s.severity === 'high'
                  ? 'text-red-500'
                  : s.severity === 'medium'
                    ? 'text-amber-500'
                    : 'text-emerald-500';
              return (
                <div key={i} className="bg-muted flex items-start gap-2 rounded-md p-2.5 text-sm">
                  <Icon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${iconColor}`} />
                  <span className="text-foreground">{s.message}</span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
