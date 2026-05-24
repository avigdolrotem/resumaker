/**
 * Modern Template — clean, tech-industry-friendly resume PDF.
 *
 * Hebrew RTL is handled per-Text via the `direction` prop on Text.
 * Top-level Page direction follows the resume locale.
 */

import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { ResumePdfProps } from './types';

// Registered in packages/resume-engine/src/fonts.ts so all templates share the
// same Font.register calls (one call per family — duplicates throw).
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
  experienceItem: { marginBottom: 10 },
  experienceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  experienceTitle: { fontSize: 11, fontWeight: 700 },
  experienceCompany: { fontSize: 10, color: '#6b7280' },
  experienceDates: { fontSize: 9, color: '#6b7280' },
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
  education: { fontSize: 10 },
});

// Default accent matches the L4 brand-600 (hsl(252 70% 47%) ≈ #6d28d9
// when converted to hex). Callers can override per-render for personal
// branding, but the unbranded look reads as indigo→violet, not the old
// blue-700 (#1d4ed8) from the pre-L4 palette.
export function ModernTemplate({ resume, accentColor = '#6d28d9' }: ResumePdfProps) {
  const lang = resume.metadata.language;
  const isRtl = lang === 'he' || lang === 'ar';
  const fontFamily = lang === 'ar' ? 'NotoSansArabic' : lang === 'he' ? 'Heebo' : 'Inter';
  // RTL adjustments — react-pdf has no `direction: 'rtl'` cascade, so we
  // mirror flex rows + flip text-align on every text node when RTL.
  // Without this the dates column lands on the wrong side and section
  // headers feel left-anchored, which RTL readers immediately notice.
  const pageStyle = {
    ...styles.page,
    fontFamily,
    ...(isRtl ? { textAlign: 'right' as const } : {}),
  };
  const headerStyle = { ...styles.header, borderBottomColor: accentColor };
  const titleStyle = { ...styles.sectionTitle, color: accentColor };
  const skillStyle = { ...styles.skill, color: accentColor };
  const experienceHeaderStyle = {
    ...styles.experienceHeader,
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
          </View>
        </View>

        {/* Summary */}
        {resume.summary && (
          <View style={styles.section}>
            <Text style={titleStyle}>
              {lang === 'he'
                ? 'תקציר'
                : lang === 'ar'
                  ? 'الملخص'
                  : lang === 'ru'
                    ? 'Резюме'
                    : 'Summary'}
            </Text>
            <Text style={styles.summary}>{resume.summary}</Text>
          </View>
        )}

        {/* Experience */}
        {resume.experience.length > 0 && (
          <View style={styles.section}>
            <Text style={titleStyle}>
              {lang === 'he'
                ? 'ניסיון תעסוקתי'
                : lang === 'ar'
                  ? 'الخبرة المهنية'
                  : lang === 'ru'
                    ? 'Опыт работы'
                    : 'Experience'}
            </Text>
            {resume.experience.map((exp, i) => (
              <View key={i} style={styles.experienceItem} wrap={false}>
                <View style={experienceHeaderStyle}>
                  <Text style={styles.experienceTitle}>{exp.title}</Text>
                  <Text style={styles.experienceDates}>
                    {exp.start_date} –{' '}
                    {exp.end_date ??
                      (lang === 'he'
                        ? 'היום'
                        : lang === 'ar'
                          ? 'الآن'
                          : lang === 'ru'
                            ? 'настоящее время'
                            : 'Present')}
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

        {/* Skills */}
        {resume.skills.length > 0 && (
          <View style={styles.section}>
            <Text style={titleStyle}>
              {lang === 'he'
                ? 'מיומנויות'
                : lang === 'ar'
                  ? 'المهارات'
                  : lang === 'ru'
                    ? 'Навыки'
                    : 'Skills'}
            </Text>
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

        {/* Education */}
        {resume.education.length > 0 && (
          <View style={styles.section}>
            <Text style={titleStyle}>
              {lang === 'he'
                ? 'השכלה'
                : lang === 'ar'
                  ? 'التعليم'
                  : lang === 'ru'
                    ? 'Образование'
                    : 'Education'}
            </Text>
            {resume.education.map((edu, i) => (
              <View key={i} style={styles.education}>
                <Text style={{ fontWeight: 700 }}>{edu.degree}</Text>
                <Text style={{ color: '#6b7280' }}>{edu.institution}</Text>
              </View>
            ))}
          </View>
        )}
      </Page>
    </Document>
  );
}
