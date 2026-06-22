import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Animated, Dimensions, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Camera } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';

import { COLORS, RADIUS, SHADOW, FONT } from '../utils/constants';
import { getUser, getPrescriptions } from '../utils/storage';

const { width: SCREEN_W } = Dimensions.get('window');
const SIDE_PAD = 16;

export default function ScanScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [user, setUser] = useState({ name: 'User' });
  const [hasPermission, setHasPermission] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [recentScans, setRecentScans] = useState([]);
  const [language, setLang] = useState('sw');

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  useFocusEffect(useCallback(() => {
    (async () => {
      const u = await getUser();
      if (u) setUser(u);
    })();
  }, []));

  async function handleScan() {
    setScanning(true);
    setTimeout(() => {
      setScanning(false);
      navigation.navigate('Dawa', { screen: 'PrescriptionForm', params: { source: 'scan' } });
    }, 2000);
  }

  async function handlePickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (!result.canceled) {
      setScanning(true);
      setTimeout(() => {
        setScanning(false);
        navigation.navigate('Dawa', { screen: 'PrescriptionForm', params: { source: 'scan' } });
      }, 1500);
    }
  }

  function handleManualEntry() {
    navigation.navigate('Dawa', { screen: 'PrescriptionForm' });
  }

  const avatarLetters = (user.name || 'U').slice(0, 2).toUpperCase();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.getParent()?.openDrawer?.()}>
            <MaterialCommunityIcons name="menu" size={24} color={COLORS.primary} />
          </TouchableOpacity>
          <Text style={styles.logoText}>MediSauti</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={() => setLang(l => l === 'sw' ? 'en' : 'sw')} style={styles.langBtn}>
            <Text style={styles.langBtnText}>{language === 'sw' ? 'SW' : 'EN'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={styles.avatar}>
            <Text style={styles.avatarText}>{avatarLetters}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ── */}
        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>
            Sauti ya <Text style={styles.heroTitleAccent}>Dawa</Text>
          </Text>
          <Text style={styles.heroSub}>
            {language === 'sw'
              ? 'Changanua lebo yako ili upate maelezo ya sauti.'
              : 'Scan your medication label to get audio instructions.'}
          </Text>
        </View>

        {/* ── Camera Viewfinder ── */}
        <View style={styles.viewfinder}>
          {hasPermission && !scanning ? (
            <Camera style={styles.camera} type={Camera.Constants.Type.back} />
          ) : (
            <View style={styles.cameraPlaceholder}>
              <MaterialCommunityIcons name="camera" size={48} color={COLORS.outline} />
            </View>
          )}

          {/* Overlay Frame */}
          <View style={styles.scanOverlay}>
            <View style={styles.scanFrame}>
              <Animated.View style={[styles.scanLine, { opacity: pulseAnim }]} />
              <View style={styles.cornerTL} />
              <View style={styles.cornerTR} />
              <View style={styles.cornerBL} />
              <View style={styles.cornerBR} />
            </View>
            <View style={styles.statusBadge}>
              <MaterialCommunityIcons name={scanning ? 'sync' : 'camera-iris'} size={18} color={COLORS.primary} />
              <Text style={styles.statusText}>
                {scanning
                  ? (language === 'sw' ? 'Inasoma...' : 'Scanning...')
                  : (language === 'sw' ? 'Tayari kuchanganua' : 'Ready to scan')}
              </Text>
            </View>
          </View>

          {/* Camera Controls */}
          <View style={styles.cameraControls}>
            <TouchableOpacity style={styles.ctrlBtn} onPress={handleScan}>
              <MaterialCommunityIcons name="flashlight" size={22} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.shutterBtn} onPress={handleScan}>
              <View style={styles.shutterInner} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.ctrlBtn} onPress={handlePickImage}>
              <MaterialCommunityIcons name="image" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Action Cards ── */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionCard} onPress={handleManualEntry}>
            <View style={styles.actionIconWrap}>
              <MaterialCommunityIcons name="keyboard" size={24} color={COLORS.onSecondaryContainer} />
            </View>
            <View style={styles.actionTextWrap}>
              <Text style={styles.actionTitle}>
                {language === 'sw' ? 'Andika Mwenyewe' : 'Manual Entry'}
              </Text>
              <Text style={styles.actionDesc}>
                {language === 'sw' ? 'Ingiza dawa kwa mkono.' : 'Type medication details manually.'}
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.primary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={() => {}}>
            <View style={[styles.actionIconWrap, { backgroundColor: COLORS.secondaryContainer + '50' }]}>
              <MaterialCommunityIcons name="history" size={24} color={COLORS.onSecondaryContainer} />
            </View>
            <View style={styles.actionTextWrap}>
              <Text style={styles.actionTitle}>
                {language === 'sw' ? 'Historia' : 'Recent Scans'}
              </Text>
              <Text style={styles.actionDesc}>
                {language === 'sw' ? 'Dawa zilizochanganuliwa hivi karibuni.' : 'Recently scanned medications.'}
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {/* ── Pro Tip ── */}
        <View style={styles.tipCard}>
          <View style={styles.tipContent}>
            <View style={styles.tipBadge}>
              <Text style={styles.tipBadgeText}>{language === 'sw' ? 'USHAURI' : 'PRO TIP'}</Text>
            </View>
            <Text style={styles.tipTitle}>
              {language === 'sw' ? 'Hakikisha mwanga mzuri' : 'Ensure good lighting'}
            </Text>
            <Text style={styles.tipDesc}>
              {language === 'sw'
                ? 'Weka chupa ya dawa mahali penye mwanga mzuri na epuka mionzi kwenye lebo.'
                : 'Place your medicine bottle in a well-lit area. Avoid glares on the label.'}
            </Text>
          </View>
          <View style={styles.tipDeco} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIDE_PAD,
    paddingVertical: 12,
    backgroundColor: COLORS.background,
    borderBottomWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
    marginBottom: 4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoText: {
    fontSize: 20,
    fontFamily: FONT.headline,
    color: COLORS.primary,
    letterSpacing: -0.5,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.primary + '12',
  },
  langBtnText: {
    fontSize: 11,
    fontFamily: FONT.bodyBold,
    color: COLORS.primary,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.primary + '20',
  },
  avatarText: {
    fontSize: 12,
    fontFamily: FONT.bodyBold,
    color: '#fff',
  },
  scrollContent: {
    paddingHorizontal: SIDE_PAD,
    paddingBottom: 32,
  },
  heroSection: {
    marginTop: 16,
    marginBottom: 20,
  },
  heroTitle: {
    fontSize: 32,
    fontFamily: FONT.headline,
    color: COLORS.onSurface,
    letterSpacing: -0.5,
    lineHeight: 38,
  },
  heroTitleAccent: {
    color: COLORS.primary,
  },
  heroSub: {
    fontSize: 15,
    fontFamily: FONT.body,
    color: COLORS.onSurfaceVariant,
    marginTop: 6,
    lineHeight: 22,
  },
  viewfinder: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    backgroundColor: COLORS.onSurface,
    borderWidth: 3,
    borderColor: COLORS.surfaceHigh,
    marginBottom: 16,
  },
  camera: {
    ...StyleSheet.absoluteFillObject,
  },
  cameraPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1a1c1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanFrame: {
    width: '75%',
    height: '50%',
    borderRadius: RADIUS.lg,
    borderWidth: 2,
    borderColor: COLORS.primaryFixed,
    overflow: 'hidden',
  },
  scanLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 6,
  },
  cornerTL: {
    position: 'absolute', top: 0, left: 0,
    width: 24, height: 24,
    borderTopWidth: 4, borderLeftWidth: 4,
    borderColor: COLORS.primary,
    borderTopLeftRadius: RADIUS.sm,
  },
  cornerTR: {
    position: 'absolute', top: 0, right: 0,
    width: 24, height: 24,
    borderTopWidth: 4, borderRightWidth: 4,
    borderColor: COLORS.primary,
    borderTopRightRadius: RADIUS.sm,
  },
  cornerBL: {
    position: 'absolute', bottom: 0, left: 0,
    width: 24, height: 24,
    borderBottomWidth: 4, borderLeftWidth: 4,
    borderColor: COLORS.primary,
    borderBottomLeftRadius: RADIUS.sm,
  },
  cornerBR: {
    position: 'absolute', bottom: 0, right: 0,
    width: 24, height: 24,
    borderBottomWidth: 4, borderRightWidth: 4,
    borderColor: COLORS.primary,
    borderBottomRightRadius: RADIUS.sm,
  },
  statusBadge: {
    marginTop: 24,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: RADIUS.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  statusText: {
    fontSize: 12,
    fontFamily: FONT.bodyBold,
    color: COLORS.primary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  cameraControls: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
  },
  ctrlBtn: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.pill,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterBtn: {
    width: 72,
    height: 72,
    borderRadius: RADIUS.pill,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  shutterInner: {
    width: '100%',
    height: '100%',
    borderRadius: RADIUS.pill,
    backgroundColor: '#fff',
  },
  actionRow: {
    gap: 12,
    marginBottom: 20,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLow,
    borderRadius: RADIUS.xl,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: COLORS.outline + '12',
  },
  actionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.secondaryContainer + '40',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTextWrap: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontFamily: FONT.bold,
    color: COLORS.onSurface,
  },
  actionDesc: {
    fontSize: 12,
    fontFamily: FONT.body,
    color: COLORS.onSurfaceVariant,
    marginTop: 2,
  },
  tipCard: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.xl,
    padding: 24,
    overflow: 'hidden',
    marginBottom: 16,
  },
  tipContent: {
    position: 'relative',
    zIndex: 1,
  },
  tipBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: RADIUS.pill,
    marginBottom: 12,
  },
  tipBadgeText: {
    fontSize: 10,
    fontFamily: FONT.bodyBold,
    color: '#fff',
    letterSpacing: 1.5,
  },
  tipTitle: {
    fontSize: 20,
    fontFamily: FONT.headline,
    color: '#fff',
    marginBottom: 8,
  },
  tipDesc: {
    fontSize: 15,
    fontFamily: FONT.body,
    color: COLORS.primaryFixed,
    lineHeight: 22,
  },
  tipDeco: {
    position: 'absolute',
    right: -40,
    bottom: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
});
