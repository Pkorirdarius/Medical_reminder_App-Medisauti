import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { COLORS, RADIUS, SHADOW } from '../utils/constants';
import { getPrescriptions, logDose } from '../utils/storage';
import { speakReminder, formatTime12, getTimeLabel } from '../utils/reminders';

function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function buildTodayReminders(prescriptions) {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const reminders = [];

  for (const med of prescriptions) {
    for (const time of med.times || []) {
      const tMin = timeToMinutes(time);
      reminders.push({
        key:            `${med.id}-${time}`,
        prescriptionId: med.id,
        drugName:       med.drugName,
        dosage:         med.dosage,
        notes:          med.notes || '',
        time,
        isPast:         tMin < nowMin,
        isCurrent:      Math.abs(tMin - nowMin) <= 30,
      });
    }
  }

  reminders.sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
  return reminders;
}

export default function RemindersScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef(null);

  const [reminders, setReminders]   = useState([]);
  const [doseStatus, setDoseStatus] = useState({});
  const [language, setLanguage]     = useState('sw');
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => { load(); }, [])
  );

  useFocusEffect(
    useCallback(() => {
      if (scrollRef.current) {
        setTimeout(() => scrollRef.current?.scrollTo?.({ y: 0, animated: true }), 100);
      }
    }, [])
  );

  async function load() {
    const meds = await getPrescriptions();
    setReminders(buildTodayReminders(meds));
    setRefreshing(false);
  }

  function onRefresh() {
    setRefreshing(true);
    load();
  }

  async function handleAction(reminder, action) {
    setDoseStatus(s => ({ ...s, [reminder.key]: action }));

    const scheduledTime = new Date();
    const [h, m] = reminder.time.split(':').map(Number);
    scheduledTime.setHours(h, m, 0, 0);

    await logDose(reminder.prescriptionId, action, scheduledTime.toISOString());

    if (action === 'taken') {
      speakReminder(
        reminder.drugName,
        reminder.dosage,
        getTimeLabel(reminder.time, language),
        language
      );
    }

    if (action === 'snoozed') {
      Alert.alert(
        language === 'sw' ? '⏰ Imewekwa tena' : '⏰ Snoozed',
        language === 'sw'
          ? 'Tutakukumbusha baada ya dakika 15.'
          : 'We will remind you again in 15 minutes.'
      );
    }
  }

  const past    = reminders.filter(r => r.isPast);
  const upcoming = reminders.filter(r => !r.isPast);

  function ReminderCard({ r }) {
    const status = doseStatus[r.key];

    const statusColors = {
      taken:   { bg: COLORS.green[50],  border: COLORS.green[400], label: language === 'sw' ? '✓ Imechukuliwa' : '✓ Taken',  labelColor: COLORS.green[400] },
      missed:  { bg: COLORS.red[50],    border: COLORS.red[400],   label: language === 'sw' ? '✗ Imekosekana'  : '✗ Missed', labelColor: COLORS.red[400]   },
      snoozed: { bg: COLORS.amber[50],  border: COLORS.amber[400], label: language === 'sw' ? '⏰ Imepigwa'    : '⏰ Snoozed',labelColor: COLORS.amber[400] },
    };

    const sc = status ? statusColors[status] : null;

    return (
      <View style={[
        styles.rCard,
        r.isCurrent && styles.rCardActive,
        sc && { backgroundColor: sc.bg, borderColor: sc.border },
      ]}>
        <View style={styles.rLeft}>
          <Text style={[styles.rTime, r.isCurrent && { color: COLORS.teal[600] }]}>
            {formatTime12(r.time)}
          </Text>
          <Text style={styles.rPeriod}>{getTimeLabel(r.time, language)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.rName}>{r.drugName} {r.dosage}</Text>
          {r.notes ? <Text style={styles.rSub}>{r.notes}</Text> : null}
        </View>
        {sc ? (
          <Text style={[styles.badge, { color: sc.labelColor }]}>{sc.label}</Text>
        ) : (
          <View style={styles.actionBtns}>
            <TouchableOpacity style={[styles.aBtn, styles.aBtnTaken]} onPress={() => handleAction(r, 'taken')}>
              <Text style={styles.aBtnText}>✓</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.aBtn, styles.aBtnSnooze]} onPress={() => handleAction(r, 'snoozed')}>
              <Text style={styles.aBtnText}>⏰</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.aBtn, styles.aBtnMiss]} onPress={() => handleAction(r, 'missed')}>
              <Text style={styles.aBtnText}>✗</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>⏰ {language === 'sw' ? 'Vikumbusho · Reminders' : 'Reminders'}</Text>
        <Text style={styles.headerSub}>
          {new Date().toLocaleDateString('sw-KE', { weekday: 'long', day: 'numeric', month: 'long' })}
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

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={{ padding: 12, paddingBottom: 40, flexGrow: 1 }}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.teal[600]]}
            tintColor={COLORS.teal[600]}
          />
        }
      >
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: COLORS.green[400] }]} />
            <Text style={styles.legendText}>{language === 'sw' ? 'Imechukuliwa' : 'Taken'}</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: COLORS.red[400] }]} />
            <Text style={styles.legendText}>{language === 'sw' ? 'Imekosekana' : 'Missed'}</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: COLORS.amber[400] }]} />
            <Text style={styles.legendText}>{language === 'sw' ? 'Imepigwa' : 'Snoozed'}</Text>
          </View>
        </View>

        <View style={[styles.legend, { marginBottom: 14 }]}>
          <Text style={{ fontSize: 11, color: COLORS.text.secondary }}>
            {language === 'sw'
              ? '✓ = Imechukuliwa  ⏰ = Subiri dakika 15  ✗ = Imekosekana'
              : '✓ = Taken  ⏰ = Snooze 15m  ✗ = Missed'}
          </Text>
        </View>

        {upcoming.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>{language === 'sw' ? 'Zinakuja · Upcoming' : 'Upcoming'}</Text>
            {upcoming.map(r => <ReminderCard key={r.key} r={r} />)}
          </>
        )}

        {past.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: 16 }]}>
              {language === 'sw' ? 'Zilizopita · Past' : 'Earlier today'}
            </Text>
            {[...past].reverse().map(r => (
              <View key={r.key} style={{ opacity: 0.65 }}>
                <ReminderCard r={r} />
              </View>
            ))}
          </>
        )}

        {reminders.length === 0 && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>💊</Text>
            <Text style={styles.emptyText}>
              {language === 'sw'
                ? 'Hakuna vikumbusho bado.\nOngeza dawa yako kwenye kichupo cha Dawa.'
                : 'No reminders yet.\nAdd your prescriptions in the Dawa tab.'}
            </Text>
          </View>
        )}
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
  sectionLabel:       { fontSize: 11, fontWeight: '600', color: COLORS.text.secondary, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 },
  legend:             { flexDirection: 'row', gap: 14, marginBottom: 6 },
  legendItem:         { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot:          { width: 8, height: 8, borderRadius: 4 },
  legendText:         { fontSize: 11, color: COLORS.text.secondary },
  rCard:              {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: RADIUS.lg,
    padding: 12, marginBottom: 8, borderWidth: 0.5, borderColor: '#e0e0e0', ...SHADOW.sm,
  },
  rCardActive:        { borderColor: COLORS.teal[100], backgroundColor: COLORS.teal[50] },
  rLeft:              { minWidth: 54, alignItems: 'center' },
  rTime:              { fontSize: 14, fontWeight: '600', color: COLORS.text.primary },
  rPeriod:            { fontSize: 10, color: COLORS.text.secondary },
  rName:              { fontSize: 14, fontWeight: '500', color: COLORS.text.primary },
  rSub:               { fontSize: 12, color: COLORS.text.secondary },
  badge:              { fontSize: 11, fontWeight: '600' },
  actionBtns:         { flexDirection: 'row', gap: 4 },
  aBtn:               { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  aBtnTaken:          { backgroundColor: COLORS.green[400] },
  aBtnSnooze:         { backgroundColor: COLORS.amber[400] },
  aBtnMiss:           { backgroundColor: COLORS.red[400] },
  aBtnText:           { color: '#fff', fontSize: 12, fontWeight: '700' },
  emptyBox:           { alignItems: 'center', marginTop: 60 },
  emptyIcon:          { fontSize: 48, marginBottom: 12 },
  emptyText:          { fontSize: 14, color: COLORS.text.secondary, textAlign: 'center', lineHeight: 22 },
});
