import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView,
  Platform, Animated,
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SHADOW } from '../utils/constants';
import { saveUser, getUser, getIsRegistered } from '../utils/storage';

const PIN_LENGTH = 4;

export default function AuthScreen({ onAuthSuccess }) {
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
  const [language, setLanguage] = useState('sw');
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

  useEffect(() => {
    checkAuthStatus();
  }, []);

  async function checkAuthStatus() {
    try {
      const registered = await getIsRegistered();
      setIsRegistered(registered);

      const hasBiometric = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setBiometricAvailable(hasBiometric && enrolled);

      if (registered) {
        setMode('login');
      } else {
        setMode('register');
      }
    } catch (e) {
      console.error('checkAuthStatus:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleBiometricLogin() {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: language === 'sw' ? 'Ingiza alama ya uso au kidole' : 'Authenticate to continue',
        fallbackLabel: language === 'sw' ? 'Tumia PIN' : 'Use PIN',
        disableDeviceFallback: false,
      });
      if (result.success) {
        Alert.alert(
          language === 'sw' ? '✅ Imefanikiwa' : '✅ Success',
          language === 'sw' ? 'Karibu tena!' : 'Welcome back!'
        );
        onAuthSuccess();
      }
    } catch (e) {
      console.error('Biometric error:', e);
    }
  }

  async function handleRegister() {
    if (!name.trim() || !phone.trim() || !age.trim() || !condition.trim()) {
      Alert.alert(
        language === 'sw' ? 'Kosa' : 'Error',
        language === 'sw' ? 'Tafadhali jaza sehemu zote.' : 'Please fill all fields.'
      );
      return;
    }
    if (pin.length !== PIN_LENGTH || pin !== confirmPin) {
      Alert.alert(
        language === 'sw' ? 'PIN hailingani' : 'PIN Mismatch',
        language === 'sw' ? `Tafadhali ingiza PIN yenye tarakimu ${PIN_LENGTH} na uhakikishe inalingana.` : `Enter a ${PIN_LENGTH}-digit PIN and confirm it matches.`
      );
      return;
    }

    setRegistering(true);
    try {
      const user = {
        name: name.trim(),
        phone: phone.trim(),
        age: parseInt(age.trim(), 10),
        condition: condition.trim(),
        pin,
        createdAt: new Date().toISOString(),
      };
      await saveUser(user);
      Alert.alert(
        language === 'sw' ? '✅ Umesajiliwa' : '✅ Registered',
        language === 'sw' ? `Karibu ${user.name}!` : `Welcome ${user.name}!`
      );
      onAuthSuccess();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setRegistering(false);
    }
  }

  async function handleLogin() {
    if (loginPin.length !== PIN_LENGTH) {
      Alert.alert(
        language === 'sw' ? 'PIN si sahihi' : 'Invalid PIN',
        language === 'sw' ? `Tafadhali ingiza PIN yenye tarakimu ${PIN_LENGTH}.` : `Please enter your ${PIN_LENGTH}-digit PIN.`
      );
      return;
    }

    try {
      const user = await getUser();
      if (user && user.pin === loginPin) {
        onAuthSuccess();
      } else {
        Alert.alert(
          language === 'sw' ? 'PIN si sahihi' : 'Wrong PIN',
          language === 'sw' ? 'PIN ulioingiza hailingani. Tafadhali jaribu tena.' : 'The PIN you entered does not match. Please try again.'
        );
      }
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={styles.appName}>MEDISAUTI</Text>
        <ActivityIndicator size="large" color={COLORS.teal[400]} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.appName}>MEDISAUTI</Text>
          <Text style={styles.tagline}>
            {language === 'sw' ? 'Dawa yako, afya yako' : 'Your meds, your health'}
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

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {mode === 'register' ? (
            /* ── Registration ── */
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                {language === 'sw' ? '📝 Jisajili · Register' : '📝 Register'}
              </Text>
              <Text style={styles.cardSub}>
                {language === 'sw'
                  ? 'Tafadhali jaza taarifa zako za matibabu.'
                  : 'Please fill in your medical information.'}
              </Text>

              <View style={styles.inputRow}>
                <Text style={styles.label}>{language === 'sw' ? 'Jina kamili' : 'Full name'}</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Darius Kamau"
                  placeholderTextColor={COLORS.text.hint}
                />
              </View>

              <View style={styles.inputRow}>
                <Text style={styles.label}>{language === 'sw' ? 'Nambari ya simu' : 'Phone number'}</Text>
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="e.g. 0712345678"
                  placeholderTextColor={COLORS.text.hint}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.inputRow}>
                <Text style={styles.label}>{language === 'sw' ? 'Umri' : 'Age'}</Text>
                <TextInput
                  style={styles.input}
                  value={age}
                  onChangeText={setAge}
                  placeholder="e.g. 45"
                  placeholderTextColor={COLORS.text.hint}
                  keyboardType="number-pad"
                />
              </View>

              <View style={styles.inputRow}>
                <Text style={styles.label}>{language === 'sw' ? 'Hali ya kiafya' : 'Medical condition'}</Text>
                <TextInput
                  style={styles.input}
                  value={condition}
                  onChangeText={setCondition}
                  placeholder="e.g. Diabetes"
                  placeholderTextColor={COLORS.text.hint}
                />
              </View>

              <View style={styles.inputRow}>
                <Text style={styles.label}>{language === 'sw' ? 'Weka PIN (tarakimu 4)' : 'Set PIN (4 digits)'}</Text>
                <TextInput
                  style={styles.input}
                  value={pin}
                  onChangeText={v => setPin(v.replace(/\D/g, '').slice(0, PIN_LENGTH))}
                  placeholder="****"
                  placeholderTextColor={COLORS.text.hint}
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={PIN_LENGTH}
                />
              </View>

              <View style={styles.inputRow}>
                <Text style={styles.label}>{language === 'sw' ? 'Thibitisha PIN' : 'Confirm PIN'}</Text>
                <TextInput
                  style={styles.input}
                  value={confirmPin}
                  onChangeText={v => setConfirmPin(v.replace(/\D/g, '').slice(0, PIN_LENGTH))}
                  placeholder="****"
                  placeholderTextColor={COLORS.text.hint}
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={PIN_LENGTH}
                />
              </View>

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleRegister}
                disabled={registering}
              >
                {registering ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>
                    {language === 'sw' ? '✅ Jisajili' : '✅ Register'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            /* ── Login ── */
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                {language === 'sw' ? '🔐 Ingia · Login' : '🔐 Login'}
              </Text>
              <Text style={styles.cardSub}>
                {language === 'sw'
                  ? 'Ingiza PIN yako au tumia alama ya uso / kidole.'
                  : 'Enter your PIN or use face/fingerprint to continue.'}
              </Text>

              {/* Biometric button */}
              {biometricAvailable && (
                <TouchableOpacity
                  style={styles.biometricBtn}
                  onPress={handleBiometricLogin}
                >
                  <Animated.Text style={[styles.biometricIcon, { transform: [{ scale: pulse }] }]}>
                    {Platform.OS === 'ios' ? '😀' : '🖐️'}
                  </Animated.Text>
                  <Text style={styles.biometricText}>
                    {language === 'sw' ? 'Tumia alama ya uso / kidole' : 'Use face / fingerprint'}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Divider */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>
                  {language === 'sw' ? 'AU ingiza PIN' : 'OR enter PIN'}
                </Text>
                <View style={styles.dividerLine} />
              </View>

              <View style={styles.inputRow}>
                <Text style={styles.label}>{language === 'sw' ? 'PIN yako' : 'Your PIN'}</Text>
                <TextInput
                  style={styles.input}
                  value={loginPin}
                  onChangeText={v => setLoginPin(v.replace(/\D/g, '').slice(0, PIN_LENGTH))}
                  placeholder="****"
                  placeholderTextColor={COLORS.text.hint}
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={PIN_LENGTH}
                />
              </View>

              <TouchableOpacity style={styles.primaryBtn} onPress={handleLogin}>
                <Text style={styles.primaryBtnText}>
                  {language === 'sw' ? '🔓 Ingia' : '🔓 Login'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Toggle between register/login */}
          {isRegistered && mode === 'login' && (
            <TouchableOpacity
              style={styles.switchBtn}
              onPress={() => {
                setIsRegistered(false);
                setMode('register');
              }}
            >
              <Text style={styles.switchBtnText}>
                {language === 'sw' ? 'Sajili mtumiaji mpya' : 'Register a new user'}
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: COLORS.teal[600] },
  header:         { alignItems: 'center', paddingVertical: 30 },
  appName:        { fontSize: 32, fontWeight: '900', color: '#fff', letterSpacing: 1 },
  tagline:        { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 },

  langRow:        { flexDirection: 'row', backgroundColor: '#fff', marginHorizontal: 20, borderRadius: RADIUS.md, overflow: 'hidden', marginBottom: 8 },
  langBtn:        { flex: 1, paddingVertical: 10, alignItems: 'center' },
  langBtnActive:  { backgroundColor: COLORS.teal[50] },
  langBtnText:    { fontSize: 13, color: COLORS.text.secondary, fontWeight: '500' },
  langBtnTextActive: { color: COLORS.teal[600], fontWeight: '700' },

  scroll:         { flex: 1 },
  scrollContent:  { padding: 20, paddingBottom: 40 },

  card:           {
    backgroundColor: '#fff', borderRadius: RADIUS.xl,
    padding: 24, marginBottom: 16, ...SHADOW.sm,
  },
  cardTitle:      { fontSize: 18, fontWeight: '700', color: COLORS.text.primary, marginBottom: 4 },
  cardSub:        { fontSize: 13, color: COLORS.text.secondary, marginBottom: 20, lineHeight: 18 },

  inputRow:       { marginBottom: 14 },
  label:          { fontSize: 12, fontWeight: '600', color: COLORS.text.secondary, marginBottom: 4 },
  input:          {
    borderWidth: 0.5, borderColor: '#ccc', borderRadius: RADIUS.md,
    padding: 12, fontSize: 15, color: COLORS.text.primary,
    backgroundColor: COLORS.background,
  },

  primaryBtn:     {
    backgroundColor: COLORS.teal[600], borderRadius: RADIUS.md,
    padding: 14, alignItems: 'center', marginTop: 6,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  biometricBtn:   {
    alignItems: 'center', padding: 20, marginBottom: 8,
    backgroundColor: COLORS.teal[50], borderRadius: RADIUS.lg,
  },
  biometricIcon:  { fontSize: 48, marginBottom: 8 },
  biometricText:  { fontSize: 14, fontWeight: '600', color: COLORS.teal[600] },

  divider:        { flexDirection: 'row', alignItems: 'center', marginVertical: 16 },
  dividerLine:    { flex: 1, height: 0.5, backgroundColor: '#ccc' },
  dividerText:    { fontSize: 12, color: COLORS.text.secondary, marginHorizontal: 10 },

  switchBtn:      { alignSelf: 'center', padding: 12 },
  switchBtnText:  { fontSize: 13, color: '#fff', fontWeight: '500', textDecorationLine: 'underline' },
});
