/**
 * Minimal Template — extreme white-space, single column, sans-serif.
 *
 * Best for tech / design / startup roles. English-language resumes
 * targeting international companies. Anyone who wants the resume itself
 * to feel like a portfolio piece.
 *
 * Section order matches the on-screen editor:
 *   Header → Summary → Experience → Education → Projects → Skills →
 *   Certifications → Awards → Languages
 */

import { Document, Page, Text, View, StyleSheet, Link } from '@react-pdf/renderer';
import type { ResumePdfProps } from './types';
import { ensureFontsRegistered } from '../fonts';
import { formatMonthYear, presentLabel, localizedSectionTitle } from '../utils/format';

ensureFontsRegistered();

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Inter',
    fontSize: 9.5,
    padding: 56,
    color: '#1f2937',
    lineHeight: 1.6,
  },
  pageHe: { fontFamily: 'Heebo' },
  header: { marginBottom: 28 },
  name: {
    fontSize: 28,
    fontWeight: 500,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  contactRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    fontSize: 9,
    color: '#6b7280',
  },
  section: { marginBottom: 22 },
  sectionTitle: {
    fontSize: 9,
    fontWeight: 600,
    color: '#9ca3af',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  summary: { fontSize: 10, lineHeight: 1.7 },
  entry: { marginBottom: 14 },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 2,
  },
  entryTitle: { fontSize: 10.5, fontWeight: 600 },
  entrySubtitle: { fontSize: 10, color: '#4b5563', marginBottom: 4 },
  entryDates: { fontSize: 9, color: '#9ca3af', fontWeight: 400 },
  entryBody: { fontSize: 9.5, marginTop: 3 },
  entryMeta: { fontSize: 9, color: '#9ca3af', marginTop: 1 },
  highlightRow: { flexDirection: 'row', marginTop: 2 },
  highlightBullet: { width: 8, fontSize: 9.5, color: '#9ca3af' },
  highlight: { fontSize: 9.5, flex: 1 },
  inlineList: { fontSize: 9.5, lineHeight: 1.7, color: '#374151' },
  certRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
    fontSize: 9.5,
  },
  link: { color: '#4b5563', textDecoration: 'underline' },
});

export function MinimalTemplate({ resume }: ResumePdfProps) {
  const lang = resume.metadata.language;
  const isRtl = lang === 'he' || lang === 'ar';
  const rtlFontOverride = lang === 'ar' ? { fontFamily: 'NotoSansArabic' } : styles.pageHe;
  const present = presentLabel(lang);

  const pageStyle = {
    ...styles.page,
    ...(isRtl ? { ...rtlFontOverride, textAlign: 'right' as const } : {}),
  };
  const entryHeaderStyle = isRtl
    ? { ...styles.entryHeader, flexDirection: 'row-reverse' as const }
    : styles.entryHeader;
  const highlightRowStyle = isRtl
    ? { ...styles.highlightRow, flexDirection: 'row-reverse' as const }
    : styles.highlightRow;
  const contactRowStyle = isRtl
    ? {
        ...styles.contactRow,
        flexDirection: 'row-reverse' as const,
        justifyContent: 'flex-start' as const,
      }
    : styles.contactRow;
  const highlightStyle = isRtl
    ? { ...styles.highlight, textAlign: 'right' as const }
    : styles.highlight;

  return (
    <Document>
      <Page size="A4" style={pageStyle}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.name}>{resume.contact.name}</Text>
          <View style={contactRowStyle}>
            {resume.contact.email && <Text>{resume.contact.email}</Text>}
            {resume.contact.phone && <Text>{resume.contact.phone}</Text>}
            {resume.contact.location && <Text>{resume.contact.location}</Text>}
            {resume.contact.linkedin && <Text>{resume.contact.linkedin}</Text>}
            {resume.contact.github && <Text>{resume.contact.github}</Text>}
            {resume.contact.website && <Text>{resume.contact.website}</Text>}
          </View>
        </View>

        {/* Summary */}
        {resume.summary && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{localizedSectionTitle(lang, 'summary')}</Text>
            <Text style={styles.summary}>{resume.summary}</Text>
          </View>
        )}

        {/* Experience */}
        {resume.experience.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{localizedSectionTitle(lang, 'experience')}</Text>
            {resume.experience.map((exp, i) => (
              <View key={i} style={styles.entry} wrap={false}>
                <View style={entryHeaderStyle}>
                  <Text style={styles.entryTitle}>{exp.title}</Text>
                  <Text style={styles.entryDates}>
                    {formatMonthYear(exp.start_date)} –{' '}
                    {exp.is_current || !exp.end_date ? present : formatMonthYear(exp.end_date)}
                  </Text>
                </View>
                <Text style={styles.entrySubtitle}>
                  {exp.company}
                  {exp.location ? ` · ${exp.location}` : ''}
                </Text>
                {exp.description && <Text style={styles.entryBody}>{exp.description}</Text>}
                {exp.highlights?.map((h, j) => (
                  <View key={j} style={highlightRowStyle}>
                    <Text style={styles.highlightBullet}>·</Text>
                    <Text style={highlightStyle}>{h}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        {/* Education */}
        {resume.education.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{localizedSectionTitle(lang, 'education')}</Text>
            {resume.education.map((edu, i) => (
              <View key={i} style={styles.entry} wrap={false}>
                <View style={entryHeaderStyle}>
                  <Text style={styles.entryTitle}>
                    {edu.degree}
                    {edu.field ? ` · ${edu.field}` : ''}
                  </Text>
                  {(edu.start_date || edu.end_date) && (
                    <Text style={styles.entryDates}>
                      {formatMonthYear(edu.start_date)} –{' '}
                      {edu.is_current || !edu.end_date ? present : formatMonthYear(edu.end_date)}
                    </Text>
                  )}
                </View>
                <Text style={styles.entrySubtitle}>
                  {edu.institution}
                  {edu.gpa ? ` · GPA: ${edu.gpa}` : ''}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Projects */}
        {resume.projects && resume.projects.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{localizedSectionTitle(lang, 'projects')}</Text>
            {resume.projects.map((p, i) => (
              <View key={i} style={styles.entry} wrap={false}>
                <View style={entryHeaderStyle}>
                  <Text style={styles.entryTitle}>{p.name}</Text>
                  {(p.start_date || p.end_date || p.is_ongoing) && (
                    <Text style={styles.entryDates}>
                      {formatMonthYear(p.start_date ?? '')} –{' '}
                      {p.is_ongoing ? present : formatMonthYear(p.end_date ?? '')}
                    </Text>
                  )}
                </View>
                {p.url && (
                  <Link src={p.url} style={styles.link}>
                    {p.url.replace(/^https?:\/\//, '')}
                  </Link>
                )}
                {p.technologies && p.technologies.length > 0 && (
                  <Text style={styles.entryMeta}>{p.technologies.join(', ')}</Text>
                )}
                {p.description && <Text style={styles.entryBody}>{p.description}</Text>}
              </View>
            ))}
          </View>
        )}

        {/* Skills */}
        {resume.skills.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{localizedSectionTitle(lang, 'skills')}</Text>
            <Text style={styles.inlineList}>{resume.skills.join(' · ')}</Text>
          </View>
        )}

        {/* Certifications */}
        {resume.certifications && resume.certifications.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{localizedSectionTitle(lang, 'certifications')}</Text>
            {resume.certifications.map((c, i) => (
              <View key={i} style={styles.certRow}>
                <Text>
                  <Text style={{ fontWeight: 600 }}>{c.name}</Text>
                  {c.issuer ? ` · ${c.issuer}` : ''}
                </Text>
                <Text style={styles.entryDates}>
                  {c.date ? formatMonthYear(c.date) : ''}
                  {c.credential_url && (
                    <>
                      {c.date ? '  ' : ''}
                      <Link src={c.credential_url} style={styles.link}>
                        view
                      </Link>
                    </>
                  )}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Awards */}
        {resume.awards && resume.awards.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{localizedSectionTitle(lang, 'awards')}</Text>
            {resume.awards.map((a, i) => (
              <View key={i} style={styles.entry} wrap={false}>
                <View style={entryHeaderStyle}>
                  <Text style={styles.entryTitle}>
                    {a.title}
                    {a.issuer ? ` · ${a.issuer}` : ''}
                  </Text>
                  {a.date && <Text style={styles.entryDates}>{formatMonthYear(a.date)}</Text>}
                </View>
                {a.description && <Text style={styles.entryBody}>{a.description}</Text>}
              </View>
            ))}
          </View>
        )}

        {/* Languages */}
        {resume.languages && resume.languages.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {lang === 'he'
                ? 'שפות'
                : lang === 'ar'
                  ? 'اللغات'
                  : lang === 'ru'
                    ? 'Языки'
                    : 'Languages'}
            </Text>
            <Text style={styles.inlineList}>
              {resume.languages.map((l) => `${l.name} — ${l.level}`).join(' · ')}
            </Text>
          </View>
        )}
      </Page>
    </Document>
  );
}
