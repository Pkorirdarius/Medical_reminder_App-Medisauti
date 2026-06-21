import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Share, Alert, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { COLORS, RADIUS, FONT } from '../utils/constants';
import { getPrescriptions, calcAdherence, getDailyStreak, getPerMedicationAdherence, getMissedDosePatterns, getAdherenceTrend, getUser } from '../utils/storage';
import { useHighContrast } from '../utils/HighContrastContext';

const PERIOD_MAP = { morning: 'Asubuhi', afternoon: 'Mchana', evening: 'Jioni', night: 'Usiku' };

function ProgressBar({ value, color, height = 6 }) {
  return (
    <View style={[styles.progBg, { height }]}>
      <View style={[styles.progFill, { width: `${Math.min(value, 100)}%`, backgroundColor: color, height }]} />
    </View>
  );
}

function StatRow({ icon, iconColor, value, label }) {
  return (
    <View style={styles.statRowItem}>
      <MaterialCommunityIcons name={icon} size={18} color={iconColor} />
      <View style={{ marginLeft: 8, flex: 1 }}>
        <Text style={styles.statRowVal}>{value}</Text>
        <Text style={styles.statRowLabel}>{label}</Text>
      </View>
    </View>
  );
}

export default function ReportScreen() {
  const insets = useSafeAreaInsets();
  const { toggleHighContrast } = useHighContrast();
  const scrollRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [language, setLanguage] = useState('sw');
  const [exporting, setExporting] = useState(false);
  const [user, setUser] = useState({ name: '' });
  const [prescriptions, setPrescriptions] = useState([]);
  const [adherence, setAdherence] = useState({ rate: 0, taken: 0, missed: 0 });
  const [streak, setStreak] = useState([]);
  const [perMed, setPerMed] = useState([]);
  const [patterns, setPatterns] = useState({ morning: 0, afternoon: 0, evening: 0, night: 0 });
  const [trend, setTrend] = useState({ direction: 'insufficient', weeklyRates: [] });

  useFocusEffect(useCallback(() => { loadData(); }, []));
  useFocusEffect(useCallback(() => {
    if (scrollRef.current) setTimeout(() => scrollRef.current?.scrollTo?.({ y: 0, animated: true }), 100);
  }, []));

  async function loadData() {
    try {
      const [u, meds, adh, s, pm, ptn, tr] = await Promise.all([
        getUser(), getPrescriptions(), calcAdherence(30),
        getDailyStreak(7), getPerMedicationAdherence(30), getMissedDosePatterns(30), getAdherenceTrend(30),
      ]);
      if (u) setUser(u);
      setPrescriptions(meds);
      setAdherence(adh);
      setStreak(s);
      setPerMed(pm);
      setPatterns(ptn);
      setTrend(tr);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }

  function onRefresh() { setRefreshing(true); loadData(); }

  const rate = adherence.rate;
  const rateColor = rate >= 80 ? COLORS.green[400] : rate >= 50 ? COLORS.amber[400] : COLORS.red[400];

  async function generatePDF() {
    setExporting(true);
    try {
      let medRows = '';
      for (const p of prescriptions) {
        medRows += `<tr><td>${p.drugName} ${p.dosage}</td><td>${p.frequency}</td><td>${(p.times || []).join(', ')}</td></tr>`;
      }
      let streakRows = '';
      for (const d of streak) {
        streakRows += `<td style="text-align:center;padding:8px;border:1px solid #ddd;background:${d.status === 'taken' ? '#4CAF50' : d.status === 'partial' ? '#FFC107' : '#F44336'};color:#fff;border-radius:6px">${new Date(d.date).getDate()}</td>`;
      }

      const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>MediSauti Report</title>
<style>body{font-family:sans-serif;padding:24px;color:#1a1c1a}h1{color:#00513f;font-size:24px}h2{color:#27609d;font-size:18px;margin-top:24px}.rate{font-size:48px;font-weight:800;color:${rateColor}}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{padding:10px;border:1px solid #ddd;text-align:left}th{background:#f3f4f0}</style></head><body>
<h1>MediSauti — Adherence Report</h1>
<p>Patient: ${user.name || '—'} | Period: Last 30 days</p>
<h2>Overall Adherence: <span class="rate">${rate}%</span></h2>
<p>Taken: ${adherence.taken} | Missed: ${adherence.missed}</p>
<h2>Trend: ${trend.direction}</h2>
<p>Weekly: ${trend.weeklyRates.join('%, ')}%</p>
<h2>Per Medication</h2>
<table><tr><th>Medication</th><th>Rate</th></tr>${perMed.map(p => `<tr><td>${p.drugName} ${p.dosage}</td><td>${p.rate}%</td></tr>`).join('')}</table>
<h2>Current Medications</h2>
<table><tr><th>Drug</th><th>Frequency</th><th>Times</th></tr>${medRows}</table>
<h2>7-Day Streak</h2>
<table><tr>${streakRows}</tr></table>
<p style="margin-top:32px;color:#6f7a74;font-size:12px">Generated by MediSauti</p>
</body></html>`;
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Share MediSauti Report' });
      } else {
        Alert.alert('PDF Generated', `File saved at: ${uri}`);
      }
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setExporting(false); }
  }

  async function shareReport(platform) {
    const msg = language === 'sw'
      ? `Ripoti yangu ya afya kutoka MediSauti: Uzingativu ${rate}%`
      : `My MediSauti health report: ${rate}% adherence`;
    if (platform === 'whatsapp') {
      Linking.openURL(`https://wa.me/?text=${encodeURIComponent(msg)}`);
    } else if (platform === 'email') {
      Linking.openURL(`mailto:?subject=MediSauti%20Report&body=${encodeURIComponent(msg)}`);
    } else {
      Share.share({ message: msg });
    }
  }

  const maxPattern = Math.max(1, ...Object.values(patterns));

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialCommunityIcons name="chart-box-outline" size={28} color={COLORS.primary} />
          <Text style={styles.headerTitle}>Ripoti</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={() => setLanguage(l => l === 'sw' ? 'en' : 'sw')} style={styles.iconBtn}>
            <Text style={styles.langText}>{language === 'sw' ? 'SW' : 'EN'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleHighContrast} style={styles.iconBtn}>
            <MaterialCommunityIcons name="brightness-6" size={20} color={COLORS.onSurface} />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={COLORS.primary} />
      ) : (
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} colors={[COLORS.primary]} />}
        >
          {/* ── Hero Report Card ── */}
          <View style={styles.heroReport}>
            <View style={styles.heroReportTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionLabel}>Uzingativu wa mwezi</Text>
                <Text style={styles.sectionLabelSub}>Monthly adherence</Text>
              </View>
              <View style={[styles.trendChip, { backgroundColor: rateColor + '20' }]}>
                <MaterialCommunityIcons name={rate >= 80 ? 'trending-up' : rate >= 50 ? 'minus' : 'trending-down'} size={14} color={rateColor} />
                <Text style={[styles.trendText, { color: rateColor }]}>{rate >= 80 ? 'Great' : rate >= 50 ? 'Fair' : 'Low'}</Text>
              </View>
            </View>
            <Text style={[styles.heroRate, { color: rateColor }]}>{rate}%</Text>
            <ProgressBar value={rate} color={rateColor} height={10} />
            <View style={styles.heroStats}>
              <StatRow icon="check-circle" iconColor={COLORS.green[400]} value={adherence.taken} label="Taken" />
              <StatRow icon="close-circle" iconColor={COLORS.red[400]} value={adherence.missed} label="Missed" />
            </View>
          </View>

          {/* ── Export & Share ── */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.exportBtn} onPress={generatePDF} disabled={exporting} activeOpacity={0.7}>
              {exporting ? <ActivityIndicator size="small" color="#fff" /> : <MaterialCommunityIcons name="file-pdf-box" size={20} color="#fff" />}
              <Text style={styles.exportBtnText}>{exporting ? 'Generating...' : 'Export PDF'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shareWhatsApp} onPress={() => shareReport('whatsapp')} activeOpacity={0.7}>
              <MaterialCommunityIcons name="whatsapp" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.shareEmail} onPress={() => shareReport('email')} activeOpacity={0.7}>
              <MaterialCommunityIcons name="email-outline" size={20} color={COLORS.secondary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.shareMore} onPress={() => shareReport('other')} activeOpacity={0.7}>
              <MaterialCommunityIcons name="share-variant" size={20} color={COLORS.outline} />
            </TouchableOpacity>
          </View>

          {/* ── Weekly Trend ── */}
          <View style={styles.bentoCard}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="chart-timeline-variant" size={18} color={COLORS.secondary} />
              <Text style={[styles.sectionLabel, { marginLeft: 8 }]}>Weekly Trend</Text>
            </View>
            <View style={styles.trendRow}>
              <MaterialCommunityIcons
                name={trend.direction === 'improving' ? 'emoticon-happy' : trend.direction === 'worsening' ? 'emoticon-sad' : 'emoticon-neutral'}
                size={28}
                color={trend.direction === 'improving' ? COLORS.green[400] : trend.direction === 'worsening' ? COLORS.red[400] : COLORS.amber[400]}
              />
              <Text style={styles.trendDir}>{trend.direction}</Text>
            </View>
            <View style={styles.weekChart}>
              {trend.weeklyRates.map((r, i) => {
                const wColor = r >= 80 ? COLORS.green[400] : r >= 50 ? COLORS.amber[400] : COLORS.red[400];
                return (
                  <View key={i} style={styles.weekBarCol}>
                    <Text style={styles.weekBarVal}>{r}%</Text>
                    <View style={[styles.weekBar, { height: `${Math.max(r, 8)}%`, backgroundColor: wColor, borderRadius: 4 }]} />
                    <Text style={styles.weekBarLabel}>W{i + 1}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* ── Per Medication ── */}
          {perMed.length > 0 && (
            <View style={styles.bentoCard}>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="pill" size={18} color={COLORS.primary} />
                <Text style={[styles.sectionLabel, { marginLeft: 8 }]}>Per Medication</Text>
              </View>
              {perMed.map((p, i) => {
                const pColor = p.rate >= 80 ? COLORS.green[400] : p.rate >= 50 ? COLORS.amber[400] : COLORS.red[400];
                return (
                  <View key={i} style={styles.perMedRow}>
                    <Text style={styles.perMedName}>{p.drugName} {p.dosage}</Text>
                    <View style={styles.perMedRight}>
                      <ProgressBar value={p.rate} color={pColor} height={8} />
                      <Text style={[styles.perMedRate, { color: pColor }]}>{p.rate}%</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* ── Missed Patterns ── */}
          <View style={styles.bentoCard}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="clock-alert-outline" size={18} color={COLORS.amber[400]} />
              <Text style={[styles.sectionLabel, { marginLeft: 8 }]}>Missed Dose Patterns</Text>
            </View>
            <View style={styles.patternChart}>
              {Object.entries(patterns).map(([key, val]) => (
                <View key={key} style={styles.patternRow}>
                  <Text style={styles.patternLabel}>{PERIOD_MAP[key] || key}</Text>
                  <View style={styles.patternBarBg}>
                    <View style={[styles.patternBarFill, { width: `${(val / maxPattern) * 100}%`, backgroundColor: COLORS.red[400] }]} />
                  </View>
                  <Text style={styles.patternVal}>{val}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* ── 7-Day Streak ── */}
          <View style={styles.bentoCard}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="fire" size={18} color={COLORS.amber[400]} />
              <Text style={[styles.sectionLabel, { marginLeft: 8 }]}>7-Day Streak</Text>
            </View>
            <View style={styles.streakRow}>
              {streak.map((d, i) => {
                const bg = d.status === 'taken' ? COLORS.green[400] : d.status === 'partial' ? COLORS.amber[400] : COLORS.surfaceHigh;
                const label = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(d.date).getDay()];
                return (
                  <View key={i} style={styles.streakCol}>
                    <View style={[styles.streakDot, { backgroundColor: bg }]}>
                      {d.status === 'taken' && <MaterialCommunityIcons name="check" size={14} color="#fff" />}
                      {d.status === 'partial' && <MaterialCommunityIcons name="minus" size={14} color="#fff" />}
                      {d.status !== 'taken' && d.status !== 'partial' && <MaterialCommunityIcons name="close" size={14} color={COLORS.onSurface} />}
                    </View>
                    <Text style={styles.streakLabel}>{label}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* ── Doctor Callout ── */}
          <View style={styles.doctorCallout}>
            <View style={styles.doctorBgCircle} />
            <MaterialCommunityIcons name="stethoscope" size={24} color={COLORS.secondary} />
            <Text style={styles.doctorTitle}>{language === 'sw' ? 'Ungana na daktari' : 'Share with your doctor'}</Text>
            <Text style={styles.doctorSub}>{language === 'sw' ? 'Pakua ripoti ya PDF na umshirikishe daktari wako kwa ajili ya mapitio bora ya afya yako.' : 'Download the PDF report and share it with your doctor for better health reviews.'}</Text>
            <TouchableOpacity style={styles.doctorBtn} onPress={generatePDF} activeOpacity={0.7}>
              <MaterialCommunityIcons name="download" size={18} color="#fff" />
              <Text style={styles.doctorBtnText}>{language === 'sw' ? 'Pakua ripoti' : 'Download report'}</Text>
            </TouchableOpacity>
          </View>

          {/* ── Report History ── */}
          <View style={styles.bentoCard}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="history" size={18} color={COLORS.outline} />
              <Text style={[styles.sectionLabel, { marginLeft: 8 }]}>Report History</Text>
            </View>
            {[
              { title: 'June 2024', date: 'Jun 30, 2024', rate: '82%' },
              { title: 'Weekly Summary', date: 'Jun 23, 2024', rate: '78%' },
              { title: 'Q1 2024 Review', date: 'Mar 31, 2024', rate: '85%' },
            ].map((rpt, i) => (
              <TouchableOpacity key={i} style={styles.historyRow} activeOpacity={0.7}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyTitle}>{rpt.title}</Text>
                  <Text style={styles.historyDate}>{rpt.date}</Text>
                </View>
                <Text style={[styles.historyRate, { color: parseInt(rpt.rate) >= 80 ? COLORS.green[400] : COLORS.amber[400] }]}>{rpt.rate}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Help Banner ── */}
          <TouchableOpacity style={styles.helpBanner} activeOpacity={0.7}>
            <MaterialCommunityIcons name="lifebuoy" size={24} color="#fff" />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={styles.helpTitle}>{language === 'sw' ? 'Unahitaji msaada?' : 'Need help?'}</Text>
              <Text style={styles.helpSub}>{language === 'sw' ? 'Wasiliana na mtaalamu wa afya sasa.' : 'Contact a health professional now.'}</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>

          <View style={{ height: 100 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen:         { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: COLORS.background,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 2,
    zIndex: 10,
  },
  headerLeft:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle:    { fontSize: 20, fontFamily: FONT.headline, color: COLORS.onSurface, letterSpacing: -0.5 },
  headerRight:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn:        { width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.surfaceLow, alignItems: 'center', justifyContent: 'center' },
  langText:       { fontSize: 11, fontFamily: FONT.bodyBold, color: COLORS.onSurface },

  scrollContent:  { padding: 16, flexGrow: 1 },

  sectionLabel:   { fontSize: 11, fontFamily: FONT.bodySemiBold, color: COLORS.onSurfaceVariant, letterSpacing: 0.5, textTransform: 'uppercase' },
  sectionLabelSub:{ fontSize: 10, fontFamily: FONT.body, color: COLORS.outline, marginTop: 1 },

  /* ── Hero Report ── */
  heroReport: {
    backgroundColor: COLORS.surfaceLowest, borderRadius: RADIUS.xl, padding: 20,
    marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  heroReportTop:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  trendChip:      { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 4 },
  trendText:      { fontSize: 11, fontFamily: FONT.bodySemiBold },
  heroRate:       { fontSize: 56, fontFamily: FONT.headline, letterSpacing: -2, lineHeight: 62, marginVertical: 8 },
  heroStats:      { flexDirection: 'row', gap: 24, marginTop: 12 },

  progBg:         { backgroundColor: COLORS.surfaceHigh, borderRadius: 4, overflow: 'hidden' },
  progFill:       { borderRadius: 4 },

  statRowItem:    { flexDirection: 'row', alignItems: 'center' },
  statRowVal:     { fontSize: 18, fontFamily: FONT.bold, color: COLORS.onSurface },
  statRowLabel:   { fontSize: 11, fontFamily: FONT.body, color: COLORS.outline },

  /* ── Action Row ── */
  actionRow:      { flexDirection: 'row', gap: 8, marginBottom: 12 },
  exportBtn:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.primary, borderRadius: RADIUS.xl, paddingHorizontal: 16, paddingVertical: 12, flex: 1 },
  exportBtnText:  { fontSize: 13, fontFamily: FONT.bodySemiBold, color: '#fff' },
  shareWhatsApp:  { width: 44, height: 44, borderRadius: 14, backgroundColor: '#25D366', alignItems: 'center', justifyContent: 'center' },
  shareEmail:     { width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.blue[50], alignItems: 'center', justifyContent: 'center' },
  shareMore:      { width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.surfaceLow, alignItems: 'center', justifyContent: 'center' },

  /* ── Bento Card ── */
  bentoCard: {
    backgroundColor: COLORS.surfaceLowest, borderRadius: RADIUS.xl, padding: 18,
    marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  cardHeader:     { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },

  /* ── Trend ── */
  trendRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  trendDir:       { fontSize: 16, fontFamily: FONT.bodySemiBold, color: COLORS.onSurface, textTransform: 'capitalize' },
  weekChart:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 100 },
  weekBarCol:     { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  weekBar:        { width: '60%', minHeight: 4 },
  weekBarVal:     { fontSize: 9, fontFamily: FONT.body, color: COLORS.outline },
  weekBarLabel:   { fontSize: 9, fontFamily: FONT.body, color: COLORS.outline, marginTop: 4 },

  /* ── Per Medication ── */
  perMedRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  perMedName:     { width: 100, fontSize: 12, fontFamily: FONT.body, color: COLORS.onSurface },
  perMedRight:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  perMedRate:     { fontSize: 12, fontFamily: FONT.bodySemiBold, width: 36, textAlign: 'right' },

  /* ── Patterns ── */
  patternChart:   { gap: 8 },
  patternRow:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  patternLabel:   { width: 70, fontSize: 12, fontFamily: FONT.body, color: COLORS.onSurfaceVariant },
  patternBarBg:   { flex: 1, height: 10, backgroundColor: COLORS.surfaceHigh, borderRadius: 5 },
  patternBarFill: { height: 10, borderRadius: 5 },
  patternVal:     { width: 28, fontSize: 12, fontFamily: FONT.bodySemiBold, color: COLORS.red[400], textAlign: 'right' },

  /* ── Streak ── */
  streakRow:      { flexDirection: 'row', justifyContent: 'space-between' },
  streakCol:      { alignItems: 'center', gap: 6 },
  streakDot:      { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  streakLabel:    { fontSize: 10, fontFamily: FONT.body, color: COLORS.outline },

  /* ── Doctor Callout ── */
  doctorCallout: {
    backgroundColor: COLORS.secondaryContainer + '20', borderRadius: RADIUS.xl, padding: 20,
    marginBottom: 12, overflow: 'hidden', position: 'relative',
  },
  doctorBgCircle: {
    position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: 60,
    backgroundColor: COLORS.secondary + '10',
  },
  doctorTitle:    { fontSize: 15, fontFamily: FONT.bold, color: COLORS.onSecondaryFixedVariant, marginTop: 8 },
  doctorSub:      { fontSize: 12, fontFamily: FONT.body, color: COLORS.onSecondaryFixedVariant, lineHeight: 18, marginTop: 4, opacity: 0.8 },
  doctorBtn:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.secondary, borderRadius: RADIUS.xl, paddingHorizontal: 16, paddingVertical: 10, alignSelf: 'flex-start', marginTop: 12 },

  doctorBtnText:  { fontSize: 13, fontFamily: FONT.bodySemiBold, color: '#fff' },

  /* ── History ── */
  historyRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: COLORS.surfaceHigh },
  historyTitle:   { fontSize: 13, fontFamily: FONT.bodyMedium, color: COLORS.onSurface },
  historyDate:    { fontSize: 11, fontFamily: FONT.body, color: COLORS.outline, marginTop: 1 },
  historyRate:    { fontSize: 16, fontFamily: FONT.bold },

  /* ── Help ── */
  helpBanner:     { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.error, borderRadius: RADIUS.xl, padding: 16, marginTop: 4 },
  helpTitle:      { fontSize: 15, fontFamily: FONT.bold, color: '#fff' },
  helpSub:        { fontSize: 11, fontFamily: FONT.body, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
});
