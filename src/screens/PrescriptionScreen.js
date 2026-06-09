import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { COLORS, RADIUS, SHADOW } from '../utils/constants';
import { getPrescriptions, savePrescription, deletePrescription } from '../utils/storage';
import { scheduleReminder, cancelReminder } from '../utils/reminders';
import { OCR_WEBVIEW_HTML, parseOCRText } from '../utils/ocr';

const INITIAL_FORM = {
  drugName:  '',
  dosage:    '',
  frequency: '',
  times:     ['08:00'],
  notes:     '',
  source:    'manual', // 'manual' | 'doctor'
};

function FormInput({ label, value, onChangeText, placeholder, keyboardType = 'default' }) {
  return (
    <View style={styles.formRow}>
      <Text style={styles.formLabel}>{label}</Text>
      <TextInput
        style={styles.formInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.text.hint}
        keyboardType={keyboardType}
      />
    </View>
  );
}

export default function PrescriptionScreen() {
  const insets      = useSafeAreaInsets();
  const webviewRef  = useRef(null);

  const [prescriptions, setPrescriptions] = useState([]);
  const [form, setForm]                   = useState(INITIAL_FORM);
  const [scanning, setScanning]           = useState(false);
  const [ocrProgress, setOcrProgress]     = useState(0);
  const [language, setLanguage]           = useState('sw'); // 'sw' | 'en'
  const [showForm, setShowForm]           = useState(false);

  useFocusEffect(
    useCallback(() => { loadPrescriptions(); }, [])
  );

  async function loadPrescriptions() {
    const data = await getPrescriptions();
    setPrescriptions(data);
  }

  // ─── Photo / OCR ────────────────────────────────────────────────────
  async function handlePhotoScan() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        language === 'sw' ? 'Ruhusa Inahitajika' : 'Permission Required',
        language === 'sw'
          ? 'Tafadhali ruhusu kamera kuchukua picha za dawa.'
          : 'Please allow camera access to scan prescriptions.'
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      base64: true, // needed for WebView OCR
    });

    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      setScanning(true);
      setOcrProgress(0);

      // Send base64 image to WebView for OCR
      if (webviewRef.current) {
        webviewRef.current.postMessage(
          JSON.stringify({ imageUri: `data:image/jpeg;base64,${asset.base64}` })
        );
      }
    }
  }

  async function handleGalleryPick() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets?.[0]) {
      setScanning(true);
      setOcrProgress(0);
      if (webviewRef.current) {
        webviewRef.current.postMessage(
          JSON.stringify({ imageUri: `data:image/jpeg;base64,${result.assets[0].base64}` })
        );
      }
    }
  }

  function handleWebViewMessage(event) {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'progress') {
        setOcrProgress(msg.progress);
      } else if (msg.type === 'result') {
        setScanning(false);
        const parsed = parseOCRText(msg.text);
        setForm({
          drugName:  parsed.drugName  || '',
          dosage:    parsed.dosage    || '',
          frequency: parsed.frequency || '',
          times:     parsed.times     || ['08:00'],
          notes:     '',
          source:    'manual',
        });
        setShowForm(true);
        Alert.alert(
          language === 'sw' ? '✅ Imetambuliwa' : '✅ Detected',
          language === 'sw'
            ? 'Maandishi ya dawa yametambuliwa. Tafadhali kagua na urekebishe.'
            : 'Prescription text detected. Please review and correct if needed.'
        );
      } else if (msg.type === 'error') {
        setScanning(false);
        Alert.alert('OCR Error', msg.message);
      }
    } catch (e) {
      setScanning(false);
    }
  }

  // ─── Save prescription ───────────────────────────────────────────────
  async function handleSave() {
    if (!form.drugName.trim()) {
      Alert.alert(
        language === 'sw' ? 'Kosa' : 'Error',
        language === 'sw' ? 'Tafadhali ingiza jina la dawa.' : 'Please enter the drug name.'
      );
      return;
    }

    const prescription = {
      id:        Date.now().toString(),
      ...form,
      createdAt: new Date().toISOString(),
      active:    true,
      notifIds:  [],
    };

    // Schedule a notification for each dose time
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
    await loadPrescriptions();

    setForm(INITIAL_FORM);
    setShowForm(false);
    Alert.alert(
      language === 'sw' ? '✅ Imehifadhiwa' : '✅ Saved',
      language === 'sw'
        ? `Dawa ya ${prescription.drugName} imehifadhiwa na vikumbusho vimewekwa.`
        : `${prescription.drugName} saved and reminders scheduled.`
    );
  }

  async function handleDelete(id, notifIds = []) {
    for (const { nid } of notifIds) {
      try { await cancelReminder(nid); } catch {}
    }
    await deletePrescription(id);
    await loadPrescriptions();
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {language === 'sw' ? '💊 Dawa · Prescriptions' : '💊 Prescriptions'}
          </Text>
          <Text style={styles.headerSub}>
            {language === 'sw' ? 'Skani au ingiza kwa mkono' : 'Scan or enter manually'}
          </Text>
        </View>

        {/* Language toggle */}
        <View style={styles.langRow}>
          {['sw', 'en'].map(l => (
            <TouchableOpacity
              key={l}
              style={[styles.langBtn, language === l && styles.langBtnActive]}
              onPress={() => setLanguage(l)}
            >
              <Text style={[styles.langBtnText, language === l && styles.langBtnTextActive]}>
                {l === 'sw' ? 'Kiswahili' : 'English'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Hidden WebView for OCR */}
        <WebView
          ref={webviewRef}
          style={{ width: 0, height: 0 }}
          source={{ html: OCR_WEBVIEW_HTML }}
          onMessage={handleWebViewMessage}
          javaScriptEnabled
          domStorageEnabled
        />

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

          {/* Scan buttons */}
          <View style={styles.scanRow}>
            <TouchableOpacity
              style={[styles.scanBtn, styles.scanBtnPrimary]}
              onPress={handlePhotoScan}
              disabled={scanning}
            >
              {scanning ? (
                <View style={{ alignItems: 'center' }}>
                  <ActivityIndicator color="#fff" />
                  <Text style={styles.scanBtnTextPrimary}>{ocrProgress}%</Text>
                </View>
              ) : (
                <>
                  <Text style={{ fontSize: 28 }}>📷</Text>
                  <Text style={styles.scanBtnTextPrimary}>
                    {language === 'sw' ? 'Piga Picha' : 'Take Photo'}
                  </Text>
                  <Text style={styles.scanBtnSub}>OCR auto-fill</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.scanBtn, styles.scanBtnOutline]}
              onPress={handleGalleryPick}
              disabled={scanning}
            >
              <Text style={{ fontSize: 28 }}>🖼️</Text>
              <Text style={styles.scanBtnTextOutline}>
                {language === 'sw' ? 'Chagua Picha' : 'Gallery'}
              </Text>
              <Text style={[styles.scanBtnSub, { color: COLORS.teal[400] }]}>from gallery</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => setShowForm(!showForm)} style={styles.manualToggle}>
            <Text style={styles.manualToggleText}>
              {showForm
                ? (language === 'sw' ? '▲ Ficha fomu' : '▲ Hide form')
                : (language === 'sw' ? '+ Ingiza kwa mkono' : '+ Enter manually')}
            </Text>
          </TouchableOpacity>

          {showForm && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                {language === 'sw' ? 'Maelezo ya Dawa' : 'Prescription Details'}
              </Text>

              <FormInput
                label={language === 'sw' ? 'Jina la dawa' : 'Drug name'}
                value={form.drugName}
                onChangeText={v => setForm(f => ({ ...f, drugName: v }))}
                placeholder="e.g. Metformin"
              />
              <FormInput
                label={language === 'sw' ? 'Kipimo (Dosage)' : 'Dosage'}
                value={form.dosage}
                onChangeText={v => setForm(f => ({ ...f, dosage: v }))}
                placeholder="e.g. 500mg"
              />
              <FormInput
                label={language === 'sw' ? 'Mzunguko (Frequency)' : 'Frequency'}
                value={form.frequency}
                onChangeText={v => setForm(f => ({ ...f, frequency: v }))}
                placeholder="e.g. Twice daily"
              />
              <FormInput
                label={language === 'sw' ? 'Nyakati (Times) — separate with comma' : 'Times'}
                value={form.times.join(', ')}
                onChangeText={v => setForm(f => ({ ...f, times: v.split(',').map(t => t.trim()) }))}
                placeholder="08:00, 20:00"
              />
              <FormInput
                label={language === 'sw' ? 'Maelezo zaidi (optional)' : 'Notes (optional)'}
                value={form.notes}
                onChangeText={v => setForm(f => ({ ...f, notes: v }))}
                placeholder={language === 'sw' ? 'e.g. Na chakula' : 'e.g. With food'}
              />

              {/* Doctor source toggle */}
              <View style={styles.sourceRow}>
                <Text style={styles.formLabel}>
                  {language === 'sw' ? 'Chanzo cha dawa' : 'Prescription source'}
                </Text>
                <View style={styles.sourceToggleRow}>
                  <TouchableOpacity
                    style={[styles.sourceBtn, form.source === 'manual' && styles.sourceBtnActive]}
                    onPress={() => setForm(f => ({ ...f, source: 'manual' }))}
                  >
                    <Text style={[styles.sourceBtnText, form.source === 'manual' && styles.sourceBtnTextActive]}>
                      {language === 'sw' ? '✍️ Mkono' : '✍️ Manual'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.sourceBtn, form.source === 'doctor' && styles.sourceBtnActive]}
                    onPress={() => setForm(f => ({ ...f, source: 'doctor' }))}
                  >
                    <Text style={[styles.sourceBtnText, form.source === 'doctor' && styles.sourceBtnTextActive]}>
                      {language === 'sw' ? '🩺 Daktari' : '🩺 Doctor'}
                    </Text>
                  </TouchableOpacity>
                </View>
                {form.source === 'doctor' && (
                  <Text style={styles.sourceHint}>
                    {language === 'sw'
                      ? 'Dawa imeingizwa kutoka kwa daktari. Hii itawekwa alama kwenye ripoti.'
                      : 'Prescription recorded from doctor. This will be marked in the report.'}
                  </Text>
                )}
              </View>

              <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveBtnText}>
                  {language === 'sw' ? '💾 Hifadhi Dawa' : '💾 Save Prescription'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Existing prescriptions */}
          {prescriptions.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                {language === 'sw' ? 'Dawa Zilizohifadhiwa' : 'Saved Prescriptions'}
              </Text>
              {prescriptions.map((p, i) => (
                <View key={p.id || i} style={styles.savedRow}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.medName}>{p.drugName} {p.dosage}</Text>
                      {p.source === 'doctor' && (
                        <Text style={styles.sourceBadge}>
                          {language === 'sw' ? '🩺 Daktari' : '🩺 Doctor'}
                        </Text>
                      )}
                    </View>
                    <Text style={styles.medSub}>{p.frequency} · {(p.times || []).join(', ')}</Text>
                    {p.notes ? <Text style={styles.medSub}>{p.notes}</Text> : null}
                  </View>
                  <TouchableOpacity
                    onPress={() => Alert.alert(
                      language === 'sw' ? 'Futa Dawa?' : 'Delete?',
                      language === 'sw'
                        ? `Je, unataka kufuta ${p.drugName}?`
                        : `Delete ${p.drugName}?`,
                      [
                        { text: language === 'sw' ? 'Hapana' : 'Cancel', style: 'cancel' },
                        { text: language === 'sw' ? 'Futa' : 'Delete', style: 'destructive',
                          onPress: () => handleDelete(p.id, p.notifIds) },
                      ]
                    )}
                  >
                    <Text style={{ fontSize: 18 }}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: COLORS.background },
  header:             { backgroundColor: COLORS.teal[600], padding: 16, paddingBottom: 18 },
  headerTitle:        { fontSize: 18, fontWeight: '600', color: '#fff' },
  headerSub:          { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },

  langRow:            {
    flexDirection: 'row', backgroundColor: '#fff',
    borderBottomWidth: 0.5, borderColor: '#e0e0e0',
  },
  langBtn:            { flex: 1, paddingVertical: 10, alignItems: 'center' },
  langBtnActive:      { borderBottomWidth: 2, borderBottomColor: COLORS.teal[400] },
  langBtnText:        { fontSize: 13, color: COLORS.text.secondary },
  langBtnTextActive:  { color: COLORS.teal[600], fontWeight: '600' },

  scroll:             { flex: 1 },
  scrollContent:      { padding: 12, paddingBottom: 40 },

  scanRow:            { flexDirection: 'row', gap: 10, marginBottom: 10 },
  scanBtn:            {
    flex: 1, borderRadius: RADIUS.lg, padding: 20,
    alignItems: 'center', gap: 4,
  },
  scanBtnPrimary:     { backgroundColor: COLORS.teal[600] },
  scanBtnOutline:     {
    backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.teal[100],
  },
  scanBtnTextPrimary: { color: '#fff', fontSize: 14, fontWeight: '600' },
  scanBtnTextOutline: { color: COLORS.teal[600], fontSize: 14, fontWeight: '600' },
  scanBtnSub:         { fontSize: 11, color: 'rgba(255,255,255,0.75)' },

  manualToggle:       { alignSelf: 'center', marginBottom: 10 },
  manualToggleText:   { fontSize: 13, color: COLORS.teal[600], fontWeight: '500' },

  card:               {
    backgroundColor: '#fff', borderRadius: RADIUS.lg,
    padding: 14, marginBottom: 12, ...SHADOW.sm,
  },
  cardTitle:          {
    fontSize: 11, fontWeight: '600', color: COLORS.text.secondary,
    textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 12,
  },

  formRow:            { marginBottom: 10 },
  formLabel:          { fontSize: 12, color: COLORS.text.secondary, marginBottom: 4 },
  formInput:          {
    borderWidth: 0.5, borderColor: '#ccc', borderRadius: RADIUS.md,
    padding: 10, fontSize: 14, color: COLORS.text.primary, backgroundColor: '#fff',
  },

  saveBtn:            {
    backgroundColor: COLORS.teal[600], borderRadius: RADIUS.md,
    padding: 12, alignItems: 'center', marginTop: 4,
  },
  saveBtnText:        { color: '#fff', fontSize: 15, fontWeight: '600' },

  sourceRow:          { marginBottom: 12 },
  sourceToggleRow:    { flexDirection: 'row', gap: 8, marginTop: 4 },
  sourceBtn:          {
    flex: 1, paddingVertical: 10, alignItems: 'center',
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: '#ccc',
    backgroundColor: '#fff',
  },
  sourceBtnActive:    { borderColor: COLORS.teal[400], backgroundColor: COLORS.teal[50] },
  sourceBtnText:      { fontSize: 13, color: COLORS.text.secondary },
  sourceBtnTextActive:{ color: COLORS.teal[600], fontWeight: '600' },
  sourceHint:         { fontSize: 11, color: COLORS.text.secondary, marginTop: 4, fontStyle: 'italic' },

  savedRow:           {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#e8e8e8',
  },
  medName:            { fontSize: 14, fontWeight: '500', color: COLORS.text.primary },
  medSub:             { fontSize: 12, color: COLORS.text.secondary, marginTop: 1 },
  sourceBadge:        { fontSize: 11, fontWeight: '600', color: COLORS.teal[600], backgroundColor: COLORS.teal[50], borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' },
});
