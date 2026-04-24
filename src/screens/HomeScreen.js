import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { COLORS, RADIUS, SHADOW, FONTS } from '../utils/constants';
import { getUser, getPrescriptions, calcAdherence } from '../utils/storage';
import { speakReminder, formatTime12, getTimeLabel } from '../utils/reminders';

// ─── Pill badge component ─────────────────────────────────────────────
function Badge({ label, type = 'teal' }) {
  const colors = {
    teal:   { bg: COLORS.teal[50],  text: COLORS.teal[600]  },
    amber:  { bg: COLORS.amber[50], text: COLORS.amber[400] },
    green:  { bg: COLORS.green[50], text: COLORS.green[400] },
    blue:   { bg: COLORS.blue[50],  text: COLORS.blue[800]  },
  };
  const c = colors[type] || colors.teal;
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.badgeText, { color: c.text }]}>{label}</Text>
    </View>
  );
}

// ─── Medication list item ─────────────────────────────────────────────
function MedItem({ med, onSpeak }) {
  const badgeType = med.stock === 'low' ? 'amber' : 'teal';
  const badgeLabel = med.stock === 'low' ? 'Low stock' : 'Active';

  return (
    <View style={styles.medRow}>
      <View style={[styles.medIcon, { backgroundColor: COLORS.teal[50] }]}>
        <Text style={{ fontSize: 20 }}>💊</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.medName}>{med.drugName} {med.dosage}</Text>
        <Text style={styles.medSub}>
          {med.frequency} · {med.times.map(t => formatTime12(t)).join(', ')}
        </Text>
      </View>
      <Badge label={badgeLabel} type={badgeType} />
    </View>
  );
}

// ─── Main Home Screen ─────────────────────────────────────────────────
export default function HomeScreen() {
  const insets = useSafeAreaInsets();

  const [user, setUser]                 = useState({ name: 'Darius' });
  const [prescriptions, setPrescriptions] = useState([]);
  const [adherence, setAdherence]       = useState({ rate: 0, taken: 0, missed: 0 });
  const [nextReminder, setNextReminder] = useState(null);
  const [speaking, setSpeaking]         = useState(false);
  const [loading, setLoading]           = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  async function loadData() {
    setLoading(true);
    try {
      const [u, meds, adh] = await Promise.all([
        getUser(),
        getPrescriptions(),
        calcAdherence(30),
      ]);
      if (u) setUser(u);
      setPrescriptions(meds);
      setAdherence(adh);
      setNextReminder(findNextReminder(meds));
    } catch (e) {
      console.error('HomeScreen loadData:', e);
    } finally {
      setLoading(false);
    }
  }

  function findNextReminder(meds) {
    if (!meds.length) return null;
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    let nearest = null;
    let nearestDiff = Infinity;

    for (const med of meds) {
      for (const t of med.times || []) {
        const [h, m] = t.split(':').map(Number);
        const medMinutes = h * 60 + m;
        const diff = medMinutes > nowMinutes
          ? medMinutes - nowMinutes
          : 1440 - nowMinutes + medMinutes; // tomorrow

        if (diff < nearestDiff) {
          nearestDiff = diff;
          nearest = { ...med, nextTime: t };
        }
      }
    }
    return nearest;
  }

  function handleSpeak() {
    if (!nextReminder) return;
    setSpeaking(true);
    speakReminder(
      nextReminder.drugName,
      nextReminder.dosage,
      getTimeLabel(nextReminder.nextTime, 'sw'),
      'sw'
    );
    setTimeout(() => setSpeaking(false), 5000);
  }

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Habari za asubuhi';
    if (h < 17) return 'Habari za mchana';
    return 'Habari za jioni';
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greeting}>{greeting()}, {user.name} 👋</Text>
            <Text style={styles.subGreeting}>Dawa yako ya leo · Your meds today</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(user.name || 'U').slice(0, 2).toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Adherence bar */}
        <View style={styles.adhBox}>
          <View style={styles.adhRow}>
            <Text style={styles.adhLabel}>Uzingativu wa mwezi · Monthly adherence</Text>
            <Text style={styles.adhRate}>{adherence.rate}%</Text>
          </View>
          <View style={styles.progBg}>
            <View style={[styles.progFill, { width: `${adherence.rate}%` }]} />
          </View>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.teal[400]} />
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

          {/* Stat cards */}
          <View style={styles.statRow}>
            <View style={[styles.statCard, { backgroundColor: COLORS.teal[50] }]}>
              <Text style={[styles.statVal, { color: COLORS.teal[600] }]}>{adherence.taken}</Text>
              <Text style={styles.statLbl}>Doses taken (30d)</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: COLORS.red[50] }]}>
              <Text style={[styles.statVal, { color: COLORS.red[400] }]}>{adherence.missed}</Text>
              <Text style={styles.statLbl}>Missed (30d)</Text>
            </View>
          </View>

          {/* Next reminder */}
          {nextReminder && (
            <View style={[styles.card, styles.nextCard]}>
              <Text style={styles.cardTitle}>Inayokuja · Next reminder</Text>
              <View style={styles.nextRow}>
                <View style={styles.timeBubble}>
                  <Text style={styles.timeBig}>{formatTime12(nextReminder.nextTime).split(' ')[0]}</Text>
                  <Text style={styles.timeAmpm}>{formatTime12(nextReminder.nextTime).split(' ')[1]}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.medName}>{nextReminder.drugName} {nextReminder.dosage}</Text>
                  <Text style={styles.medSub}>
                    {getTimeLabel(nextReminder.nextTime, 'sw')} ·{' '}
                    {getTimeLabel(nextReminder.nextTime, 'en')}
                  </Text>
                </View>
                <TouchableOpacity style={styles.speakBtn} onPress={handleSpeak}>
                  <Text style={styles.speakBtnText}>{speaking ? '🔊' : '▶ Sauti'}</Text>
                </TouchableOpacity>
              </View>
              {speaking && (
                <View style={styles.speakingBar}>
                  <Text style={styles.speakingText}>
                    🔊 "Ni wakati wa kuchukua dawa yako..."
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Medications list */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Dawa zote · All medications</Text>
            {prescriptions.length === 0 ? (
              <Text style={styles.emptyText}>
                Bado hujaongeza dawa. Bonyeza kichupo "Dawa" kuanza.
                {'\n'}No meds added yet. Tap the "Dawa" tab to start.
              </Text>
            ) : (
              prescriptions.map((med, i) => (
                <MedItem key={med.id || i} med={med} />
              ))
            )}
          </View>

        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: COLORS.background },
  header:         { backgroundColor: COLORS.teal[600], padding: 16, paddingBottom: 20 },
  headerRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  greeting:       { fontSize: 18, fontWeight: '600', color: '#fff' },
  subGreeting:    { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  avatar:         {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText:     { color: '#fff', fontWeight: '600', fontSize: 14 },
  adhBox:         { marginTop: 12 },
  adhRow:         { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  adhLabel:       { fontSize: 11, color: 'rgba(255,255,255,0.8)' },
  adhRate:        { fontSize: 11, color: '#fff', fontWeight: '600' },
  progBg:         { height: 6, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 3 },
  progFill:       { height: 6, backgroundColor: '#fff', borderRadius: 3 },

  scroll:         { flex: 1 },
  scrollContent:  { padding: 12, paddingBottom: 30 },

  statRow:        { flexDirection: 'row', gap: 10, marginBottom: 12 },
  statCard:       { flex: 1, borderRadius: RADIUS.md, padding: 12, alignItems: 'center' },
  statVal:        { fontSize: 26, fontWeight: '600' },
  statLbl:        { fontSize: 11, color: COLORS.text.secondary, marginTop: 2, textAlign: 'center' },

  card:           {
    backgroundColor: '#fff', borderRadius: RADIUS.lg,
    padding: 14, marginBottom: 12, ...SHADOW.sm,
  },
  nextCard:       { borderLeftWidth: 4, borderLeftColor: COLORS.teal[400] },
  cardTitle:      {
    fontSize: 11, fontWeight: '600', color: COLORS.text.secondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10,
  },
  nextRow:        { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timeBubble:     {
    backgroundColor: COLORS.teal[50], borderRadius: RADIUS.md,
    paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center',
  },
  timeBig:        { fontSize: 20, fontWeight: '600', color: COLORS.teal[600] },
  timeAmpm:       { fontSize: 10, color: COLORS.teal[400] },
  speakBtn:       {
    backgroundColor: COLORS.teal[400], borderRadius: RADIUS.pill,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  speakBtnText:   { color: '#fff', fontSize: 12, fontWeight: '600' },
  speakingBar:    {
    marginTop: 10, backgroundColor: COLORS.teal[50],
    borderRadius: RADIUS.md, padding: 8,
  },
  speakingText:   { fontSize: 12, color: COLORS.teal[600] },

  medRow:         {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#e8e8e8',
  },
  medIcon:        { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  medName:        { fontSize: 14, fontWeight: '500', color: COLORS.text.primary },
  medSub:         { fontSize: 12, color: COLORS.text.secondary, marginTop: 1 },

  badge:          { borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText:      { fontSize: 11, fontWeight: '600' },

  emptyText:      { fontSize: 13, color: COLORS.text.secondary, lineHeight: 22, textAlign: 'center' },
});
