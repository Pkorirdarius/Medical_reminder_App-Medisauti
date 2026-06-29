import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { RADIUS, SHADOW, FONT } from '../utils/constants';
import { getUser, saveUser, clearAllData } from '../utils/storage';
import { cancelAllReminders } from '../utils/reminders';
import { useLanguage } from '../utils/LanguageContext';
import { useTheme } from '../utils/ThemeContext';

export default function ProfileScreen({ onLogout }) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { language, toggleLanguage, t } = useLanguage();
  const { COLORS } = useTheme();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [condition, setCondition] = useState('');
  const [avatarUri, setAvatarUri] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const styles = useMemo(() => getStyles(COLORS), [COLORS]);

  useFocusEffect(useCallback(() => {
    loadProfile();
  }, []));

  async function loadProfile() {
    try {
      const u = await getUser();
      if (u) {
        setName(u.name || '');
        setPhone(u.phone || '');
        setAge(u.age ? String(u.age) : '');
        setCondition(u.condition || '');
        setAvatarUri(u.avatar || null);
      }
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
        age: parseInt(age.trim(), 10) || 0,
        condition: condition.trim(),
        avatar: avatarUri,
      });
      Alert.alert(t('saved'), t('saved_profile'));
      navigation.goBack();
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
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
                <ProfileField label={t('label_age')} value={age} onChangeText={setAge} placeholder={t('placeholder_age')} keyboardType="number-pad" containerStyle={styles.fieldGroup} labelStyle={styles.fieldLabel} inputStyle={styles.fieldInput} placeholderColor={COLORS.outline} />
                <ProfileField label={t('label_condition')} value={condition} onChangeText={setCondition} placeholder={t('placeholder_condition')} multiline containerStyle={styles.fieldGroup} labelStyle={styles.fieldLabel} inputStyle={styles.fieldInput} placeholderColor={COLORS.outline} />

                <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.saveBtnText}>{t('btn_save_changes')}</Text>
                  )}
                </TouchableOpacity>
              </View>

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
  });
}
