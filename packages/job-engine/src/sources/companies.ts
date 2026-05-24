import type { Source } from '../types.js';

/**
 * Company slugs grouped by ATS source.
 * Derived from job-app/backend/app/sources/companies.json.
 * Note: "comeet" entries from the original are omitted — comeet uses slug+uid
 * pairs and is not in the Source union; it can be added in a follow-up.
 */
export const COMPANIES: Partial<Record<Source, string[]>> = {
  greenhouse: [
    'payoneer',
    'taboola',
    'similarweb',
    'jfrog',
    'riskified',
    'nice',
    'playtikaltd',
    'fireblocks',
    'Wizinc',
    'sentinellabs',
    'cybereason',
    'armissecurity',
    'catonetworks',
    'orcasecurity',
    'tipaltisolutions',
    'axonius',
    'forter',
    'transmitsecurity',
    'gongio',
    'lightricks',
    'appsflyer',
    'melio',
    'liveperson',
    'sisense',
    'optimove',
    'yotpo',
    'duda',
    'perionnetworkltd',
    'safebreach',
    'torq',
    'lightmatter',
    'innovid',
    'apiiro',
    'keepersecurity',
    'customerio',
    'guardz',
    'blend',
    'cymulate',
    'tigera',
    'bringg',
    'iai',
  ],
  lever: ['cloudinary', 'walkme', 'biocatch', 'houzz', 'logz'],
  workable: ['bizzabo', 'humanz', 'hyro', 'powtoon'],
  ashby: [],
};
