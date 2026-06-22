import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Animated, RefreshControl, Dimensions, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { COLORS, RADIUS, SHADOW, FONT } from '../utils/constants';
import { getUser, getPrescriptions, calcAdherence, getDoctors, getMyDoctor, setMyDoctor } from '../utils/storage';
import { useHighContrast } from '../utils/HighContrastContext';
import { useLanguage } from '../utils/LanguageContext';
import { speakReminder, formatTime12, getTimeLabel } from '../utils/reminders';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_GAP = 12;
const SIDE_PAD = 16;

function StatCard({ icon, iconColor, value, label, bg }) {
  return (
    <View style={[styles.statCard, { backgroundColor: bg || COLORS.surfaceLowest }]}>
      <View style={[styles.statIconWrap, { backgroundColor: iconColor + '18' }]}>
        <MaterialCommunityIcons name={icon} size={22} color={iconColor} />
      </View>
      <Text style={[styles.statVal, { color: iconColor }]}>{value}</Text>
      <Text style={styles.statLbl}>{label}</Text>
    </View>
  );
}

function Badge({ label, type }) {
  const map = {
    teal:  { bg: COLORS.primaryFixed + '40', text: COLORS.primary },
    amber: { bg: COLORS.amber[50], text: COLORS.amber[400] },
    green: { bg: COLORS.green[50], text: COLORS.green[400] },
    blue:  { bg: COLORS.blue[50],  text: COLORS.blue[800] },
  };
  const c = map[type] || map.teal;
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.badgeText, { color: c.text }]}>{label}</Text>
    </View>
  );
}

function MedItem({ med }) {
  return (
    <View style={styles.medRow}>
      <View style={[styles.medDot, { backgroundColor: COLORS.onPrimaryContainer + '30' }]}>
        <MaterialCommunityIcons name="pill" size={18} color={COLORS.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.medName}>{med.drugName} {med.dosage}</Text>
        <Text style={styles.medSub}>
          {med.frequency} · {med.times.map(t => formatTime12(t)).join(', ')}
        </Text>
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { highContrast, toggleHighContrast } = useHighContrast();
  const { language, toggleLanguage, t } = useLanguage();
  const scrollRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const [user, setUser]           = useState({ name: 'Darius' });
  const [prescriptions, setP]    = useState([]);
  const [adherence, setAdh]      = useState({ rate: 0, taken: 0, missed: 0 });
  const [nextReminder, setNext]  = useState(null);
  const [speaking, setSpeaking]  = useState(false);
  const [loading, setLoading]    = useState(true);
  const [refreshing, setRef]     = useState(false);
  const [myDoctor, setMyDoc]     = useState(null);
  const [doctorsList, setDoctors] = useState([]);

  useFocusEffect(useCallback(() => { loadData(); }, []));
  useFocusEffect(useCallback(() => {
    if (scrollRef.current) setTimeout(() => scrollRef.current?.scrollTo?.({ y: 0, animated: true }), 100);
  }, []));

  React.useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  async function loadData() {
    try {
      const [u, meds, adh, docs, myDoc] = await Promise.all([getUser(), getPrescriptions(), calcAdherence(30), getDoctors(), getMyDoctor()]);
      if (u) setUser(u);
      setP(meds);
      setAdh(adh);
      setDoctors(docs);
      setMyDoc(myDoc);
      setNext(findNextReminder(meds));
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRef(false); }
  }

  function onRefresh() { setRef(true); loadData(); }

  function findNextReminder(meds) {
    if (!meds.length) return null;
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    let nearest = null, nearestDiff = Infinity;
    for (const med of meds) {
      for (const t of med.times || []) {
        const [h, m] = t.split(':').map(Number);
        const medMin = h * 60 + m;
        const diff = medMin > nowMin ? medMin - nowMin : 1440 - nowMin + medMin;
        if (diff < nearestDiff) { nearestDiff = diff; nearest = { ...med, nextTime: t }; }
      }
    }
    return nearest;
  }

  function handleSpeak() {
    if (!nextReminder) return;
    setSpeaking(true);
    speakReminder(nextReminder.drugName, nextReminder.dosage, getTimeLabel(nextReminder.nextTime, 'sw'), 'sw');
    setTimeout(() => setSpeaking(false), 5000);
  }

  function handleSelectDoctor() {
    if (doctorsList.length === 0) {
      Alert.alert(t('select_doctor'), t('no_doctors_available'));
      return;
    }
    if (doctorsList.length <= 2) {
      const buttons = doctorsList.map(d => ({
        text: `${d.name} — ${d.specialization || t('role_doctor')}`,
        onPress: () => { setMyDoc(d); setMyDoctor(d); },
      }));
      buttons.push({ text: t('cancel'), style: 'cancel' });
      Alert.alert(t('select_doctor'), '', buttons);
    } else {
      const names = doctorsList.map((d, i) => `${i + 1}. ${d.name} (${d.specialization || t('role_doctor')})`).join('\n');
      Alert.alert(t('select_doctor'), names + '\n\n' + t('change_doctor'), [
        { text: doctorsList[0].name, onPress: () => { setMyDoc(doctorsList[0]); setMyDoctor(doctorsList[0]); } },
        { text: doctorsList[1].name, onPress: () => { setMyDoc(doctorsList[1]); setMyDoctor(doctorsList[1]); } },
        { text: t('cancel'), style: 'cancel' },
      ]);
    }
  }

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return t('greeting_morning');
    if (h < 17) return t('greeting_afternoon');
    if (h < 21) return t('greeting_evening');
    return t('greeting_night');
  };

  const rate = adherence.rate;
  const rateColor = rate >= 80 ? COLORS.green[400] : rate >= 50 ? COLORS.amber[400] : COLORS.red[400];
  const rateBg   = rate >= 80 ? COLORS.green[50]  : rate >= 50 ? COLORS.amber[50]  : COLORS.red[50];

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialCommunityIcons name="heart-pulse" size={28} color={COLORS.primary} />
          <Text style={{ fontSize: 20, fontFamily: FONT.headline, color: COLORS.primary, letterSpacing: -0.5 }}>MediSauti</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={toggleLanguage} style={styles.iconBtn}>
            <Text style={styles.langText}>{language === 'sw' ? 'SW' : 'EN'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleHighContrast} style={styles.iconBtn}>
            <MaterialCommunityIcons name={highContrast ? 'brightness-6' : 'brightness-6'} size={20} color={COLORS.onSurface} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={styles.avatar}>
            <Text style={styles.avatarText}>{(user.name || 'U').slice(0, 2).toUpperCase()}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} colors={[COLORS.primary]} />}
        keyboardShouldPersistTaps="handled"
      >
        {loading ? (
          <ActivityIndicator style={{ marginTop: 60 }} color={COLORS.primary} />
        ) : (
          <>
            {/* ── Hero ── */}
            <View style={styles.hero}>
              <Text style={styles.greeting}>{greeting()},</Text>
              <Text style={styles.userName}>{user.name} 👋</Text>
            </View>

            {/* ── Adherence Hero Card ── */}
            <View style={[styles.bentoCard, styles.adhHeroCard]}>
              <View style={styles.adhHeroTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionLabel}>{t('heading_adherence')}</Text>
                </View>
                <View style={[styles.trendChip, { backgroundColor: rateBg }]}>
                  <MaterialCommunityIcons
                    name={rate >= 80 ? 'trending-up' : rate >= 50 ? 'minus' : 'trending-down'}
                    size={14} color={rateColor}
                  />
                  <Text style={[styles.trendText, { color: rateColor }]}>
                    {rate >= 80 ? t('trend_great') : rate >= 50 ? t('trend_fair') : t('trend_low')}
                  </Text>
                </View>
              </View>
              <View style={styles.adhHeroMid}>
                <Text style={[styles.adhHeroNum, { color: rateColor }]}>{rate}%</Text>
              </View>
              <View style={styles.progWrap}>
                <View style={[styles.progBg, { backgroundColor: COLORS.surfaceHigh }]}>
                  <View style={[styles.progFill, { width: `${rate}%`, backgroundColor: rateColor }]} />
                </View>
                <View style={styles.progLabels}>
                  <Text style={styles.progLabel}>{adherence.taken} {t('taken_label')}</Text>
                  <Text style={styles.progLabel}>{adherence.missed} {t('missed_label')}</Text>
                </View>
              </View>
            </View>

            {/* ── Stat Row ── */}
            <View style={styles.statRow}>
              <StatCard
                icon="check-circle"
                iconColor={COLORS.green[400]}
                value={adherence.taken}
                label={t('doses_taken_30d')}
                bg={COLORS.green[50]}
              />
              <StatCard
                icon="close-circle"
                iconColor={COLORS.red[400]}
                value={adherence.missed}
                label={t('missed_30d')}
                bg={COLORS.red[50]}
              />
            </View>

            {/* ── Next Reminder ── */}
            {nextReminder && (
              <View style={[styles.bentoCard, styles.nextCard]}>
                <View style={styles.nextHeader}>
                  <MaterialCommunityIcons name="bell-ring" size={16} color={COLORS.primary} />
                  <Text style={[styles.sectionLabel, { marginLeft: 6 }]}>{t('next_reminder')}</Text>
                </View>
                <View style={styles.nextBody}>
                  <View style={styles.timeBubble}>
                    <Text style={styles.timeBig}>{formatTime12(nextReminder.nextTime).split(' ')[0]}</Text>
                    <Text style={styles.timeAmpm}>{formatTime12(nextReminder.nextTime).split(' ')[1]}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.medNameLarge}>{nextReminder.drugName} {nextReminder.dosage}</Text>
                    <Text style={styles.medSub}>
                      {getTimeLabel(nextReminder.nextTime, 'sw')} · {getTimeLabel(nextReminder.nextTime, 'en')}
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.speakBtn} onPress={handleSpeak} activeOpacity={0.7}>
                    <MaterialCommunityIcons name={speaking ? 'volume-high' : 'volume-medium'} size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
                {speaking && (
                  <View style={styles.speakingBar}>
                    <Animated.View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary, opacity: pulseAnim, marginRight: 8 }} />
                    <Text style={styles.speakingText}>{t('speaking_reminder')}</Text>
                  </View>
                )}
              </View>
            )}

            {/* ── Weekly Insight / Doctor Tips ── */}
            <View style={styles.insightRow}>
              <View style={[styles.bentoCard, { flex: 1 }]}>
                <View style={styles.nextHeader}>
                  <MaterialCommunityIcons name="calendar-check" size={16} color={COLORS.secondary} />
                  <Text style={[styles.sectionLabel, { marginLeft: 6 }]}>{t('this_week')}</Text>
                </View>
                <View style={styles.weekRow}>
                  {[t('mon'),t('tue'),t('wed'),t('thu'),t('fri'),t('sat'),t('sun')].map((d, i) => {
                    const dayOk = i < new Date().getDay();
                    return (
                      <View key={d} style={styles.weekCol}>
                        <View style={[
                          styles.weekDot,
                          { backgroundColor: dayOk ? COLORS.green[400] : i === new Date().getDay() - 1 ? COLORS.amber[400] : COLORS.surfaceHigh }
                        ]} />
                        <Text style={styles.weekLabel}>{d.slice(0, 1)}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
              <View style={[styles.bentoCard, styles.doctorCard]}>
                <MaterialCommunityIcons name="lightbulb-outline" size={20} color={COLORS.secondary} />
                <Text style={[styles.sectionLabel, { marginTop: 6 }]}>{t('tip_heading')}</Text>
                <Text style={styles.doctorTip}>{t('tip_text')}</Text>
              </View>
            </View>

            {/* ── My Doctor (patients only) ── */}
            {user.role !== 'doctor' && (
              <TouchableOpacity style={styles.doctorAssignCard} onPress={handleSelectDoctor} activeOpacity={0.7}>
                <View style={styles.doctorAssignLeft}>
                  <View style={styles.doctorAssignIcon}>
                    <MaterialCommunityIcons name={myDoctor ? 'stethoscope' : 'plus'} size={22} color={myDoctor ? COLORS.blue[800] : COLORS.outline} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.doctorAssignLabel}>{t('my_doctor')}</Text>
                    {myDoctor ? (
                      <>
                        <Text style={styles.doctorAssignName}>{myDoctor.name}</Text>
                        <Text style={styles.doctorAssignSpec}>{myDoctor.specialization || t('role_doctor')}</Text>
                      </>
                    ) : (
                      <Text style={styles.doctorAssignEmpty}>{t('no_doctor_assigned')} — {t('select_doctor')}</Text>
                    )}
                  </View>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.outline} />
              </TouchableOpacity>
            )}

            {/* ── Medication List ── */}
            <View style={[styles.bentoCard, { marginBottom: 100 }]}>
              <View style={styles.nextHeader}>
                <MaterialCommunityIcons name="pill" size={16} color={COLORS.primary} />
                <Text style={[styles.sectionLabel, { marginLeft: 6 }]}>{t('all_medications')}</Text>
              </View>
              {prescriptions.length === 0 ? (
                <View style={styles.emptyState}>
                  <MaterialCommunityIcons name="pill" size={40} color={COLORS.outline} />
                  <Text style={styles.emptyText}>{t('no_meds_added')}</Text>
                </View>
              ) : (
                prescriptions.map((med, i) => <MedItem key={med.id || i} med={med} />)
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:         { flex: 1, backgroundColor: COLORS.background },

  /* ── Header ── */
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SIDE_PAD, paddingVertical: 12,
    backgroundColor: COLORS.background,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 2,
    zIndex: 10,
  },
  headerLeft:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoText:       { fontSize: 20, fontFamily: FONT.headline, color: COLORS.primary, letterSpacing: -0.5 },
  headerRight:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn:        { width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.surfaceLow, alignItems: 'center', justifyContent: 'center' },
  langText:       { fontSize: 11, fontFamily: FONT.bodyBold, color: COLORS.onSurface },
  avatar:         { width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText:     { fontSize: 12, fontFamily: FONT.bodyBold, color: '#fff' },

  scrollContent:  { paddingHorizontal: SIDE_PAD, paddingTop: 8, paddingBottom: 30, flexGrow: 1 },

  /* ── Hero ── */
  hero:           { marginBottom: 16 },
  greeting:       { fontSize: 15, fontFamily: FONT.body, color: COLORS.onSurfaceVariant },
  userName:       { fontSize: 26, fontFamily: FONT.headline, color: COLORS.onSurface, letterSpacing: -0.5, marginTop: 0 },

  /* ── Bento Cards ── */
  bentoCard: {
    backgroundColor: COLORS.surfaceLowest, borderRadius: RADIUS.xl,
    padding: 18, marginBottom: CARD_GAP,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },

  /* ── Adherence Hero ── */
  adhHeroCard:    { paddingVertical: 22 },
  adhHeroTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionLabel:   { fontSize: 11, fontFamily: FONT.bodySemiBold, color: COLORS.onSurfaceVariant, letterSpacing: 0.5, textTransform: 'uppercase' },
  sectionLabelSub:{ fontSize: 10, fontFamily: FONT.body, color: COLORS.outline, marginTop: 1 },
  trendChip:      { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 4 },
  trendText:      { fontSize: 11, fontFamily: FONT.bodySemiBold },
  adhHeroMid:     { marginVertical: 4 },
  adhHeroNum:     { fontSize: 56, fontFamily: FONT.headline, letterSpacing: -2, lineHeight: 62 },
  progWrap:       { marginTop: 4 },
  progBg:         { height: 8, borderRadius: 4 },
  progFill:       { height: 8, borderRadius: 4 },
  progLabels:     { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  progLabel:      { fontSize: 11, fontFamily: FONT.body, color: COLORS.outline },

  /* ── Stat Row ── */
  statRow:        { flexDirection: 'row', gap: CARD_GAP, marginBottom: CARD_GAP },
  statCard: {
    flex: 1, borderRadius: RADIUS.xl, padding: 16,
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  statIconWrap:   { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statVal:        { fontSize: 28, fontFamily: FONT.headline, letterSpacing: -1 },
  statLbl:        { fontSize: 11, fontFamily: FONT.body, color: COLORS.onSurfaceVariant, marginTop: 2, textAlign: 'center' },

  /* ── Next Reminder ── */
  nextCard:       { borderLeftWidth: 0 },
  nextHeader:     { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  nextBody:       { flexDirection: 'row', alignItems: 'center', gap: 14 },
  timeBubble: {
    backgroundColor: COLORS.onPrimaryContainer + '25', borderRadius: RADIUS.lg,
    paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center',
  },
  timeBig:        { fontSize: 22, fontFamily: FONT.bold, color: COLORS.primary, letterSpacing: -0.5 },
  timeAmpm:       { fontSize: 10, fontFamily: FONT.bodySemiBold, color: COLORS.primary, opacity: 0.7 },
  medNameLarge:   { fontSize: 16, fontFamily: FONT.bodySemiBold, color: COLORS.onSurface },
  medSub:         { fontSize: 12, fontFamily: FONT.body, color: COLORS.onSurfaceVariant, marginTop: 2 },
  speakBtn: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  speakingBar:    { flexDirection: 'row', alignItems: 'center', marginTop: 12, backgroundColor: COLORS.primaryFixed + '30', borderRadius: RADIUS.md, padding: 10 },
  speakingText:   { fontSize: 12, fontFamily: FONT.body, color: COLORS.primary, flex: 1 },

  /* ── Week / Doctor ── */
  insightRow:     { flexDirection: 'row', gap: CARD_GAP, marginBottom: CARD_GAP },
  weekRow:        { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  weekCol:        { alignItems: 'center', gap: 4 },
  weekDot:        { width: 20, height: 20, borderRadius: 6 },
  weekLabel:      { fontSize: 10, fontFamily: FONT.body, color: COLORS.outline },
  doctorCard: {
    backgroundColor: COLORS.secondaryContainer + '20',
    flex: 0.7, alignItems: 'flex-start',
  },
  doctorTip:      { fontSize: 11, fontFamily: FONT.body, color: COLORS.onSecondaryFixedVariant, lineHeight: 16, marginTop: 4 },

  /* ── Doctor Assign Card ── */
  doctorAssignCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.blue[50], borderRadius: RADIUS.xl, padding: 14, marginBottom: CARD_GAP,
  },
  doctorAssignLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  doctorAssignIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  doctorAssignLabel: { fontSize: 11, fontFamily: FONT.bodySemiBold, color: COLORS.blue[800], textTransform: 'uppercase', letterSpacing: 0.3 },
  doctorAssignName: { fontSize: 15, fontFamily: FONT.bodySemiBold, color: COLORS.onSurface, marginTop: 1 },
  doctorAssignSpec: { fontSize: 11, fontFamily: FONT.body, color: COLORS.blue[800], opacity: 0.7, marginTop: 1 },
  doctorAssignEmpty: { fontSize: 12, fontFamily: FONT.body, color: COLORS.blue[800], opacity: 0.6, marginTop: 2 },

  /* ── Medication List ── */
  medRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: COLORS.surfaceHigh,
  },
  medDot:         { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  medName:        { fontSize: 14, fontFamily: FONT.bodySemiBold, color: COLORS.onSurface },
  medSub:         { fontSize: 11, fontFamily: FONT.body, color: COLORS.onSurfaceVariant, marginTop: 1 },
  badge:          { borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText:      { fontSize: 10, fontFamily: FONT.bodySemiBold },

  /* ── Empty State ── */
  emptyState:     { alignItems: 'center', paddingVertical: 24 },
  emptyText:      { fontSize: 13, fontFamily: FONT.body, color: COLORS.outline, lineHeight: 22, textAlign: 'center', marginTop: 12 },
});
