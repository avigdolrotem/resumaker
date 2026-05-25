/**
 * Classic Template — traditional Hebrew CV layout.
 *
 * Optimized for Israeli HR conventions:
 *   - Centered name + contact block at top
 *   - Italic subtitles for company / institution names
 *   - Black-and-white only (employer-friendly, prints well)
 *   - Conservative spacing + medium body weight
 *
 * Section order matches the on-screen editor:
 *   Header → Summary → Experience → Education → Projects → Skills →
 *   Certifications → Awards → Languages
 *
 * Best for: government, finance, legal, traditional industries; older
 * recruiters who prefer the "Israeli standard" look.
 */

import { Document, Page, Text, View, StyleSheet, Link } from '@react-pdf/renderer';
import type { ResumePdfProps } from './types';
import { ensureFontsRegistered } from '../fonts';
import { formatMonthYear, presentLabel, localizedSectionTitle } from '../utils/format';

ensureFontsRegistered();

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Heebo',
    fontSize: 10.5,
    padding: 50,
    color: '#000000',
    lineHeight: 1.55,
  },
  header: {
    alignItems: 'center',
    marginBottom: 18,
    paddingBottom: 12,
    borderBottom: '1 solid',
    borderBottomColor: '#000000',
  },
  name: {
    fontSize: 22,
    fontWeight: 700,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  contactBlock: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    fontSize: 9.5,
    color: '#333333',
    justifyContent: 'center',
  },
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 8,
    paddingBottom: 3,
    borderBottom: '0.5 solid',
    borderBottomColor: '#666666',
    letterSpacing: 0.5,
  },
  summary: {
    fontSize: 10.5,
    lineHeight: 1.65,
    textAlign: 'justify',
  },
  entry: { marginBottom: 12 },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 3,
  },
  entryTitle: { fontSize: 11, fontWeight: 700 },
  entryItalic: {
    fontSize: 10.5,
    fontStyle: 'italic',
    color: '#333333',
    marginBottom: 4,
  },
  entryDates: { fontSize: 9.5, color: '#666666' },
  entryBody: { fontSize: 10, marginTop: 3 },
  highlight: { fontSize: 10, marginTop: 3, paddingLeft: 12 },
  bullet: { width: 10, fontSize: 10 },
  highlightRow: { flexDirection: 'row', marginTop: 3 },
  skillsBlock: { fontSize: 10, lineHeight: 1.7 },
  certRow: { fontSize: 10, marginBottom: 4, flexDirection: 'row', justifyContent: 'space-between' },
  link: { color: '#000000', textDecoration: 'underline' },
});

export function ClassicTemplate({ resume }: ResumePdfProps) {
  const lang = resume.metadata.language;
  const isRtl = lang === 'he' || lang === 'ar';
  const fontFamily = lang === 'ar' ? 'NotoSansArabic' : lang === 'ru' ? 'Inter' : 'Heebo';
  const present = presentLabel(lang);

  const pageStyle = isRtl
    ? { ...styles.page, fontFamily, textAlign: 'right' as const }
    : { ...styles.page, fontFamily };
  const entryHeaderStyle = isRtl
    ? { ...styles.entryHeader, flexDirection: 'row-reverse' as const }
    : styles.entryHeader;
  const highlightRowStyle = isRtl
    ? { ...styles.highlightRow, flexDirection: 'row-reverse' as const }
    : styles.highlightRow;
  const highlightStyle = isRtl
    ? { ...styles.highlight, paddingLeft: 0, paddingRight: 12 }
    : styles.highlight;

  return (
    <Document>
      <Page size="A4" style={pageStyle}>
        {/* Header — centered, traditional */}
        <View style={styles.header}>
          <Text style={styles.name}>{resume.contact.name}</Text>
          <View style={styles.contactBlock}>
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
                <Text style={styles.entryItalic}>
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
                <Text style={styles.entryItalic}>
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
                {p.technologies && p.technologies.length > 0 && (
                  <Text style={styles.entryItalic}>{p.technologies.join(', ')}</Text>
                )}
                {p.url && (
                  <Link src={p.url} style={styles.link}>
                    {p.url.replace(/^https?:\/\//, '')}
                  </Link>
                )}
                {p.description && <Text style={styles.entryBody}>{p.description}</Text>}
              </View>
            ))}
          </View>
        )}

        {/* Skills — comma-separated for the classic look */}
        {resume.skills.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{localizedSectionTitle(lang, 'skills')}</Text>
            <Text style={styles.skillsBlock}>{resume.skills.join(' · ')}</Text>
          </View>
        )}

        {/* Certifications */}
        {resume.certifications && resume.certifications.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{localizedSectionTitle(lang, 'certifications')}</Text>
            {resume.certifications.map((c, i) => (
              <View key={i} style={styles.certRow}>
                <Text>
                  <Text style={{ fontWeight: 700 }}>{c.name}</Text>
                  {c.issuer ? ` · ` : ''}
                  {c.issuer && <Text style={{ fontStyle: 'italic' }}>{c.issuer}</Text>}
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
                  <Text style={styles.entryTitle}>{a.title}</Text>
                  {a.date && <Text style={styles.entryDates}>{formatMonthYear(a.date)}</Text>}
                </View>
                {a.issuer && <Text style={styles.entryItalic}>{a.issuer}</Text>}
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
            <Text style={styles.skillsBlock}>
              {resume.languages.map((l) => `${l.name} (${l.level})`).join(' · ')}
            </Text>
          </View>
        )}
      </Page>
    </Document>
  );
}
