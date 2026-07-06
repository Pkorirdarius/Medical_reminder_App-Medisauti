import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { RADIUS, FONT } from '../utils/constants';
import { getPrescriptions } from '../utils/storage';
import { useLanguage } from '../utils/LanguageContext';
import { useTheme } from '../utils/ThemeContext';

const CONDITION_KEYWORDS = [
  { key: 'diabetes', icons: ['metformin', 'insulin', 'glibenclamide', 'gliclazide'], labelKey: 'condition_diabetes' },
  { key: 'bp', icons: ['amlodipine', 'enalapril', 'losartan', 'hydrochlorothiazide', 'nifedipine'],
    labelKey: 'condition_bp' },
  { key: 'hiv', icons: ['tenofovir', 'lamivudine', 'dolutegravir', 'tld', 'efavirenz', 'nevirapine'],
    labelKey: 'condition_hiv' },
];

const CONDITION_ORDER = ['diabetes', 'bp', 'hiv', 'other'];

function inferCondition(drugName) {
  const name = (drugName || '').toLowerCase();
  for (const group of CONDITION_KEYWORDS) {
    if (group.icons.some(icon => name.includes(icon))) return group.key;
  }
  return 'other';
}

function conditionQueryToKey(query) {
  const q = query.toLowerCase();
  if (q.includes('kisukari') || q.includes('diabetes')) return 'diabetes';
  if (q.includes('shinikizo') || q.includes('damu') || q.includes('blood') || q.includes('pressure') || q === 'bp') return 'bp';
  if (q.includes('hiv') || q.includes('vvu')) return 'hiv';
  return null;
}

const CONDITION_ICONS_MAP = {
  diabetes: 'water',
  bp: 'heart-pulse',
  hiv: 'shield-check',
  other: 'medical-bag',
};

const CONDITION_COLORS = {
  diabetes: { bg: '#E1F5EE', icon: '#1D9E75' },
  bp: { bg: '#E6F1FB', icon: '#378ADD' },
  hiv: { bg: '#FAEEDA', icon: '#BA7517' },
  other: { bg: '#F1EFE8', icon: '#5F5E5A' },
};

export default function PatientSearchScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { t } = useLanguage();
  const { COLORS, isDark } = useTheme();
  const styles = useMemo(() => getStyles(COLORS), [COLORS]);

  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  useFocusEffect(useCallback(() => { loadData(); }, []));

  async function loadData() {
    try {
      const rx = await getPrescriptions();
      setPrescriptions(rx);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  const grouped = useMemo(() => {
    const groups = { diabetes: [], bp: [], hiv: [], other: [] };
    const query = search.toLowerCase().trim();

    for (const rx of prescriptions) {
      const cond = inferCondition(rx.drugName);
      if (activeFilter !== 'all' && cond !== activeFilter) continue;
      if (query) {
        const drugMatch = rx.drugName.toLowerCase().includes(query);
        const condKeyMatch = cond.includes(query);
        const queryCondKey = conditionQueryToKey(query);
        const condNameMatch = queryCondKey && cond === queryCondKey;
        if (!drugMatch && !condKeyMatch && !condNameMatch) continue;
      }
      groups[cond].push(rx);
    }
    return groups;
  }, [prescriptions, search, activeFilter]);

  const totalShown = Object.values(grouped).reduce((s, arr) => s + arr.length, 0);

  const condLabelMap = {
    diabetes: 'condition_diabetes',
    bp: 'condition_bp',
    hiv: 'condition_hiv',
    other: 'condition_other',
  };

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

      {/* Search Bar */}
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

      {/* Condition Filter Pills */}
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
              style={[styles.pill, {
                backgroundColor: isActive ? COLORS.primary : COLORS.surfaceLow,
              }]}
              onPress={() => setActiveFilter(key)}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name={icon}
                size={14}
                color={isActive ? '#fff' : COLORS.outline}
              />
              <Text style={[styles.pillText, {
                color: isActive ? '#fff' : COLORS.onSurfaceVariant,
                fontFamily: isActive ? FONT.bodySemiBold : FONT.body,
              }]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {totalShown === 0 ? (
          <View style={styles.emptyWrap}>
            <MaterialCommunityIcons name="account-off-outline" size={48} color={COLORS.outline} />
            <Text style={[styles.emptyText, { color: COLORS.onSurface }]}>{t('no_search_results')}</Text>
          </View>
        ) : (
          CONDITION_ORDER.map(cond => {
            const rxs = grouped[cond];
            if (rxs.length === 0) return null;
            const colors = CONDITION_COLORS[cond];
            const dColors = CONDITION_COLORS.other;
            const cc = isDark ? colors : colors;
            return (
              <View key={cond} style={styles.groupCard}>
                <View style={[styles.groupHeader, { backgroundColor: cc.bg }]}>
                  <MaterialCommunityIcons name={CONDITION_ICONS_MAP[cond]} size={16} color={cc.icon} />
                  <Text style={[styles.groupTitle, { color: cc.icon }]}>{t(condLabelMap[cond])}</Text>
                  <View style={[styles.groupCount, { backgroundColor: cc.icon + '30' }]}>
                    <Text style={[styles.groupCountText, { color: cc.icon }]}>{rxs.length}</Text>
                  </View>
                </View>
                {rxs.map((rx, i) => (
                  <TouchableOpacity
                    key={rx.id || i}
                    style={[styles.rxRow, { borderBottomWidth: i < rxs.length - 1 ? 0.5 : 0, borderBottomColor: COLORS.surfaceHigh }]}
                    activeOpacity={0.6}
                    onPress={() => navigation.navigate('Profile')}
                  >
                    <View style={[styles.rxIcon, { backgroundColor: COLORS.primary + '12' }]}>
                      <MaterialCommunityIcons name="pill" size={16} color={COLORS.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rxName}>{rx.drugName} {rx.dosage}</Text>
                      <Text style={styles.rxDetail}>{rx.frequency} · {rx.times.join(', ')}</Text>
                      <View style={styles.rxMeta}>
                        <MaterialCommunityIcons name={rx.source === 'doctor' ? 'stethoscope' : 'pencil'} size={11} color={COLORS.outline} />
                        <Text style={styles.rxMetaText}>{rx.source === 'doctor' ? t('source_doctor') : t('source_manual')}</Text>
                        {rx.active !== false && (
                          <View style={[styles.statusBadge, { backgroundColor: COLORS.goal[50] }]}>
                            <Text style={[styles.statusText, { color: COLORS.goal[600] }]}>{t('badge_active')}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={18} color={COLORS.outline} />
                  </TouchableOpacity>
                ))}
              </View>
            );
          })
        )}
      </ScrollView>
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

    /* Search */
    searchBar: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      marginHorizontal: 16, marginTop: 12,
      borderRadius: RADIUS.lg, paddingHorizontal: 12, height: 42,
    },
    searchInput:     { flex: 1, fontSize: 14, fontFamily: FONT.body, height: 42 },

    /* Filter Pills */
    filterRow:       { marginTop: 12, marginBottom: 4 },
    pill: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingHorizontal: 12, paddingVertical: 8,
      borderRadius: RADIUS.pill,
    },
    pillText:        { fontSize: 12 },

    /* Groups */
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

    /* Rx rows */
    rxRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingHorizontal: 14, paddingVertical: 12,
    },
    rxIcon:          { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    rxName:          { fontSize: 13, fontFamily: FONT.bodySemiBold, color: C.onSurface },
    rxDetail:        { fontSize: 11, fontFamily: FONT.body, color: C.outline },
    rxMeta:          { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    rxMetaText:      { fontSize: 10, fontFamily: FONT.body, color: C.outline },
    statusBadge:     { borderRadius: RADIUS.pill, paddingHorizontal: 6, paddingVertical: 1 },
    statusText:      { fontSize: 9, fontFamily: FONT.bodySemiBold },

    /* Empty */
    emptyWrap:       { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
    emptyText:       { fontSize: 14, fontFamily: FONT.body, color: C.outline, textAlign: 'center' },
  });
}
