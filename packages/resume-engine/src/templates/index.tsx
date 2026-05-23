/**
 * Template registry + dispatcher.
 *
 * `resumes.templateId` (varchar in DB) maps to one of these keys. The
 * PDF route calls `renderTemplate(templateId, props)` which returns the
 * right React-PDF component to feed to `renderToBuffer`.
 *
 * Adding a new template:
 *   1. Create `./<name>.tsx` exporting `<Name>Template`
 *   2. Add to TEMPLATES below
 *   3. Add the id to ResumeSchema.metadata.template enum if you want
 *      schema-level validation
 */

import type { ReactElement } from 'react';
import type { DocumentProps } from '@react-pdf/renderer';
import type { ResumePdfProps } from './types';
import { ModernTemplate } from './modern';
import { ClassicTemplate } from './classic';
import { MinimalTemplate } from './minimal';

/**
 * Every template returns a React-PDF `<Document>`. Typing this as
 * `ReactElement<DocumentProps>` lets the consumer pass our output
 * straight to `renderToBuffer` without re-casting.
 */
type PdfDocument = ReactElement<DocumentProps>;

export type TemplateId = 'modern' | 'classic' | 'minimal';

export interface TemplateMeta {
  id: TemplateId;
  /** Display name per locale. */
  name: { he: string; en: string };
  /** One-line description per locale. */
  description: { he: string; en: string };
  /** Render component. */
  render: (props: ResumePdfProps) => PdfDocument;
  /**
   * Which tiers can use this template? Free tier sees only `freeAvailable`.
   * Plus / Pro see all three.
   */
  freeAvailable: boolean;
  /** Display order on the template picker. */
  order: number;
}

export const TEMPLATES: Record<TemplateId, TemplateMeta> = {
  modern: {
    id: 'modern',
    name: { he: 'מודרני', en: 'Modern' },
    description: {
      he: 'מראה נקי עם צבע מודגש — מתאים להייטק וסטארטאפים',
      en: 'Clean with a brand accent — best for tech and startups',
    },
    render: (props) => <ModernTemplate {...props} />,
    freeAvailable: true, // the one free template
    order: 1,
  },
  classic: {
    id: 'classic',
    name: { he: 'קלאסי', en: 'Classic' },
    description: {
      he: 'עיצוב מסורתי בשחור-לבן — מתאים לגופים ציבוריים, פיננסים ומשפט',
      en: 'Traditional black-and-white — best for government, finance, legal',
    },
    render: (props) => <ClassicTemplate {...props} />,
    freeAvailable: false,
    order: 2,
  },
  minimal: {
    id: 'minimal',
    name: { he: 'מינימליסטי', en: 'Minimal' },
    description: {
      he: 'הכי הרבה חלל לבן — מתאים לתפקידי עיצוב ויזם',
      en: 'Maximum whitespace — best for design and product roles',
    },
    render: (props) => <MinimalTemplate {...props} />,
    freeAvailable: false,
    order: 3,
  },
};

/** Default template when `resumes.templateId` is missing or unknown. */
export const DEFAULT_TEMPLATE_ID: TemplateId = 'modern';

/**
 * Render the chosen template, falling back to Modern if `id` is unknown.
 * Never throws — bad ids degrade gracefully so an old saved templateId
 * (e.g. one we removed) still renders something.
 */
export function renderTemplate(id: string | null | undefined, props: ResumePdfProps): PdfDocument {
  const template = TEMPLATES[id as TemplateId] ?? TEMPLATES[DEFAULT_TEMPLATE_ID];
  return template.render(props);
}

/** Templates the given tier is allowed to use. */
export function templatesForTier(tier: 'free' | 'plus' | 'pro'): TemplateMeta[] {
  const ordered = Object.values(TEMPLATES).sort((a, b) => a.order - b.order);
  if (tier === 'free') return ordered.filter((t) => t.freeAvailable);
  return ordered;
}
