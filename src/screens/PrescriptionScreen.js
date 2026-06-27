import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, RefreshControl,
  Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'expo-camera';

import { COLORS, RADIUS, FONT } from '../utils/constants';
import { getPrescriptions, savePrescription, deletePrescription, getUser } from '../utils/storage';
import { useHighContrast } from '../utils/HighContrastContext';
import { useLanguage } from '../utils/LanguageContext';
import { scheduleReminder, cancelReminder, normalizeTime } from '../utils/reminders';
import { OCR_WEBVIEW_HTML, parseOCRText } from '../utils/ocr';
import { parseWithAI, hasProvider, getProvider } from '../utils/ai';

const INITIAL_FORM = {
  drugName: '', dosage: '', frequency: 'Mara moja kwa siku', times: ['08:00'], notes: '', source: 'manual', voiceNotif: true,
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

function PrescriptionCard({ item, onDelete, onEdit }) {
  const { t } = useLanguage();
  return (
    <TouchableOpacity onPress={() => onEdit(item)} activeOpacity={0.7}>
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
    </TouchableOpacity>
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
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrMode, setOcrMode] = useState(null);
  const webviewRef = useRef(null);
  const pendingImageUri = useRef(null);

  const isEditing = editItem !== null;

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

  function resetForm() { setForm(INITIAL_FORM); setEditItem(null); setShowForm(false); }

  function openEdit(item) {
    setEditItem(item);
    setForm({
      drugName: item.drugName || '',
      dosage: item.dosage || '',
      frequency: item.frequency || INITIAL_FORM.frequency,
      times: item.times || INITIAL_FORM.times,
      notes: item.notes || '',
      source: item.source || 'manual',
      voiceNotif: item.voiceNotif !== false,
    });
    setShowForm(true);
  }

  async function handleOCRSnap() {
    const { status } = await Camera.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('error'), t('permission_desc'));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets?.[0]) {
      startOCR(result.assets[0].base64);
    }
  }

  async function handleOCRPick() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('error'), t('permission_desc'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets?.[0]) {
      startOCR(result.assets[0].base64);
    }
  }

  function startOCR(base64) {
    pendingImageUri.current = `data:image/jpeg;base64,${base64}`;
    setOcrBusy(true);
    setOcrProgress(0);
    setTimeout(() => {
      webviewRef.current?.postMessage(JSON.stringify({ imageUri: pendingImageUri.current }));
    }, 500);
  }

  function applyParsed(parsed) {
    setForm(f => ({
      ...f,
      drugName: parsed.drugName || f.drugName,
      dosage: parsed.dosage || f.dosage,
      frequency: parsed.frequency || f.frequency,
      times: parsed.times?.length > 0 ? parsed.times : f.times,
      source: 'manual',
    }));
    setShowForm(true);
  }

  async function handleOCRResult(rawText) {
    setOcrProgress(95);
    let parsed = null;
    if (rawText.length > 5) {
      if (!hasProvider()) {
        Alert.alert(t('ocr_ai_title'), t('ocr_ai_no_key'));
      }
      parsed = await parseWithAI(rawText);
    }
    if (parsed) {
      setOcrMode('ai');
    } else {
      setOcrMode('regex');
      parsed = parseOCRText(rawText);
    }
    setOcrBusy(false);
    pendingImageUri.current = null;
    applyParsed(parsed);
  }

  function handleOCRMessage(event) {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'ready') {
        if (pendingImageUri.current) {
          webviewRef.current?.postMessage(JSON.stringify({ imageUri: pendingImageUri.current }));
        }
      } else if (msg.type === 'progress') {
        setOcrProgress(msg.progress);
      } else if (msg.type === 'result') {
        handleOCRResult(msg.text);
      } else if (msg.type === 'error') {
        setOcrBusy(false);
        pendingImageUri.current = null;
        Alert.alert(t('error'), msg.message || 'OCR failed');
      }
    } catch (e) { console.warn('OCR message error', e); }
  }

  async function handleSave() {
    if (!form.drugName.trim() || !form.dosage.trim()) {
      Alert.alert(t('error'), t('validation_error'));
      return;
    }
    setSaving(true);
    try {
      const prescription = {
        id: isEditing ? editItem.id : Date.now().toString(),
        ...form,
        times: form.times.map(t => normalizeTime(t.trim())),
        createdAt: editItem?.createdAt || new Date().toISOString(),
        active: editItem?.active !== undefined ? editItem.active : true,
        notifIds: editItem?.notifIds || [],
      };

      if (!isEditing) {
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
      }

      await savePrescription(prescription);
      await loadData();
      resetForm();
      Alert.alert(t('saved_success_title'), t('saved_success'));
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

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60, flex: 1 }} color={COLORS.primary} />
      ) : (
        <>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(true)} activeOpacity={0.7}>
            <MaterialCommunityIcons name="plus-circle" size={22} color="#fff" />
            <Text style={styles.addBtnText}>{t('add_medication')}</Text>
          </TouchableOpacity>

          {/* OCR Scan Buttons */}
          <View style={styles.ocrRow}>
            <TouchableOpacity style={styles.ocrBtn} onPress={handleOCRSnap} activeOpacity={0.7}>
              <MaterialCommunityIcons name="camera" size={20} color={COLORS.primary} />
              <Text style={styles.ocrBtnText}>{t('header_scan')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ocrBtn} onPress={handleOCRPick} activeOpacity={0.7}>
              <MaterialCommunityIcons name="image" size={20} color={COLORS.primary} />
              <Text style={styles.ocrBtnText}>{t('recent_scans')}</Text>
            </TouchableOpacity>
          </View>

          {prescriptions.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="pill" size={56} color={COLORS.outline} />
              <Text style={styles.emptyTitle}>{t('empty_medications_title')}</Text>
              <Text style={styles.emptySub}>{t('empty_medications_sub')}</Text>
            </View>
          ) : (
            <ScrollView
              ref={scrollRef}
              style={{ flex: 1 }}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} colors={[COLORS.primary]} />}
            >
              {prescriptions.map((item, i) => (
                <PrescriptionCard key={item.id || i} item={item} onDelete={handleDelete} onEdit={openEdit} />
              ))}
            </ScrollView>
          )}
        </>
      )}

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
            <Text style={styles.modalTitle}>{isEditing ? t('modal_edit_med') : t('modal_new_med')}</Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color={COLORS.primary} /> : <Text style={styles.modalSave}>{t('save')}</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <FormInput label={t('label_drug_name')} value={form.drugName} onChangeText={v => setForm(f => ({ ...f, drugName: v }))} placeholder={t('placeholder_drug_name')} />
            <FormInput label={t('label_dosage')} value={form.dosage} onChangeText={v => setForm(f => ({ ...f, dosage: v }))} placeholder={t('placeholder_dosage')} />

            {/* Frequency Presets */}
            <Text style={styles.inputLabel}>{t('frequency_presets')}</Text>
            <View style={styles.freqRow}>
              {[
                { key: 'once', label: t('freq_once'), times: ['08:00'] },
                { key: 'twice', label: t('freq_twice'), times: ['08:00', '20:00'] },
                { key: 'thrice', label: t('freq_thrice'), times: ['08:00', '14:00', '20:00'] },
              ].map(opt => {
                const active = form.times.length === opt.times.length &&
                  form.times.every((t, i) => t === opt.times[i]);
                return (
                  <TouchableOpacity key={opt.key} style={[styles.freqBtn, active && styles.freqBtnActive]} onPress={() => setForm(f => ({ ...f, times: [...opt.times], frequency: opt.label }))}>
                    <Text style={[styles.freqBtnText, active && styles.freqBtnTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Time Period Pills */}
            <Text style={styles.inputLabel}>{t('select_times')}</Text>
            <View style={styles.timePillRow}>
              {[
                { key: 'asubuhi', label: t('time_morning'), icon: 'weather-sunset-up', time: '08:00' },
                { key: 'mchana', label: t('time_afternoon'), icon: 'weather-sunny', time: '14:00' },
                { key: 'jioni', label: t('time_evening'), icon: 'weather-sunset-down', time: '20:00' },
                { key: 'usiku', label: t('time_night'), icon: 'weather-night', time: '22:00' },
              ].map(period => {
                const hasTime = form.times.includes(period.time);
                return (
                  <TouchableOpacity key={period.key} style={[styles.timePill, hasTime && styles.timePillActive]} onPress={() => {
                    if (hasTime) {
                      setForm(f => ({ ...f, times: f.times.filter(t => t !== period.time) }));
                    } else {
                      setForm(f => ({ ...f, times: [...f.times, period.time].sort() }));
                    }
                  }}>
                    <MaterialCommunityIcons name={period.icon} size={16} color={hasTime ? '#fff' : COLORS.outline} />
                    <Text style={[styles.timePillLabel, hasTime && styles.timePillLabelActive]}>{period.label}</Text>
                    <Text style={[styles.timePillVal, hasTime && styles.timePillValActive]}>{period.time}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <FormInput label={t('label_notes')} value={form.notes} onChangeText={v => setForm(f => ({ ...f, notes: v }))} placeholder={t('placeholder_notes')} multiline />

            {/* Voice Notification Toggle */}
            <View style={styles.voiceRow}>
              <MaterialCommunityIcons name={form.voiceNotif ? 'volume-high' : 'volume-off'} size={20} color={form.voiceNotif ? COLORS.primary : COLORS.outline} />
              <Text style={styles.voiceLabel}>{t('voice_label')}</Text>
              <TouchableOpacity style={[styles.voiceToggle, form.voiceNotif && styles.voiceToggleActive]} onPress={() => setForm(f => ({ ...f, voiceNotif: !f.voiceNotif }))}>
                <View style={[styles.voiceKnob, form.voiceNotif && styles.voiceKnobActive]} />
              </TouchableOpacity>
            </View>

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

      {/* Hidden WebView for Tesseract.js OCR */}
      <WebView
        ref={webviewRef}
        source={{ html: OCR_WEBVIEW_HTML }}
        onMessage={handleOCRMessage}
        style={{ height: 0, width: 0, opacity: 0 }}
        javaScriptEnabled
        domStorageEnabled
      />

      {/* OCR Loading Overlay */}
      {ocrBusy && (
        <View style={styles.ocrOverlay}>
          <View style={styles.ocrCard}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.ocrTitle}>{t('scanning')}</Text>
            <View style={styles.ocrProgBg}>
              <View style={[styles.ocrProgFill, { width: `${ocrProgress}%` }]} />
            </View>
            <Text style={styles.ocrProgText}>{ocrProgress}%</Text>
            {ocrMode && (
              <View style={[styles.ocrModeBadge, {
                backgroundColor: ocrMode === 'ai' ? COLORS.blue[50] : COLORS.surfaceHigh,
              }]}>
                <MaterialCommunityIcons
                  name={ocrMode === 'ai' ? 'robot' : 'code-braces'}
                  size={12}
                  color={ocrMode === 'ai' ? COLORS.blue[800] : COLORS.outline}
                />
                <Text style={[styles.ocrModeText, {
                  color: ocrMode === 'ai' ? COLORS.blue[800] : COLORS.outline,
                }]}>
                  {ocrMode === 'ai' ? (getProvider() || 'AI') : 'Local Regex'}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}
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

  /* Frequency Presets */
  freqRow:        { flexDirection: 'row', gap: 8 },
  freqBtn:        { flex: 1, paddingVertical: 10, borderRadius: RADIUS.md, backgroundColor: COLORS.surfaceLow, alignItems: 'center', borderWidth: 1, borderColor: COLORS.surfaceHigh },
  freqBtnActive:  { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  freqBtnText:    { fontSize: 12, fontFamily: FONT.bodySemiBold, color: COLORS.onSurfaceVariant, textAlign: 'center' },
  freqBtnTextActive: { color: '#fff' },

  /* Time Period Pills */
  timePillRow:    { flexDirection: 'row', gap: 8 },
  timePill:       { flex: 1, paddingVertical: 10, borderRadius: RADIUS.md, backgroundColor: COLORS.surfaceLow, alignItems: 'center', gap: 2, borderWidth: 1, borderColor: COLORS.surfaceHigh },
  timePillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  timePillLabel:  { fontSize: 10, fontFamily: FONT.body, color: COLORS.outline },
  timePillLabelActive: { color: '#fff' },
  timePillVal:    { fontSize: 11, fontFamily: FONT.bodySemiBold, color: COLORS.onSurfaceVariant },
  timePillValActive: { color: '#fff', opacity: 0.85 },

  /* Voice Toggle */
  voiceRow:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  voiceLabel:     { fontSize: 12, fontFamily: FONT.bodySemiBold, color: COLORS.onSurfaceVariant, flex: 1 },
  voiceToggle:    { width: 44, height: 24, borderRadius: 12, backgroundColor: COLORS.surfaceHigh, justifyContent: 'center', paddingHorizontal: 2 },
  voiceToggleActive: { backgroundColor: COLORS.primary },
  voiceKnob:      { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  voiceKnobActive:{ alignSelf: 'flex-end' },

  /* OCR Buttons */
  ocrRow:         { flexDirection: 'row', gap: 8, marginBottom: 16 },
  ocrBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: RADIUS.md, backgroundColor: COLORS.surfaceLow,
    borderWidth: 1, borderColor: COLORS.surfaceHigh,
  },
  ocrBtnText:     { fontSize: 13, fontFamily: FONT.bodySemiBold, color: COLORS.primary },

  /* OCR Overlay */
  ocrOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 999,
  },
  ocrCard: {
    backgroundColor: COLORS.surfaceLowest, borderRadius: RADIUS.xl, padding: 32,
    alignItems: 'center', gap: 12, marginHorizontal: 40,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 24, elevation: 10,
  },
  ocrTitle:       { fontSize: 16, fontFamily: FONT.bodySemiBold, color: COLORS.onSurface },
  ocrProgBg:      { height: 6, borderRadius: 3, backgroundColor: COLORS.surfaceHigh, width: '100%', overflow: 'hidden' },
  ocrProgFill:    { height: 6, borderRadius: 3, backgroundColor: COLORS.primary },
  ocrProgText:    { fontSize: 12, fontFamily: FONT.body, color: COLORS.outline },
  ocrModeBadge:   { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 3, marginTop: 8 },
  ocrModeText:    { fontSize: 10, fontFamily: FONT.bodySemiBold },
});
