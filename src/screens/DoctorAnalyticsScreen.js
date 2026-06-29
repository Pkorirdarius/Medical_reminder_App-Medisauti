import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { RADIUS, FONT } from '../utils/constants';
import {
  getPrescriptions, calcAdherence, getDailyStreak, getPerMedicationAdherence,
  getCurrentStreak, getAdherenceTrend,
} from '../utils/storage';
import { useLanguage } from '../utils/LanguageContext';
import { useTheme } from '../utils/ThemeContext';

const CONDITION_KEYWORDS = [
  { key: 'diabetes', icons: ['metformin', 'insulin', 'glibenclamide', 'gliclazide'], labelKey: 'condition_diabetes' },
  { key: 'bp', icons: ['amlodipine', 'enalapril', 'losartan', 'hydrochlorothiazide', 'nifedipine'],
    labelKey: 'condition_bp' },
  { key: 'hiv', icons: ['tenofovir', 'lamivudine', 'dolutegravir', 'tld', 'efavirenz', 'nevirapine'],
    labelKey: 'condition_hiv' },
];

function inferCondition(drugName) {
  const name = (drugName || '').toLowerCase();
  for (const group of CONDITION_KEYWORDS) {
    if (group.icons.some(icon => name.includes(icon))) return group.key;
  }
  return 'other';
}

const CONDITION_ICONS_MAP = {
  diabetes: 'water',
  bp: 'heart-pulse',
  hiv: 'shield-check',
  other: 'medical-bag',
};

const TREND_ICONS = {
  improving: 'trending-up',
  worsening: 'trending-down',
  stable: 'trending-neutral',
  insufficient: 'help-circle-outline',
};

function StatCard({ icon, value, label, color }) {
  const { COLORS } = useTheme();
  return (
    <View style={[statStyles.card, { backgroundColor: COLORS.surfaceLowest }]}>
      <View style={[statStyles.iconWrap, { backgroundColor: (color || COLORS.primary) + '18' }]}>
        <MaterialCommunityIcons name={icon} size={22} color={color || COLORS.primary} />
      </View>
      <Text style={[statStyles.value, { color: COLORS.onSurface }]}>{value}</Text>
      <Text style={[statStyles.label, { color: COLORS.outline }]}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: { flex: 1, borderRadius: RADIUS.lg, padding: 14, alignItems: 'center', gap: 6 },
  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  value: { fontSize: 22, fontFamily: FONT.headline },
  label: { fontSize: 10, fontFamily: FONT.body, textTransform: 'uppercase', letterSpacing: 0.3, textAlign: 'center' },
});

export default function DoctorAnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { t } = useLanguage();
  const { COLORS } = useTheme();
  const styles = useMemo(() => getStyles(COLORS), [COLORS]);

  const [loading, setLoading] = useState(true);
  const [prescriptions, setPrescriptions] = useState([]);
  const [adherence, setAdherence] = useState({ rate: 0, taken: 0, missed: 0, total: 0 });
  const [streakDays, setStreakDays] = useState([]);
  const [perMed, setPerMed] = useState([]);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [trend, setTrend] = useState({ direction: 'insufficient', weeklyRates: [] });

  useFocusEffect(useCallback(() => { loadData(); }, []));

  async function loadData() {
    try {
      const [rx, adh, stk, meds, streak, tr] = await Promise.all([
        getPrescriptions(),
        calcAdherence(30),
        getDailyStreak(7),
        getPerMedicationAdherence(30),
        getCurrentStreak(),
        getAdherenceTrend(30),
      ]);
      setPrescriptions(rx);
      setAdherence(adh);
      setStreakDays(stk);
      setPerMed(meds);
      setCurrentStreak(streak);
      setTrend(tr);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  const activeRx = prescriptions.filter(r => r.active !== false).length;

  const conditionGroups = useMemo(() => {
    const groups = { diabetes: [], bp: [], hiv: [], other: [] };
    for (const rx of prescriptions) {
      const cond = inferCondition(rx.drugName);
      groups[cond].push(rx);
    }
    return groups;
  }, [prescriptions]);

  const conditionAdherence = useMemo(() => {
    const result = {};
    for (const [cond, rxs] of Object.entries(conditionGroups)) {
      const ids = new Set(rxs.map(r => r.id));
      const meds = perMed.filter(m => ids.has(m.prescriptionId));
      const total = meds.reduce((s, m) => s + m.total, 0);
      const taken = meds.reduce((s, m) => s + m.taken, 0);
      result[cond] = {
        count: rxs.length,
        rate: total > 0 ? Math.round((taken / total) * 100) : 0,
        total,
        taken,
      };
    }
    return result;
  }, [conditionGroups, perMed]);

  const trendColor = trend.direction === 'improving' ? COLORS.goal[500]
    : trend.direction === 'worsening' ? COLORS.error
    : COLORS.outline;

  if (loading) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="chart-bar" size={26} color={COLORS.primary} />
        <Text style={styles.headerTitle}>{t('header_analytics')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Stats Row */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <StatCard icon="prescription" value={prescriptions.length} label={t('analytics_total_rx')} color={COLORS.primary} />
          <StatCard icon="pill" value={activeRx} label={t('analytics_active_rx')} color={COLORS.goal[500]} />
          <StatCard icon="check-circle-outline" value={`${adherence.rate}%`} label={t('analytics_avg_adherence')}
            color={adherence.rate >= 70 ? COLORS.goal[500] : adherence.rate >= 40 ? COLORS.warning : COLORS.error} />
        </View>

        {/* Current Streak + Trend */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={[styles.halfCard, { backgroundColor: COLORS.surfaceLowest }]}>
            <View style={[styles.halfCardIcon, { backgroundColor: COLORS.amber[50] }]}>
              <MaterialCommunityIcons name="fire" size={22} color={COLORS.amber[400]} />
            </View>
            <Text style={[styles.halfCardValue, { color: COLORS.onSurface }]}>{currentStreak}</Text>
            <Text style={[styles.halfCardLabel, { color: COLORS.outline }]}>{t('analytics_current_streak')}</Text>
          </View>
          <View style={[styles.halfCard, { backgroundColor: COLORS.surfaceLowest }]}>
            <View style={[styles.halfCardIcon, { backgroundColor: (trendColor) + '18' }]}>
              <MaterialCommunityIcons name={TREND_ICONS[trend.direction]} size={22} color={trendColor} />
            </View>
            <Text style={[styles.halfCardValue, { color: trendColor }]}>{t(`trend_${trend.direction}`)}</Text>
            <Text style={[styles.halfCardLabel, { color: COLORS.outline }]}>{t('analytics_trend')}</Text>
            {trend.weeklyRates.length > 0 && (
              <View style={{ flexDirection: 'row', gap: 3, marginTop: 6 }}>
                {trend.weeklyRates.map((r, i) => (
                  <View key={i} style={{
                    width: 20, height: 20, borderRadius: 4,
                    backgroundColor: r >= 70 ? COLORS.goal[500] : r >= 40 ? COLORS.warning : COLORS.error,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{ fontSize: 8, fontFamily: FONT.bodyBold, color: '#fff' }}>{r}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Condition-Based Groups */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('analytics_by_condition')}</Text>
          {(['diabetes', 'bp', 'hiv', 'other']).map(cond => {
            const data = conditionAdherence[cond];
            if (!data || data.count === 0) return null;
            const condLabelMap = { diabetes: 'condition_diabetes', bp: 'condition_bp', hiv: 'condition_hiv', other: 'condition_other' };
            const labelKey = condLabelMap[cond];
            const condColorMap = { diabetes: COLORS.teal[400], bp: COLORS.blue[400], hiv: COLORS.amber[400], other: COLORS.gray[600] };
            const color = condColorMap[cond];
            return (
              <View key={cond} style={styles.condRow}>
                <View style={[styles.condIcon, { backgroundColor: color + '18' }]}>
                  <MaterialCommunityIcons name={CONDITION_ICONS_MAP[cond] || 'medical-bag'} size={16} color={color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.condName}>{t(labelKey)}</Text>
                  <Text style={styles.condCount}>{data.count} {t('medication_analytics').toLowerCase()}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={[styles.condRate, { color: data.rate >= 70 ? COLORS.goal[500] : COLORS.warning }]}>{data.rate}%</Text>
                  <View style={{ width: 60, height: 4, borderRadius: 2, backgroundColor: COLORS.surfaceHigh, overflow: 'hidden' }}>
                    <View style={{ width: `${data.rate}%`, height: 4, borderRadius: 2, backgroundColor: data.rate >= 70 ? COLORS.goal[500] : COLORS.warning }} />
                  </View>
                </View>
              </View>
            );
          })}
          {conditionGroups.diabetes.length === 0 && conditionGroups.bp.length === 0 &&
           conditionGroups.hiv.length === 0 && conditionGroups.other.length === 0 && (
            <Text style={styles.emptySub}>{t('analytics_no_data')}</Text>
          )}
        </View>

        {/* Per-Medication Analytics */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('analytics_per_medication')}</Text>
          {perMed.length === 0 ? (
            <Text style={styles.emptySub}>{t('analytics_no_data')}</Text>
          ) : (
            perMed.map((m, i) => {
              const mColor = m.rate >= 70 ? COLORS.goal[500] : m.rate >= 40 ? COLORS.warning : COLORS.error;
              return (
                <View key={m.prescriptionId || i} style={styles.medRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.medName}>{m.drugName} {m.dosage}</Text>
                    <Text style={styles.medDetail}>{m.taken}/{m.total} {t('doses_taken').toLowerCase()}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text style={[styles.medRate, { color: mColor }]}>{m.rate}%</Text>
                    <View style={{ width: 60, height: 4, borderRadius: 2, backgroundColor: COLORS.surfaceHigh, overflow: 'hidden' }}>
                      <View style={{ width: `${m.rate}%`, height: 4, borderRadius: 2, backgroundColor: mColor }} />
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Weekly Streak Preview */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('patient_streak')}</Text>
          <View style={styles.streakRow}>
            {streakDays.map((day, i) => (
              <View key={i} style={{ alignItems: 'center', gap: 4 }}>
                <View style={[styles.streakDot, {
                  backgroundColor:
                    day.status === 'taken' ? COLORS.goal[500] :
                    day.status === 'partial' ? COLORS.warning :
                    day.status === 'missed' ? COLORS.error :
                    COLORS.surfaceHigh,
                }]} />
                <Text style={{ fontSize: 10, fontFamily: FONT.body, color: COLORS.outline }}>
                  {['S','M','T','W','T','F','S'][new Date(day.date).getDay()]}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function getStyles(C) {
  return StyleSheet.create({
    screen:               { flex: 1, backgroundColor: C.background },
    header: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingHorizontal: 16, paddingVertical: 14,
      backgroundColor: C.background,
      shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 2,
      zIndex: 10,
    },
    headerTitle:          { fontSize: 20, fontFamily: FONT.headline, color: C.onSurface, letterSpacing: -0.5, flex: 1 },

    scrollContent:        { padding: 16, paddingBottom: 100, gap: 16 },

    /* Half cards */
    halfCard: {
      flex: 1, borderRadius: RADIUS.lg, padding: 16, alignItems: 'center', gap: 6,
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
    },
    halfCardIcon:         { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    halfCardValue:        { fontSize: 20, fontFamily: FONT.headline },
    halfCardLabel:        { fontSize: 9, fontFamily: FONT.body, textTransform: 'uppercase', letterSpacing: 0.3, textAlign: 'center' },

    /* Card */
    card:                 { backgroundColor: C.surfaceLowest, borderRadius: RADIUS.xl, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
    cardTitle:            { fontSize: 15, fontFamily: FONT.bodySemiBold, color: C.onSurface, marginBottom: 12 },

    /* Condition rows */
    condRow:              { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: C.surfaceHigh },
    condIcon:             { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    condName:             { fontSize: 14, fontFamily: FONT.bodySemiBold, color: C.onSurface },
    condCount:            { fontSize: 11, fontFamily: FONT.body, color: C.outline },
    condRate:             { fontSize: 16, fontFamily: FONT.bold },

    /* Medication rows */
    medRow:               { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: C.surfaceHigh },
    medName:              { fontSize: 13, fontFamily: FONT.bodySemiBold, color: C.onSurface },
    medDetail:            { fontSize: 11, fontFamily: FONT.body, color: C.outline },
    medRate:              { fontSize: 16, fontFamily: FONT.bold },

    /* Streak */
    streakRow:            { flexDirection: 'row', justifyContent: 'space-between' },
    streakDot:            { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },

    emptySub:             { fontSize: 12, fontFamily: FONT.body, color: C.outline, textAlign: 'center', paddingVertical: 20 },
  });
}
