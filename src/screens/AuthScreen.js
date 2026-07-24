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
import { saveUser, getUser, getIsRegistered, addConditionPrescriptions, saveDoctorProfile, getDoctors, clearUserData, hashPin, storePinHash, getStoredPinHash, generateRandomPassword, storeSupabasePassword, getSupabasePassword } from '../utils/storage';
import { isConfigured as sbConfigured, registerUser as sbRegister, loginUser as sbLogin, getClient as getSupabaseClient, sendSmsCode, verifySmsCode } from '../utils/supabase';
import { scheduleReminder, cancelAllReminders } from '../utils/reminders';
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
  const [resetMode, setResetMode] = useState('');
  const [resetPhone, setResetPhone] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newConfirmPin, setNewConfirmPin] = useState('');
  const [resetUid, setResetUid] = useState(null);
  const [resetting, setResetting] = useState(false);
  const failedAttempts = useRef(0);
  const lockoutUntil = useRef(0);

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

      // Hash PIN and store securely
      const pinHash = await hashPin(pin);
      await storePinHash(pinHash);

      // Generate random Supabase password (never store raw PIN as password)
      const sbPassword = await generateRandomPassword();
      await storeSupabasePassword(sbPassword);

      let sbUid = null;
      if (sbConfigured()) {
        sbUid = await sbRegister(phone.trim(), pinHash, user);
        // Store the hashed password in SecureStore for the Supabase auth session
        await storeSupabasePassword(pinHash);
      }
      if (sbUid) user.uid = sbUid;
      await saveUser(user);

      if (role === 'doctor') {
        await saveDoctorProfile({ name: user.name, phone: user.phone, specialization: user.specialization, pin: user.pin, uid: sbUid });
        Alert.alert(t('registration_success'), t('registration_welcome').replace('{name}', user.name));
      } else {
        await clearUserData();
        const added = await addConditionPrescriptions(user.condition);
        if (added.length > 0) {
          try { await cancelAllReminders(); } catch (_) {}
          for (const rx of added) {
            for (const time of rx.times || []) {
              try { await scheduleReminder(rx, time, language); } catch (_) {}
            }
          }
          Alert.alert(t('auto_added_title'), t('auto_added_body').replace('{condition}', user.condition));
        } else {
          Alert.alert(t('registration_success'), t('registration_welcome').replace('{name}', user.name));
        }
      }
      onAuthSuccess(role);
    } catch (e) { Alert.alert(t('error'), e.message); }
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
        const previousUser = await getUser();
        if (previousUser && previousUser.phone && previousUser.phone !== loginPhone) {
          await clearUserData();
        }
        let remoteUser = await getUser();
        if (!remoteUser || (previousUser && previousUser.phone !== loginPhone)) {
          const sbClient = getSupabaseClient();
          if (sbClient) {
            const { data } = await sbClient.from('users').select('*').eq('id', uid).maybeSingle();
            if (data) remoteUser = { uid, ...data.data, phone: data.phone };
          }
        }
        if (!remoteUser) {
          remoteUser = { uid, phone: loginPhone, pin: loginPin, role: 'patient', name: loginPhone, createdAt: new Date().toISOString() };
        }
        await saveUser(remoteUser);
        onAuthSuccess(remoteUser.role || 'patient');
      } else {
        if (Date.now() < lockoutUntil.current) {
          const secs = Math.ceil((lockoutUntil.current - Date.now()) / 1000);
          Alert.alert(t('error'), `Too many attempts. Try again in ${secs}s.`);
          return;
        }
        const user = await getUser();
        if (!user) {
          Alert.alert(t('error'), t('no_account_found'));
          return;
        }
        // Verify PIN: try hash comparison first, fall back to plain text for legacy
        const storedHash = await getStoredPinHash();
        let pinValid = false;
        if (storedHash) {
          const inputHash = await hashPin(loginPin);
          pinValid = inputHash === storedHash;
        }
        // Legacy fallback: plain text comparison
        if (!pinValid && user.pin === loginPin) {
          pinValid = true;
          // Migrate: store hash for next time
          const newHash = await hashPin(loginPin);
          await storePinHash(newHash);
        }
        if (!pinValid) {
          failedAttempts.current++;
          if (failedAttempts.current >= 5) {
            lockoutUntil.current = Date.now() + 30000;
            failedAttempts.current = 0;
            Alert.alert(t('error'), 'Too many failed attempts. Locked for 30 seconds.');
          } else {
            Alert.alert(t('wrong_pin'), t('wrong_pin_body'), [
              { text: t('forgot_pin'), onPress: startReset },
              { text: 'OK' },
            ]);
          }
          return;
        }
        failedAttempts.current = 0;
        const userRole = user.role || 'patient';
        if (loginRole !== userRole) {
          Alert.alert(t('error'), `This account is registered as ${userRole}. Please select the correct role.`);
          return;
        }
        onAuthSuccess(userRole);
      }
    } catch (e) {
      const msg = (e.message || '').toLowerCase();
      if (msg.includes('invalid login') || msg.includes('credentials') || msg.includes('wrong password')) {
        Alert.alert(t('wrong_pin'), t('wrong_pin_body'), [
          { text: t('forgot_pin'), onPress: startReset },
          { text: 'OK' },
        ]);
      } else {
        Alert.alert(t('error'), e.message);
      }
    }
  }

  // ── Forgot PIN (real SMS verification) ──────────────────────
  function startReset() {
    setResetPhone('');
    setCodeInput('');
    setNewPin('');
    setNewConfirmPin('');
    setResetUid(null);
    setResetMode('phone');
  }

  async function handleResetPhone() {
    if (!resetPhone.trim()) {
      Alert.alert(t('error'), t('fill_all_fields'));
      return;
    }
    setResetting(true);
    try {
      if (sbConfigured()) {
        // Send real SMS via Supabase Edge Function + Twilio
        await sendSmsCode(resetPhone.trim());
        setResetMode('code');
      } else {
        // Local-only mode: can't send SMS, show instruction
        Alert.alert(t('forgot_pin_title'), 'SMS verification requires Supabase to be configured. Please contact support.');
        setResetMode('');
      }
    } catch (e) {
      Alert.alert(t('error'), e.message);
    } finally { setResetting(false); }
  }

  async function handleResetCode() {
    if (!codeInput.trim()) {
      Alert.alert(t('forgot_pin_title'), t('forgot_pin_code_wrong'));
      return;
    }
    setResetting(true);
    try {
      if (sbConfigured()) {
        // Verify code via Supabase Edge Function + update password
        const newPw = await generateRandomPassword();
        await verifySmsCode(resetPhone.trim(), codeInput.trim(), newPw);
        await storeSupabasePassword(newPw);
        setResetMode('newPin');
      }
    } catch (e) {
      Alert.alert(t('forgot_pin_title'), e.message || t('forgot_pin_code_wrong'));
    } finally { setResetting(false); }
  }

  async function handleResetPin() {
    if (newPin.length !== PIN_LENGTH || newPin !== newConfirmPin) {
      Alert.alert(t('forgot_pin_title'), t('forgot_pin_mismatch'));
      return;
    }
    setResetting(true);
    try {
      const localUser = await getUser();
      const updated = { ...(localUser || {}), pin: newPin };
      await saveUser(updated);

      // Update PIN hash in SecureStore
      const newHash = await hashPin(newPin);
      await storePinHash(newHash);

      // Update Supabase auth password to match new PIN hash
      if (sbConfigured() && resetUid) {
        try {
          const newPw = await generateRandomPassword();
          await storeSupabasePassword(newPw);
          // Re-register with new PIN hash for Supabase auth
          const sbClient = getSupabaseClient();
          if (sbClient) {
            await sbClient.from('users').update({
              data: { ...updated, updatedAt: new Date().toISOString() },
            }).eq('id', resetUid);
          }
        } catch (_) {}
      }
      Alert.alert(t('success'), t('forgot_pin_success'));
      setResetMode('');
      setLoginPhone(resetPhone);
      setLoginPin('');
    } catch (e) { Alert.alert(t('error'), e.message); }
    finally { setResetting(false); }
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
              {resetMode ? (
                <>
                  {resetMode === 'phone' && (
                    <>
                      <Text style={styles.cardTitle}>{t('forgot_pin_title')}</Text>
                      <Text style={styles.cardSub}>{t('forgot_pin_phone')}</Text>
                      <FormInput label={t('label_phone')} value={resetPhone} onChangeText={setResetPhone} placeholder={t('placeholder_phone')} keyboardType="phone-pad" containerStyle={styles.inputRow} labelStyle={styles.label} inputStyle={styles.input} placeholderColor={COLORS.outline} />
                      <TouchableOpacity style={styles.primaryBtn} onPress={handleResetPhone} disabled={resetting}>
                        {resetting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>{t('forgot_pin_next')}</Text>}
                      </TouchableOpacity>
                    </>
                  )}
                  {resetMode === 'code' && (
                    <>
                      <Text style={styles.cardTitle}>{t('forgot_pin_title')}</Text>
                      <Text style={styles.cardSub}>{t('forgot_pin_code_sent')}</Text>
                      <View style={{ backgroundColor: COLORS.surfaceLow, borderRadius: RADIUS.lg, padding: 16, alignItems: 'center', marginBottom: 16 }}>
                        <MaterialCommunityIcons name="message-text-lock" size={32} color={COLORS.primary} />
                        <Text style={{ fontSize: 12, fontFamily: FONT.body, color: COLORS.outline, marginTop: 8, textAlign: 'center' }}>
                          {t('forgot_pin_code_hint')}
                        </Text>
                      </View>
                      <FormInput label={t('forgot_pin_code_label')} value={codeInput} onChangeText={setCodeInput} placeholder="------" keyboardType="number-pad" containerStyle={styles.inputRow} labelStyle={styles.label} inputStyle={styles.input} placeholderColor={COLORS.outline} />
                      <TouchableOpacity style={styles.primaryBtn} onPress={handleResetCode} disabled={resetting}>
                        {resetting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>{t('forgot_pin_next')}</Text>}
                      </TouchableOpacity>
                    </>
                  )}
                  {resetMode === 'newPin' && (
                    <>
                      <Text style={styles.cardTitle}>{t('forgot_pin_title')}</Text>
                      <FormInput label={t('forgot_pin_new')} value={newPin} onChangeText={v => setNewPin(v.replace(/\D/g, '').slice(0, PIN_LENGTH))} placeholder="****" keyboardType="number-pad" secureTextEntry containerStyle={styles.inputRow} labelStyle={styles.label} inputStyle={styles.input} placeholderColor={COLORS.outline} />
                      <FormInput label={t('forgot_pin_confirm')} value={newConfirmPin} onChangeText={v => setNewConfirmPin(v.replace(/\D/g, '').slice(0, PIN_LENGTH))} placeholder="****" keyboardType="number-pad" secureTextEntry containerStyle={styles.inputRow} labelStyle={styles.label} inputStyle={styles.input} placeholderColor={COLORS.outline} />
                      <TouchableOpacity style={styles.primaryBtn} onPress={handleResetPin} disabled={resetting}>
                        {resetting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>{t('forgot_pin_btn')}</Text>}
                      </TouchableOpacity>
                    </>
                  )}
                  <TouchableOpacity style={styles.switchBtn} onPress={() => setResetMode('')}>
                    <Text style={styles.switchBtnText}>{t('forgot_pin_back')}</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
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

                  <TouchableOpacity style={styles.switchBtn} onPress={startReset}>
                    <Text style={styles.switchBtnText}>{t('forgot_pin')}</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}

          {isRegistered && mode === 'login' && !resetMode && (
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
