import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, RefreshControl,
  Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { COLORS, RADIUS, FONT } from '../utils/constants';
import { getPrescriptions, savePrescription, deletePrescription } from '../utils/storage';
import { useHighContrast } from '../utils/HighContrastContext';
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

function PrescriptionCard({ item, onDelete, language }) {
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
              <Text style={styles.docBadgeText}>Daktari</Text>
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
  const { toggleHighContrast } = useHighContrast();
  const scrollRef = useRef(null);

  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [language, setLanguage] = useState('sw');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);

  useFocusEffect(useCallback(() => { loadData(); }, []));
  useFocusEffect(useCallback(() => {
    if (scrollRef.current) setTimeout(() => scrollRef.current?.scrollTo?.({ y: 0, animated: true }), 100);
  }, []));

  async function loadData() {
    try {
      const meds = await getPrescriptions();
      setPrescriptions(meds);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }

  function onRefresh() { setRefreshing(true); loadData(); }

  function resetForm() { setForm(INITIAL_FORM); setShowForm(false); }

  async function handleSave() {
    if (!form.drugName.trim() || !form.dosage.trim()) {
      Alert.alert(language === 'sw' ? 'Hitilafu' : 'Error', language === 'sw' ? 'Tafadhali jaza jina na kipimo cha dawa.' : 'Please fill drug name and dosage.');
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
      Alert.alert(
        language === 'sw' ? '✅ Imehifadhiwa' : '✅ Saved',
        language === 'sw' ? `Dawa ya ${prescription.drugName} imehifadhiwa na vikumbusho vimewekwa.` : `${prescription.drugName} saved and reminders scheduled.`
      );
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(item) {
    Alert.alert(
      language === 'sw' ? 'Futa dawa?' : 'Delete medication?',
      language === 'sw' ? 'Una uhakika unataka kufuta dawa hii?' : 'Are you sure you want to delete this medication?',
      [
        { text: language === 'sw' ? 'Hapana' : 'Cancel', style: 'cancel' },
        {
          text: language === 'sw' ? 'Futa' : 'Delete', style: 'destructive',
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
          <Text style={styles.headerTitle}>Dawa</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={() => setLanguage(l => l === 'sw' ? 'en' : 'sw')} style={styles.iconBtn}>
            <Text style={styles.langText}>{language === 'sw' ? 'SW' : 'EN'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleHighContrast} style={styles.iconBtn}>
            <MaterialCommunityIcons name="brightness-6" size={20} color={COLORS.onSurface} />
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
              <Text style={styles.addBtnText}>{language === 'sw' ? 'Ongeza dawa' : 'Add medication'}</Text>
            </TouchableOpacity>

            {prescriptions.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="pill-off" size={56} color={COLORS.outline} />
                <Text style={styles.emptyTitle}>{language === 'sw' ? 'Hakuna dawa' : 'No medications'}</Text>
                <Text style={styles.emptySub}>{language === 'sw' ? 'Bonyeza kituo cha juu kuongeza dawa yako ya kwanza.' : 'Tap the button above to add your first medication.'}</Text>
              </View>
            ) : (
              prescriptions.map((item, i) => (
                <PrescriptionCard key={item.id || i} item={item} onDelete={handleDelete} language={language} />
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
              <Text style={styles.modalCancel}>{language === 'sw' ? 'Ghairi' : 'Cancel'}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{language === 'sw' ? 'Dawa mpya' : 'New medication'}</Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color={COLORS.primary} /> : <Text style={styles.modalSave}>{language === 'sw' ? 'Hifadhi' : 'Save'}</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <FormInput label={language === 'sw' ? 'Jina la dawa' : 'Drug name'} value={form.drugName} onChangeText={v => setForm(f => ({ ...f, drugName: v }))} placeholder="e.g. Amoxicillin" />
            <FormInput label={language === 'sw' ? 'Kipimo' : 'Dosage'} value={form.dosage} onChangeText={v => setForm(f => ({ ...f, dosage: v }))} placeholder="e.g. 500mg" />
            <FormInput label={language === 'sw' ? 'Mara' : 'Frequency'} value={form.frequency} onChangeText={v => setForm(f => ({ ...f, frequency: v }))} placeholder="e.g. Twice daily" />
            <FormInput label={language === 'sw' ? 'Nyakati — separate with comma' : 'Times'} value={form.times.join(', ')} onChangeText={v => setForm(f => ({ ...f, times: v.split(',').map(t => normalizeTime(t.trim())) }))} placeholder="08:00, 20:00" />
            <FormInput label={language === 'sw' ? 'Maelezo (optional)' : 'Notes (optional)'} value={form.notes} onChangeText={v => setForm(f => ({ ...f, notes: v }))} placeholder={language === 'sw' ? 'e.g. Na chakula' : 'e.g. With food'} multiline />
            <View style={styles.sourceRow}>
              <Text style={styles.inputLabel}>{language === 'sw' ? 'Chanzo' : 'Source'}</Text>
              <View style={styles.sourceToggle}>
                <TouchableOpacity style={[styles.sourceOpt, form.source === 'manual' && styles.sourceOptActive]} onPress={() => setForm(f => ({ ...f, source: 'manual' }))}>
                  <MaterialCommunityIcons name="pencil-outline" size={16} color={form.source === 'manual' ? '#fff' : COLORS.onSurfaceVariant} />
                  <Text style={[styles.sourceOptText, form.source === 'manual' && styles.sourceOptTextActive]}>Manual</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.sourceOpt, form.source === 'doctor' && styles.sourceOptActive]} onPress={() => setForm(f => ({ ...f, source: 'doctor' }))}>
                  <MaterialCommunityIcons name="stethoscope" size={16} color={form.source === 'doctor' ? '#fff' : COLORS.onSurfaceVariant} />
                  <Text style={[styles.sourceOptText, form.source === 'doctor' && styles.sourceOptTextActive]}>Daktari</Text>
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
