import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Alert, ActivityIndicator, ScrollView,
  Platform, Animated,
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { RADIUS, FONT } from '../utils/constants';
import { saveUser, getUser, getIsRegistered, addConditionPrescriptions, saveDoctorProfile, getDoctors } from '../utils/storage';
import { isConfigured as sbConfigured, registerUser as sbRegister, loginUser as sbLogin } from '../utils/supabase';
import { useLanguage } from '../utils/LanguageContext';
import { useTheme } from '../utils/ThemeContext';

const PIN_LENGTH = 4;

export default function AuthScreen({ onAuthSuccess, route }) {
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [isRegistered, setIsRegistered] = useState(false);
  const [mode, setMode] = useState('register');

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [condition, setCondition] = useState('');
  const [role, setRole] = useState('patient');
  const [specialization, setSpecialization] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPin, setLoginPin] = useState('');
  const [loginRole, setLoginRole] = useState('patient');
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [bioRegistering, setBioRegistering] = useState(false);
  const [userBioPref, setUserBioPref] = useState(false);
  const [optInBio, setOptInBio] = useState(false);
  const { language, setLanguage, t } = useLanguage();
  const { COLORS } = useTheme();
  const styles = useMemo(() => getStyles(COLORS), [COLORS]);
  const [registering, setRegistering] = useState(false);

  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.3, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useEffect(() => { checkAuthStatus(); }, []);

  useEffect(() => {
    if (!loading && mode === 'login' && userBioPref && biometricAvailable) {
      const timer = setTimeout(() => handleBiometricLogin(), 400);
      return () => clearTimeout(timer);
    }
  }, [loading, mode, userBioPref, biometricAvailable]);

  async function checkAuthStatus() {
    try {
      const registered = await getIsRegistered();
      setIsRegistered(registered);
      const hasBiometric = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setBiometricAvailable(hasBiometric && enrolled);
      if (registered) {
        const u = await getUser();
        if (u?.biometricEnabled) setUserBioPref(true);
        if (u?.role) setLoginRole(u.role);
      }
      const initialMode = route?.params?.initialMode;
      if (initialMode) setMode(initialMode);
      else if (registered) setMode('login');
      else setMode('register');
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function handleBiometricLogin() {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: t('auth_biometric_prompt'),
        fallbackLabel: t('auth_use_pin'),
        disableDeviceFallback: false,
      });
      if (result.success) {
        const u = await getUser();
        const role = u?.role || loginRole;
        Alert.alert(t('success'), t('welcome_back'));
        onAuthSuccess(role);
      }
    } catch (e) { console.error(e); }
  }

  async function handleBiometricRegister() {
    if (!biometricAvailable) return;
    setBioRegistering(true);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: t('bio_register_prompt'),
        fallbackLabel: t('auth_use_pin'),
        disableDeviceFallback: false,
      });
      if (result.success) {
        setOptInBio(true);
        Alert.alert(t('success'), t('bio_enrolled'));
      }
    } catch (e) { console.error(e); }
    finally { setBioRegistering(false); }
  }

  async function handleRegister() {
    if (!name.trim() || !phone.trim()) {
      Alert.alert(t('error'), t('fill_all_fields'));
      return;
    }
    if (role === 'patient' && (!age.trim() || !condition.trim())) {
      Alert.alert(t('error'), t('fill_all_fields'));
      return;
    }
    if (role === 'doctor' && !specialization.trim()) {
      Alert.alert(t('error'), t('fill_all_fields'));
      return;
    }
    if (pin.length !== PIN_LENGTH || pin !== confirmPin) {
      Alert.alert(t('pin_mismatch'), t('pin_mismatch_body'));
      return;
    }
    setRegistering(true);
    try {
      // Uniqueness checks
      const existingUser = await getUser();
      if (existingUser) {
        if (existingUser.phone === phone.trim()) {
          Alert.alert(t('error'), t('phone_taken'));
          setRegistering(false);
          return;
        }
        if (existingUser.pin === pin) {
          Alert.alert(t('error'), t('pin_taken'));
          setRegistering(false);
          return;
        }
      }
      const doctors = await getDoctors();
      if (doctors.some(d => d.pin === pin)) {
        Alert.alert(t('error'), t('pin_taken'));
        setRegistering(false);
        return;
      }

      const user = {
        name: name.trim(), phone: phone.trim(),
        age: role === 'patient' ? parseInt(age.trim(), 10) : 0,
        condition: role === 'patient' ? condition.trim() : specialization.trim(),
        role,
        specialization: role === 'doctor' ? specialization.trim() : '',
        pin, createdAt: new Date().toISOString(),
        biometricEnabled: optInBio,
      };

      if (sbConfigured()) {
        await sbRegister(phone.trim(), pin, user);
      } else {
        await saveUser(user);
      }

      if (role === 'doctor') {
        await saveDoctorProfile({ name: user.name, phone: user.phone, specialization: user.specialization, pin: user.pin });
        Alert.alert(t('registration_success'), t('registration_welcome').replace('{name}', user.name));
      } else {
        const added = await addConditionPrescriptions(user.condition);
        if (added.length > 0) {
          Alert.alert(t('auto_added_title'), t('auto_added_body').replace('{condition}', user.condition));
        } else {
          Alert.alert(t('registration_success'), t('registration_welcome').replace('{name}', user.name));
        }
      }
      onAuthSuccess(role);
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setRegistering(false); }
  }

  async function handleLogin() {
    if (loginPin.length !== PIN_LENGTH) {
      Alert.alert(t('invalid_pin'), `${t('invalid_pin')}. ${t('fill_all_fields')}`);
      return;
    }
    try {
      if (sbConfigured()) {
        const uid = await sbLogin(loginPhone, loginPin);
        const remoteUser = await getUser();
        if (!remoteUser) {
          Alert.alert(t('error'), t('no_account_found'));
          return;
        }
        onAuthSuccess(remoteUser.role || 'patient');
      } else {
        const user = await getUser();
        if (!user) {
          Alert.alert(t('error'), t('no_account_found'));
          return;
        }
        if (user.pin !== loginPin) {
          Alert.alert(t('wrong_pin'), t('wrong_pin_body'));
          return;
        }
        onAuthSuccess(user.role || 'patient');
      }
    } catch (e) { Alert.alert('Error', e.message); }
  }

  if (loading) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ fontSize: 28, fontFamily: FONT.headline, color: '#fff' }}>MediSauti</Text>
        <ActivityIndicator size="large" color="#fff" style={{ marginTop: 16 }} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.screen}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={true} bounces={false}>
          <View style={styles.header}>
            <MaterialCommunityIcons name="heart-pulse" size={40} color="#fff" />
            <Text style={styles.appName}>MediSauti</Text>
            <Text style={styles.tagline}>{t('tagline')}</Text>
          </View>

          <View style={styles.langRow}>
            {['sw', 'en'].map(l => (
              <TouchableOpacity key={l} style={[styles.langBtn, language === l && styles.langBtnActive]} onPress={() => setLanguage(l)}>
                <Text style={[styles.langBtnText, language === l && styles.langBtnTextActive]}>{l === 'sw' ? t('swahili') : t('english')}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {mode === 'register' ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{role === 'doctor' ? t('doctor_register_title') : t('card_register_title')}</Text>
              <Text style={styles.cardSub}>{role === 'doctor' ? t('doctor_register_subtitle') : t('card_register_subtitle')}</Text>

              {/* Role Toggle */}
              <View style={styles.roleRow}>
                <Text style={styles.roleLabel}>{t('label_role')}</Text>
                <View style={styles.roleToggle}>
                  {['patient', 'doctor'].map(r => (
                    <TouchableOpacity key={r} style={[styles.roleOpt, role === r && styles.roleOptActive]} onPress={() => setRole(r)}>
                      <MaterialCommunityIcons
                        name={r === 'doctor' ? 'stethoscope' : 'account'}
                        size={14} color={role === r ? '#fff' : COLORS.outline}
                      />
                      <Text style={[styles.roleOptText, role === r && styles.roleOptTextActive]}>
                        {r === 'doctor' ? t('role_doctor') : t('role_patient')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <FormInput label={t('label_name')} value={name} onChangeText={setName} placeholder={t('placeholder_name')} containerStyle={styles.inputRow} labelStyle={styles.label} inputStyle={styles.input} placeholderColor={COLORS.outline} />
              <FormInput label={t('label_phone')} value={phone} onChangeText={setPhone} placeholder={t('placeholder_phone')} keyboardType="phone-pad" containerStyle={styles.inputRow} labelStyle={styles.label} inputStyle={styles.input} placeholderColor={COLORS.outline} />

              {role === 'patient' ? (
                <>
                  <FormInput label={t('label_age')} value={age} onChangeText={setAge} placeholder={t('placeholder_age')} keyboardType="number-pad" containerStyle={styles.inputRow} labelStyle={styles.label} inputStyle={styles.input} placeholderColor={COLORS.outline} />
                  <FormInput label={t('label_condition')} value={condition} onChangeText={setCondition} placeholder={t('placeholder_condition')} containerStyle={styles.inputRow} labelStyle={styles.label} inputStyle={styles.input} placeholderColor={COLORS.outline} />
                </>
              ) : (
                <FormInput label={t('label_specialization')} value={specialization} onChangeText={setSpecialization} placeholder={t('placeholder_specialization')} containerStyle={styles.inputRow} labelStyle={styles.label} inputStyle={styles.input} placeholderColor={COLORS.outline} />
              )}

              <FormInput label={t('label_set_pin')} value={pin} onChangeText={v => setPin(v.replace(/\D/g, '').slice(0, PIN_LENGTH))} placeholder="****" keyboardType="number-pad" secureTextEntry containerStyle={styles.inputRow} labelStyle={styles.label} inputStyle={styles.input} placeholderColor={COLORS.outline} />
              <FormInput label={t('label_confirm_pin')} value={confirmPin} onChangeText={v => setConfirmPin(v.replace(/\D/g, '').slice(0, PIN_LENGTH))} placeholder="****" keyboardType="number-pad" secureTextEntry containerStyle={styles.inputRow} labelStyle={styles.label} inputStyle={styles.input} placeholderColor={COLORS.outline} />

              {biometricAvailable && (
                <TouchableOpacity
                  style={[styles.bioOptIn, optInBio && styles.bioOptInActive]}
                  onPress={bioRegistering ? null : optInBio ? () => setOptInBio(false) : handleBiometricRegister}
                  activeOpacity={0.7}
                  disabled={bioRegistering}
                >
                  <MaterialCommunityIcons
                    name={optInBio ? 'check-circle' : Platform.OS === 'ios' ? 'face-recognition' : 'fingerprint'}
                    size={22}
                    color={optInBio ? COLORS.green[500] : COLORS.onSurfaceVariant}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.bioOptInTitle, optInBio && { color: COLORS.green[500] }]}>
                      {optInBio ? t('bio_enabled_label') : t('bio_opt_in')}
                    </Text>
                    <Text style={styles.bioOptInDesc}>
                      {optInBio ? t('bio_enabled_desc') : t('bio_opt_in_desc')}
                    </Text>
                  </View>
                  {bioRegistering && <ActivityIndicator size="small" color={COLORS.primary} />}
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.primaryBtn} onPress={handleRegister} disabled={registering}>
                {registering ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>{t('btn_register')}</Text>}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('card_login_title')}</Text>
              <Text style={styles.cardSub}>{t('card_login_subtitle')}</Text>

              {/* Login Role Toggle */}
              <View style={styles.roleRow}>
                <Text style={styles.roleLabel}>{t('login_as')}</Text>
                <View style={styles.roleToggle}>
                  {['patient', 'doctor'].map(r => (
                    <TouchableOpacity key={r} style={[styles.roleOpt, loginRole === r && styles.roleOptActive]} onPress={() => setLoginRole(r)}>
                      <MaterialCommunityIcons
                        name={r === 'doctor' ? 'stethoscope' : 'account'}
                        size={14} color={loginRole === r ? '#fff' : COLORS.outline}
                      />
                      <Text style={[styles.roleOptText, loginRole === r && styles.roleOptTextActive]}>
                        {r === 'doctor' ? t('role_doctor') : t('role_patient')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {biometricAvailable && (
                <TouchableOpacity
                  style={[styles.biometricBtn, userBioPref && styles.biometricBtnPref]}
                  onPress={handleBiometricLogin}
                >
                  <Animated.View style={{ transform: userBioPref ? [{ scale: pulse }] : [{ scale: 1 }] }}>
                    <MaterialCommunityIcons
                      name={Platform.OS === 'ios' ? 'face-recognition' : 'fingerprint'}
                      size={userBioPref ? 52 : 48}
                      color={userBioPref ? COLORS.primary : COLORS.primary}
                    />
                  </Animated.View>
                  <Text style={styles.biometricText}>
                    {userBioPref ? t('bio_tap_to_login') : t('btn_biometric')}
                  </Text>
                  {userBioPref && <Text style={styles.biometricSub}>{t('bio_pref_hint')}</Text>}
                </TouchableOpacity>
              )}

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>{t('or_enter_pin')}</Text>
                <View style={styles.dividerLine} />
              </View>

              <FormInput label={t('label_phone')} value={loginPhone} onChangeText={setLoginPhone} placeholder={t('placeholder_phone')} keyboardType="phone-pad" containerStyle={styles.inputRow} labelStyle={styles.label} inputStyle={styles.input} placeholderColor={COLORS.outline} />
              <FormInput label={t('label_your_pin')} value={loginPin} onChangeText={v => setLoginPin(v.replace(/\D/g, '').slice(0, PIN_LENGTH))} placeholder="****" keyboardType="number-pad" secureTextEntry containerStyle={styles.inputRow} labelStyle={styles.label} inputStyle={styles.input} placeholderColor={COLORS.outline} />

              <TouchableOpacity style={styles.primaryBtn} onPress={handleLogin}>
                <Text style={styles.primaryBtnText}>{t('btn_login')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {isRegistered && mode === 'login' && (
            <TouchableOpacity style={styles.switchBtn} onPress={() => { setIsRegistered(false); setMode('register'); }}>
              <Text style={styles.switchBtnText}>{t('switch_to_register')}</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

function FormInput({ label, value, onChangeText, placeholder, keyboardType, secureTextEntry, containerStyle, labelStyle, inputStyle, placeholderColor }) {
  return (
    <View style={containerStyle}>
      <Text style={labelStyle}>{label}</Text>
      <TextInput
        style={inputStyle}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={placeholderColor}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
      />
    </View>
  );
}

function getStyles(C) {
  return StyleSheet.create({
    screen:         { flex: 1, backgroundColor: C.primary },
    header:         { alignItems: 'center', paddingVertical: 30 },
    appName:        { fontSize: 32, fontFamily: FONT.headline, color: '#fff', letterSpacing: -0.5, marginTop: 8 },
    tagline:        { fontSize: 13, fontFamily: FONT.body, color: 'rgba(255,255,255,0.8)', marginTop: 4 },

    langRow:        { flexDirection: 'row', backgroundColor: '#fff', marginHorizontal: 20, borderRadius: RADIUS.xl, overflow: 'hidden', marginBottom: 8, alignSelf: 'center' },
    langBtn:        { paddingHorizontal: 24, paddingVertical: 10, alignItems: 'center' },
    langBtnActive:  { backgroundColor: C.primaryFixed + '40' },
    langBtnText:    { fontSize: 13, fontFamily: FONT.bodyMedium },
    langBtnTextActive: { color: C.primary, fontWeight: '700' },

    scrollContent:  { padding: 20, paddingBottom: 120, flexGrow: 1 },

    card: {
      backgroundColor: C.surfaceLowest, borderRadius: RADIUS.xxl,
      padding: 24, marginBottom: 16,
      shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 8,
    },
    cardTitle:      { fontSize: 18, fontFamily: FONT.bold, color: C.onSurface, marginBottom: 4 },
    cardSub:        { fontSize: 13, fontFamily: FONT.body, color: C.onSurfaceVariant, marginBottom: 20, lineHeight: 18 },

    /* Role Toggle */
    roleRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
    roleLabel:      { fontSize: 12, fontFamily: FONT.bodySemiBold, color: C.onSurfaceVariant },
    roleToggle:     { flexDirection: 'row', gap: 6 },
    roleOpt:        { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.md, backgroundColor: C.surfaceLow, borderWidth: 1, borderColor: C.surfaceHigh },
    roleOptActive:  { backgroundColor: C.primary, borderColor: C.primary },
    roleOptText:    { fontSize: 12, fontFamily: FONT.bodySemiBold, color: C.outline },
    roleOptTextActive: { color: '#fff' },

    inputRow:       { marginBottom: 14 },
    label:          { fontSize: 12, fontFamily: FONT.bodySemiBold, color: C.onSurfaceVariant, marginBottom: 4 },
    input:          { backgroundColor: C.surfaceLow, borderRadius: RADIUS.md, padding: 12, fontSize: 15, fontFamily: FONT.body, color: C.onSurface, borderWidth: 1, borderColor: C.surfaceHigh },

    primaryBtn:     { backgroundColor: C.primary, borderRadius: RADIUS.xl, padding: 14, alignItems: 'center', marginTop: 6, shadowColor: C.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
    primaryBtnText: { color: '#fff', fontSize: 16, fontFamily: FONT.bold },

    biometricBtn:   { alignItems: 'center', padding: 20, marginBottom: 8, backgroundColor: C.primaryFixed + '25', borderRadius: RADIUS.xl },
    biometricBtnPref: { backgroundColor: C.primaryFixed + '40', borderWidth: 1, borderColor: C.primary },
    biometricText:  { fontSize: 14, fontFamily: FONT.bodySemiBold, color: C.primary, marginTop: 8 },
    biometricSub:   { fontSize: 11, fontFamily: FONT.body, color: C.outline, marginTop: 2 },

    divider:        { flexDirection: 'row', alignItems: 'center', marginVertical: 16 },
    dividerLine:    { flex: 1, height: 0.5, backgroundColor: C.surfaceHigh },
    dividerText:    { fontSize: 12, fontFamily: FONT.body, color: C.outline, marginHorizontal: 10 },

    bioOptIn:       { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: RADIUS.lg, backgroundColor: C.surfaceLow, borderWidth: 1, borderColor: C.surfaceHigh, marginBottom: 14 },
    bioOptInActive: { backgroundColor: C.green[50], borderColor: C.green[400] },
    bioOptInTitle:  { fontSize: 13, fontFamily: FONT.bodySemiBold, color: C.onSurface },
    bioOptInDesc:   { fontSize: 11, fontFamily: FONT.body, color: C.outline, marginTop: 1 },

    switchBtn:      { alignSelf: 'center', padding: 12 },
    switchBtnText:  { fontSize: 13, fontFamily: FONT.bodyMedium, textDecorationLine: 'underline' },
  });
}
