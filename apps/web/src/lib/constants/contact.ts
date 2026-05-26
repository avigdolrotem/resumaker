/**
 * Centralized contact addresses + legal sender identification.
 *
 * All public-facing emails live here. Cloudflare Email Routing on
 * resumaker.co.il is configured as catch-all → personal inbox, so any
 * `*@resumaker.co.il` alias used below lands in the operator's mailbox.
 * Don't sprinkle hardcoded emails across the codebase — change this
 * file when (a) you set up dedicated Workspace mailboxes per alias,
 * or (b) you change the company name / address.
 *
 * Sender identification (`COMPANY_*`) is required by:
 *   - Israeli Spam Law (תיקון 40 לחוק התקשורת, 2008) — marketing
 *     emails must identify the sender by full legal name + means of
 *     contact, otherwise the recipient can sue for ₪1,000 per email.
 *   - Israeli Privacy Protection Law (חוק הגנת הפרטיות, 1981) —
 *     data subjects must be able to reach the controller in writing.
 *   - Israeli Consumer Protection Law (חוק הגנת הצרכן) — sellers must
 *     publish full legal identity before accepting payment.
 */

export const SUPPORT_EMAIL = 'contact@resumaker.co.il';
export const PRIVACY_EMAIL = 'privacy@resumaker.co.il';
export const LEGAL_EMAIL = 'legal@resumaker.co.il';
export const ACCESSIBILITY_EMAIL = 'accessibility@resumaker.co.il';
export const DPO_EMAIL = 'dpo@resumaker.co.il';
export const BILLING_EMAIL = 'billing@resumaker.co.il';

/**
 * Legal identity of the operator. Used in:
 *   - Marketing email "פרסומת" footers (sender identification — תיקון 40)
 *   - Privacy policy (controller identification — Privacy Law §11)
 *   - Terms of service (seller identification — Consumer Protection Law)
 *   - Tax invoice receipts (if/when VAT-registered)
 *
 * Status: עוסק פטור (VAT-exempt sole proprietor) — no VAT charged, no
 * Companies Registrar number needed. If you upgrade to עוסק מורשה or
 * incorporate as a חברה בע"מ, update COMPANY_LEGAL_NAME + add
 * COMPANY_REGISTRATION_ID + COMPANY_VAT_ID below.
 */
export const COMPANY_LEGAL_NAME = 'Rotem Avigdol';
export const COMPANY_TRADING_NAME = 'Resumaker';
export const COMPANY_TYPE_HE = 'עוסק פטור';
export const COMPANY_TYPE_EN = 'VAT-exempt sole proprietor';

/**
 * Display address for legal pages + email footers. PO box / forwarding
 * address is fine here — only needs to be a verifiable means of
 * contacting the operator in writing. Update to a real address before
 * launch if you don't want to use the email-only fallback.
 */
export const COMPANY_ADDRESS_HE = 'ישראל'; // TODO: replace with city/PO box before launch
export const COMPANY_ADDRESS_EN = 'Israel'; // TODO: replace with city/PO box before launch

/**
 * Mailto convenience helpers — saves the `mailto:` prefix repetition
 * and makes IDE go-to-definition land on this file when you grep for
 * email links.
 */
export const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}`;
export const PRIVACY_MAILTO = `mailto:${PRIVACY_EMAIL}`;
export const ACCESSIBILITY_MAILTO = `mailto:${ACCESSIBILITY_EMAIL}`;

/**
 * Israeli Privacy Protection Authority — public regulator for data-
 * subject complaints. Linked from the privacy policy per regulator
 * guidance ("the data subject must be told where to complain").
 */
export const PRIVACY_AUTHORITY_URL_HE =
  'https://www.gov.il/he/departments/the_privacy_protection_authority';
export const PRIVACY_AUTHORITY_URL_EN =
  'https://www.gov.il/en/departments/the_privacy_protection_authority';

/**
 * Database registration status with the Privacy Protection Authority.
 * Under §8 of the Privacy Law + 2017 Privacy Regulations, registration
 * is required if (a) data on >10,000 subjects, (b) sensitive data
 * (health, biometric, political opinions, etc.), (c) data processed by
 * a third party, or (d) bought/sold for direct marketing.
 *
 * Resumes contain employment + education history → not sensitive per §7.
 * Free tier handles <10K subjects pre-launch.
 *
 * Update this when you cross 10,000 active users OR add any sensitive
 * data category (e.g., health, military service details beyond what
 * the user themselves chose to put on their CV).
 */
export const DB_REGISTRATION_REQUIRED = false;
export const DB_REGISTRATION_NUMBER: string | null = null;
