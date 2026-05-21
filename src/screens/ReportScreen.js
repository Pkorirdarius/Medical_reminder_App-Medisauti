import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Animated,
  Linking,
} from 'react-native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { calcAdherence, getDailyStreak, getPrescriptions } from '../utils/storage';

// ─── Design Tokens (matching HTML mockup palette) ─────────────────────
const C = {
  primary:       '#00513f',
  primaryLight:  '#006b54',
  primaryFixed:  '#9ef3d6',
  primaryBg:     '#e8f5f1',
  secondary:     '#27609d',
  secondaryBg:   'rgba(39,96,157,0.08)',
  tertiary:      '#705d00',
  tertiaryBg:    'rgba(112,93,0,0.08)',
  surface:       '#f9faf5',
  surfaceCard:   '#ffffff',
  surfaceHigh:   '#e8e8e4',
  surfaceLow:    '#f3f4f0',
  onSurface:     '#1a1c1a',
  onSurfaceVar:  '#3e4944',
  outline:       '#6f7a74',
  outlineVar:    '#bec9c3',
  error:         '#ba1a1a',
  green:         '#22c55e',
};

// ─── Build HTML Report ────────────────────────────────────────────────
function buildReportHTML({ user, prescriptions, adherence, streak, generatedAt }) {
  const rows = prescriptions.map(p => `
    <tr>
      <td>${p.drugName}</td><td>${p.dosage}</td>
      <td>${p.frequency}</td><td>${(p.times || []).join(', ')}</td>
    </tr>`).join('');

  const streakRows = streak.map(s => `
    <tr>
      <td>${s.date}</td>
      <td style="color:${s.status === 'taken' ? '#00513f' : s.status === 'missed' ? '#ba1a1a' : '#705d00'}">
        ${s.status === 'taken' ? '✓ Taken' : s.status === 'missed' ? '✗ Missed' : s.status === 'partial' ? '~ Partial' : '—'}
      </td>
      <td>${s.taken}</td><td>${s.missed}</td>
    </tr>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <style>
    body { font-family: Arial, sans-serif; font-size:12px; color:#1a1c1a; padding:24px; background:#f9faf5; }
    h1 { color:#00513f; font-size:22px; margin-bottom:4px; }
    h2 { color:#00513f; font-size:14px; margin:20px 0 8px; border-bottom:1px solid #9ef3d6; padding-bottom:4px; }
    .meta { font-size:11px; color:#3e4944; margin-bottom:20px; }
    .stat-box { display:inline-block; background:#e8f5f1; border-radius:12px; padding:12px 20px; margin:4px; text-align:center; }
    .stat-val { font-size:26px; font-weight:700; color:#00513f; }
    .stat-lbl { font-size:10px; color:#3e4944; margin-top:2px; }
    table { width:100%; border-collapse:collapse; margin-top:8px; }
    th { background:#00513f; color:#fff; padding:8px; text-align:left; font-size:11px; }
    td { padding:6px 8px; border-bottom:0.5px solid #e0e0e0; font-size:11px; }
    tr:nth-child(even) { background:#f3f4f0; }
    .footer { margin-top:30px; font-size:10px; color:#6f7a74; text-align:center; border-top:1px solid #bec9c3; padding-top:12px; }
  </style></head><body>
  <h1>MEDISAUTI — Ripoti ya Matumizi ya Dawa</h1>
  <p class="meta">Mgonjwa: <strong>${user?.name || 'Unknown'}</strong> &nbsp;|&nbsp;
  Hali: <strong>${user?.condition || '—'}</strong> &nbsp;|&nbsp;
  Tarehe: <strong>${generatedAt}</strong></p>
  <h2>Muhtasari wa Uzingativu (Siku 30)</h2>
  <div>
    <div class="stat-box"><div class="stat-val">${adherence.rate}%</div><div class="stat-lbl">Adherence</div></div>
    <div class="stat-box"><div class="stat-val">${adherence.taken}</div><div class="stat-lbl">Zilizochukuliwa</div></div>
    <div class="stat-box" style="background:#fce8e8;"><div class="stat-val" style="color:#ba1a1a;">${adherence.missed}</div><div class="stat-lbl">Zilizokosekana</div></div>
  </div>
  <h2>Dawa za Sasa</h2>
  <table><tr><th>Dawa</th><th>Kipimo</th><th>Mzunguko</th><th>Nyakati</th></tr>
  ${rows || '<tr><td colspan="4">Hakuna dawa zilizorekodiwa</td></tr>'}</table>
  <h2>Kipindi cha Wiki 7</h2>
  <table><tr><th>Tarehe</th><th>Hali</th><th>Zilizochukuliwa</th><th>Zilizokosekana</th></tr>${streakRows}</table>
  <div class="footer">MEDISAUTI v1.0 — Kabarak University, Computer Science &amp; IT<br/>
  Ripoti hii ni ya kumbukumbu ya kliniki tu. Wasiliana na daktari wako.</div>
  </body></html>`;
}

// ─── History Item Component ───────────────────────────────────────────
function HistoryItem({ title, subtitle, onView, alternate }) {
  const [hovered, setHovered] = useState(false);
  return (
    <TouchableOpacity
      onPressIn={() => setHovered(true)}
      onPressOut={() => setHovered(false)}
      onPress={onView}
      activeOpacity={0.85}
      style={[styles.historyItem, alternate && styles.historyItemAlt, hovered && styles.historyItemHover]}
    >
      <View style={styles.historyIcon}>
        <Text style={styles.historyIconText}>📄</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.historyTitle}>{title}</Text>
        <Text style={styles.historySub}>{subtitle}</Text>
      </View>
      <View style={[styles.historyViewBtn, hovered && styles.historyViewBtnVisible]}>
        <Text style={styles.historyViewIcon}>👁</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Share Button Component ───────────────────────────────────────────
function ShareButton({ icon, onPress }) {
  return (
    <TouchableOpacity style={styles.shareBtn} onPress={onPress} activeOpacity={0.7}>
      <Text style={{ fontSize: 22 }}>{icon}</Text>
    </TouchableOpacity>
  );
}

// ─── Main Report Screen ───────────────────────────────────────────────
export default function ReportScreen() {
  const insets = useSafeAreaInsets();

  const [adherence, setAdherence]     = useState({ rate: 0, taken: 0, missed: 0, total: 0 });
  const [streak, setStreak]           = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [language, setLanguage]       = useState('sw');
  const [exporting, setExporting]     = useState(false);
  const [lastReportUri, setLastReportUri] = useState(null);

  // Pulse animation for live dot
  const pulse = React.useRef(new Animated.Value(1)).current;
  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.4, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,   duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);

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

  // ─── Generate and share HTML report ────────────────────────────────
  async function generateReport() {
    const user = null;
    const html = buildReportHTML({
      user, prescriptions, adherence, streak,
      generatedAt: new Date().toLocaleDateString('en-KE', {
        day: '2-digit', month: 'long', year: 'numeric',
      }),
    });
    const fileUri = FileSystem.documentDirectory + 'MEDISAUTI_Report.html';
    await FileSystem.writeAsStringAsync(fileUri, html, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    setLastReportUri(fileUri);
    return fileUri;
  }

  async function handleExportPDF() {
    setExporting(true);
    try {
      const fileUri = await generateReport();
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/html',
          dialogTitle: language === 'sw' ? 'Shiriki Ripoti' : 'Share Report',
        });
      } else {
        Alert.alert(
          language === 'sw' ? 'Ripoti Imehifadhiwa' : 'Report Saved',
          language === 'sw' ? `Faili: ${fileUri}` : `Saved to: ${fileUri}`
        );
      }
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setExporting(false);
    }
  }

  async function handleShareWhatsApp() {
    try {
      const fileUri = await generateReport();
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: 'text/html' });
      }
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  }

  async function handleShareEmail() {
    const subject = encodeURIComponent('MEDISAUTI — Ripoti ya Dawa');
    const body = encodeURIComponent(
      `Habari Daktari,\n\nHii ni ripoti yangu ya matumizi ya dawa kutoka MEDISAUTI.\nKiwango cha uzingativu: ${adherence.rate}%\nDawa zilizochukuliwa: ${adherence.taken}\nDawa zilizokosekana: ${adherence.missed}\n\nMeshukuru.`
    );
    Linking.openURL(`mailto:?subject=${subject}&body=${body}`);
  }

  async function handleShareSMS() {
    const msg = encodeURIComponent(
      `MEDISAUTI Ripoti: Uzingativu ${adherence.rate}% | Zilizochukuliwa: ${adherence.taken} | Zilizokosekana: ${adherence.missed}`
    );
    Linking.openURL(`sms:?body=${msg}`);
  }

  const adherenceColor =
    adherence.rate >= 80 ? C.primary :
    adherence.rate >= 50 ? C.tertiary : C.error;

  const now = new Date();
  const updateTime = now.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });

  // ── Past reports (static demo list, in production pull from storage) ─
  const pastReports = [
    { title: language === 'sw' ? 'Ripoti ya Mwezi Juni' : 'June Monthly Report',          sub: language === 'sw' ? 'Imetolewa: 30 Juni 2024 · PDF (1.2 MB)' : 'Generated: 30 Jun 2024 · PDF (1.2 MB)' },
    { title: language === 'sw' ? 'Muhtasari wa Wiki (Mei 21–28)' : 'Weekly Summary (May 21–28)', sub: language === 'sw' ? 'Imetolewa: 28 Mei 2024 · PDF (890 KB)' : 'Generated: 28 May 2024 · PDF (890 KB)' },
    { title: language === 'sw' ? 'Ripoti ya Robo ya Kwanza' : 'Q1 Report',                sub: language === 'sw' ? 'Imetolewa: 31 Machi 2024 · PDF (2.5 MB)' : 'Generated: 31 Mar 2024 · PDF (2.5 MB)' },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── Top App Bar ─────────────────────────────────────────────── */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.menuBtn}>
          <Text style={styles.menuIcon}>☰</Text>
        </TouchableOpacity>
        <Text style={styles.appTitle}>MediSauti</Text>
        <View style={styles.langToggle}>
          <Text style={[styles.langOption, { color: C.primary, fontWeight: '700' }]}>
            {language === 'sw' ? 'SW' : 'EN'}
          </Text>
          <TouchableOpacity onPress={() => setLanguage(l => l === 'sw' ? 'en' : 'sw')}>
            <View style={styles.langTrack}>
              <View style={[styles.langThumb, language === 'en' && { marginLeft: 10 }]} />
            </View>
          </TouchableOpacity>
          <Text style={[styles.langOption, { color: C.outline }]}>
            {language === 'sw' ? 'EN' : 'SW'}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 90 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ──────────────────────────────────────────────────── */}
        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>
            {language === 'sw' ? 'Ripoti Yako.' : 'Your Report.'}
          </Text>
          <Text style={styles.heroSub}>
            {language === 'sw'
              ? 'Hali yako ya matumizi ya dawa kwa mwezi huu.'
              : 'Your medication adherence status this month.'}
          </Text>
        </View>

        {/* ── Bento Grid Row ─────────────────────────────────────────── */}
        <View style={styles.bentoRow}>
          {/* Main Report Preview Card */}
          <View style={styles.mainCard}>
            <View style={styles.mainCardDecor} />
            <View style={styles.mainCardHeader}>
              <View>
                <Text style={styles.mainCardEyebrow}>
                  {language === 'sw' ? 'Muhtasari wa PDF' : 'PDF Summary'}
                </Text>
                <Text style={styles.mainCardTitle}>
                  {language === 'sw' ? 'Maendeleo ya Tiba' : 'Treatment Progress'}
                </Text>
              </View>
              <Text style={{ fontSize: 32, opacity: 0.35 }}>📋</Text>
            </View>

            {/* Adherence bar */}
            <View style={styles.adherenceBox}>
              <View style={styles.adherenceRow}>
                <Text style={styles.adherenceLabel}>
                  {language === 'sw' ? 'Kiwango cha Adherence' : 'Adherence Rate'}
                </Text>
                <Text style={[styles.adherenceRate, { color: adherenceColor }]}>
                  {adherence.rate}%
                </Text>
              </View>
              <View style={styles.progressBg}>
                <View style={[styles.progressFill, {
                  width: `${adherence.rate}%`,
                  backgroundColor: adherenceColor,
                }]} />
              </View>
            </View>

            {/* Stat mini-cards */}
            <View style={styles.miniStatRow}>
              <View style={styles.miniStatBlue}>
                <Text style={styles.miniStatLabel}>
                  {language === 'sw' ? 'Dawa Zilizochelewa' : 'Delayed'}
                </Text>
                <Text style={[styles.miniStatVal, { color: C.secondary }]}>
                  {String(adherence.missed).padStart(2, '0')}
                </Text>
              </View>
              <View style={styles.miniStatAmber}>
                <Text style={styles.miniStatLabel}>
                  {language === 'sw' ? 'Zilizokosekana' : 'Missed'}
                </Text>
                <Text style={[styles.miniStatVal, { color: C.tertiary }]}>
                  {adherence.total > 0
                    ? String(Math.max(0, adherence.total - adherence.taken - adherence.missed)).padStart(2, '0')
                    : '00'}
                </Text>
              </View>
            </View>

            {/* Live update indicator */}
            <View style={styles.liveRow}>
              <Animated.View style={[styles.liveDot, { transform: [{ scale: pulse }] }]} />
              <Text style={styles.liveText}>
                {language === 'sw'
                  ? `Ripoti imesasishwa leo, ${updateTime}`
                  : `Report updated today, ${updateTime}`}
              </Text>
            </View>
          </View>

          {/* Side actions column */}
          <View style={styles.sideCol}>
            {/* Export button */}
            <TouchableOpacity
              style={styles.exportBtn}
              onPress={handleExportPDF}
              disabled={exporting}
              activeOpacity={0.85}
            >
              {exporting ? (
                <ActivityIndicator color="#fff" size="large" />
              ) : (
                <>
                  <Text style={styles.exportIcon}>⬇</Text>
                  <Text style={styles.exportLabel}>Export PDF</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Share options */}
            <View style={styles.shareCard}>
              <Text style={styles.shareCardTitle}>
                {language === 'sw' ? 'Shiriki na Daktari' : 'Share with Doctor'}
              </Text>
              <View style={styles.shareBtnsRow}>
                <ShareButton icon="💬" onPress={handleShareWhatsApp} />
                <ShareButton icon="✉️" onPress={handleShareEmail}   />
                <ShareButton icon="💬" onPress={handleShareSMS}     />
              </View>
            </View>
          </View>
        </View>

        {/* ── 7-Day Streak ─────────────────────────────────────────── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionCardTitle}>
            {language === 'sw' ? 'Wiki Hii' : 'This Week'}
          </Text>
          <View style={styles.streakRow}>
            {streak.map((s, i) => {
              const configs = {
                taken:   { bg: C.primary, text: '#fff',      label: '✓' },
                missed:  { bg: '#fce8e8', text: C.error,     label: '✗' },
                partial: { bg: '#faf4dc', text: C.tertiary,  label: '~' },
                none:    { bg: C.surfaceLow, text: C.outline, label: '·' },
              };
              const cfg = configs[s.status] || configs.none;
              const d = new Date(s.date + 'T12:00:00');
              return (
                <View key={i} style={[styles.dayChip, { backgroundColor: cfg.bg }]}>
                  <Text style={[styles.dayChipDow, { color: cfg.text }]}>
                    {d.toLocaleDateString('en', { weekday: 'short' }).slice(0, 2)}
                  </Text>
                  <Text style={[styles.dayChipNum, { color: cfg.text }]}>{d.getDate()}</Text>
                  <Text style={[styles.dayChipStatus, { color: cfg.text }]}>{cfg.label}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* ── Report History ───────────────────────────────────────── */}
        <View style={styles.historySection}>
          <View style={styles.historySectionHeader}>
            <Text style={styles.historySectionTitle}>
              {language === 'sw' ? 'Historia ya Ripoti' : 'Report History'}
            </Text>
            <TouchableOpacity>
              <Text style={styles.seeAllBtn}>
                {language === 'sw' ? 'Ona Zote →' : 'See All →'}
              </Text>
            </TouchableOpacity>
          </View>
          {pastReports.map((r, i) => (
            <HistoryItem
              key={i}
              title={r.title}
              subtitle={r.sub}
              alternate={i % 2 === 0}
              onView={() => Alert.alert(
                language === 'sw' ? 'Angalia Ripoti' : 'View Report',
                r.title
              )}
            />
          ))}
        </View>

        {/* ── Help Banner ──────────────────────────────────────────── */}
        <View style={styles.helpBanner}>
          <View style={styles.helpBannerGlow1} />
          <View style={styles.helpBannerGlow2} />
          <Text style={styles.helpBannerTitle}>
            {language === 'sw'
              ? 'Je, unahitaji msaada kuelewa ripoti?'
              : 'Need help understanding your report?'}
          </Text>
          <Text style={styles.helpBannerSub}>
            {language === 'sw'
              ? 'Wasiliana na timu yetu ya matibabu au piga simu kwa dharura yoyote ya kiafya.'
              : 'Contact our medical team or call for any health emergency.'}
          </Text>
          <TouchableOpacity style={styles.helpBannerBtn}>
            <Text style={styles.helpBannerBtnText}>
              {language === 'sw' ? 'Pata Msaada Sasa' : 'Get Help Now'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: C.surface },

  // Top bar
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: C.surface,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06, shadowRadius: 16, elevation: 4,
  },
  menuBtn:      { padding: 8, borderRadius: 40 },
  menuIcon:     { fontSize: 20, color: C.primary },
  appTitle:     { fontFamily: 'System', fontWeight: '900', fontSize: 22, color: C.primary, letterSpacing: -0.5 },
  langToggle:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  langOption:   { fontSize: 11, fontWeight: '600' },
  langTrack:    {
    width: 24, height: 14, backgroundColor: `${C.primary}30`,
    borderRadius: 7, justifyContent: 'center', paddingHorizontal: 2,
  },
  langThumb:    { width: 10, height: 10, borderRadius: 5, backgroundColor: C.primary },

  // Scroll
  scroll:       { flex: 1 },
  scrollContent:{ paddingHorizontal: 16, paddingTop: 8 },

  // Hero
  heroSection:  { marginVertical: 16 },
  heroTitle:    { fontSize: 42, fontWeight: '900', color: C.primary, lineHeight: 46, letterSpacing: -1.5 },
  heroSub:      { fontSize: 15, color: C.onSurfaceVar, fontWeight: '500', marginTop: 4 },

  // Bento row
  bentoRow:     { flexDirection: 'row', gap: 12, marginBottom: 16 },

  // Main card
  mainCard: {
    flex: 1.6, backgroundColor: C.surfaceCard, borderRadius: 24,
    padding: 18, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  mainCardDecor: {
    position: 'absolute', top: -24, right: -24,
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: `${C.primary}08`,
  },
  mainCardHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  mainCardEyebrow:  { fontSize: 10, fontWeight: '700', color: C.primary, letterSpacing: 1.5, textTransform: 'uppercase' },
  mainCardTitle:    { fontSize: 16, fontWeight: '700', color: C.onSurface, marginTop: 2 },

  adherenceBox:     { backgroundColor: C.surfaceLow, borderRadius: 16, padding: 14, marginBottom: 10 },
  adherenceRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  adherenceLabel:   { fontSize: 12, fontWeight: '600', color: C.onSurface },
  adherenceRate:    { fontSize: 22, fontWeight: '900' },
  progressBg:       { height: 8, backgroundColor: C.surfaceHigh, borderRadius: 4, overflow: 'hidden' },
  progressFill:     { height: 8, borderRadius: 4 },

  miniStatRow:      { flexDirection: 'row', gap: 8 },
  miniStatBlue:     { flex: 1, backgroundColor: C.secondaryBg, borderRadius: 14, padding: 12 },
  miniStatAmber:    { flex: 1, backgroundColor: C.tertiaryBg, borderRadius: 14, padding: 12 },
  miniStatLabel:    { fontSize: 10, fontWeight: '700', color: C.onSurfaceVar, marginBottom: 4 },
  miniStatVal:      { fontSize: 24, fontWeight: '900' },

  liveRow:          { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  liveDot:          { width: 7, height: 7, borderRadius: 4, backgroundColor: C.green },
  liveText:         { fontSize: 11, color: C.onSurfaceVar, fontStyle: 'italic' },

  // Side column
  sideCol:          { flex: 1, gap: 12 },
  exportBtn: {
    flex: 1, backgroundColor: C.primary, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12,
    shadowColor: C.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  exportIcon:       { fontSize: 28, color: '#fff' },
  exportLabel:      { fontSize: 13, fontWeight: '700', color: '#fff', textAlign: 'center' },

  shareCard: {
    backgroundColor: C.surfaceHigh, borderRadius: 24, padding: 14,
  },
  shareCardTitle:   { fontSize: 10, fontWeight: '700', color: C.onSurfaceVar, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  shareBtnsRow:     { flexDirection: 'row', gap: 6, justifyContent: 'space-between' },
  shareBtn: {
    flex: 1, backgroundColor: '#fff', borderRadius: 14, paddingVertical: 10,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },

  // Streak
  sectionCard: {
    backgroundColor: C.surfaceCard, borderRadius: 24, padding: 16, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  sectionCardTitle: { fontSize: 12, fontWeight: '700', color: C.onSurfaceVar, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  streakRow:        { flexDirection: 'row', gap: 5, justifyContent: 'space-between' },
  dayChip:          { flex: 1, borderRadius: 10, paddingVertical: 8, alignItems: 'center', gap: 2 },
  dayChipDow:       { fontSize: 9, fontWeight: '500' },
  dayChipNum:       { fontSize: 13, fontWeight: '700' },
  dayChipStatus:    { fontSize: 10 },

  // History
  historySection:   { marginBottom: 16 },
  historySectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 },
  historySectionTitle:  { fontSize: 22, fontWeight: '700', color: C.onSurface },
  seeAllBtn:        { fontSize: 12, fontWeight: '700', color: C.primary },
  historyItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 16, backgroundColor: C.surfaceLow,
    borderRadius: 24, marginBottom: 8,
  },
  historyItemAlt:   { backgroundColor: C.surface },
  historyItemHover: { backgroundColor: C.surfaceHigh },
  historyIcon: {
    width: 46, height: 46, backgroundColor: '#fff', borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  historyIconText:  { fontSize: 20 },
  historyTitle:     { fontSize: 14, fontWeight: '600', color: C.onSurface },
  historySub:       { fontSize: 12, color: C.onSurfaceVar, marginTop: 2 },
  historyViewBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: `${C.primary}15`, alignItems: 'center', justifyContent: 'center',
    opacity: 0,
  },
  historyViewBtnVisible: { opacity: 1 },
  historyViewIcon:  { fontSize: 16 },

  // Help banner
  helpBanner: {
    backgroundColor: `${C.primary}12`, borderRadius: 40,
    padding: 28, marginBottom: 20, overflow: 'hidden', alignItems: 'center',
  },
  helpBannerGlow1: {
    position: 'absolute', bottom: -20, left: -20,
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: `${C.primary}15`,
  },
  helpBannerGlow2: {
    position: 'absolute', top: -20, right: -20,
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: `${C.secondary}10`,
  },
  helpBannerTitle:  { fontSize: 18, fontWeight: '700', color: C.primary, textAlign: 'center', marginBottom: 8 },
  helpBannerSub:    { fontSize: 13, color: C.onSurfaceVar, textAlign: 'center', lineHeight: 20, marginBottom: 16, maxWidth: 280 },
  helpBannerBtn: {
    backgroundColor: C.primary, paddingHorizontal: 28, paddingVertical: 14,
    borderRadius: 16,
  },
  helpBannerBtnText:{ color: '#fff', fontWeight: '700', fontSize: 14 },
});
