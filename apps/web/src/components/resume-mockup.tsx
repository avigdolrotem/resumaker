'use client';

import { motion, useInView } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Sparkles } from 'lucide-react';

/**
 * Animated resume preview mockup for the landing page hero.
 * Shows a fake resume building up with ATS score ticking from 0 → 92.
 */
export function ResumeMockup({ locale }: { locale: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });
  const [score, setScore] = useState(0);

  const isHebrew = locale === 'he';

  useEffect(() => {
    if (!inView) return;
    const targetScore = 92;
    const duration = 1500;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out-cubic
      setScore(Math.round(eased * targetScore));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView]);

  return (
    <div ref={ref} className="relative mx-auto w-full max-w-md" dir={isHebrew ? 'rtl' : 'ltr'}>
      {/* ATS Score floating badge */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8, x: isHebrew ? -40 : 40 }}
        animate={inView ? { opacity: 1, scale: 1, x: 0 } : {}}
        transition={{ delay: 0.6, type: 'spring', stiffness: 200, damping: 20 }}
        className="absolute -top-4 z-10 rounded-2xl border border-green-200 bg-white p-3 shadow-xl"
        style={{ [isHebrew ? 'left' : 'right']: -16 }}
      >
        <div className="flex items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-emerald-600 text-white">
            <span className="text-lg font-bold">{score}</span>
          </div>
          <div>
            <div className="text-xs font-semibold text-neutral-900">ATS Score</div>
            <div className="text-xs text-green-600">{isHebrew ? 'מצוין' : 'Excellent'}</div>
          </div>
        </div>
      </motion.div>

      {/* Resume card */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="shadow-brand-500/10 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl"
      >
        {/* Top brand bar */}
        <div className="from-brand-500 via-brand-600 to-brand-700 h-2 bg-gradient-to-r" />

        <div className="p-6">
          {/* Name */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ delay: 0.2 }}
          >
            <div className="h-6 w-48 rounded bg-gradient-to-r from-neutral-900 to-neutral-700" />
            <div className="mt-2 flex gap-2">
              <div className="h-2 w-20 rounded bg-neutral-300" />
              <div className="h-2 w-24 rounded bg-neutral-300" />
            </div>
          </motion.div>

          {/* Section: Summary */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ delay: 0.4 }}
            className="mt-6"
          >
            <div className="text-brand-600 mb-2 text-xs font-bold uppercase tracking-wider">
              {isHebrew ? 'תקציר' : 'Summary'}
            </div>
            <div className="space-y-2">
              <div className="h-2 w-full rounded bg-neutral-200" />
              <div className="h-2 w-11/12 rounded bg-neutral-200" />
              <div className="h-2 w-9/12 rounded bg-neutral-200" />
            </div>
          </motion.div>

          {/* Section: Skills (staggered chips) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ delay: 0.8 }}
            className="mt-6"
          >
            <div className="text-brand-600 mb-2 text-xs font-bold uppercase tracking-wider">
              {isHebrew ? 'מיומנויות' : 'Skills'}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {['TypeScript', 'React', 'AWS', 'Postgres', 'Docker', 'k8s'].map((skill, i) => (
                <motion.span
                  key={skill}
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={inView ? { opacity: 1, scale: 1 } : {}}
                  transition={{ delay: 0.9 + i * 0.08, type: 'spring', stiffness: 300 }}
                  className="bg-brand-50 text-brand-700 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
                >
                  <Sparkles className="h-3 w-3" />
                  {skill}
                </motion.span>
              ))}
            </div>
          </motion.div>

          {/* Section: Experience */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ delay: 1.4 }}
            className="mt-6"
          >
            <div className="text-brand-600 mb-2 text-xs font-bold uppercase tracking-wider">
              {isHebrew ? 'ניסיון' : 'Experience'}
            </div>
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="h-3 w-32 rounded bg-neutral-300" />
                    <div className="h-2 w-12 rounded bg-neutral-200" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3 w-3 flex-shrink-0 text-green-500" />
                      <div className="h-2 w-full max-w-xs rounded bg-neutral-200" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3 w-3 flex-shrink-0 text-green-500" />
                      <div className="h-2 w-full max-w-[15rem] rounded bg-neutral-200" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Floating "AI generated" badge */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ delay: 1.6 }}
        className="absolute -bottom-4 z-10 rounded-full bg-neutral-900 px-4 py-2 text-xs font-medium text-white shadow-xl"
        style={{ [isHebrew ? 'right' : 'left']: -16 }}
      >
        <span className="me-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
        {isHebrew ? 'נוצר באמצעות AI' : 'AI-generated'}
      </motion.div>
    </div>
  );
}
