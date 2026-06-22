import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView,
  Platform, Animated,
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, RADIUS, FONT } from '../utils/constants';
import { saveUser, getUser, getIsRegistered } from '../utils/storage';
import { useLanguage } from '../utils/LanguageContext';

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
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loginPin, setLoginPin] = useState('');
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const { language, setLanguage, t } = useLanguage();
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

  async function checkAuthStatus() {
    try {
      const registered = await getIsRegistered();
      setIsRegistered(registered);
      const hasBiometric = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setBiometricAvailable(hasBiometric && enrolled);
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
        Alert.alert('✅ ' + t('success'), t('welcome_back'));
        onAuthSuccess();
      }
    } catch (e) { console.error(e); }
  }

  async function handleRegister() {
    if (!name.trim() || !phone.trim() || !age.trim() || !condition.trim()) {
      Alert.alert(t('error'), t('fill_all_fields'));
      return;
    }
    if (pin.length !== PIN_LENGTH || pin !== confirmPin) {
      Alert.alert(t('pin_mismatch'), t('pin_mismatch_body'));
      return;
    }
    setRegistering(true);
    try {
      const user = { name: name.trim(), phone: phone.trim(), age: parseInt(age.trim(), 10), condition: condition.trim(), pin, createdAt: new Date().toISOString() };
      await saveUser(user);
      Alert.alert('✅ ' + t('registration_success'), t('registration_welcome').replace('{name}', user.name));
      onAuthSuccess();
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setRegistering(false); }
  }

  async function handleLogin() {
    if (loginPin.length !== PIN_LENGTH) {
      Alert.alert(t('invalid_pin'), `${t('invalid_pin')}. ${t('fill_all_fields')}`);
      return;
    }
    try {
      const user = await getUser();
      if (user && user.pin === loginPin) onAuthSuccess();
      else Alert.alert(t('wrong_pin'), t('wrong_pin_body'));
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
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'android' ? 'height' : 'padding'} keyboardVerticalOffset={Platform.OS === 'android' ? insets.top + 50 : 0}>
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
              <Text style={styles.cardTitle}>{t('card_register_title')}</Text>
              <Text style={styles.cardSub}>{t('card_register_subtitle')}</Text>

              <Input label={t('label_name')} value={name} onChangeText={setName} placeholder={t('placeholder_name')} />
              <Input label={t('label_phone')} value={phone} onChangeText={setPhone} placeholder={t('placeholder_phone')} keyboardType="phone-pad" />
              <Input label={t('label_age')} value={age} onChangeText={setAge} placeholder={t('placeholder_age')} keyboardType="number-pad" />
              <Input label={t('label_condition')} value={condition} onChangeText={setCondition} placeholder={t('placeholder_condition')} />
              <Input label={t('label_set_pin')} value={pin} onChangeText={v => setPin(v.replace(/\D/g, '').slice(0, PIN_LENGTH))} placeholder="****" keyboardType="number-pad" secureTextEntry />
              <Input label={t('label_confirm_pin')} value={confirmPin} onChangeText={v => setConfirmPin(v.replace(/\D/g, '').slice(0, PIN_LENGTH))} placeholder="****" keyboardType="number-pad" secureTextEntry />

              <TouchableOpacity style={styles.primaryBtn} onPress={handleRegister} disabled={registering}>
                {registering ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>{t('btn_register')}</Text>}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('card_login_title')}</Text>
              <Text style={styles.cardSub}>{t('card_login_subtitle')}</Text>

              {biometricAvailable && (
                <TouchableOpacity style={styles.biometricBtn} onPress={handleBiometricLogin}>
                  <Animated.View style={{ transform: [{ scale: pulse }] }}>
                    <MaterialCommunityIcons name={Platform.OS === 'ios' ? 'face-recognition' : 'fingerprint'} size={48} color={COLORS.primary} />
                  </Animated.View>
                  <Text style={styles.biometricText}>{t('btn_biometric')}</Text>
                </TouchableOpacity>
              )}

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>{t('or_enter_pin')}</Text>
                <View style={styles.dividerLine} />
              </View>

              <Input label={t('label_your_pin')} value={loginPin} onChangeText={v => setLoginPin(v.replace(/\D/g, '').slice(0, PIN_LENGTH))} placeholder="****" keyboardType="number-pad" secureTextEntry />

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
    </KeyboardAvoidingView>
  );
}

function Input({ label, value, onChangeText, placeholder, keyboardType, secureTextEntry }) {
  return (
    <View style={styles.inputRow}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.outline}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen:         { flex: 1, backgroundColor: COLORS.primary },
  header:         { alignItems: 'center', paddingVertical: 30 },
  appName:        { fontSize: 32, fontFamily: FONT.headline, color: '#fff', letterSpacing: -0.5, marginTop: 8 },
  tagline:        { fontSize: 13, fontFamily: FONT.body, color: 'rgba(255,255,255,0.8)', marginTop: 4 },

  langRow:        { flexDirection: 'row', backgroundColor: '#fff', marginHorizontal: 20, borderRadius: RADIUS.xl, overflow: 'hidden', marginBottom: 8, alignSelf: 'center' },
  langBtn:        { paddingHorizontal: 24, paddingVertical: 10, alignItems: 'center' },
  langBtnActive:  { backgroundColor: COLORS.primaryFixed + '40' },
  langBtnText:    { fontSize: 13, fontFamily: FONT.bodyMedium },
  langBtnTextActive: { color: COLORS.primary, fontWeight: '700' },

  scrollContent:  { padding: 20, paddingBottom: 120, flexGrow: 1 },

  card: {
    backgroundColor: COLORS.surfaceLowest, borderRadius: RADIUS.xxl,
    padding: 24, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 8,
  },
  cardTitle:      { fontSize: 18, fontFamily: FONT.bold, color: COLORS.onSurface, marginBottom: 4 },
  cardSub:        { fontSize: 13, fontFamily: FONT.body, color: COLORS.onSurfaceVariant, marginBottom: 20, lineHeight: 18 },

  inputRow:       { marginBottom: 14 },
  label:          { fontSize: 12, fontFamily: FONT.bodySemiBold, color: COLORS.onSurfaceVariant, marginBottom: 4 },
  input:          { backgroundColor: COLORS.surfaceLow, borderRadius: RADIUS.md, padding: 12, fontSize: 15, fontFamily: FONT.body, color: COLORS.onSurface, borderWidth: 1, borderColor: COLORS.surfaceHigh },

  primaryBtn:     { backgroundColor: COLORS.primary, borderRadius: RADIUS.xl, padding: 14, alignItems: 'center', marginTop: 6, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontFamily: FONT.bold },

  biometricBtn:   { alignItems: 'center', padding: 20, marginBottom: 8, backgroundColor: COLORS.primaryFixed + '25', borderRadius: RADIUS.xl },
  biometricText:  { fontSize: 14, fontFamily: FONT.bodySemiBold, color: COLORS.primary, marginTop: 8 },

  divider:        { flexDirection: 'row', alignItems: 'center', marginVertical: 16 },
  dividerLine:    { flex: 1, height: 0.5, backgroundColor: COLORS.surfaceHigh },
  dividerText:    { fontSize: 12, fontFamily: FONT.body, color: COLORS.outline, marginHorizontal: 10 },

  switchBtn:      { alignSelf: 'center', padding: 12 },
  switchBtnText:  { fontSize: 13, fontFamily: FONT.bodyMedium, textDecorationLine: 'underline' },
});
