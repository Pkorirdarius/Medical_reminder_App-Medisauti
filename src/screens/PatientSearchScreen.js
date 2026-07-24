import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { RADIUS, FONT } from '../utils/constants';
import { getUser, getDoctorPatients, getPrescriptions } from '../utils/storage';
import { useLanguage } from '../utils/LanguageContext';
import { useTheme } from '../utils/ThemeContext';

const CONDITION_ICONS = {
  Kisukari: 'water',
  'Shinikizo la damu': 'heart-pulse',
  VVU: 'shield-check',
  Diabetes: 'water',
  'Blood Pressure': 'heart-pulse',
  HIV: 'shield-check',
};

const CONDITION_KEYWORDS = [
  { key: 'diabetes', matches: ['kisukari', 'diabetes', 'metformin', 'insulin'] },
  { key: 'bp', matches: ['shinikizo', 'damu', 'blood pressure', 'bp', 'amlodipine'] },
  { key: 'hiv', matches: ['hiv', 'vvu', 'tenofovir', 'tld'] },
];

function inferCondition(condition) {
  const c = (condition || '').toLowerCase();
  for (const group of CONDITION_KEYWORDS) {
    if (group.matches.some(m => c.includes(m))) return group.key;
  }
  return 'other';
}

const CONDITION_COLORS = {
  diabetes: { bg: '#E1F5EE', icon: '#1D9E75' },
  bp: { bg: '#E6F1FB', icon: '#378ADD' },
  hiv: { bg: '#FAEEDA', icon: '#BA7517' },
  other: { bg: '#F1EFE8', icon: '#5F5E5A' },
};

const CONDITION_ICONS_MAP = { diabetes: 'water', bp: 'heart-pulse', hiv: 'shield-check', other: 'medical-bag' };

export default function PatientSearchScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { COLORS } = useTheme();
  const styles = useMemo(() => getStyles(COLORS), [COLORS]);

  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [selectedRxList, setSelectedRxList] = useState([]);
  const [loadingRx, setLoadingRx] = useState(false);

  useFocusEffect(useCallback(() => { loadData(); }, []));

  async function loadData() {
    try {
      const u = await getUser();
      if (!u || u.role !== 'doctor') { setLoading(false); return; }
      const patientsList = await getDoctorPatients();
      setPatients(patientsList);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function handleViewPatient(patient) {
    setSelectedPatient(patient);
    setLoadingRx(true);
    try {
      const rx = await getPrescriptions(patient.uid);
      setSelectedRxList(rx);
    } catch (e) { console.error(e); }
    finally { setLoadingRx(false); }
  }

  const grouped = useMemo(() => {
    const groups = { diabetes: [], bp: [], hiv: [], other: [] };
    const query = search.toLowerCase().trim();

    for (const p of patients) {
      const cond = inferCondition(p.condition);
      if (activeFilter !== 'all' && cond !== activeFilter) continue;
      if (query) {
        const nameMatch = (p.name || '').toLowerCase().includes(query);
        const condMatch = (p.condition || '').toLowerCase().includes(query);
        if (!nameMatch && !condMatch) continue;
      }
      groups[cond].push(p);
    }
    return groups;
  }, [patients, search, activeFilter]);

  const totalShown = Object.values(grouped).reduce((s, arr) => s + arr.length, 0);

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
        <MaterialCommunityIcons name="account-search" size={26} color={COLORS.primary} />
        <Text style={styles.headerTitle}>{t('header_search_patients')}</Text>
      </View>

      <View style={[styles.searchBar, { backgroundColor: COLORS.surfaceLow }]}>
        <MaterialCommunityIcons name="magnify" size={20} color={COLORS.outline} />
        <TextInput
          style={[styles.searchInput, { color: COLORS.onSurface }]}
          placeholder={t('search_placeholder')}
          placeholderTextColor={COLORS.outline}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <MaterialCommunityIcons name="close-circle" size={18} color={COLORS.outline} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
        {[
          { key: 'all', label: t('condition_all'), icon: 'view-grid' },
          { key: 'diabetes', label: t('condition_diabetes'), icon: 'water' },
          { key: 'bp', label: t('condition_bp'), icon: 'heart-pulse' },
          { key: 'hiv', label: t('condition_hiv'), icon: 'shield-check' },
          { key: 'other', label: t('condition_other'), icon: 'medical-bag' },
        ].map(({ key, label, icon }) => {
          const isActive = activeFilter === key;
          return (
            <TouchableOpacity
              key={key}
              style={[styles.pill, { backgroundColor: isActive ? COLORS.primary : COLORS.surfaceLow }]}
              onPress={() => setActiveFilter(key)}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name={icon} size={14} color={isActive ? '#fff' : COLORS.outline} />
              <Text style={[styles.pillText, {
                color: isActive ? '#fff' : COLORS.onSurfaceVariant,
                fontFamily: isActive ? FONT.bodySemiBold : FONT.body,
              }]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {totalShown === 0 ? (
          <View style={styles.emptyWrap}>
            <MaterialCommunityIcons name="account-off-outline" size={48} color={COLORS.outline} />
            <Text style={[styles.emptyText, { color: COLORS.onSurface }]}>
              {patients.length === 0 ? t('no_patients_assigned') : t('no_search_results')}
            </Text>
          </View>
        ) : (
          Object.entries({ diabetes: 'condition_diabetes', bp: 'condition_bp', hiv: 'condition_hiv', other: 'condition_other' }).map(([cond, labelKey]) => {
            const pts = grouped[cond];
            if (pts.length === 0) return null;
            const cc = CONDITION_COLORS[cond];
            return (
              <View key={cond} style={styles.groupCard}>
                <View style={[styles.groupHeader, { backgroundColor: cc.bg }]}>
                  <MaterialCommunityIcons name={CONDITION_ICONS_MAP[cond]} size={16} color={cc.icon} />
                  <Text style={[styles.groupTitle, { color: cc.icon }]}>{t(labelKey)}</Text>
                  <View style={[styles.groupCount, { backgroundColor: cc.icon + '30' }]}>
                    <Text style={[styles.groupCountText, { color: cc.icon }]}>{pts.length}</Text>
                  </View>
                </View>
                {pts.map((p, i) => (
                  <TouchableOpacity
                    key={p.uid || i}
                    style={[styles.rxRow, { borderBottomWidth: i < pts.length - 1 ? 0.5 : 0, borderBottomColor: COLORS.surfaceHigh }]}
                    activeOpacity={0.6}
                    onPress={() => handleViewPatient(p)}
                  >
                    <View style={[styles.rxIcon, { backgroundColor: COLORS.primary + '12' }]}>
                      <MaterialCommunityIcons name="account" size={16} color={COLORS.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rxName}>{p.name}</Text>
                      <Text style={styles.rxDetail}>{p.age || '--'} yrs · {p.condition || ''}</Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={18} color={COLORS.outline} />
                  </TouchableOpacity>
                ))}
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={!!selectedPatient} transparent animationType="fade" onRequestClose={() => { setSelectedPatient(null); setSelectedRxList([]); }}>
        <View style={styles.detailOverlay}>
          <View style={styles.detailCard}>
            <View style={styles.detailHeader}>
              <View style={[styles.detailIcon, { backgroundColor: COLORS.primary + '15' }]}>
                <MaterialCommunityIcons name="account" size={24} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailName}>{selectedPatient?.name}</Text>
                <Text style={styles.detailSub}>{selectedPatient?.age || '--'} yrs · {selectedPatient?.condition || ''}</Text>
              </View>
              <TouchableOpacity onPress={() => { setSelectedPatient(null); setSelectedRxList([]); }}>
                <MaterialCommunityIcons name="close" size={22} color={COLORS.outline} />
              </TouchableOpacity>
            </View>
            <View style={{ padding: 16 }}>
              <Text style={{ fontSize: 13, fontFamily: FONT.bodySemiBold, color: COLORS.onSurface, marginBottom: 8 }}>
                {t('all_medications')} ({selectedRxList.length})
              </Text>
              {loadingRx ? (
                <ActivityIndicator size="small" color={COLORS.primary} style={{ marginVertical: 16 }} />
              ) : selectedRxList.length === 0 ? (
                <Text style={{ fontSize: 12, fontFamily: FONT.body, color: COLORS.outline, textAlign: 'center', paddingVertical: 16 }}>
                  {t('no_meds_added')}
                </Text>
              ) : (
                selectedRxList.map((rx, i) => (
                  <View key={rx.id || i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: i < selectedRxList.length - 1 ? 0.5 : 0, borderBottomColor: COLORS.surfaceHigh }}>
                    <MaterialCommunityIcons name="pill" size={14} color={COLORS.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, fontFamily: FONT.bodySemiBold, color: COLORS.onSurface }}>{rx.drugName} {rx.dosage}</Text>
                      <Text style={{ fontSize: 10, fontFamily: FONT.body, color: COLORS.outline }}>{rx.frequency} · {rx.times?.join(', ')}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: RADIUS.pill, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: rx.source === 'doctor' ? COLORS.blue[50] : COLORS.surfaceLow }}>
                      <MaterialCommunityIcons name={rx.source === 'doctor' ? 'stethoscope' : 'pencil'} size={10} color={rx.source === 'doctor' ? COLORS.blue[800] : COLORS.outline} />
                      <Text style={{ fontSize: 8, fontFamily: FONT.bodySemiBold, color: rx.source === 'doctor' ? COLORS.blue[800] : COLORS.outline }}>
                        {rx.source === 'doctor' ? t('source_doctor') : t('source_manual')}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function getStyles(C) {
  return StyleSheet.create({
    screen:          { flex: 1, backgroundColor: C.background },
    header: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingHorizontal: 16, paddingVertical: 14,
      backgroundColor: C.background,
      shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 2,
      zIndex: 10,
    },
    headerTitle:     { fontSize: 20, fontFamily: FONT.headline, color: C.onSurface, letterSpacing: -0.5, flex: 1 },
    searchBar: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      marginHorizontal: 16, marginTop: 12,
      borderRadius: RADIUS.lg, paddingHorizontal: 12, height: 42,
    },
    searchInput:     { flex: 1, fontSize: 14, fontFamily: FONT.body, height: 42 },
    filterRow:       { marginTop: 12, marginBottom: 4 },
    pill: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingHorizontal: 12, paddingVertical: 8,
      borderRadius: RADIUS.pill,
    },
    pillText:        { fontSize: 12 },
    scrollContent:   { padding: 16, paddingBottom: 100, gap: 16 },
    groupCard: {
      backgroundColor: C.surfaceLowest, borderRadius: RADIUS.xl, overflow: 'hidden',
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
    },
    groupHeader: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 14, paddingVertical: 10,
    },
    groupTitle:      { fontSize: 14, fontFamily: FONT.bodySemiBold, flex: 1 },
    groupCount:      { borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 1 },
    groupCountText:  { fontSize: 11, fontFamily: FONT.bodyBold },
    rxRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingHorizontal: 14, paddingVertical: 12,
    },
    rxIcon:          { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    rxName:          { fontSize: 13, fontFamily: FONT.bodySemiBold, color: C.onSurface },
    rxDetail:        { fontSize: 11, fontFamily: FONT.body, color: C.outline },
    emptyWrap:       { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
    emptyText:       { fontSize: 14, fontFamily: FONT.body, color: C.outline, textAlign: 'center' },
    detailOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 32 },
    detailCard:      { width: '100%', maxHeight: '80%', backgroundColor: C.surfaceLowest, borderRadius: RADIUS.xl, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 24, elevation: 12 },
    detailHeader:    { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 0.5, borderBottomColor: C.surfaceHigh },
    detailIcon:      { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    detailName:      { fontSize: 16, fontFamily: FONT.bodySemiBold, color: C.onSurface },
    detailSub:       { fontSize: 12, fontFamily: FONT.body, color: C.onSurfaceVariant, marginTop: 2 },
  });
}
