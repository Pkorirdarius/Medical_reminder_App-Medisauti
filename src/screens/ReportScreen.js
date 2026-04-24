import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator,
} from 'react-native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { COLORS, RADIUS, SHADOW } from '../utils/constants';
import { calcAdherence, getDailyStreak, getLogs, getPrescriptions } from '../utils/storage';

// ─── Build HTML for PDF report ────────────────────────────────────────
function buildReportHTML({ user, prescriptions, adherence, streak, generatedAt }) {
  const rows = prescriptions.map(p => `
    <tr>
      <td>${p.drugName}</td>
      <td>${p.dosage}</td>
      <td>${p.frequency}</td>
      <td>${(p.times || []).join(', ')}</td>
    </tr>
  `).join('');

  const streakRows = streak.map(s => `
    <tr>
      <td>${s.date}</td>
      <td style="color:${s.status === 'taken' ? '#0F6E56' : s.status === 'missed' ? '#E24B4A' : '#BA7517'}">
        ${s.status === 'taken' ? '✓ Taken' : s.status === 'missed' ? '✗ Missed' : s.status === 'partial' ? '~ Partial' : '—'}
      </td>
      <td>${s.taken}</td>
      <td>${s.missed}</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; color: #1A1A18; padding: 24px; }
    h1 { color: #0F6E56; font-size: 20px; margin-bottom: 4px; }
    h2 { color: #0F6E56; font-size: 14px; margin: 20px 0 8px; border-bottom: 1px solid #9FE1CB; padding-bottom: 4px; }
    .meta { font-size: 11px; color: #5F5E5A; margin-bottom: 20px; }
    .stat-box { display: inline-block; background: #E1F5EE; border-radius: 8px; padding: 10px 20px; margin: 4px; text-align: center; }
    .stat-val { font-size: 24px; font-weight: bold; color: #0F6E56; }
    .stat-lbl { font-size: 10px; color: #5F5E5A; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { background: #0F6E56; color: #fff; padding: 8px; text-align: left; font-size: 11px; }
    td { padding: 6px 8px; border-bottom: 0.5px solid #e0e0e0; font-size: 11px; }
    tr:nth-child(even) { background: #f5f5f0; }
    .footer { margin-top: 30px; font-size: 10px; color: #888; text-align: center; }
  </style>
</head>
<body>
  <h1>MEDISAUTI — Medication Adherence Report</h1>
  <p class="meta">
    Patient: <strong>${user?.name || 'Unknown'}</strong> &nbsp;|&nbsp;
    Condition: <strong>${user?.condition || '—'}</strong> &nbsp;|&nbsp;
    Generated: <strong>${generatedAt}</strong>
  </p>

  <h2>Adherence Summary (Last 30 Days)</h2>
  <div>
    <div class="stat-box">
      <div class="stat-val">${adherence.rate}%</div>
      <div class="stat-lbl">Adherence rate</div>
    </div>
    <div class="stat-box">
      <div class="stat-val">${adherence.taken}</div>
      <div class="stat-lbl">Doses taken</div>
    </div>
    <div class="stat-box" style="background:#FCEBEB;">
      <div class="stat-val" style="color:#E24B4A;">${adherence.missed}</div>
      <div class="stat-lbl">Doses missed</div>
    </div>
  </div>

  <h2>Current Prescriptions</h2>
  <table>
    <tr><th>Drug</th><th>Dosage</th><th>Frequency</th><th>Times</th></tr>
    ${rows || '<tr><td colspan="4">No prescriptions recorded</td></tr>'}
  </table>

  <h2>7-Day Streak</h2>
  <table>
    <tr><th>Date</th><th>Status</th><th>Taken</th><th>Missed</th></tr>
    ${streakRows}
  </table>

  <div class="footer">
    MEDISAUTI v1.0 — Kabarak University, Dept. of Computer Science & IT<br/>
    This report is for clinical reference only. Please consult your healthcare provider.
  </div>
</body>
</html>
  `;
}

// ─── Streak Day chip ──────────────────────────────────────────────────
function DayChip({ day }) {
  const configs = {
    taken:   { bg: COLORS.teal[400],  text: '#fff',                  label: '✓' },
    missed:  { bg: COLORS.red[50],    text: COLORS.red[400],         label: '✗' },
    partial: { bg: COLORS.amber[50],  text: COLORS.amber[400],       label: '~' },
    none:    { bg: COLORS.gray[50],   text: COLORS.text.secondary,   label: '·' },
  };
  const c = configs[day.status] || configs.none;
  const date = new Date(day.date + 'T12:00:00');
  const dayName = date.toLocaleDateString('en', { weekday: 'short' }).slice(0, 2);
  const dayNum  = date.getDate();

  return (
    <View style={[styles.dayChip, { backgroundColor: c.bg }]}>
      <Text style={[styles.dayChipName, { color: c.text }]}>{dayName}</Text>
      <Text style={[styles.dayChipNum, { color: c.text }]}>{dayNum}</Text>
      <Text style={[styles.dayChipStatus, { color: c.text }]}>{c.label}</Text>
    </View>
  );
}

export default function ReportScreen() {
  const insets = useSafeAreaInsets();

  const [adherence, setAdherence]       = useState({ rate: 0, taken: 0, missed: 0, total: 0 });
  const [streak, setStreak]             = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [language, setLanguage]         = useState('sw');
  const [exporting, setExporting]       = useState(false);

  useFocusEffect(
    useCallback(() => { loadData(); }, [])
  );

  async function loadData() {
    const [adh, str, meds] = await Promise.all([
      calcAdherence(30),
      getDailyStreak(7),
      getPrescriptions(),
    ]);
    setAdherence(adh);
    setStreak(str);
    setPrescriptions(meds);
  }

  async function handleExportPDF() {
    setExporting(true);
    try {
      const user = null; // load from storage if needed
      const html = buildReportHTML({
        user,
        prescriptions,
        adherence,
        streak,
        generatedAt: new Date().toLocaleDateString('en-KE', {
          day: '2-digit', month: 'long', year: 'numeric',
        }),
      });

      // Save as HTML file (react-native-html-to-pdf not available in Expo Go;
      // HTML can be opened in browser or shared. For production, use a PDF library.)
      const fileUri = FileSystem.documentDirectory + 'MEDISAUTI_Report.html';
      await FileSystem.writeAsStringAsync(fileUri, html, { encoding: FileSystem.EncodingType.UTF8 });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/html',
          dialogTitle: language === 'sw' ? 'Shiriki Ripoti' : 'Share Report',
        });
      } else {
        Alert.alert(
          language === 'sw' ? 'Ripoti Imehifadhiwa' : 'Report Saved',
          language === 'sw'
            ? `Ripoti imehifadhiwa: ${fileUri}`
            : `Report saved to: ${fileUri}`
        );
      }
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setExporting(false);
    }
  }

  const adherenceColor = adherence.rate >= 80
    ? COLORS.green[400]
    : adherence.rate >= 50
      ? COLORS.amber[400]
      : COLORS.red[400];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📊 {language === 'sw' ? 'Ripoti · Reports' : 'Adherence Reports'}</Text>
        <Text style={styles.headerSub}>
          {language === 'sw' ? 'Fuatilia maendeleo yako' : 'Track your progress'}
        </Text>
      </View>

      <View style={styles.langRow}>
        {['sw', 'en'].map(l => (
          <TouchableOpacity key={l} style={[styles.langBtn, language === l && styles.langBtnActive]} onPress={() => setLanguage(l)}>
            <Text style={[styles.langBtnText, language === l && styles.langBtnTextActive]}>
              {l === 'sw' ? 'Kiswahili' : 'English'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 12, paddingBottom: 50 }}>

        {/* Main adherence ring */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{language === 'sw' ? 'Mwezi huu · This month (30 days)' : 'This month (30 days)'}</Text>
          <View style={styles.bigStatRow}>
            <View style={[styles.bigStatCircle, { borderColor: adherenceColor }]}>
              <Text style={[styles.bigStatVal, { color: adherenceColor }]}>{adherence.rate}%</Text>
              <Text style={styles.bigStatSub}>{language === 'sw' ? 'Uzingativu' : 'Adherence'}</Text>
            </View>
            <View style={styles.smallStats}>
              <View style={styles.smallStat}>
                <Text style={[styles.smallStatVal, { color: COLORS.teal[400] }]}>{adherence.taken}</Text>
                <Text style={styles.smallStatLbl}>{language === 'sw' ? 'Zilizochukuliwa' : 'Taken'}</Text>
              </View>
              <View style={styles.smallStat}>
                <Text style={[styles.smallStatVal, { color: COLORS.red[400] }]}>{adherence.missed}</Text>
                <Text style={styles.smallStatLbl}>{language === 'sw' ? 'Zilizokosekana' : 'Missed'}</Text>
              </View>
              <View style={styles.smallStat}>
                <Text style={[styles.smallStatVal, { color: COLORS.text.primary }]}>{adherence.total}</Text>
                <Text style={styles.smallStatLbl}>{language === 'sw' ? 'Jumla' : 'Total'}</Text>
              </View>
            </View>
          </View>

          {/* Progress bar */}
          <View style={styles.progBg}>
            <View style={[styles.progFill, { width: `${adherence.rate}%`, backgroundColor: adherenceColor }]} />
          </View>

          {/* Rating message */}
          <Text style={{ fontSize: 12, color: adherenceColor, marginTop: 6, textAlign: 'center', fontWeight: '500' }}>
            {adherence.rate >= 80
              ? (language === 'sw' ? '🌟 Hongera! Unafanya vizuri sana.' : '🌟 Excellent! Keep it up.')
              : adherence.rate >= 50
                ? (language === 'sw' ? '⚠️ Vizuri, lakini bado unaweza kuboresha.' : '⚠️ Good, but there is room to improve.')
                : (language === 'sw' ? '❗ Tafadhali jaribu zaidi. Dawa ni muhimu.' : '❗ Please try harder. Medication is important.')}
          </Text>
        </View>

        {/* 7-day streak */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{language === 'sw' ? 'Wiki hii · This week' : 'This week'}</Text>
          <View style={styles.streakRow}>
            {streak.map((s, i) => <DayChip key={i} day={s} />)}
          </View>
        </View>

        {/* Analytics */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{language === 'sw' ? 'Uchambuzi · Analytics' : 'Analytics'}</Text>

          <View style={styles.analRow}>
            <Text style={styles.analLabel}>{language === 'sw' ? 'Hali yako' : 'Your status'}</Text>
            <View style={[styles.analBadge, { backgroundColor: adherenceColor + '20' }]}>
              <Text style={[styles.analBadgeText, { color: adherenceColor }]}>
                {adherence.rate >= 80
                  ? (language === 'sw' ? 'Bora' : 'Good')
                  : adherence.rate >= 50
                    ? (language === 'sw' ? 'Wastani' : 'Fair')
                    : (language === 'sw' ? 'Inahitaji kuboresha' : 'Needs improvement')}
              </Text>
            </View>
          </View>

          <View style={styles.analRow}>
            <Text style={styles.analLabel}>{language === 'sw' ? 'Dawa zilizo na rekodi' : 'Meds tracked'}</Text>
            <Text style={styles.analValue}>{prescriptions.length}</Text>
          </View>

          <View style={styles.analRow}>
            <Text style={styles.analLabel}>{language === 'sw' ? 'Zilizochukuliwa wiki hii' : 'Taken this week'}</Text>
            <Text style={styles.analValue}>{streak.reduce((a, s) => a + s.taken, 0)}</Text>
          </View>

          <View style={styles.analRow}>
            <Text style={styles.analLabel}>{language === 'sw' ? 'Zilizokosekana wiki hii' : 'Missed this week'}</Text>
            <Text style={[styles.analValue, { color: COLORS.red[400] }]}>
              {streak.reduce((a, s) => a + s.missed, 0)}
            </Text>
          </View>
        </View>

        {/* Export button */}
        <TouchableOpacity style={styles.exportBtn} onPress={handleExportPDF} disabled={exporting}>
          {exporting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={{ fontSize: 18 }}>📄</Text>
              <Text style={styles.exportBtnText}>
                {language === 'sw' ? 'Tuma Ripoti kwa Daktari' : 'Export Report for Doctor'}
              </Text>
            </>
          )}
        </TouchableOpacity>
        <Text style={styles.exportHint}>
          {language === 'sw'
            ? 'Shiriki ripoti via WhatsApp, Email, au SMS'
            : 'Share via WhatsApp, Email, or SMS'}
        </Text>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: COLORS.background },
  header:             { backgroundColor: COLORS.teal[600], padding: 16, paddingBottom: 18 },
  headerTitle:        { fontSize: 18, fontWeight: '600', color: '#fff' },
  headerSub:          { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  langRow:            { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 0.5, borderColor: '#e0e0e0' },
  langBtn:            { flex: 1, paddingVertical: 10, alignItems: 'center' },
  langBtnActive:      { borderBottomWidth: 2, borderBottomColor: COLORS.teal[400] },
  langBtnText:        { fontSize: 13, color: COLORS.text.secondary },
  langBtnTextActive:  { color: COLORS.teal[600], fontWeight: '600' },
  scroll:             { flex: 1 },
  card:               {
    backgroundColor: '#fff', borderRadius: RADIUS.lg,
    padding: 14, marginBottom: 12, ...SHADOW.sm,
  },
  cardTitle:          {
    fontSize: 11, fontWeight: '600', color: COLORS.text.secondary,
    textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 12,
  },
  bigStatRow:         { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 10 },
  bigStatCircle:      {
    width: 90, height: 90, borderRadius: 45, borderWidth: 4,
    alignItems: 'center', justifyContent: 'center',
  },
  bigStatVal:         { fontSize: 22, fontWeight: '700' },
  bigStatSub:         { fontSize: 10, color: COLORS.text.secondary },
  smallStats:         { flex: 1, gap: 8 },
  smallStat:          { },
  smallStatVal:       { fontSize: 18, fontWeight: '600' },
  smallStatLbl:       { fontSize: 11, color: COLORS.text.secondary },
  progBg:             { height: 6, backgroundColor: COLORS.gray[50], borderRadius: 3 },
  progFill:           { height: 6, borderRadius: 3 },
  streakRow:          { flexDirection: 'row', gap: 5, justifyContent: 'space-between' },
  dayChip:            { flex: 1, borderRadius: RADIUS.sm, padding: 6, alignItems: 'center', gap: 1 },
  dayChipName:        { fontSize: 10 },
  dayChipNum:         { fontSize: 13, fontWeight: '600' },
  dayChipStatus:      { fontSize: 10 },
  analRow:            {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#e8e8e8',
  },
  analLabel:          { fontSize: 13, color: COLORS.text.secondary },
  analValue:          { fontSize: 13, fontWeight: '600', color: COLORS.text.primary },
  analBadge:          { borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 4 },
  analBadgeText:      { fontSize: 11, fontWeight: '600' },
  exportBtn:          {
    backgroundColor: COLORS.teal[600], borderRadius: RADIUS.lg,
    padding: 16, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8,
  },
  exportBtnText:      { color: '#fff', fontSize: 15, fontWeight: '600' },
  exportHint:         { fontSize: 11, color: COLORS.text.secondary, textAlign: 'center', marginTop: 6 },
});
