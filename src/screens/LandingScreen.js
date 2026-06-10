import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SHADOW } from '../utils/constants';

export default function LandingScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [language, setLanguage] = useState('sw');

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 20 }]}
      bounces={false}
    >
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

      {/* Hero section */}
      <View style={styles.hero}>
        <Text style={styles.heroIcon}>💊</Text>
        <Text style={styles.appName}>MEDISAUTI</Text>
        <Text style={styles.tagline}>
          {language === 'sw' ? 'Dawa yako, afya yako' : 'Your meds, your health'}
        </Text>
        <Text style={styles.description}>
          {language === 'sw'
            ? 'Panga ratiba ya dawa zako, pata vikumbusho, na fuata maendeleo ya afya yako.'
            : 'Schedule your medications, get reminders, and track your health progress.'}
        </Text>
      </View>

      {/* Action buttons */}
      <View style={styles.actionsCard}>
        <TouchableOpacity
          style={styles.loginBtn}
          onPress={() => navigation.navigate('Auth', { initialMode: 'login' })}
          activeOpacity={0.8}
        >
          <Text style={styles.loginBtnIcon}>🔐</Text>
          <View style={styles.btnTextWrap}>
            <Text style={styles.loginBtnLabel}>
              {language === 'sw' ? 'Ingia' : 'Login'}
            </Text>
            <Text style={styles.loginBtnSub}>
              {language === 'sw' ? 'Tumia PIN au alama ya uso' : 'Use PIN or biometrics'}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>
            {language === 'sw' ? 'AU' : 'OR'}
          </Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity
          style={styles.registerBtn}
          onPress={() => navigation.navigate('Auth', { initialMode: 'register' })}
          activeOpacity={0.8}
        >
          <Text style={styles.registerBtnIcon}>📝</Text>
          <View style={styles.btnTextWrap}>
            <Text style={styles.registerBtnLabel}>
              {language === 'sw' ? 'Jisajili' : 'Register'}
            </Text>
            <Text style={styles.registerBtnSub}>
              {language === 'sw' ? 'Unda akaunti mpya' : 'Create a new account'}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: COLORS.teal[600] },
  content:        { flexGrow: 1, padding: 20, paddingBottom: 40 },

  langRow:        { flexDirection: 'row', backgroundColor: '#fff', marginBottom: 30, borderRadius: RADIUS.md, overflow: 'hidden' },
  langBtn:        { flex: 1, paddingVertical: 10, alignItems: 'center' },
  langBtnActive:  { backgroundColor: COLORS.teal[50] },
  langBtnText:    { fontSize: 13, color: COLORS.text.secondary, fontWeight: '500' },
  langBtnTextActive: { color: COLORS.teal[600], fontWeight: '700' },

  hero:           { alignItems: 'center', marginBottom: 40 },
  heroIcon:       { fontSize: 64, marginBottom: 12 },
  appName:        { fontSize: 36, fontWeight: '900', color: '#fff', letterSpacing: 1.5 },
  tagline:        { fontSize: 15, color: 'rgba(255,255,255,0.85)', marginTop: 6 },
  description:    { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 10, textAlign: 'center', lineHeight: 18, paddingHorizontal: 10 },

  actionsCard:    {
    backgroundColor: '#fff', borderRadius: RADIUS.xl,
    padding: 24, ...SHADOW.sm,
  },

  loginBtn:       {
    backgroundColor: COLORS.teal[600], borderRadius: RADIUS.md,
    padding: 16, flexDirection: 'row', alignItems: 'center',
  },
  loginBtnIcon:   { fontSize: 24, marginRight: 12 },
  loginBtnLabel:  { color: '#fff', fontSize: 16, fontWeight: '700' },
  loginBtnSub:    { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },

  divider:        { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  dividerLine:    { flex: 1, height: 0.5, backgroundColor: '#ccc' },
  dividerText:    { fontSize: 12, color: COLORS.text.secondary, marginHorizontal: 10, fontWeight: '500' },

  registerBtn:    {
    borderWidth: 1.5, borderColor: COLORS.teal[600], borderRadius: RADIUS.md,
    padding: 16, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff',
  },
  registerBtnIcon: { fontSize: 24, marginRight: 12 },
  registerBtnLabel: { color: COLORS.teal[600], fontSize: 16, fontWeight: '700' },
  registerBtnSub: { color: COLORS.teal[400], fontSize: 12, marginTop: 2 },

  btnTextWrap:    { flex: 1 },
});
