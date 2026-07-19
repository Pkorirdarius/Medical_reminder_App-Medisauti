import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Share, Alert, Linking,
  Modal, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { RADIUS, FONT } from '../utils/constants';
import { getPrescriptions, calcAdherence, getDailyStreak, getPerMedicationAdherence, getMissedDosePatterns, getAdherenceTrend, getUser, exportDataAsJSON, exportDataAsCSV } from '../utils/storage';
import { useHighContrast } from '../utils/HighContrastContext';
import { useLanguage } from '../utils/LanguageContext';
import { useTheme } from '../utils/ThemeContext';

const PERIOD_MAP = { morning: 'period_morning', afternoon: 'period_afternoon', evening: 'period_evening', night: 'period_night' };

export default function ReportScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { toggleHighContrast } = useHighContrast();
  const { COLORS, isDark, toggleTheme } = useTheme();
  const { language, toggleLanguage, t } = useLanguage();
  const scrollRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
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
      const html = buildReportHtml();
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Share MediSauti Report' });
      } else {
        Alert.alert('PDF Generated', `File saved at: ${uri}`);
      }
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setExporting(false); }
  }

  function buildReportHtml() {
    let medRows = '';
    for (const p of prescriptions) {
      const dosageDetail = p.dosageQuantity
        ? `${p.dosageQuantity} ${t('form_' + (p.dosageForm || 'tablet'))} · ${p.dosage}`
        : p.dosage;
      medRows += `<tr><td>${p.drugName} ${p.dosage}</td><td>${dosageDetail}</td><td>${p.frequency}</td><td>${(p.times || []).join(', ')}</td></tr>`;
    }
    let streakRows = '';
    for (const d of streak) {
      streakRows += `<td style="text-align:center;padding:8px;border:1px solid #ddd;background:${d.status === 'taken' ? '#4CAF50' : d.status === 'partial' ? '#FFC107' : '#F44336'};color:#fff;border-radius:6px">${new Date(d.date).getDate()}</td>`;
    }

    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>MediSauti Report</title>
<style>body{font-family:sans-serif;padding:24px;color:#1a1c1a}h1{color:#00513f;font-size:24px}h2{color:#27609d;font-size:18px;margin-top:24px}.rate{font-size:48px;font-weight:800;color:${rateColor}}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{padding:10px;border:1px solid #ddd;text-align:left}th{background:#f3f4f0}.badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600}.badge-green{background:#E8F5E9;color:#2E7D32}.badge-amber{background:#FFF8E1;color:#F57F17}.badge-red{background:#FFEBEE;color:#C62828}.section{margin-bottom:24px}.med-detail{color:#6f7a74;font-size:13px}</style></head><body>
<h1>MediSauti — ${t('header_report')}</h1>
<p><strong>${t('preview_patient')}:</strong> ${user.name || '—'} | <strong>${t('preview_period')}:</strong> ${t('preview_last_30days')}</p>
<h2>${t('preview_adherence')}: <span class="rate">${rate}%</span></h2>
<p>${t('preview_taken')}: ${adherence.taken} | ${t('preview_missed')}: ${adherence.missed}</p>
<h2>${t('preview_trend')}: ${trend.direction}</h2>
<p>Weekly: ${trend.weeklyRates.join('%, ')}%</p>
<h2>${t('preview_per_med')}</h2>
<table><tr><th>${t('label_drug_name')}</th><th>${t('adherence_rate')}</th></tr>${perMed.map(p => `<tr><td>${p.drugName} ${p.dosage}</td><td>${p.rate}%</td></tr>`).join('')}</table>
<h2>${t('preview_medications')}</h2>
<table><tr><th>${t('label_drug_name')}</th><th>${t('label_dosage')}</th><th>${t('label_frequency')}</th><th>${t('label_times')}</th></tr>${medRows}</table>
<h2>${t('preview_streak')}</h2>
<table><tr>${streakRows}</tr></table>
<p style="margin-top:32px;color:#6f7a74;font-size:12px">${t('preview_generated')}</p>
</body></html>`;
  }

  function handlePreview() {
    const html = buildReportHtml();
    setPreviewHtml(html);
    setShowPreview(true);
  }

  async function shareReport(platform) {
    const msg = `${t('share_message')}: ${rate}%`;
    if (platform === 'whatsapp') {
      Linking.openURL(`https://wa.me/?text=${encodeURIComponent(msg)}`);
    } else if (platform === 'email') {
      Linking.openURL(`mailto:?subject=MediSauti%20Report&body=${encodeURIComponent(msg)}`);
    } else {
      Share.share({ message: msg });
    }
  }

  async function exportJSON() {
    try {
      const data = await exportDataAsJSON();
      const { uri } = await Print.printToFileAsync({ html: `<pre>${data}</pre>` });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'Export MediSauti Data' });
      }
    } catch (e) { Alert.alert('Error', e.message); }
  }

  async function exportCSV() {
    try {
      const csv = await exportDataAsCSV();
      const { uri } = await Print.printToFileAsync({ html: `<pre>${csv}</pre>` });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: 'Export MediSauti Data' });
      }
    } catch (e) { Alert.alert('Error', e.message); }
  }

  const maxPattern = Math.max(1, ...Object.values(patterns));

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

  const styles = useMemo(() => getStyles(COLORS), [COLORS]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialCommunityIcons name="chart-box-outline" size={28} color={COLORS.primary} />
          <Text style={styles.headerTitle}>{t('header_report')}</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={toggleLanguage} style={styles.iconBtn}>
            <Text style={styles.langText}>{language === 'sw' ? 'SW' : 'EN'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleTheme} style={styles.iconBtn}>
            <MaterialCommunityIcons name={isDark ? 'weather-sunny' : 'weather-night'} size={20} color={COLORS.onSurface} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={styles.avatar}>
            <Text style={styles.avatarText}>{(user.name || 'U').slice(0, 2).toUpperCase()}</Text>
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
                <Text style={styles.sectionLabel}>{t('monthly_adherence')}</Text>
              </View>
              <View style={[styles.trendChip, { backgroundColor: rateColor + '20' }]}>
                <MaterialCommunityIcons name={rate >= 80 ? 'trending-up' : rate >= 50 ? 'minus' : 'trending-down'} size={14} color={rateColor} />
                <Text style={[styles.trendText, { color: rateColor }]}>{rate >= 80 ? t('trend_great') : rate >= 50 ? t('trend_fair') : t('trend_low')}</Text>
              </View>
            </View>
            <Text style={[styles.heroRate, { color: rateColor }]}>{rate}%</Text>
            <ProgressBar value={rate} color={rateColor} height={10} />
            <View style={styles.heroStats}>
              <StatRow icon="check-circle" iconColor={COLORS.green[400]} value={adherence.taken} label={t('status_taken')} />
              <StatRow icon="close-circle" iconColor={COLORS.red[400]} value={adherence.missed} label={t('status_missed')} />
            </View>
          </View>

          {/* ── Export & Share ── */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.previewBtn} onPress={handlePreview} activeOpacity={0.7}>
              <MaterialCommunityIcons name="eye-outline" size={20} color="#fff" />
              <Text style={styles.previewBtnText}>{t('preview_report')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.exportBtn} onPress={generatePDF} disabled={exporting} activeOpacity={0.7}>
              {exporting ? <ActivityIndicator size="small" color="#fff" /> : <MaterialCommunityIcons name="file-pdf-box" size={20} color="#fff" />}
              <Text style={styles.exportBtnText}>{exporting ? t('generating') : t('export_pdf')}</Text>
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

          {/* Data Export Row */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.previewBtn} onPress={exportJSON} activeOpacity={0.7}>
              <MaterialCommunityIcons name="code-json" size={20} color="#fff" />
              <Text style={styles.previewBtnText}>JSON</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.exportBtn, { backgroundColor: COLORS.secondary }]} onPress={exportCSV} activeOpacity={0.7}>
              <MaterialCommunityIcons name="file-delimited" size={20} color="#fff" />
              <Text style={styles.exportBtnText}>CSV</Text>
            </TouchableOpacity>
          </View>

          {/* ── Weekly Trend ── */}
          <View style={styles.bentoCard}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="chart-timeline-variant" size={18} color={COLORS.secondary} />
              <Text style={[styles.sectionLabel, { marginLeft: 8 }]}>{t('heading_weekly_trend')}</Text>
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
                <Text style={[styles.sectionLabel, { marginLeft: 8 }]}>{t('heading_per_med')}</Text>
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
              <Text style={[styles.sectionLabel, { marginLeft: 8 }]}>{t('heading_missed_patterns')}</Text>
            </View>
            <View style={styles.patternChart}>
              {Object.entries(patterns).map(([key, val]) => (
                <View key={key} style={styles.patternRow}>
                  <Text style={styles.patternLabel}>{t(PERIOD_MAP[key]) || key}</Text>
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
              <Text style={[styles.sectionLabel, { marginLeft: 8 }]}>{t('heading_streak_7day')}</Text>
            </View>
            <View style={styles.streakRow}>
              {streak.map((d, i) => {
                const bg = d.status === 'taken' ? COLORS.green[400] : d.status === 'partial' ? COLORS.amber[400] : COLORS.surfaceHigh;
                const label = [t('sun'), t('mon'), t('tue'), t('wed'), t('thu'), t('fri'), t('sat')][new Date(d.date).getDay()];
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
            <Text style={styles.doctorTitle}>{t('heading_share_doctor')}</Text>
            <Text style={styles.doctorSub}>{t('share_doctor_desc')}</Text>
            <TouchableOpacity style={styles.doctorBtn} onPress={handlePreview} activeOpacity={0.7}>
              <MaterialCommunityIcons name="eye-outline" size={18} color="#fff" />
              <Text style={styles.doctorBtnText}>{t('preview_report')}</Text>
            </TouchableOpacity>
          </View>

          {/* ── Report History ── */}
          <View style={styles.bentoCard}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="history" size={18} color={COLORS.outline} />
              <Text style={[styles.sectionLabel, { marginLeft: 8 }]}>{t('heading_report_history')}</Text>
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
              <Text style={styles.helpTitle}>{t('heading_need_help')}</Text>
              <Text style={styles.helpSub}>{t('contact_professional')}</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>

          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* ── Report Preview Modal ── */}
      <Modal visible={showPreview} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.previewScreen, { paddingTop: insets.top }]}>
          <View style={styles.previewHeader}>
            <TouchableOpacity onPress={() => setShowPreview(false)} style={styles.previewBackBtn}>
              <MaterialCommunityIcons name="close" size={24} color={COLORS.onSurface} />
            </TouchableOpacity>
            <Text style={styles.previewHeaderTitle}>{t('preview_title')}</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Preview Info Bar */}
          <View style={styles.previewInfoBar}>
            <MaterialCommunityIcons name="check-decagram" size={16} color={COLORS.green[400]} />
            <Text style={styles.previewInfoText}>{t('preview_ready_to_share')}</Text>
          </View>

          {/* WebView Preview */}
          <View style={styles.previewWebWrap}>
            <WebView
              source={{ html: previewHtml }}
              style={styles.previewWebView}
              originWhitelist={['*']}
              showsVerticalScrollIndicator
              scalesPageToFit={Platform.OS === 'android'}
            />
          </View>

          {/* Preview Action Buttons */}
          <View style={styles.previewActions}>
            <TouchableOpacity
              style={styles.previewActionPrimary}
              onPress={async () => {
                setShowPreview(false);
                await generatePDF();
              }}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="file-pdf-box" size={20} color="#fff" />
              <Text style={styles.previewActionPrimaryText}>{t('preview_export')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.previewActionSecondary}
              onPress={() => {
                setShowPreview(false);
                shareReport('other');
              }}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="share-variant" size={20} color={COLORS.primary} />
              <Text style={styles.previewActionSecondaryText}>{t('preview_share')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function getStyles(C) {
  return StyleSheet.create({
    screen:         { flex: 1, backgroundColor: C.background },
    header: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 12,
      backgroundColor: C.background,
      shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 2,
      zIndex: 10,
    },
    headerLeft:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
    headerTitle:    { fontSize: 20, fontFamily: FONT.headline, color: C.onSurface, letterSpacing: -0.5 },
    headerRight:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
    iconBtn:        { width: 36, height: 36, borderRadius: 10, backgroundColor: C.surfaceLow, alignItems: 'center', justifyContent: 'center' },
    langText:       { fontSize: 11, fontFamily: FONT.bodyBold, color: C.onSurface },
    avatar:         { width: 36, height: 36, borderRadius: 10, backgroundColor: C.primaryContainer, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.primary + '20' },
    avatarText:     { fontSize: 12, fontFamily: FONT.bodyBold, color: '#fff' },

    scrollContent:  { padding: 16, flexGrow: 1 },

    sectionLabel:   { fontSize: 11, fontFamily: FONT.bodySemiBold, color: C.onSurfaceVariant, letterSpacing: 0.5, textTransform: 'uppercase' },
    sectionLabelSub:{ fontSize: 10, fontFamily: FONT.body, color: C.outline, marginTop: 1 },

    /* ── Hero Report ── */
    heroReport: {
      backgroundColor: C.surfaceLowest, borderRadius: RADIUS.xl, padding: 20,
      marginBottom: 12,
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
    },
    heroReportTop:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    trendChip:      { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 4 },
    trendText:      { fontSize: 11, fontFamily: FONT.bodySemiBold },
    heroRate:       { fontSize: 56, fontFamily: FONT.headline, letterSpacing: -2, lineHeight: 62, marginVertical: 8 },
    heroStats:      { flexDirection: 'row', gap: 24, marginTop: 12 },

    progBg:         { backgroundColor: C.surfaceHigh, borderRadius: 4, overflow: 'hidden' },
    progFill:       { borderRadius: 4 },

    statRowItem:    { flexDirection: 'row', alignItems: 'center' },
    statRowVal:     { fontSize: 18, fontFamily: FONT.bold, color: C.onSurface },
    statRowLabel:   { fontSize: 11, fontFamily: FONT.body, color: C.outline },

    /* ── Action Row ── */
    actionRow:      { flexDirection: 'row', gap: 8, marginBottom: 12 },
    exportBtn:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.primary, borderRadius: RADIUS.xl, paddingHorizontal: 16, paddingVertical: 12, flex: 1 },
    exportBtnText:  { fontSize: 13, fontFamily: FONT.bodySemiBold, color: '#fff' },
    shareWhatsApp:  { width: 44, height: 44, borderRadius: 14, backgroundColor: '#25D366', alignItems: 'center', justifyContent: 'center' },
    shareEmail:     { width: 44, height: 44, borderRadius: 14, backgroundColor: C.blue[50], alignItems: 'center', justifyContent: 'center' },
    shareMore:      { width: 44, height: 44, borderRadius: 14, backgroundColor: C.surfaceLow, alignItems: 'center', justifyContent: 'center' },

    /* ── Bento Card ── */
    bentoCard: {
      backgroundColor: C.surfaceLowest, borderRadius: RADIUS.xl, padding: 18,
      marginBottom: 12,
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
    },
    cardHeader:     { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },

    /* ── Trend ── */
    trendRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
    trendDir:       { fontSize: 16, fontFamily: FONT.bodySemiBold, color: C.onSurface, textTransform: 'capitalize' },
    weekChart:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 100 },
    weekBarCol:     { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
    weekBar:        { width: '60%', minHeight: 4 },
    weekBarVal:     { fontSize: 9, fontFamily: FONT.body, color: C.outline },
    weekBarLabel:   { fontSize: 9, fontFamily: FONT.body, color: C.outline, marginTop: 4 },

    /* ── Per Medication ── */
    perMedRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
    perMedName:     { width: 100, fontSize: 12, fontFamily: FONT.body, color: C.onSurface },
    perMedRight:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
    perMedRate:     { fontSize: 12, fontFamily: FONT.bodySemiBold, width: 36, textAlign: 'right' },

    /* ── Patterns ── */
    patternChart:   { gap: 8 },
    patternRow:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
    patternLabel:   { width: 70, fontSize: 12, fontFamily: FONT.body, color: C.onSurfaceVariant },
    patternBarBg:   { flex: 1, height: 10, backgroundColor: C.surfaceHigh, borderRadius: 5 },
    patternBarFill: { height: 10, borderRadius: 5 },
    patternVal:     { width: 28, fontSize: 12, fontFamily: FONT.bodySemiBold, color: C.red[400], textAlign: 'right' },

    /* ── Streak ── */
    streakRow:      { flexDirection: 'row', justifyContent: 'space-between' },
    streakCol:      { alignItems: 'center', gap: 6 },
    streakDot:      { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    streakLabel:    { fontSize: 10, fontFamily: FONT.body, color: C.outline },

    /* ── Doctor Callout ── */
    doctorCallout: {
      backgroundColor: C.secondaryContainer + '20', borderRadius: RADIUS.xl, padding: 20,
      marginBottom: 12, overflow: 'hidden', position: 'relative',
    },
    doctorBgCircle: {
      position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: 60,
      backgroundColor: C.secondary + '10',
    },
    doctorTitle:    { fontSize: 15, fontFamily: FONT.bold, color: C.onSecondaryFixedVariant, marginTop: 8 },
    doctorSub:      { fontSize: 12, fontFamily: FONT.body, color: C.onSecondaryFixedVariant, lineHeight: 18, marginTop: 4, opacity: 0.8 },
    doctorBtn:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.secondary, borderRadius: RADIUS.xl, paddingHorizontal: 16, paddingVertical: 10, alignSelf: 'flex-start', marginTop: 12 },

    doctorBtnText:  { fontSize: 13, fontFamily: FONT.bodySemiBold, color: '#fff' },

    /* ── History ── */
    historyRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: C.surfaceHigh },
    historyTitle:   { fontSize: 13, fontFamily: FONT.bodyMedium, color: C.onSurface },
    historyDate:    { fontSize: 11, fontFamily: FONT.body, color: C.outline, marginTop: 1 },
    historyRate:    { fontSize: 16, fontFamily: FONT.bold },

    /* ── Help ── */
    helpBanner:     { flexDirection: 'row', alignItems: 'center', backgroundColor: C.error, borderRadius: RADIUS.xl, padding: 16, marginTop: 4 },
    helpTitle:      { fontSize: 15, fontFamily: FONT.bold, color: '#fff' },
    helpSub:        { fontSize: 11, fontFamily: FONT.body, color: 'rgba(255,255,255,0.8)', marginTop: 2 },

    /* ── Preview Button ── */
    previewBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.secondary, borderRadius: RADIUS.xl, paddingHorizontal: 16, paddingVertical: 12 },
    previewBtnText: { fontSize: 13, fontFamily: FONT.bodySemiBold, color: '#fff' },

    /* ── Preview Modal ── */
    previewScreen:  { flex: 1, backgroundColor: C.background },
    previewHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: C.surfaceLowest, borderBottomWidth: 0.5, borderBottomColor: C.surfaceHigh },
    previewBackBtn: { width: 40, height: 40, borderRadius: 100, alignItems: 'center', justifyContent: 'center' },
    previewHeaderTitle: { fontSize: 17, fontFamily: FONT.bold, color: C.onSurface, flex: 1, textAlign: 'center' },
    previewInfoBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: C.green[50] },
    previewInfoText:{ fontSize: 12, fontFamily: FONT.bodySemiBold, color: C.green[400] },
    previewWebWrap: { flex: 1, margin: 12, borderRadius: RADIUS.xl, overflow: 'hidden', backgroundColor: '#fff', borderWidth: 1, borderColor: C.surfaceHigh },
    previewWebView: { flex: 1 },
    previewActions: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingBottom: 20, paddingTop: 8, backgroundColor: C.surfaceLowest, borderTopWidth: 0.5, borderTopColor: C.surfaceHigh },
    previewActionPrimary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.primary, borderRadius: RADIUS.xl, paddingVertical: 14 },
    previewActionPrimaryText: { fontSize: 15, fontFamily: FONT.bodySemiBold, color: '#fff' },
    previewActionSecondary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.surfaceLow, borderRadius: RADIUS.xl, paddingVertical: 14, borderWidth: 1, borderColor: C.primary + '30' },
    previewActionSecondaryText: { fontSize: 15, fontFamily: FONT.bodySemiBold, color: C.primary },
  });
}
