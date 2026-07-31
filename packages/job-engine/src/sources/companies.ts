import type { Source } from '../types';

/**
 * Company slugs grouped by ATS source.
 * Derived from job-app/backend/app/sources/companies.json.
 * Comeet doesn't fit this shape (needs slug+uid+token, not a bare slug —
 * see COMEET_COMPANIES below).
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
  // Empty until Serper discovery (or manual curation) turns up real
  // Israeli companies on these two — both fetchers are wired and
  // verified against real live boards (see recruitee.ts /
  // smartrecruiters.ts), just no curated list yet.
  recruitee: [],
  smartrecruiters: [],
};

export interface ComeetCompany {
  slug: string;
  uid: string;
  token: string;
}

/**
 * Comeet requires a per-company token (enforced since 2025) alongside the
 * slug+uid pair — see harvestComeetToken in ./comeet.ts for where these
 * come from (Comeet's own hosted careers page embeds it in page HTML,
 * client-visible by design). Re-run the harvester and refresh an entry
 * here if its fetch starts 401ing — tokens rotate occasionally.
 *
 * job-app/backend/app/sources/companies.json listed 26 Comeet companies;
 * re-harvesting on 2026-07-23 got 21 (companies below). 5 came back with
 * no token (CyberArk, BigPanda, Cloudinary, Optimove, Earnix) — their
 * https://www.comeet.com/jobs/{slug}/{uid} page 302-redirected to the
 * Comeet homepage rather than 200ing, meaning that slug+uid no longer
 * resolves to a live company page (moved off Comeet, renamed, or the uid
 * changed). Omitted rather than kept with a stale/absent token.
 */
export const COMEET_COMPANIES: ComeetCompany[] = [
  { slug: 'AudioCodes', uid: '85.004', token: '5841B942C2058431A4108C269C108C0108C' },
  { slug: 'Skai', uid: '22.00A', token: '22A8A81150454CFC115022AAD2F26137A' },
  { slug: 'LiveU', uid: '90.00C', token: '9C2709C1D43A827030C3A82709C' },
  { slug: 'Cellebrite', uid: 'C3.00F', token: '3CF130BF3C0B6D16DA1AA9B6D130B16DA' },
  { slug: 'Fiverr', uid: '60.002', token: '62188018812631018862C4188' },
  { slug: 'Monday', uid: '41.00B', token: '14B52C52C67790D3E1296BA37C20' },
  { slug: 'Rapyd', uid: '73.00E', token: '37E11766FC1F6E11761F6E6FC01BF06FC' },
  { slug: 'Kaltura', uid: 'E2.00D', token: '2EDEA12ED017688C7147B1A555DA2ED' },
  { slug: 'Cyera', uid: '17.008', token: '7182A90154871823783FD838C031A802378' },
  { slug: 'Island', uid: '09.00A', token: '90A363C515A03F4601B1E2D32515A2D32' },
  { slug: 'ai21', uid: 'E6.001', token: '6E12946DC230276E13DE93708294637083708' },
  { slug: 'Tabnine', uid: '39.006', token: '936374452E652E6126C407A52E6407A52E6936' },
  { slug: 'Coralogix', uid: '06.004', token: '604241801E141E1460430200604604' },
  { slug: 'Artlist', uid: '85.003', token: '5831B8F2C185832C182C181B8F319BB061089' },
  { slug: 'Seemplicity', uid: '67.00D', token: '76D2C8E164733FB33FB1DB442D5042D5EDA' },
  { slug: 'Voyantis', uid: '86.00b', token: '68B2742D1600D16020B71A2C2742' },
  { slug: 'eToro', uid: '41.009', token: '14952452466D3DB7B61495240B91' },
  { slug: 'DealHub', uid: '86.005', token: '685271E6853AAD1A14D0A2099138F2DA33428' },
  { slug: 'Lusha', uid: '73.00B', token: '37B11676F61F53DEC6F606F61BD8185D' },
  { slug: 'Silverfort', uid: '54.007', token: '45715B315B38AE22B8D051A0A457D051E61' },
  { slug: 'Cynet', uid: '33.00D', token: '33D103133D19E8136E1D25103133D10311D25' },
];
