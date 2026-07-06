import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Image, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { RADIUS, SHADOW, FONT } from '../utils/constants';
import { getUser, saveUser, clearAllData } from '../utils/storage';
import { isConfigured as sbConfigured, updateUserPassword as sbUpdatePin } from '../utils/supabase';
import { cancelAllReminders, requestNotificationPermission, getNotificationPermissionStatus, sendTestNotification, saveNotificationSound, getNotificationSound, SOUND_OPTIONS, speakReminder } from '../utils/reminders';
import { useLanguage } from '../utils/LanguageContext';
import { useTheme } from '../utils/ThemeContext';

export default function ProfileScreen({ onLogout }) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { language, toggleLanguage, t } = useLanguage();
  const { COLORS, isDark, toggleTheme } = useTheme();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [condition, setCondition] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [role, setRole] = useState('patient');
  const [avatarUri, setAvatarUri] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notifPermission, setNotifPermission] = useState('undetermined');
  const [notifSound, setNotifSound] = useState('default');
  const [testingNotif, setTestingNotif] = useState(false);
  const [showSoundPicker, setShowSoundPicker] = useState(false);
  const styles = useMemo(() => getStyles(COLORS), [COLORS]);

  useFocusEffect(useCallback(() => {
    loadProfile();
  }, []));

  async function loadProfile() {
    try {
      const [u, permStatus, sound] = await Promise.all([
        getUser(),
        getNotificationPermissionStatus(),
        getNotificationSound(),
      ]);
      if (u) {
        setName(u.name || '');
        setPhone(u.phone || '');
        setAge(u.age ? String(u.age) : '');
        setCondition(u.condition || '');
        setSpecialization(u.specialization || '');
        setRole(u.role || 'patient');
        setAvatarUri(u.avatar || null);
      }
      setNotifPermission(permStatus);
      setNotifSound(sound);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function handlePickAvatar() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('permission_title'), t('permission_desc'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled) {
      setAvatarUri(result.assets[0].uri);
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert(t('error'), t('error_name_required'));
      return;
    }
    setSaving(true);
    try {
      const existing = await getUser();
      await saveUser({
        ...existing,
        name: name.trim(),
        phone: phone.trim(),
        age: role === 'doctor' ? 0 : (parseInt(age.trim(), 10) || 0),
        condition: role === 'doctor' ? '' : condition.trim(),
        specialization: role === 'doctor' ? specialization.trim() : '',
        role,
        avatar: avatarUri,
      });
      Alert.alert(t('saved'), t('saved_profile'));
      navigation.goBack();
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  }

  async function handleRequestNotifPermission() {
    const granted = await requestNotificationPermission();
    if (granted) {
      setNotifPermission('granted');
      Alert.alert(t('success'), t('notif_permission_granted'));
    } else {
      setNotifPermission('denied');
      Alert.alert(t('notif_permission_title'), t('notif_permission_denied'));
    }
  }

  async function handleTestNotification() {
    setTestingNotif(true);
    try {
      const perm = await getNotificationPermissionStatus();
      if (perm !== 'granted') {
        Alert.alert(t('notif_permission_title'), t('notif_permission_denied'));
        return;
      }
      await sendTestNotification(language, 'Paracetamol', '500mg');
      Alert.alert(t('test_notif_sent_title'), t('test_notif_sent_body'));
    } catch (e) {
      Alert.alert(t('error'), e.message);
    } finally {
      setTestingNotif(false);
    }
  }

  async function handleSoundSelect(soundKey) {
    setNotifSound(soundKey);
    setShowSoundPicker(false);
    await saveNotificationSound(soundKey);
  }

  function handleLogout() {
    Alert.alert(t('logout_confirm_title'), t('logout_confirm_body'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('btn_logout'), style: 'destructive',
        onPress: async () => {
          await cancelAllReminders();
          await clearAllData();
          if (onLogout) {
            onLogout();
          } else {
            navigation.reset({ index: 0, routes: [{ name: 'Landing' }] });
          }
        },
      },
    ]);
  }

  const avatarLetters = (name || 'U').slice(0, 2).toUpperCase();

  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.onSurface} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('header_profile')}</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {loading ? (
            <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 60 }} />
          ) : (
            <>
              {/* ── Avatar ── */}
              <View style={styles.avatarSection}>
                <TouchableOpacity onPress={handlePickAvatar} style={styles.avatarWrap}>
                  {avatarUri ? (
                    <View style={styles.avatarImageWrap}>
                      <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                    </View>
                  ) : (
                    <View style={styles.avatarCircle}>
                      <Text style={styles.avatarLetters}>{avatarLetters}</Text>
                    </View>
                  )}
                  <View style={styles.avatarBadge}>
                    <MaterialCommunityIcons name="camera" size={14} color="#fff" />
                  </View>
                </TouchableOpacity>
                <Text style={styles.avatarHint}>{avatarUri ? t('change_photo') : t('tap_change_photo')}</Text>
              </View>

              {/* ── Form ── */}
              <View style={styles.formCard}>
                <ProfileField label={t('label_name')} value={name} onChangeText={setName} placeholder={t('placeholder_name')} containerStyle={styles.fieldGroup} labelStyle={styles.fieldLabel} inputStyle={styles.fieldInput} placeholderColor={COLORS.outline} />
                <ProfileField label={t('label_phone')} value={phone} onChangeText={setPhone} placeholder={t('placeholder_phone')} keyboardType="phone-pad" containerStyle={styles.fieldGroup} labelStyle={styles.fieldLabel} inputStyle={styles.fieldInput} placeholderColor={COLORS.outline} />
                <View style={[styles.fieldGroup, { flexDirection: 'row', gap: 8 }]}>
                  <View style={{ flex: 1, gap: 6 }}>
                    <Text style={styles.fieldLabel}>{t('label_role')}</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity style={[styles.roleOpt, role === 'patient' && styles.roleOptActive]} onPress={() => setRole('patient')}>
                        <Text style={[styles.roleOptText, role === 'patient' && styles.roleOptTextActive]}>{t('role_patient')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.roleOpt, role === 'doctor' && styles.roleOptActive]} onPress={() => setRole('doctor')}>
                        <Text style={[styles.roleOptText, role === 'doctor' && styles.roleOptTextActive]}>{t('role_doctor')}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
                {role === 'doctor' ? (
                  <ProfileField label={t('label_specialization')} value={specialization} onChangeText={setSpecialization} placeholder={t('placeholder_specialization')} containerStyle={styles.fieldGroup} labelStyle={styles.fieldLabel} inputStyle={styles.fieldInput} placeholderColor={COLORS.outline} />
                ) : (
                  <>
                    <ProfileField label={t('label_age')} value={age} onChangeText={setAge} placeholder={t('placeholder_age')} keyboardType="number-pad" containerStyle={styles.fieldGroup} labelStyle={styles.fieldLabel} inputStyle={styles.fieldInput} placeholderColor={COLORS.outline} />
                    <ProfileField label={t('label_condition')} value={condition} onChangeText={setCondition} placeholder={t('placeholder_condition')} multiline containerStyle={styles.fieldGroup} labelStyle={styles.fieldLabel} inputStyle={styles.fieldInput} placeholderColor={COLORS.outline} />
                  </>
                )}

                <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.saveBtnText}>{t('btn_save_changes')}</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* ── Appearance & Language ── */}
              <View style={[styles.formCard, { marginTop: 8 }]}>
                <TouchableOpacity
                  style={styles.toggleRow}
                  onPress={toggleTheme}
                  activeOpacity={0.6}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <MaterialCommunityIcons
                      name={isDark ? 'weather-night' : 'weather-sunny'}
                      size={22}
                      color={isDark ? COLORS.amber[400] : COLORS.warning}
                    />
                    <View>
                      <Text style={styles.toggleLabel}>{t(isDark ? 'dark_mode' : 'light_mode')}</Text>
                      <Text style={styles.toggleHint}>{t('appearance')}</Text>
                    </View>
                  </View>
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={20}
                    color={COLORS.outline}
                  />
                </TouchableOpacity>
                <View style={[styles.divider, { backgroundColor: COLORS.surfaceHigh }]} />
                <TouchableOpacity
                  style={styles.toggleRow}
                  onPress={toggleLanguage}
                  activeOpacity={0.6}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <MaterialCommunityIcons
                      name="translate"
                      size={22}
                      color={COLORS.primary}
                    />
                    <View>
                      <Text style={styles.toggleLabel}>{t('language')}</Text>
                      <Text style={styles.toggleHint}>{t(language === 'sw' ? 'swahili' : 'english')}</Text>
                    </View>
                  </View>
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={20}
                    color={COLORS.outline}
                  />
                </TouchableOpacity>
              </View>

              {/* ── Notifications ── */}
              <View style={[styles.formCard, { marginTop: 8 }]}>
                <Text style={[styles.fieldLabel, { marginBottom: 4 }]}>{t('notif_settings')}</Text>

                {/* Permission */}
                <View style={styles.toggleRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                    <MaterialCommunityIcons
                      name={notifPermission === 'granted' ? 'bell-ring' : 'bell-off-outline'}
                      size={22}
                      color={notifPermission === 'granted' ? COLORS.primary : COLORS.outline}
                    />
                    <View>
                      <Text style={styles.toggleLabel}>{t('notif_permission')}</Text>
                      <Text style={styles.toggleHint}>
                        {notifPermission === 'granted' ? t('notif_permission_granted') : notifPermission === 'denied' ? t('notif_permission_denied') : t('notif_permission_request')}
                      </Text>
                    </View>
                  </View>
                  {notifPermission !== 'granted' && (
                    <TouchableOpacity style={[styles.smallBtn, { backgroundColor: COLORS.primary }]} onPress={handleRequestNotifPermission}>
                      <Text style={styles.smallBtnText}>{t('enable')}</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={[styles.divider, { backgroundColor: COLORS.surfaceHigh }]} />

                {/* Sound */}
                <TouchableOpacity style={styles.toggleRow} onPress={() => setShowSoundPicker(true)} activeOpacity={0.6}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                    <MaterialCommunityIcons name="volume-high" size={22} color={COLORS.primary} />
                    <View>
                      <Text style={styles.toggleLabel}>{t('notif_sound')}</Text>
                      <Text style={styles.toggleHint}>
                        {SOUND_OPTIONS.find(s => s.key === notifSound)?.[language === 'sw' ? 'sw' : 'en'] || 'Default'}
                      </Text>
                    </View>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.outline} />
                </TouchableOpacity>

                <View style={[styles.divider, { backgroundColor: COLORS.surfaceHigh }]} />

                {/* Test */}
                <TouchableOpacity style={styles.toggleRow} onPress={handleTestNotification} disabled={testingNotif} activeOpacity={0.6}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                    <MaterialCommunityIcons name="volume-high" size={22} color={COLORS.warning} />
                    <View>
                      <Text style={styles.toggleLabel}>{t('test_notif')}</Text>
                      <Text style={styles.toggleHint}>{t('test_notif_desc')}</Text>
                    </View>
                  </View>
                  {testingNotif ? (
                    <ActivityIndicator size="small" color={COLORS.primary} />
                  ) : (
                    <MaterialCommunityIcons name="play-circle" size={28} color={COLORS.primary} />
                  )}
                </TouchableOpacity>
              </View>

              {/* ── Sound Picker Modal ── */}
              <Modal visible={showSoundPicker} animationType="fade" transparent>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowSoundPicker(false)}>
                  <View style={styles.soundPickerCard}>
                    <Text style={styles.soundPickerTitle}>{t('notif_sound')}</Text>
                    {SOUND_OPTIONS.map(opt => {
                      const active = notifSound === opt.key;
                      return (
                        <TouchableOpacity key={opt.key} style={[styles.soundPickerRow, active && styles.soundPickerRowActive]} onPress={() => handleSoundSelect(opt.key)}>
                          <MaterialCommunityIcons
                            name={active ? 'radiobox-marked' : 'radiobox-blank'}
                            size={20}
                            color={active ? COLORS.primary : COLORS.outline}
                          />
                          <Text style={[styles.soundPickerLabel, active && { color: COLORS.primary, fontFamily: FONT.bodySemiBold }]}>
                            {opt[language === 'sw' ? 'sw' : 'en']}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                    <TouchableOpacity style={styles.soundPickerDone} onPress={() => setShowSoundPicker(false)}>
                      <Text style={styles.soundPickerDoneText}>{t('done')}</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              </Modal>

              {/* ── Logout ── */}
              <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
                <MaterialCommunityIcons name="logout" size={20} color={COLORS.red[400]} />
                <Text style={styles.logoutText}>{t('btn_logout')}</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

function ProfileField({ label, value, onChangeText, placeholder, keyboardType, multiline, containerStyle, labelStyle, inputStyle, placeholderColor }) {
  return (
    <View style={containerStyle}>
      <Text style={labelStyle}>{label}</Text>
      <TextInput
        style={[inputStyle, multiline && { minHeight: 72, paddingTop: 10 }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={placeholderColor}
        keyboardType={keyboardType}
        multiline={multiline}
      />
    </View>
  );
}

function getStyles(C) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: C.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 0,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 6,
      elevation: 1,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: RADIUS.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 18,
      fontFamily: FONT.headline,
      color: C.onSurface,
      letterSpacing: -0.3,
    },
    scrollContent: {
      paddingHorizontal: 16,
      paddingBottom: 40,
    },
    avatarSection: {
      alignItems: 'center',
      marginTop: 24,
      marginBottom: 28,
    },
    avatarWrap: {
      position: 'relative',
    },
    avatarCircle: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: C.primaryContainer,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 3,
      borderColor: C.primary + '20',
    },
    avatarLetters: {
      fontSize: 30,
      fontFamily: FONT.headline,
      color: '#fff',
    },
    avatarImageWrap: {
      width: 88,
      height: 88,
      borderRadius: 44,
      overflow: 'hidden',
    },
    avatarImage: {
      width: '100%',
      height: '100%',
    },
    avatarBadge: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: C.primary,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: C.background,
    },
    avatarHint: {
      fontSize: 12,
      fontFamily: FONT.body,
      color: C.onSurfaceVariant,
      marginTop: 8,
    },
    formCard: {
      backgroundColor: C.surfaceLowest,
      borderRadius: RADIUS.xl,
      padding: 20,
      gap: 16,
      ...SHADOW.sm,
    },
    fieldGroup: {
      gap: 6,
    },
    fieldLabel: {
      fontSize: 12,
      fontFamily: FONT.bodySemiBold,
      color: C.onSurfaceVariant,
      letterSpacing: 0.3,
      textTransform: 'uppercase',
    },
    fieldInput: {
      backgroundColor: C.surfaceLow,
      borderRadius: RADIUS.md,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      fontFamily: FONT.body,
      color: C.onSurface,
      borderWidth: 1,
      borderColor: C.outline + '20',
    },
    saveBtn: {
      backgroundColor: C.primary,
      borderRadius: RADIUS.md,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
    },
    saveBtnText: {
      fontSize: 16,
      fontFamily: FONT.bold,
      color: '#fff',
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 6,
    },
    toggleLabel: {
      fontSize: 15,
      fontFamily: FONT.bodySemiBold,
      color: C.onSurface,
    },
    toggleHint: {
      fontSize: 12,
      fontFamily: FONT.body,
      color: C.outline,
      marginTop: 1,
    },
    divider: {
      height: 1,
      marginVertical: 6,
    },
    logoutBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 24,
      paddingVertical: 14,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: C.red[100],
      backgroundColor: C.red[50],
    },
    logoutText: {
      fontSize: 15,
      fontFamily: FONT.bodySemiBold,
      color: C.red[400],
    },

    smallBtn: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: RADIUS.md,
    },
    smallBtnText: {
      fontSize: 12,
      fontFamily: FONT.bodySemiBold,
      color: '#fff',
    },

    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    soundPickerCard: {
      backgroundColor: C.surfaceLowest,
      borderRadius: RADIUS.xl,
      padding: 24,
      width: '80%',
      maxWidth: 320,
      gap: 4,
    },
    soundPickerTitle: {
      fontSize: 16,
      fontFamily: FONT.bold,
      color: C.onSurface,
      marginBottom: 12,
    },
    soundPickerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 8,
      borderRadius: RADIUS.md,
    },
    soundPickerRowActive: {
      backgroundColor: C.primary + '12',
    },
    soundPickerLabel: {
      fontSize: 15,
      fontFamily: FONT.body,
      color: C.onSurface,
    },
    soundPickerDone: {
      marginTop: 12,
      alignItems: 'center',
      paddingVertical: 12,
      backgroundColor: C.primary,
      borderRadius: RADIUS.md,
    },
    soundPickerDoneText: {
      fontSize: 15,
      fontFamily: FONT.bodySemiBold,
      color: '#fff',
    },

    roleOpt: {
      flex: 1, paddingVertical: 10, borderRadius: RADIUS.md,
      alignItems: 'center', backgroundColor: C.surfaceLow,
      borderWidth: 1, borderColor: C.surfaceHigh,
    },
    roleOptActive:    { backgroundColor: C.primary, borderColor: C.primary },
    roleOptText:      { fontSize: 12, fontFamily: FONT.bodySemiBold, color: C.onSurfaceVariant },
    roleOptTextActive:{ color: '#fff' },
  });
}
