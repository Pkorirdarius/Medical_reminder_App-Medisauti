import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, RefreshControl,
  Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { COLORS, RADIUS, FONT } from '../utils/constants';
import { getPrescriptions, savePrescription, deletePrescription, getUser } from '../utils/storage';
import { useHighContrast } from '../utils/HighContrastContext';
import { useLanguage } from '../utils/LanguageContext';
import { scheduleReminder, cancelReminder, normalizeTime } from '../utils/reminders';

const INITIAL_FORM = {
  drugName: '', dosage: '', frequency: '', times: ['08:00'], notes: '', source: 'manual',
};

function FormInput({ label, value, onChangeText, placeholder, keyboardType, multiline }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && { minHeight: 72, paddingTop: 10 }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.outline}
        keyboardType={keyboardType}
        multiline={multiline}
      />
    </View>
  );
}

function PrescriptionCard({ item, onDelete }) {
  const { t } = useLanguage();
  return (
    <View style={styles.medCard}>
      <View style={styles.medCardHeader}>
        <View style={styles.medCardLeft}>
          <View style={styles.medIconWrap}>
            <MaterialCommunityIcons name="pill" size={22} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.medCardName}>{item.drugName} {item.dosage}</Text>
            <Text style={styles.medCardSub}>{item.frequency} · {item.times.join(', ')}</Text>
          </View>
          {item.source === 'doctor' && (
            <View style={styles.docBadge}>
              <MaterialCommunityIcons name="stethoscope" size={12} color={COLORS.blue[800]} />
              <Text style={styles.docBadgeText}>{t('source_doctor')}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={() => onDelete(item)} style={styles.deleteBtn}>
          <MaterialCommunityIcons name="delete-outline" size={20} color={COLORS.error} />
        </TouchableOpacity>
      </View>
      {item.notes ? <Text style={styles.medCardNotes}>{item.notes}</Text> : null}
    </View>
  );
}

export default function PrescriptionScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { toggleHighContrast } = useHighContrast();
  const { language, toggleLanguage, t } = useLanguage();
  const scrollRef = useRef(null);

  const [user, setUser] = useState({ name: 'User' });
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);

  useFocusEffect(useCallback(() => { loadData(); }, []));
  useFocusEffect(useCallback(() => {
    if (scrollRef.current) setTimeout(() => scrollRef.current?.scrollTo?.({ y: 0, animated: true }), 100);
  }, []));

  async function loadData() {
    try {
      const [meds, u] = await Promise.all([getPrescriptions(), getUser()]);
      setPrescriptions(meds);
      if (u) setUser(u);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }

  function onRefresh() { setRefreshing(true); loadData(); }

  function resetForm() { setForm(INITIAL_FORM); setShowForm(false); }

  async function handleSave() {
    if (!form.drugName.trim() || !form.dosage.trim()) {
      Alert.alert(t('error'), t('validation_error'));
      return;
    }
    setSaving(true);
    try {
      const prescription = {
        id: Date.now().toString(),
        ...form,
        times: form.times.map(t => normalizeTime(t.trim())),
        createdAt: new Date().toISOString(),
        active: true,
        notifIds: [],
      };
      const notifIds = [];
      for (const time of prescription.times) {
        try {
          const nid = await scheduleReminder(prescription, time, language);
          notifIds.push({ time, nid });
        } catch (e) {
          console.warn('Could not schedule notification for', time, e);
        }
      }
      prescription.notifIds = notifIds;
      await savePrescription(prescription);
      await loadData();
      resetForm();
      Alert.alert('✅ ' + t('saved_success_title'), t('saved_success'));
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(item) {
    Alert.alert(t('delete_title'), t('delete_body'),
      [
        { text: t('no'), style: 'cancel' },
        {
          text: t('delete'), style: 'destructive',
          onPress: async () => {
            for (const n of item.notifIds || []) { try { await cancelReminder(n.nid); } catch (e) {} }
            await deletePrescription(item.id);
            await loadData();
          },
        },
      ]
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialCommunityIcons name="pill" size={28} color={COLORS.primary} />
          <Text style={styles.headerTitle}>{t('header_medications')}</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={toggleLanguage} style={styles.iconBtn}>
            <Text style={styles.langText}>{language === 'sw' ? 'SW' : 'EN'}</Text>
          </TouchableOpacity>
        <TouchableOpacity onPress={toggleHighContrast} style={styles.iconBtn}>
          <MaterialCommunityIcons name="brightness-6" size={20} color={COLORS.onSurface} />
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
      >
        {loading ? (
          <ActivityIndicator style={{ marginTop: 60 }} color={COLORS.primary} />
        ) : (
          <>
            <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(true)} activeOpacity={0.7}>
              <MaterialCommunityIcons name="plus-circle" size={22} color="#fff" />
              <Text style={styles.addBtnText}>{t('add_medication')}</Text>
            </TouchableOpacity>

            {prescriptions.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="pill" size={56} color={COLORS.outline} />
                <Text style={styles.emptyTitle}>{t('empty_medications_title')}</Text>
                <Text style={styles.emptySub}>{t('empty_medications_sub')}</Text>
              </View>
            ) : (
              prescriptions.map((item, i) => (
                <PrescriptionCard key={item.id || i} item={item} onDelete={handleDelete} />
              ))
            )}
          </>
        )}
      </ScrollView>

      {/* ── Add/Edit Form Modal ── */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[styles.modalScreen, { paddingTop: insets.top }]}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={resetForm}>
              <Text style={styles.modalCancel}>{t('cancel')}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{t('modal_new_med')}</Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color={COLORS.primary} /> : <Text style={styles.modalSave}>{t('save')}</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <FormInput label={t('label_drug_name')} value={form.drugName} onChangeText={v => setForm(f => ({ ...f, drugName: v }))} placeholder={t('placeholder_drug_name')} />
            <FormInput label={t('label_dosage')} value={form.dosage} onChangeText={v => setForm(f => ({ ...f, dosage: v }))} placeholder={t('placeholder_dosage')} />
            <FormInput label={t('label_frequency')} value={form.frequency} onChangeText={v => setForm(f => ({ ...f, frequency: v }))} placeholder={t('placeholder_frequency')} />
            <FormInput label={`${t('label_times')} — ${t('times_instruction')}`} value={form.times.join(', ')} onChangeText={v => setForm(f => ({ ...f, times: v.split(',').map(t => normalizeTime(t.trim())) }))} placeholder={t('placeholder_times')} />
            <FormInput label={t('label_notes')} value={form.notes} onChangeText={v => setForm(f => ({ ...f, notes: v }))} placeholder={t('placeholder_notes')} multiline />
            <View style={styles.sourceRow}>
              <Text style={styles.inputLabel}>{t('label_source')}</Text>
              <View style={styles.sourceToggle}>
                <TouchableOpacity style={[styles.sourceOpt, form.source === 'manual' && styles.sourceOptActive]} onPress={() => setForm(f => ({ ...f, source: 'manual' }))}>
                  <MaterialCommunityIcons name="pencil-outline" size={16} color={form.source === 'manual' ? '#fff' : COLORS.onSurfaceVariant} />
                  <Text style={[styles.sourceOptText, form.source === 'manual' && styles.sourceOptTextActive]}>{t('source_manual')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.sourceOpt, form.source === 'doctor' && styles.sourceOptActive]} onPress={() => setForm(f => ({ ...f, source: 'doctor' }))}>
                  <MaterialCommunityIcons name="stethoscope" size={16} color={form.source === 'doctor' ? '#fff' : COLORS.onSurfaceVariant} />
                  <Text style={[styles.sourceOptText, form.source === 'doctor' && styles.sourceOptTextActive]}>{t('source_doctor')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:         { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: COLORS.background,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 2,
    zIndex: 10,
  },
  headerLeft:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle:    { fontSize: 20, fontFamily: FONT.headline, color: COLORS.onSurface, letterSpacing: -0.5 },
  headerRight:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn:        { width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.surfaceLow, alignItems: 'center', justifyContent: 'center' },
  langText:       { fontSize: 11, fontFamily: FONT.bodyBold, color: COLORS.onSurface },
  avatar:         { width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.primaryContainer, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.primary + '20' },
  avatarText:     { fontSize: 12, fontFamily: FONT.bodyBold, color: '#fff' },

  scrollContent:  { padding: 16, paddingBottom: 100, flexGrow: 1 },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: RADIUS.xl, paddingVertical: 14,
    marginBottom: 16,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  addBtnText:     { fontSize: 15, fontFamily: FONT.bodySemiBold, color: '#fff' },

  medCard: {
    backgroundColor: COLORS.surfaceLowest, borderRadius: RADIUS.xl, padding: 16,
    marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  medCardHeader:  { flexDirection: 'row', alignItems: 'flex-start' },
  medCardLeft:    { flex: 1, flexDirection: 'row', gap: 12 },
  medIconWrap:    { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.onPrimaryContainer + '25', alignItems: 'center', justifyContent: 'center' },
  medCardName:    { fontSize: 15, fontFamily: FONT.bodySemiBold, color: COLORS.onSurface },
  medCardSub:     { fontSize: 12, fontFamily: FONT.body, color: COLORS.onSurfaceVariant, marginTop: 1 },
  docBadge:       { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.blue[50], borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  docBadgeText:   { fontSize: 10, fontFamily: FONT.bodySemiBold, color: COLORS.blue[800] },
  deleteBtn:      { padding: 4 },
  medCardNotes:   { fontSize: 12, fontFamily: FONT.body, color: COLORS.onSurfaceVariant, marginTop: 8, backgroundColor: COLORS.surfaceLow, padding: 10, borderRadius: RADIUS.md },

  emptyState:     { alignItems: 'center', paddingVertical: 60 },
  emptyTitle:     { fontSize: 18, fontFamily: FONT.bold, color: COLORS.onSurface, marginTop: 16 },
  emptySub:       { fontSize: 13, fontFamily: FONT.body, color: COLORS.outline, textAlign: 'center', marginTop: 8, lineHeight: 20, paddingHorizontal: 20 },

  /* Modal */
  modalScreen:    { flex: 1, backgroundColor: COLORS.background },
  modalHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: COLORS.surfaceLowest, borderBottomWidth: 0.5, borderBottomColor: COLORS.surfaceHigh },
  modalTitle:     { fontSize: 16, fontFamily: FONT.bold, color: COLORS.onSurface },
  modalCancel:    { fontSize: 14, fontFamily: FONT.body, color: COLORS.outline },
  modalSave:      { fontSize: 14, fontFamily: FONT.bodySemiBold, color: COLORS.primary },
  modalContent:   { padding: 16, gap: 16, paddingBottom: 60 },

  inputLabel:     { fontSize: 12, fontFamily: FONT.bodySemiBold, color: COLORS.onSurfaceVariant, letterSpacing: 0.3 },
  input:          { backgroundColor: COLORS.surfaceLow, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: FONT.body, color: COLORS.onSurface, borderWidth: 1, borderColor: COLORS.surfaceHigh },

  sourceRow:      { gap: 8 },
  sourceToggle:   { flexDirection: 'row', gap: 8 },
  sourceOpt:      { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: RADIUS.md, backgroundColor: COLORS.surfaceLow, borderWidth: 1, borderColor: COLORS.surfaceHigh },
  sourceOptActive:{ backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  sourceOptText:  { fontSize: 13, fontFamily: FONT.body, color: COLORS.onSurfaceVariant },
  sourceOptTextActive: { color: '#fff' },
});
