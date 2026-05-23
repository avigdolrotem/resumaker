/**
 * Resume rendering engine — React-PDF templates + dispatcher.
 */

export { ModernTemplate } from './templates/modern';
export { ClassicTemplate } from './templates/classic';
export { MinimalTemplate } from './templates/minimal';
export { TEMPLATES, DEFAULT_TEMPLATE_ID, renderTemplate, templatesForTier } from './templates';
export type { TemplateId, TemplateMeta } from './templates';
export type { ResumePdfProps } from './templates/types';
