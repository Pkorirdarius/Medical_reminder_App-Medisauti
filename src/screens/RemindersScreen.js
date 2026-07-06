import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { RADIUS, FONT } from '../utils/constants';
import { getPrescriptions, logDose, getUser } from '../utils/storage';
import { useHighContrast } from '../utils/HighContrastContext';
import { useLanguage } from '../utils/LanguageContext';
import { useTheme } from '../utils/ThemeContext';
import { speakReminder, formatTime12, getTimeLabel, requestNotificationPermission } from '../utils/reminders';

function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function buildReminders(meds) {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const list = [];
  for (const med of meds || []) {
    for (const time of med.times || []) {
      const tMin = timeToMinutes(time);
      list.push({
        key: `${med.id}-${time}`,
        prescriptionId: med.id,
        drugName: med.dosage ? `${med.drugName} ${med.dosage}` : med.drugName,
        dosage: med.dosage,
        notes: med.notes,
        time,
        tMin,
        isCurrent: Math.abs(tMin - nowMin) <= 30 && tMin <= nowMin + 30,
        isPast: tMin < nowMin - 30,
      });
    }
  }
  list.sort((a, b) => a.tMin - b.tMin);
  return list;
}

export default function RemindersScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { toggleHighContrast } = useHighContrast();
  const { COLORS, isDark, toggleTheme } = useTheme();
  const { language, toggleLanguage, t } = useLanguage();
  const scrollRef = useRef(null);

  const [user, setUser] = useState({ name: 'User' });
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [doseStatus, setDoseStatus] = useState({});
  const notifPermissionChecked = useRef(false);

  const styles = useMemo(() => getStyles(COLORS), [COLORS]);

  function ReminderCard({ item, doseStatus, onAction, language }) {
    const { t } = useLanguage();
    const status = doseStatus[item.key];
    const isTaken = status === 'taken';
    const isSnoozed = status === 'snoozed';
    const isMissed = status === 'missed';

    return (
      <View style={[
        styles.remCard,
        item.isCurrent && styles.remCardCurrent,
        item.isPast && !status && styles.remCardPast,
        (isTaken || isMissed) && { opacity: 0.55 },
      ]}>
        <TouchableOpacity style={styles.remCardBody} activeOpacity={0.7}>
          <View style={styles.remTimeCol}>
            <Text style={styles.remTime}>{formatTime12(item.time).split(' ')[0]}</Text>
            <Text style={styles.remAmpm}>{formatTime12(item.time).split(' ')[1]}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.remDrug}>{item.drugName}</Text>
            <Text style={styles.remPeriod}>{getTimeLabel(item.time, language)}</Text>
            {item.notes ? <Text style={styles.remNotes}>{item.notes}</Text> : null}
          </View>
        </TouchableOpacity>

        <View style={styles.remActions}>
          {!status ? (
            <>
              <TouchableOpacity style={styles.actionTaken} onPress={() => onAction(item.key, 'taken', item)} activeOpacity={0.7}>
                <MaterialCommunityIcons name="check" size={18} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionSnooze} onPress={() => onAction(item.key, 'snoozed', item)} activeOpacity={0.7}>
                <MaterialCommunityIcons name="clock-outline" size={18} color={COLORS.amber[800]} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionMissed} onPress={() => onAction(item.key, 'missed', item)} activeOpacity={0.7}>
                <MaterialCommunityIcons name="close" size={18} color="#fff" />
              </TouchableOpacity>
            </>
          ) : (
            <View style={[styles.statusChip, {
              backgroundColor: isTaken ? COLORS.green[50] : isSnoozed ? COLORS.amber[50] : COLORS.red[50],
            }]}>
              <MaterialCommunityIcons
                name={isTaken ? 'check-circle' : isSnoozed ? 'clock-outline' : 'close-circle'}
                size={14}
                color={isTaken ? COLORS.green[400] : isSnoozed ? COLORS.amber[400] : COLORS.red[400]}
              />
              <Text style={[styles.statusText, { color: isTaken ? COLORS.green[400] : isSnoozed ? COLORS.amber[400] : COLORS.red[400] }]}>
                {isTaken ? t('status_taken') : isSnoozed ? t('status_snoozed') : t('status_missed')}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  useFocusEffect(useCallback(() => { loadData(); }, []));
  useFocusEffect(useCallback(() => {
    if (scrollRef.current) setTimeout(() => scrollRef.current?.scrollTo?.({ y: 0, animated: true }), 100);
  }, []));

  async function loadData() {
    try {
      const [meds, u] = await Promise.all([getPrescriptions(), getUser()]);
      if (u) setUser(u);
      const list = buildReminders(meds);
      setReminders(list);
      if (!notifPermissionChecked.current) {
        notifPermissionChecked.current = true;
        const granted = await requestNotificationPermission();
        if (!granted) {
          Alert.alert(t('notif_permission_title'), t('notif_permission_denied'), [
            { text: t('ok') },
            { text: t('enable'), onPress: () => requestNotificationPermission() },
          ]);
        }
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }

  function onRefresh() { setRefreshing(true); loadData(); }

  async function handleAction(key, action, item) {
    setDoseStatus(s => ({ ...s, [key]: action }));
    const scheduledTime = new Date();
    const [h, m] = item.time.split(':').map(Number);
    scheduledTime.setHours(h, m, 0, 0);

    await logDose(item.prescriptionId, action, scheduledTime.toISOString());

    if (action === 'taken') {
      const label = getTimeLabel(item.time, language);
      speakReminder(item.drugName.split(' ')[0], item.dosage || '', label, 'sw');
    } else if (action === 'snoozed') {
      Alert.alert(t('snooze_alert_title'), t('snooze_alert_body'));
    }
  }

  const upcoming = reminders.filter(r => !r.isPast && !doseStatus[r.key]);
  const earlier = reminders.filter(r => r.isPast || doseStatus[r.key]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialCommunityIcons name="bell-ring-outline" size={28} color={COLORS.primary} />
          <Text style={styles.headerTitle}>{t('header_reminders')}</Text>
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
          {/* Legend */}
          <View style={styles.legend}>
            {[
              { icon: 'check-circle', label: t('status_taken'), color: COLORS.green[400] },
              { icon: 'clock-outline', label: t('status_snoozed'), color: COLORS.amber[400] },
              { icon: 'close-circle', label: t('status_missed'), color: COLORS.red[400] },
            ].map(({ icon, label, color }) => (
              <View key={label} style={styles.legendItem}>
                <MaterialCommunityIcons name={icon} size={14} color={color} />
                <Text style={[styles.legendText, { color }]}>{label}</Text>
              </View>
            ))}
          </View>

          {reminders.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="bell-off-outline" size={56} color={COLORS.outline} />
              <Text style={styles.emptyTitle}>{t('empty_reminders_title')}</Text>
              <Text style={styles.emptySub}>{t('empty_reminders_sub')}</Text>
            </View>
          ) : (
            <>
              {upcoming.length > 0 && (
                <>
                  <Text style={styles.sectionLabel}>{t('section_upcoming')}</Text>
                  {upcoming.map(r => (
                    <ReminderCard key={r.key} item={r} doseStatus={doseStatus} onAction={handleAction} language={language} />
                  ))}
                </>
              )}
              <Text style={[styles.sectionLabel, { marginTop: 16 }]}>{t('section_earlier')}</Text>
              {earlier.length === 0 ? (
                <Text style={styles.noEarlier}>{t('no_earlier_reminders')}</Text>
              ) : (
                earlier.map(r => (
                  <ReminderCard key={r.key} item={r} doseStatus={doseStatus} onAction={handleAction} language={language} />
                ))
              )}
            </>
          )}
        </ScrollView>
      )}
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

    scrollContent:  { padding: 16, paddingBottom: 100, flexGrow: 1 },

    legend:         { flexDirection: 'row', gap: 16, marginBottom: 16 },
    legendItem:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
    legendText:     { fontSize: 11, fontFamily: FONT.body },

    sectionLabel:   { fontSize: 11, fontFamily: FONT.bodySemiBold, color: C.onSurfaceVariant, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10 },

    remCard: {
      backgroundColor: C.surfaceLowest, borderRadius: RADIUS.xl, padding: 14,
      marginBottom: 10, flexDirection: 'row', alignItems: 'center',
      shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
    },
    remCardCurrent: { borderLeftWidth: 4, borderLeftColor: C.primary },
    remCardPast:    { opacity: 0.65 },
    remCardBody:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
    remTimeCol:     { alignItems: 'center' },
    remTime:        { fontSize: 18, fontFamily: FONT.bold, color: C.onSurface, letterSpacing: -0.5 },
    remAmpm:        { fontSize: 10, fontFamily: FONT.body, color: C.outline, marginTop: -1 },
    remDrug:        { fontSize: 14, fontFamily: FONT.bodySemiBold, color: C.onSurface },
    remPeriod:      { fontSize: 11, fontFamily: FONT.body, color: C.onSurfaceVariant, marginTop: 1 },
    remNotes:       { fontSize: 11, fontFamily: FONT.body, color: C.outline, marginTop: 4, fontStyle: 'italic' },

    remActions:     { flexDirection: 'row', gap: 6, marginLeft: 8 },
    actionTaken:    { width: 34, height: 34, borderRadius: 10, backgroundColor: C.green[400], alignItems: 'center', justifyContent: 'center' },
    actionSnooze:   { width: 34, height: 34, borderRadius: 10, backgroundColor: C.amber[50], alignItems: 'center', justifyContent: 'center' },
    actionMissed:   { width: 34, height: 34, borderRadius: 10, backgroundColor: C.red[400], alignItems: 'center', justifyContent: 'center' },

    statusChip:     { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 6 },
    statusText:     { fontSize: 11, fontFamily: FONT.bodySemiBold },

    emptyState:     { alignItems: 'center', paddingVertical: 60 },
    emptyTitle:     { fontSize: 18, fontFamily: FONT.bold, color: C.onSurface, marginTop: 16 },
    emptySub:       { fontSize: 13, fontFamily: FONT.body, color: C.outline, textAlign: 'center', marginTop: 8, lineHeight: 20, paddingHorizontal: 20 },
    noEarlier:      { fontSize: 13, fontFamily: FONT.body, color: C.outline, textAlign: 'center', paddingVertical: 20 },
  });
}
