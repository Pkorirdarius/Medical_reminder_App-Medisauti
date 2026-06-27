import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { RADIUS, FONT } from '../utils/constants';
import { useTheme } from '../utils/ThemeContext';
import { useLanguage } from '../utils/LanguageContext';

export default function LandingScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { language, setLanguage, t } = useLanguage();
  const { COLORS } = useTheme();
  const styles = useMemo(() => getStyles(COLORS), [COLORS]);

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
              {l === 'sw' ? t('swahili') : t('english')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.hero}>
        <View style={styles.heroIconWrap}>
          <MaterialCommunityIcons name="heart-pulse" size={48} color="#fff" />
        </View>
        <Text style={styles.appName}>MediSauti</Text>
        <Text style={styles.tagline}>{t('tagline')}</Text>
        <Text style={styles.description}>{t('landing_desc')}</Text>
      </View>

      <View style={styles.actionsCard}>
        <TouchableOpacity
          style={styles.loginBtn}
          onPress={() => navigation.navigate('Auth', { initialMode: 'login' })}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="shield-lock-outline" size={24} color="#fff" />
          <View style={styles.btnTextWrap}>
            <Text style={styles.loginBtnLabel}>{t('login')}</Text>
            <Text style={styles.loginBtnSub}>{t('login_sub')}</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{t('or_divider')}</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity
          style={styles.registerBtn}
          onPress={() => navigation.navigate('Auth', { initialMode: 'register' })}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="account-plus-outline" size={24} color={COLORS.primary} />
          <View style={styles.btnTextWrap}>
            <Text style={styles.registerBtnLabel}>{t('register')}</Text>
            <Text style={styles.registerBtnSub}>{t('register_sub')}</Text>
          </View>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function getStyles(C) {
  return StyleSheet.create({
  screen:         { flex: 1, backgroundColor: C.primary },
  content:        { flexGrow: 1, padding: 20, paddingBottom: 40 },

  langRow:        { flexDirection: 'row', backgroundColor: '#fff', marginBottom: 30, borderRadius: RADIUS.xl, overflow: 'hidden', alignSelf: 'center' },
  langBtn:        { paddingHorizontal: 28, paddingVertical: 10, alignItems: 'center' },
  langBtnActive:  { backgroundColor: C.primaryFixed + '40' },
  langBtnText:    { fontSize: 13, fontFamily: FONT.bodyMedium },
  langBtnTextActive: { color: C.primary, fontWeight: '700' },

  hero:           { alignItems: 'center', marginBottom: 40 },
  heroIconWrap:   { width: 80, height: 80, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  appName:        { fontSize: 36, fontFamily: FONT.headline, color: '#fff', letterSpacing: -1 },
  tagline:        { fontSize: 15, fontFamily: FONT.body, color: 'rgba(255,255,255,0.85)', marginTop: 6 },
  description:    { fontSize: 13, fontFamily: FONT.body, color: 'rgba(255,255,255,0.7)', marginTop: 10, textAlign: 'center', lineHeight: 18, paddingHorizontal: 20 },

  actionsCard: {
    backgroundColor: C.surfaceLowest, borderRadius: RADIUS.xxl,
    padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 8,
  },

  loginBtn: {
    backgroundColor: C.primary, borderRadius: RADIUS.xl,
    padding: 16, flexDirection: 'row', alignItems: 'center',
    shadowColor: C.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  loginBtnLabel:  { color: '#fff', fontSize: 16, fontFamily: FONT.bold },
  loginBtnSub:    { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontFamily: FONT.body, marginTop: 2 },

  divider:        { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  dividerLine:    { flex: 1, height: 0.5, backgroundColor: C.surfaceHigh },
  dividerText:    { fontSize: 12, fontFamily: FONT.bodyMedium },

  registerBtn: {
    borderWidth: 1.5, borderColor: C.primary, borderRadius: RADIUS.xl,
    padding: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: C.surfaceLowest,
  },
  registerBtnLabel: { color: C.primary, fontSize: 16, fontFamily: FONT.bold },
  registerBtnSub: { color: C.primaryContainer, fontSize: 12, fontFamily: FONT.body, marginTop: 2 },

  btnTextWrap:    { flex: 1, marginLeft: 12 },
  });
}
