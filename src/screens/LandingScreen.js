import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, RADIUS, FONT } from '../utils/constants';

export default function LandingScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [language, setLanguage] = useState('sw');

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 40 }]}
      bounces={false}
    >
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

      <View style={styles.hero}>
        <View style={styles.heroIconWrap}>
          <MaterialCommunityIcons name="heart-pulse" size={48} color="#fff" />
        </View>
        <Text style={styles.appName}>MediSauti</Text>
        <Text style={styles.tagline}>
          {language === 'sw' ? 'Dawa yako, afya yako' : 'Your meds, your health'}
        </Text>
        <Text style={styles.description}>
          {language === 'sw'
            ? 'Panga ratiba ya dawa zako, pata vikumbusho, na fuata maendeleo ya afya yako.'
            : 'Schedule your medications, get reminders, and track your health progress.'}
        </Text>
      </View>

      <View style={styles.actionsCard}>
        <TouchableOpacity
          style={styles.loginBtn}
          onPress={() => navigation.navigate('Auth', { initialMode: 'login' })}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="shield-lock-outline" size={24} color="#fff" />
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
          <Text style={styles.dividerText}>{language === 'sw' ? 'AU' : 'OR'}</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity
          style={styles.registerBtn}
          onPress={() => navigation.navigate('Auth', { initialMode: 'register' })}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="account-plus-outline" size={24} color={COLORS.primary} />
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
  screen:         { flex: 1, backgroundColor: COLORS.primary },
  content:        { flexGrow: 1, padding: 20, paddingBottom: 40 },

  langRow:        { flexDirection: 'row', backgroundColor: '#fff', marginBottom: 30, borderRadius: RADIUS.xl, overflow: 'hidden', alignSelf: 'center' },
  langBtn:        { paddingHorizontal: 28, paddingVertical: 10, alignItems: 'center' },
  langBtnActive:  { backgroundColor: COLORS.primaryFixed + '40' },
  langBtnText:    { fontSize: 13, fontFamily: FONT.bodyMedium },
  langBtnTextActive: { color: COLORS.primary, fontWeight: '700' },

  hero:           { alignItems: 'center', marginBottom: 40 },
  heroIconWrap:   { width: 80, height: 80, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  appName:        { fontSize: 36, fontFamily: FONT.headline, color: '#fff', letterSpacing: -1 },
  tagline:        { fontSize: 15, fontFamily: FONT.body, color: 'rgba(255,255,255,0.85)', marginTop: 6 },
  description:    { fontSize: 13, fontFamily: FONT.body, color: 'rgba(255,255,255,0.7)', marginTop: 10, textAlign: 'center', lineHeight: 18, paddingHorizontal: 20 },

  actionsCard: {
    backgroundColor: COLORS.surfaceLowest, borderRadius: RADIUS.xxl,
    padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 8,
  },

  loginBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.xl,
    padding: 16, flexDirection: 'row', alignItems: 'center',
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  loginBtnLabel:  { color: '#fff', fontSize: 16, fontFamily: FONT.bold },
  loginBtnSub:    { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontFamily: FONT.body, marginTop: 2 },

  divider:        { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  dividerLine:    { flex: 1, height: 0.5, backgroundColor: COLORS.surfaceHigh },
  dividerText:    { fontSize: 12, fontFamily: FONT.bodyMedium },

  registerBtn: {
    borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: RADIUS.xl,
    padding: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surfaceLowest,
  },
  registerBtnLabel: { color: COLORS.primary, fontSize: 16, fontFamily: FONT.bold },
  registerBtnSub: { color: COLORS.primaryContainer, fontSize: 12, fontFamily: FONT.body, marginTop: 2 },

  btnTextWrap:    { flex: 1, marginLeft: 12 },
});
