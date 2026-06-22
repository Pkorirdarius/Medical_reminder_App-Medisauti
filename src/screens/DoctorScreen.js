import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { COLORS, RADIUS, FONT } from '../utils/constants';
import { getUser, getPrescriptions, savePrescription, calcAdherence, getDailyStreak } from '../utils/storage';
import { useLanguage } from '../utils/LanguageContext';

const CONDITION_ICONS = {
  Kisukari: 'water',
  'Shinikizo la damu': 'heart-pulse',
  VVU: 'shield-check',
  Diabetes: 'water',
  'Blood Pressure': 'heart-pulse',
  HIV: 'shield-check',
};

export default function DoctorScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { t } = useLanguage();

  const [patient, setPatient] = useState(null);
  const [prescriptions, setPrescriptions] = useState([]);
  const [adherence, setAdherence] = useState({ rate: 0, taken: 0, missed: 0 });
  const [streak, setStreak] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDoctor, setIsDoctor] = useState(false);

  useFocusEffect(useCallback(() => { loadData(); }, []));

  async function loadData() {
    try {
      const u = await getUser();
      if (!u || u.role !== 'doctor') {
        setIsDoctor(false);
        setLoading(false);
        return;
      }
      setIsDoctor(true);
      const [meds, adh, stk] = await Promise.all([
        getPrescriptions(), calcAdherence(30), getDailyStreak(7),
      ]);
      setPatient(u);
      setPrescriptions(meds);
      setAdherence(adh);
      setStreak(stk);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function issueDefaultPrescription() {
    if (!patient) return;
    const condition = (patient.condition || '').toLowerCase();
    let rxList = [];

    if (condition.includes('kisukari') || condition.includes('diabetes')) {
      rxList = [
        { drugName: 'Metformin', dosage: '500mg', frequency: t('freq_twice'), times: ['08:00', '20:00'], notes: 'Pamoja na chakula', source: 'doctor', voiceNotif: true },
      ];
    } else if (condition.includes('shinikizo') || condition.includes('blood pressure') || condition.includes('bp')) {
      rxList = [
        { drugName: 'Amlodipine', dosage: '5mg', frequency: t('freq_once'), times: ['08:00'], notes: 'Asubuhi baada ya kiamsha kinywa', source: 'doctor', voiceNotif: true },
      ];
    } else if (condition.includes('hiv') || condition.includes('vvu')) {
      rxList = [
        { drugName: 'TLD (Tenofovir/Lamivudine/Dolutegravir)', dosage: '300/300/50mg', frequency: t('freq_once'), times: ['20:00'], notes: 'Usiku kabla ya kulala', source: 'doctor', voiceNotif: true },
      ];
    }

    if (rxList.length === 0) {
      Alert.alert(t('doctor_dashboard'), t('no_condition_match'));
      return;
    }

    try {
      for (const rx of rxList) {
        await savePrescription({
          id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
          ...rx,
          createdAt: new Date().toISOString(),
          active: true,
          notifIds: [],
        });
      }
      await loadData();
      Alert.alert('✅ ' + t('auto_added_title'), t('rx_issued'));
    } catch (e) { Alert.alert(t('error'), e.message); }
  }

  function getStreakBadge(streakCount) {
    if (streakCount >= 7) return { color: COLORS.goal[500], label: t('trend_great') };
    if (streakCount >= 3) return { color: COLORS.warning, label: t('trend_fair') };
    return { color: COLORS.error, label: t('trend_low') };
  }

  const streakCount = streak.filter(s => s.status === 'taken').length;
  const badge = getStreakBadge(streakCount);

  if (loading) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!isDoctor) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <MaterialCommunityIcons name="stethoscope" size={26} color={COLORS.primary} />
          <Text style={styles.headerTitle}>{t('header_doctor')}</Text>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
          <MaterialCommunityIcons name="account-lock" size={56} color={COLORS.outline} />
          <Text style={{ fontSize: 16, fontFamily: FONT.bodySemiBold, color: COLORS.onSurface, marginTop: 16, textAlign: 'center' }}>
            {t('doctor_dashboard')}
          </Text>
          <Text style={{ fontSize: 13, fontFamily: FONT.body, color: COLORS.outline, marginTop: 8, textAlign: 'center', lineHeight: 20 }}>
            {t('login_as')}: {t('role_doctor')}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="stethoscope" size={26} color={COLORS.primary} />
        <Text style={styles.headerTitle}>{t('header_doctor')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Patient Summary Card */}
        {patient && (
          <View style={styles.patientCard}>
            <View style={styles.patientRow}>
              <View style={styles.patientAvatar}>
                <Text style={styles.patientAvatarText}>{(patient.name || 'P').slice(0, 2).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.patientName}>{patient.name}</Text>
                <View style={styles.patientMeta}>
                  <MaterialCommunityIcons name="calendar" size={13} color={COLORS.outline} />
                  <Text style={styles.patientMetaText}>{patient.age || '--'} yrs</Text>
                </View>
                {patient.condition && (
                  <View style={styles.conditionBadge}>
                    <MaterialCommunityIcons name={CONDITION_ICONS[patient.condition] || 'medical-bag'} size={13} color={COLORS.blue[800]} />
                    <Text style={styles.conditionText}>{patient.condition}</Text>
                  </View>
                )}
              </View>
              <View style={styles.adherenceBig}>
                <Text style={styles.adherenceBigValue}>{adherence.rate}%</Text>
                <Text style={styles.adherenceBigLabel}>{t('patient_adherence')}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Weekly Streak */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('patient_streak')}</Text>
          <View style={styles.streakRow}>
            {streak.map((day, i) => (
              <View key={i} style={styles.streakItem}>
                <View style={[styles.streakDot, {
                  backgroundColor:
                    day.status === 'taken' ? COLORS.goal[500] :
                    day.status === 'partial' ? COLORS.warning :
                    day.status === 'missed' ? COLORS.error :
                    COLORS.surfaceHigh,
                }]} />
                <Text style={styles.streakDateText}>{['J','M','T','A','I','J','J'][new Date(day.date).getDay()]}</Text>
              </View>
            ))}
          </View>
          <View style={styles.streakStatRow}>
            <MaterialCommunityIcons name="fire" size={18} color={badge.color} />
            <Text style={[styles.streakStatText, { color: badge.color }]}>{streakCount}/7 — {badge.label}</Text>
          </View>
        </View>

        {/* Active Prescriptions */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('all_medications')} ({prescriptions.length})</Text>
          {prescriptions.length === 0 ? (
            <Text style={styles.emptySub}>{t('no_meds_added')}</Text>
          ) : (
            prescriptions.map((rx, i) => (
              <View key={rx.id || i} style={styles.rxItem}>
                <MaterialCommunityIcons name="pill" size={16} color={COLORS.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rxName}>{rx.drugName} {rx.dosage}</Text>
                  <Text style={styles.rxDetail}>{rx.frequency} · {rx.times.join(', ')}</Text>
                </View>
                <View style={[styles.rxSourceBadge, { backgroundColor: rx.source === 'doctor' ? COLORS.blue[50] : COLORS.surfaceLow }]}>
                  <MaterialCommunityIcons name={rx.source === 'doctor' ? 'stethoscope' : 'pencil'} size={11} color={rx.source === 'doctor' ? COLORS.blue[800] : COLORS.outline} />
                  <Text style={[styles.rxSourceText, { color: rx.source === 'doctor' ? COLORS.blue[800] : COLORS.outline }]}>{rx.source === 'doctor' ? t('source_doctor') : t('source_manual')}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Issue Prescription Button */}
        <TouchableOpacity style={styles.issueBtn} onPress={issueDefaultPrescription} activeOpacity={0.7}>
          <MaterialCommunityIcons name="prescription" size={22} color="#fff" />
          <Text style={styles.issueBtnText}>{t('btn_issue_prescription')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:               { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: COLORS.background,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 2,
    zIndex: 10,
  },
  headerTitle:          { fontSize: 20, fontFamily: FONT.headline, color: COLORS.onSurface, letterSpacing: -0.5, flex: 1 },

  scrollContent:        { padding: 16, paddingBottom: 100, gap: 16 },

  /* Patient Card */
  patientCard:          { backgroundColor: COLORS.surfaceLowest, borderRadius: RADIUS.xl, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  patientRow:           { flexDirection: 'row', alignItems: 'center', gap: 12 },
  patientAvatar:        { width: 48, height: 48, borderRadius: 14, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  patientAvatarText:    { fontSize: 18, fontFamily: FONT.bodyBold, color: '#fff' },
  patientName:          { fontSize: 17, fontFamily: FONT.bodySemiBold, color: COLORS.onSurface },
  patientMeta:          { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  patientMetaText:      { fontSize: 12, fontFamily: FONT.body, color: COLORS.outline },
  conditionBadge:       { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.blue[50], borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start', marginTop: 4 },
  conditionText:        { fontSize: 10, fontFamily: FONT.bodySemiBold, color: COLORS.blue[800] },

  adherenceBig:         { alignItems: 'center', paddingLeft: 12, borderLeftWidth: 1, borderLeftColor: COLORS.surfaceHigh },
  adherenceBigValue:    { fontSize: 24, fontFamily: FONT.headline, color: COLORS.primary },
  adherenceBigLabel:    { fontSize: 9, fontFamily: FONT.body, color: COLORS.outline, textTransform: 'uppercase', letterSpacing: 0.3 },

  /* Card */
  card:                 { backgroundColor: COLORS.surfaceLowest, borderRadius: RADIUS.xl, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  cardTitle:            { fontSize: 15, fontFamily: FONT.bodySemiBold, color: COLORS.onSurface, marginBottom: 12 },

  /* Streak */
  streakRow:            { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  streakItem:           { alignItems: 'center', gap: 4 },
  streakDot:            { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  streakDateText:       { fontSize: 10, fontFamily: FONT.body, color: COLORS.outline },
  streakStatRow:        { flexDirection: 'row', alignItems: 'center', gap: 6 },
  streakStatText:       { fontSize: 13, fontFamily: FONT.bodySemiBold },

  /* Prescriptions List */
  rxItem:               { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: COLORS.surfaceHigh },
  rxName:               { fontSize: 13, fontFamily: FONT.bodySemiBold, color: COLORS.onSurface },
  rxDetail:             { fontSize: 11, fontFamily: FONT.body, color: COLORS.outline },
  rxSourceBadge:        { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: RADIUS.pill, paddingHorizontal: 7, paddingVertical: 2 },
  rxSourceText:         { fontSize: 9, fontFamily: FONT.bodySemiBold },

  emptySub:             { fontSize: 12, fontFamily: FONT.body, color: COLORS.outline, textAlign: 'center', paddingVertical: 20 },

  /* Issue Button */
  issueBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: RADIUS.xl, paddingVertical: 14,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  issueBtnText:         { fontSize: 15, fontFamily: FONT.bodySemiBold, color: '#fff' },
});
