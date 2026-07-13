import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { RADIUS, FONT } from '../utils/constants';
import { useTheme } from '../utils/ThemeContext';
import { useLanguage } from '../utils/LanguageContext';
import { getUser, savePrescription, saveSchedule, getPrescriptions } from '../utils/storage';
import { requestNotificationPermission } from '../utils/reminders';

export default function PrescriptionScheduleScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { COLORS } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => getStyles(COLORS), [COLORS]);

  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const [drugName, setDrugName] = useState('');
  const [dosage, setDosage] = useState('');
  const [dosageQuantity, setDosageQuantity] = useState('');
  const [dosageForm, setDosageForm] = useState('tablet');
  const [frequency, setFrequency] = useState('Mara moja kwa siku');
  const [times, setTimes] = useState(['08:00']);
  const [durationValue, setDurationValue] = useState('7');
  const [durationUnit, setDurationUnit] = useState('days');
  const [notes, setNotes] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));

  const dosageForms = [
    { key: 'tablet', icon: 'pill' },
    { key: 'capsule', icon: 'pill' },
    { key: 'injection', icon: 'needle' },
    { key: 'syrup', icon: 'bottle-tonic-plus' },
    { key: 'drops', icon: 'water' },
    { key: 'inhaler', icon: 'weather-windy' },
    { key: 'cream', icon: 'creation' },
    { key: 'ointment', icon: 'creation' },
    { key: 'suppository', icon: 'circle-outline' },
    { key: 'patch', icon: 'bandage' },
  ];

  useFocusEffect(useCallback(() => {
    loadPatient();
  }, []));

  async function loadPatient() {
    try {
      const u = await getUser();
      setPatient(u);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  function resetForm() {
    setDrugName('');
    setDosage('');
    setDosageQuantity('');
    setDosageForm('tablet');
    setFrequency('Mara moja kwa siku');
    setTimes(['08:00']);
    setDurationValue('7');
    setDurationUnit('days');
    setNotes('');
    setStartDate(new Date().toISOString().slice(0, 10));
    setSuccess(false);
  }

  async function handleIssue() {
    if (!drugName.trim() || !dosage.trim()) {
      Alert.alert(t('error'), t('validation_error'));
      return;
    }
    const notifGranted = await requestNotificationPermission();
    if (!notifGranted) {
      Alert.alert(t('notif_permission_title'), t('notif_permission_denied'));
      return;
    }
    setSaving(true);
    try {
      const now = new Date().toISOString();

      const prescription = {
        id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
        drugName: drugName.trim(),
        dosage: dosage.trim(),
        dosageQuantity: dosageQuantity.trim(),
        dosageForm,
        frequency,
        times: times.map(t => t.trim()),
        notes: notes.trim(),
        source: 'doctor',
        voiceNotif: true,
        createdAt: now,
        active: true,
        notifIds: [],
        durationValue: parseInt(durationValue, 10) || 7,
        durationUnit,
        startDate,
        issuedBy: patient?.name || 'Doctor',
        scheduled: true,
      };

      await savePrescription(prescription);

      const schedule = {
        id: prescription.id,
        patientName: patient?.name || 'Patient',
        drugName: prescription.drugName,
        dosage: prescription.dosage,
        dosageQuantity: prescription.dosageQuantity,
        dosageForm: prescription.dosageForm,
        frequency: prescription.frequency,
        times: prescription.times,
        durationValue: prescription.durationValue,
        durationUnit: prescription.durationUnit,
        startDate,
        notes: prescription.notes,
        issuedAt: now,
      };
      await saveSchedule(schedule);

      setSuccess(true);
      Alert.alert(t('saved_success_title'), t('schedule_sent'));
    } catch (e) { Alert.alert(t('error'), e.message); }
    finally { setSaving(false); }
  }

  const freqOptions = [
    { key: 'once', label: t('freq_once'), times: ['08:00'] },
    { key: 'twice', label: t('freq_twice'), times: ['08:00', '20:00'] },
    { key: 'thrice', label: t('freq_thrice'), times: ['08:00', '14:00', '20:00'] },
  ];

  const timePeriods = [
    { key: 'asubuhi', label: t('time_morning'), icon: 'weather-sunset-up', time: '08:00' },
    { key: 'mchana', label: t('time_afternoon'), icon: 'weather-sunny', time: '14:00' },
    { key: 'jioni', label: t('time_evening'), icon: 'weather-sunset-down', time: '20:00' },
    { key: 'usiku', label: t('time_night'), icon: 'weather-night', time: '22:00' },
  ];

  if (loading) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!patient || patient.role !== 'doctor') {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.onSurface} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('header_schedule')}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
          <MaterialCommunityIcons name="account-lock" size={56} color={COLORS.outline} />
          <Text style={{ fontSize: 16, fontFamily: FONT.bodySemiBold, color: COLORS.onSurface, marginTop: 16, textAlign: 'center' }}>
            {t('schedule_no_patient')}
          </Text>
        </View>
      </View>
    );
  }

  if (success) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.onSurface} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('header_schedule')}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
          <View style={[styles.successIcon]}>
            <MaterialCommunityIcons name="check-circle" size={72} color={COLORS.goal[500]} />
          </View>
          <Text style={styles.successTitle}>{t('schedule_sent')}</Text>
          <Text style={styles.successSub}>{drugName} {dosage}</Text>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
            <TouchableOpacity style={[styles.issueBtn, { flex: 1 }]} onPress={resetForm} activeOpacity={0.7}>
              <MaterialCommunityIcons name="plus" size={20} color="#fff" />
              <Text style={styles.issueBtnText}>{t('schedule_issue_another')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.issueBtn, { flex: 1, backgroundColor: COLORS.surfaceLow }]} onPress={() => navigation.goBack()} activeOpacity={0.7}>
              <MaterialCommunityIcons name="arrow-left" size={20} color={COLORS.onSurface} />
              <Text style={[styles.issueBtnText, { color: COLORS.onSurface }]}>{t('cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.onSurface} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('header_schedule')}</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Patient Info */}
          <View style={styles.patientCard}>
            <View style={styles.patientAvatar}>
              <Text style={styles.patientAvatarText}>{(patient?.name || 'D').slice(0, 2).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.patientName}>{patient?.name}</Text>
              <Text style={styles.patientMeta}>{t('role_doctor')} — {patient?.specialization || ''}</Text>
            </View>
          </View>

          <Text style={styles.formTitle}>{t('schedule_title')}</Text>
          <Text style={styles.formSub}>{t('schedule_sub')}</Text>

          {/* Drug Name */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{t('label_drug_name')}</Text>
            <TextInput
              style={styles.fieldInput}
              value={drugName}
              onChangeText={setDrugName}
              placeholder={t('placeholder_drug_name')}
              placeholderTextColor={COLORS.outline}
            />
          </View>

          {/* Dosage */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{t('label_dosage')}</Text>
            <TextInput
              style={styles.fieldInput}
              value={dosage}
              onChangeText={setDosage}
              placeholder={t('placeholder_dosage')}
              placeholderTextColor={COLORS.outline}
            />
          </View>

          {/* Dosage Quantity */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{t('label_dosage_quantity')}</Text>
            <TextInput
              style={styles.fieldInput}
              value={dosageQuantity}
              onChangeText={setDosageQuantity}
              placeholder={t('placeholder_dosage_qty')}
              placeholderTextColor={COLORS.outline}
              keyboardType="number-pad"
            />
          </View>

          {/* Dosage Form */}
          <Text style={styles.fieldLabel}>{t('label_dosage_form')}</Text>
          <View style={styles.dosageFormRow}>
            {dosageForms.map(df => {
              const active = dosageForm === df.key;
              return (
                <TouchableOpacity
                  key={df.key}
                  style={[styles.dosageFormBtn, active && styles.dosageFormBtnActive]}
                  onPress={() => setDosageForm(df.key)}
                >
                  <MaterialCommunityIcons name={df.icon} size={14} color={active ? '#fff' : COLORS.outline} />
                  <Text style={[styles.dosageFormText, active && styles.dosageFormTextActive]}>{t('form_' + df.key)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Frequency Presets */}
          <Text style={styles.fieldLabel}>{t('frequency_presets')}</Text>
          <View style={styles.freqRow}>
            {freqOptions.map(opt => {
              const active = times.length === opt.times.length &&
                times.every((t, i) => t === opt.times[i]);
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.freqBtn, active && styles.freqBtnActive]}
                  onPress={() => { setTimes([...opt.times]); setFrequency(opt.label); }}
                >
                  <Text style={[styles.freqBtnText, active && styles.freqBtnTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Time Periods */}
          <Text style={[styles.fieldLabel, { marginTop: 8 }]}>{t('select_times')}</Text>
          <View style={styles.timeRow}>
            {timePeriods.map(period => {
              const hasTime = times.includes(period.time);
              return (
                <TouchableOpacity
                  key={period.key}
                  style={[styles.timePill, hasTime && styles.timePillActive]}
                  onPress={() => {
                    if (hasTime) {
                      setTimes(prev => prev.filter(t => t !== period.time));
                    } else {
                      setTimes(prev => [...prev, period.time].sort());
                    }
                  }}
                >
                  <MaterialCommunityIcons name={period.icon} size={16} color={hasTime ? '#fff' : COLORS.outline} />
                  <Text style={[styles.timePillLabel, hasTime && styles.timePillLabelActive]}>{period.label}</Text>
                  <Text style={[styles.timePillVal, hasTime && styles.timePillValActive]}>{period.time}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Duration */}
          <Text style={styles.fieldLabel}>{t('schedule_duration_label')}</Text>
          <View style={styles.durationRow}>
            <TextInput
              style={[styles.fieldInput, { flex: 1 }]}
              value={durationValue}
              onChangeText={v => setDurationValue(v.replace(/\D/g, ''))}
              placeholder={t('placeholder_duration')}
              placeholderTextColor={COLORS.outline}
              keyboardType="number-pad"
            />
            <View style={styles.durationUnitRow}>
              {['days', 'weeks', 'months'].map(unit => (
                <TouchableOpacity
                  key={unit}
                  style={[styles.durationUnitBtn, durationUnit === unit && styles.durationUnitBtnActive]}
                  onPress={() => setDurationUnit(unit)}
                >
                  <Text style={[styles.durationUnitText, durationUnit === unit && styles.durationUnitTextActive]}>
                    {t('duration_' + unit)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Start Date */}
          <Text style={styles.fieldLabel}>{t('schedule_start_label')}</Text>
          <TouchableOpacity
            style={styles.dateBtn}
            onPress={() => {
              const today = new Date().toISOString().slice(0, 10);
              Alert.alert(
                t('schedule_start_label'),
                `${t('schedule_from_today')}: ${today}`,
                [
                  { text: t('schedule_from_today'), onPress: () => setStartDate(today) },
                  { text: t('cancel'), style: 'cancel' },
                ]
              );
            }}
          >
            <MaterialCommunityIcons name="calendar" size={20} color={COLORS.primary} />
            <Text style={styles.dateBtnText}>{startDate}</Text>
          </TouchableOpacity>

          {/* Notes */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{t('schedule_notes_doctor')}</Text>
            <TextInput
              style={[styles.fieldInput, { minHeight: 72, paddingTop: 10 }]}
              value={notes}
              onChangeText={setNotes}
              placeholder={t('placeholder_notes')}
              placeholderTextColor={COLORS.outline}
              multiline
            />
          </View>

          {/* Issue Button */}
          <TouchableOpacity style={styles.issueBtn} onPress={handleIssue} disabled={saving} activeOpacity={0.7}>
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <MaterialCommunityIcons name="prescription" size={22} color="#fff" />
                <Text style={styles.issueBtnText}>{t('schedule_btn_issue')}</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: 60 }} />
        </ScrollView>
      </View>
    </View>
  );
}

function getStyles(C) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: C.background },
    header: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingHorizontal: 16, paddingVertical: 14,
      backgroundColor: C.background,
      shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 2,
      zIndex: 10,
    },
    backBtn: { width: 40, height: 40, borderRadius: 100, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontFamily: FONT.headline, color: C.onSurface, letterSpacing: -0.5, flex: 1 },

    scrollContent: { padding: 16, gap: 16, paddingBottom: 40 },

    patientCard: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: C.surfaceLowest, borderRadius: 16, padding: 14,
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
    },
    patientAvatar: { width: 44, height: 44, borderRadius: 12, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
    patientAvatarText: { fontSize: 16, fontFamily: FONT.bodyBold, color: '#fff' },
    patientName: { fontSize: 15, fontFamily: FONT.bodySemiBold, color: C.onSurface },
    patientMeta: { fontSize: 11, fontFamily: FONT.body, color: C.outline, marginTop: 2 },

    formTitle: { fontSize: 18, fontFamily: FONT.bold, color: C.onSurface, marginTop: 4 },
    formSub: { fontSize: 13, fontFamily: FONT.body, color: C.onSurfaceVariant, marginTop: 2, lineHeight: 18 },

    fieldGroup: { gap: 6 },
    fieldLabel: { fontSize: 12, fontFamily: FONT.bodySemiBold, color: C.onSurfaceVariant, letterSpacing: 0.3 },
    fieldInput: {
      backgroundColor: C.surfaceLow, borderRadius: 8,
      paddingHorizontal: 14, paddingVertical: 12,
      fontSize: 15, fontFamily: FONT.body, color: C.onSurface,
      borderWidth: 1, borderColor: C.surfaceHigh,
    },

    freqRow: { flexDirection: 'row', gap: 8 },
    freqBtn: {
      flex: 1, paddingVertical: 10, borderRadius: 8,
      backgroundColor: C.surfaceLow, alignItems: 'center',
      borderWidth: 1, borderColor: C.surfaceHigh,
    },
    freqBtnActive: { backgroundColor: C.primary, borderColor: C.primary },
    freqBtnText: { fontSize: 12, fontFamily: FONT.bodySemiBold, color: C.onSurfaceVariant, textAlign: 'center' },
    freqBtnTextActive: { color: '#fff' },

    /* Dosage Form */
    dosageFormRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    dosageFormBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, backgroundColor: C.surfaceLow, borderWidth: 1, borderColor: C.surfaceHigh },
    dosageFormBtnActive: { backgroundColor: C.primary, borderColor: C.primary },
    dosageFormText: { fontSize: 11, fontFamily: FONT.bodySemiBold, color: C.onSurfaceVariant },
    dosageFormTextActive: { color: '#fff' },

    timeRow: { flexDirection: 'row', gap: 8 },
    timePill: {
      flex: 1, paddingVertical: 10, borderRadius: 8,
      backgroundColor: C.surfaceLow, alignItems: 'center', gap: 2,
      borderWidth: 1, borderColor: C.surfaceHigh,
    },
    timePillActive: { backgroundColor: C.primary, borderColor: C.primary },
    timePillLabel: { fontSize: 10, fontFamily: FONT.body, color: C.outline },
    timePillLabelActive: { color: '#fff' },
    timePillVal: { fontSize: 11, fontFamily: FONT.bodySemiBold, color: C.onSurfaceVariant },
    timePillValActive: { color: '#fff', opacity: 0.85 },

    durationRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    durationUnitRow: { flexDirection: 'row', gap: 4 },
    durationUnitBtn: {
      paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
      backgroundColor: C.surfaceLow, borderWidth: 1, borderColor: C.surfaceHigh,
    },
    durationUnitBtnActive: { backgroundColor: C.primary, borderColor: C.primary },
    durationUnitText: { fontSize: 12, fontFamily: FONT.body, color: C.onSurfaceVariant },
    durationUnitTextActive: { color: '#fff', fontFamily: FONT.bodySemiBold },

    dateBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingHorizontal: 14, paddingVertical: 12,
      backgroundColor: C.surfaceLow, borderRadius: 8,
      borderWidth: 1, borderColor: C.surfaceHigh,
    },
    dateBtnText: { fontSize: 15, fontFamily: FONT.body, color: C.onSurface, flex: 1 },

    issueBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: C.primary, borderRadius: 16, paddingVertical: 14,
      shadowColor: C.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
    },
    issueBtnText: { fontSize: 15, fontFamily: FONT.bodySemiBold, color: '#fff' },

    successIcon: { marginBottom: 16 },
    successTitle: { fontSize: 20, fontFamily: FONT.bold, color: C.onSurface, textAlign: 'center' },
    successSub: { fontSize: 14, fontFamily: FONT.body, color: C.onSurfaceVariant, marginTop: 8, textAlign: 'center' },
  });
}
