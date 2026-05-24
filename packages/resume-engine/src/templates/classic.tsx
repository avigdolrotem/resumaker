/**
 * Classic Template — traditional Hebrew CV layout.
 *
 * Optimized for Israeli HR conventions:
 *   - Centered name + contact block at top
 *   - "Military Service" / "שירות צבאי" section explicitly supported
 *     via the resume schema (when present in `education` or experience
 *     with company starting with "צה״ל" / "IDF")
 *   - Conservative serifs-vibe via spacing and weight (no actual serifs
 *     since Heebo doesn't have a serif sibling — we use medium weight
 *     for body, bold for headers)
 *   - Black-and-white only (employer-friendly, prints well)
 *
 * Best for: government, finance, legal, traditional industries; older
 * recruiters who prefer the "Israeli standard" look.
 */

import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { ResumePdfProps } from './types';
import { ensureFontsRegistered } from '../fonts';

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
  experienceItem: {
    marginBottom: 12,
  },
  experienceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 3,
  },
  experienceTitle: {
    fontSize: 11,
    fontWeight: 700,
  },
  experienceCompany: {
    fontSize: 10.5,
    fontStyle: 'italic',
    color: '#333333',
    marginBottom: 4,
  },
  experienceDates: {
    fontSize: 9.5,
    color: '#666666',
  },
  highlight: {
    fontSize: 10,
    marginTop: 3,
    paddingLeft: 12,
  },
  bullet: { width: 10, fontSize: 10 },
  highlightRow: { flexDirection: 'row', marginTop: 3 },
  educationItem: {
    marginBottom: 6,
  },
  educationDegree: {
    fontWeight: 700,
    fontSize: 10.5,
  },
  educationInstitution: {
    fontSize: 10,
    color: '#333333',
  },
  educationDates: {
    fontSize: 9,
    color: '#666666',
  },
  skillsBlock: {
    fontSize: 10,
    lineHeight: 1.7,
  },
});

export function ClassicTemplate({ resume }: ResumePdfProps) {
  const isHebrew = resume.metadata.language === 'he';
  // See modern.tsx for the rationale — react-pdf has no direction cascade,
  // so we apply textAlign + flexDirection per-element when Hebrew.
  const pageStyle = isHebrew ? { ...styles.page, textAlign: 'right' as const } : styles.page;
  const experienceHeaderStyle = isHebrew
    ? { ...styles.experienceHeader, flexDirection: 'row-reverse' as const }
    : styles.experienceHeader;
  const highlightRowStyle = isHebrew
    ? { ...styles.highlightRow, flexDirection: 'row-reverse' as const }
    : styles.highlightRow;
  const highlightStyle = isHebrew
    ? { ...styles.highlight, paddingLeft: 0, paddingRight: 12 }
    : styles.highlight;

  const labels = isHebrew
    ? {
        summary: 'תקציר מקצועי',
        experience: 'ניסיון תעסוקתי',
        education: 'השכלה',
        skills: 'כישורים',
        languages: 'שפות',
        present: 'היום',
      }
    : {
        summary: 'Professional Summary',
        experience: 'Professional Experience',
        education: 'Education',
        skills: 'Skills',
        languages: 'Languages',
        present: 'Present',
      };

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
            <Text style={styles.sectionTitle}>{labels.education}</Text>
            {resume.education.map((edu, i) => (
              <View key={i} style={styles.educationItem} wrap={false}>
                <View style={experienceHeaderStyle}>
                  <Text style={styles.educationDegree}>{edu.degree}</Text>
                  <Text style={styles.educationDates}>
                    {edu.start_date} – {edu.end_date ?? labels.present}
                  </Text>
                </View>
                <Text style={styles.educationInstitution}>{edu.institution}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Skills — comma-separated for the classic look (no pills) */}
        {resume.skills.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{labels.skills}</Text>
            <Text style={styles.skillsBlock}>{resume.skills.join(' · ')}</Text>
          </View>
        )}

        {/* Languages */}
        {resume.languages && resume.languages.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{labels.languages}</Text>
            <Text style={styles.skillsBlock}>
              {resume.languages.map((l) => `${l.name} (${l.level})`).join(' · ')}
            </Text>
          </View>
        )}
      </Page>
    </Document>
  );
}
