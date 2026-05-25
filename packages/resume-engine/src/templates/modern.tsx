/**
 * Modern Template — clean, tech-industry-friendly resume PDF.
 *
 * Hebrew RTL is handled per-Text via the `direction` prop on Text.
 * Top-level Page direction follows the resume locale.
 *
 * Section order matches the on-screen editor:
 *   Header → Summary → Experience → Education → Projects → Skills →
 *   Certifications → Awards → Languages
 * so what-you-edit visually maps to what-you-export.
 */

import { Document, Page, Text, View, StyleSheet, Link } from '@react-pdf/renderer';
import type { ResumePdfProps } from './types';
import { formatMonthYear, presentLabel, localizedSectionTitle } from '../utils/format';

import { ensureFontsRegistered } from '../fonts';
ensureFontsRegistered();

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Heebo',
    fontSize: 10,
    padding: 40,
    color: '#111827',
    lineHeight: 1.5,
  },
  header: {
    marginBottom: 16,
    borderBottom: '2 solid',
    borderBottomColor: '#1d4ed8',
    paddingBottom: 10,
  },
  name: { fontSize: 24, fontWeight: 700, marginBottom: 4 },
  contactRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    fontSize: 9,
    color: '#4b5563',
  },
  section: { marginBottom: 14 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: '#1d4ed8',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  summary: { fontSize: 10, lineHeight: 1.6 },
  entry: { marginBottom: 10 },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  entryTitle: { fontSize: 11, fontWeight: 700 },
  entrySubtitle: { fontSize: 10, color: '#6b7280' },
  entryDates: { fontSize: 9, color: '#6b7280' },
  entryMeta: { fontSize: 9, color: '#6b7280', marginTop: 1 },
  entryBody: { fontSize: 9.5, marginTop: 2 },
  highlight: { fontSize: 9.5, marginTop: 2, paddingLeft: 8 },
  bullet: { width: 8, fontSize: 9.5 },
  highlightRow: { flexDirection: 'row', marginTop: 2 },
  skillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  skill: {
    fontSize: 9,
    padding: '2 6',
    backgroundColor: '#eff6ff',
    color: '#1d4ed8',
    borderRadius: 2,
  },
  certRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  langsFooter: {
    marginTop: 12,
    paddingTop: 8,
    borderTop: '1 solid #e5e7eb',
    fontSize: 9,
    color: '#6b7280',
  },
  link: { color: '#1d4ed8', textDecoration: 'underline' },
});

// Default accent matches the L4 brand-600 (hsl(252 70% 47%) ≈ #6d28d9).
export function ModernTemplate({ resume, accentColor = '#6d28d9' }: ResumePdfProps) {
  const lang = resume.metadata.language;
  const isRtl = lang === 'he' || lang === 'ar';
  const fontFamily = lang === 'ar' ? 'NotoSansArabic' : lang === 'he' ? 'Heebo' : 'Inter';
  const present = presentLabel(lang);

  // RTL adjustments — react-pdf has no `direction: 'rtl'` cascade, so we
  // mirror flex rows + flip text-align on every text node when RTL.
  const pageStyle = {
    ...styles.page,
    fontFamily,
    ...(isRtl ? { textAlign: 'right' as const } : {}),
  };
  const headerStyle = { ...styles.header, borderBottomColor: accentColor };
  const titleStyle = { ...styles.sectionTitle, color: accentColor };
  const skillStyle = { ...styles.skill, color: accentColor };
  const entryHeaderStyle = {
    ...styles.entryHeader,
    ...(isRtl ? { flexDirection: 'row-reverse' as const } : {}),
  };
  const highlightRowStyle = {
    ...styles.highlightRow,
    ...(isRtl ? { flexDirection: 'row-reverse' as const } : {}),
  };
  const highlightStyle = isRtl
    ? { ...styles.highlight, paddingLeft: 0, paddingRight: 8, textAlign: 'right' as const }
    : styles.highlight;
  const contactRowStyle = isRtl
    ? {
        ...styles.contactRow,
        flexDirection: 'row-reverse' as const,
        justifyContent: 'flex-start' as const,
      }
    : styles.contactRow;

  return (
    <Document>
      <Page size="A4" style={pageStyle}>
        {/* Header */}
        <View style={headerStyle}>
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
            <Text style={titleStyle}>{localizedSectionTitle(lang, 'summary')}</Text>
            <Text style={styles.summary}>{resume.summary}</Text>
          </View>
        )}

        {/* Experience */}
        {resume.experience.length > 0 && (
          <View style={styles.section}>
            <Text style={titleStyle}>{localizedSectionTitle(lang, 'experience')}</Text>
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
                    <Text style={styles.bullet}>•</Text>
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
            <Text style={titleStyle}>{localizedSectionTitle(lang, 'education')}</Text>
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
            <Text style={titleStyle}>{localizedSectionTitle(lang, 'projects')}</Text>
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
                  <Text style={styles.entryMeta}>{p.technologies.join(' · ')}</Text>
                )}
                {p.description && <Text style={styles.entryBody}>{p.description}</Text>}
              </View>
            ))}
          </View>
        )}

        {/* Skills */}
        {resume.skills.length > 0 && (
          <View style={styles.section}>
            <Text style={titleStyle}>{localizedSectionTitle(lang, 'skills')}</Text>
            <View
              style={
                isRtl
                  ? {
                      ...styles.skillsContainer,
                      flexDirection: 'row-reverse',
                      justifyContent: 'flex-start',
                    }
                  : styles.skillsContainer
              }
            >
              {resume.skills.map((s, i) => (
                <Text key={i} style={skillStyle}>
                  {s}
                </Text>
              ))}
            </View>
          </View>
        )}

        {/* Certifications */}
        {resume.certifications && resume.certifications.length > 0 && (
          <View style={styles.section}>
            <Text style={titleStyle}>{localizedSectionTitle(lang, 'certifications')}</Text>
            {resume.certifications.map((c, i) => (
              <View key={i} style={styles.certRow} wrap={false}>
                <Text style={{ fontSize: 10 }}>
                  <Text style={{ fontWeight: 700 }}>{c.name}</Text>
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
            <Text style={titleStyle}>{localizedSectionTitle(lang, 'awards')}</Text>
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

        {/* Languages footer */}
        {resume.languages && resume.languages.length > 0 && (
          <View style={styles.langsFooter}>
            <Text>{resume.languages.map((l) => `${l.name} (${l.level})`).join(' · ')}</Text>
          </View>
        )}
      </Page>
    </Document>
  );
}
