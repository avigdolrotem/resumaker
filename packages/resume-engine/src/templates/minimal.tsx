/**
 * Minimal Template — extreme white-space, single column, sans-serif.
 *
 * Best for:
 *   - Tech / design / startup roles (the "Read Stripe Atlas docs" crowd)
 *   - English-language resumes targeting international companies
 *   - Anyone who wants the resume itself to feel like a portfolio piece
 *
 * Design choices:
 *   - Inter for body text (cleaner Latin letterforms than Heebo)
 *   - Heebo retained for Hebrew passages (mixed-language resumes still work)
 *   - No section borders, no background colors — pure typographic hierarchy
 *   - Name in light weight (the opposite of the loud Classic template)
 *   - Skills as inline pill-less list with mid-dot separator
 */

import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { ResumePdfProps } from './types';
import { ensureFontsRegistered } from '../fonts';

ensureFontsRegistered();

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Inter',
    fontSize: 9.5,
    padding: 56,
    color: '#1f2937',
    lineHeight: 1.6,
  },
  pageHe: {
    // Hebrew face when locale is he
    fontFamily: 'Heebo',
  },
  header: {
    marginBottom: 28,
  },
  name: {
    fontSize: 28,
    fontWeight: 500, // intentionally not bold — minimalist signature
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
  summary: {
    fontSize: 10,
    lineHeight: 1.7,
  },
  experienceItem: { marginBottom: 14 },
  experienceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 2,
  },
  experienceTitle: {
    fontSize: 10.5,
    fontWeight: 600,
  },
  experienceCompany: {
    fontSize: 10,
    color: '#4b5563',
    marginBottom: 4,
  },
  experienceDates: {
    fontSize: 9,
    color: '#9ca3af',
    fontWeight: 400,
  },
  highlightRow: {
    flexDirection: 'row',
    marginTop: 2,
  },
  highlightBullet: { width: 8, fontSize: 9.5, color: '#9ca3af' },
  highlight: { fontSize: 9.5, flex: 1 },
  inlineList: {
    fontSize: 9.5,
    lineHeight: 1.7,
    color: '#374151',
  },
  educationItem: {
    marginBottom: 8,
  },
  educationDegree: { fontSize: 10, fontWeight: 600 },
  educationInstitution: { fontSize: 9.5, color: '#4b5563' },
});

export function MinimalTemplate({ resume }: ResumePdfProps) {
  const isHebrew = resume.metadata.language === 'he';
  // RTL pass parallel to modern.tsx + classic.tsx — react-pdf has no
  // `direction: 'rtl'` cascade, so flex rows + text alignment have to be
  // mirrored explicitly when Hebrew. Without these flips the experience
  // header would render with title-left/date-right in Hebrew, which is
  // visually wrong (Hebrew readers expect dates on the LEFT).
  const pageStyle = {
    ...styles.page,
    ...(isHebrew ? { ...styles.pageHe, textAlign: 'right' as const } : {}),
  };
  const experienceHeaderStyle = isHebrew
    ? { ...styles.experienceHeader, flexDirection: 'row-reverse' as const }
    : styles.experienceHeader;
  const highlightRowStyle = isHebrew
    ? { ...styles.highlightRow, flexDirection: 'row-reverse' as const }
    : styles.highlightRow;
  const contactRowStyle = isHebrew
    ? {
        ...styles.contactRow,
        flexDirection: 'row-reverse' as const,
        justifyContent: 'flex-start' as const,
      }
    : styles.contactRow;
  const highlightStyle = isHebrew
    ? { ...styles.highlight, textAlign: 'right' as const }
    : styles.highlight;

  const labels = isHebrew
    ? {
        summary: 'תקציר',
        experience: 'ניסיון',
        education: 'השכלה',
        skills: 'כישורים',
        languages: 'שפות',
        present: 'היום',
      }
    : {
        summary: 'About',
        experience: 'Experience',
        education: 'Education',
        skills: 'Skills',
        languages: 'Languages',
        present: 'Present',
      };

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
            {resume.contact.website && <Text>{resume.contact.website}</Text>}
          </View>
        </View>

        {/* Summary */}
        {resume.summary && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{labels.summary}</Text>
            <Text style={styles.summary}>{resume.summary}</Text>
          </View>
        )}

        {/* Experience */}
        {resume.experience.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{labels.experience}</Text>
            {resume.experience.map((exp, i) => (
              <View key={i} style={styles.experienceItem} wrap={false}>
                <View style={experienceHeaderStyle}>
                  <Text style={styles.experienceTitle}>{exp.title}</Text>
                  <Text style={styles.experienceDates}>
                    {exp.start_date} – {exp.end_date ?? labels.present}
                  </Text>
                </View>
                <Text style={styles.experienceCompany}>{exp.company}</Text>
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
            <Text style={styles.sectionTitle}>{labels.education}</Text>
            {resume.education.map((edu, i) => (
              <View key={i} style={styles.educationItem} wrap={false}>
                <Text style={styles.educationDegree}>{edu.degree}</Text>
                <Text style={styles.educationInstitution}>
                  {edu.institution} · {edu.start_date} – {edu.end_date ?? labels.present}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Skills */}
        {resume.skills.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{labels.skills}</Text>
            <Text style={styles.inlineList}>{resume.skills.join(' · ')}</Text>
          </View>
        )}

        {/* Languages */}
        {resume.languages && resume.languages.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{labels.languages}</Text>
            <Text style={styles.inlineList}>
              {resume.languages.map((l) => `${l.name} — ${l.level}`).join(' · ')}
            </Text>
          </View>
        )}
      </Page>
    </Document>
  );
}
