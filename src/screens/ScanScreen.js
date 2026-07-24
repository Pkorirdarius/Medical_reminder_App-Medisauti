import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Animated, Dimensions, Alert, Modal, FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Camera } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';

import { RADIUS, SHADOW, FONT } from '../utils/constants';
import { getUser, getPrescriptions } from '../utils/storage';
import { useLanguage } from '../utils/LanguageContext';
import { useTheme } from '../utils/ThemeContext';
import { formatTime12 } from '../utils/reminders';

const { width: SCREEN_W } = Dimensions.get('window');
const SIDE_PAD = 16;

export default function ScanScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const cameraRef = useRef(null);
  const [user, setUser]           = useState({ name: '' });
  const [hasPermission, setHasPermission] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [recentScans, setRecentScans] = useState([]);
  const [showRecent, setShowRecent] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const { language, toggleLanguage, t } = useLanguage();
  const { COLORS } = useTheme();
  const styles = useMemo(() => getStyles(COLORS), [COLORS]);

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
      const [u, meds] = await Promise.all([getUser(), getPrescriptions()]);
      if (u) setUser(u);
      setRecentScans(meds.filter(m => m.source === 'scan').slice(0, 10));
    })();
  }, []));

  async function handleScan() {
    if (!cameraRef.current) {
      Alert.alert(t('error'), 'Camera not ready');
      return;
    }
    setScanning(true);
    try {
      const result = await cameraRef.current.takePictureAsync({ quality: 0.8, base64: true });
      navigation.navigate('PrescriptionForm', { scanImage: result.base64, source: 'scan' });
    } catch (e) {
      Alert.alert(t('error'), e.message);
    } finally {
      setScanning(false);
    }
  }

  async function handlePickImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('permission_title'), t('permission_desc'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets?.[0]) {
      setScanning(true);
      navigation.navigate('PrescriptionForm', { scanImage: result.assets[0].base64, source: 'scan' });
      setScanning(false);
    }
  }

  function handleManualEntry() {
    navigation.navigate('PrescriptionForm');
  }

  const avatarLetters = (user.name || 'U').slice(0, 2).toUpperCase();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons name="menu" size={24} color={COLORS.primary} />
          </TouchableOpacity>
          <Text style={styles.logoText}>MediSauti</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={toggleLanguage} style={styles.langBtn}>
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
            {t('hero_title')}
          </Text>
          <Text style={styles.heroSub}>{t('hero_subtitle')}</Text>
        </View>

        {/* ── Camera Viewfinder ── */}
        <View style={styles.viewfinder}>
          {hasPermission && !scanning ? (
            <Camera style={styles.camera} ref={cameraRef} type={Camera.Constants.Type.back} flashMode={torchOn ? Camera.Constants.FlashMode.torch : Camera.Constants.FlashMode.off} />
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
                {scanning ? t('scanning') : t('ready_to_scan')}
              </Text>
            </View>
          </View>

          {/* Camera Controls */}
          <View style={styles.cameraControls}>
            <TouchableOpacity style={styles.ctrlBtn} onPress={() => setTorchOn(p => !p)}>
              <MaterialCommunityIcons name={torchOn ? 'flashlight' : 'flashlight-off'} size={22} color="#fff" />
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
              <Text style={styles.actionTitle}>{t('manual_entry')}</Text>
              <Text style={styles.actionDesc}>{t('manual_entry_desc')}</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.primary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={() => setShowRecent(true)}>
            <View style={[styles.actionIconWrap, { backgroundColor: COLORS.secondaryContainer + '50' }]}>
              <MaterialCommunityIcons name="history" size={24} color={COLORS.onSecondaryContainer} />
            </View>
            <View style={styles.actionTextWrap}>
              <Text style={styles.actionTitle}>{t('recent_scans')}</Text>
              <Text style={styles.actionDesc}>{t('recent_scans_desc')}</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {/* ── Pro Tip ── */}
        <View style={styles.tipCard}>
          <View style={styles.tipContent}>
            <View style={styles.tipBadge}>
              <Text style={styles.tipBadgeText}>{t('pro_tip_badge')}</Text>
            </View>
            <Text style={styles.tipTitle}>{t('pro_tip_title')}</Text>
            <Text style={styles.tipDesc}>{t('pro_tip_desc')}</Text>
          </View>
          <View style={styles.tipDeco} />
        </View>
      </ScrollView>

      {/* ── Recent Scans Modal ── */}
      <Modal visible={showRecent} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalScreen, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowRecent(false)}>
              <MaterialCommunityIcons name="close" size={24} color={COLORS.onSurface} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{t('recent_scans')}</Text>
            <View style={{ width: 24 }} />
          </View>
          {recentScans.length === 0 ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
              <MaterialCommunityIcons name="scan-off" size={48} color={COLORS.outline} />
              <Text style={{ fontSize: 14, fontFamily: FONT.body, color: COLORS.outline, marginTop: 12, textAlign: 'center' }}>
                {t('empty_medications_sub')}
              </Text>
            </View>
          ) : (
            <FlatList
              data={recentScans}
              keyExtractor={item => item.id}
              contentContainerStyle={{ padding: 16 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.scanItem}
                  onPress={() => { setShowRecent(false); navigation.navigate('PrescriptionForm', { scanImage: null, source: 'scan' }); }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.scanItemIcon, { backgroundColor: COLORS.primary + '15' }]}>
                    <MaterialCommunityIcons name="pill" size={20} color={COLORS.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.scanItemName}>{item.drugName} {item.dosage}</Text>
                    <Text style={styles.scanItemDetail}>{item.frequency} · {item.times?.join(', ')}</Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={18} color={COLORS.outline} />
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </Modal>
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
    paddingHorizontal: SIDE_PAD,
    paddingVertical: 12,
    backgroundColor: C.background,
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
    color: C.primary,
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
    backgroundColor: C.primary + '12',
  },
  langBtnText: {
    fontSize: 11,
    fontFamily: FONT.bodyBold,
    color: C.primary,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.pill,
    backgroundColor: C.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: C.primary + '20',
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
    color: C.onSurface,
    letterSpacing: -0.5,
    lineHeight: 38,
  },
  heroTitleAccent: {
    color: C.primary,
  },
  heroSub: {
    fontSize: 15,
    fontFamily: FONT.body,
    color: C.onSurfaceVariant,
    marginTop: 6,
    lineHeight: 22,
  },
  viewfinder: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    backgroundColor: C.onSurface,
    borderWidth: 3,
    borderColor: C.surfaceHigh,
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
    borderColor: C.primaryFixed,
    overflow: 'hidden',
  },
  scanLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: C.primary,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 6,
  },
  cornerTL: {
    position: 'absolute', top: 0, left: 0,
    width: 24, height: 24,
    borderTopWidth: 4, borderLeftWidth: 4,
    borderColor: C.primary,
    borderTopLeftRadius: RADIUS.sm,
  },
  cornerTR: {
    position: 'absolute', top: 0, right: 0,
    width: 24, height: 24,
    borderTopWidth: 4, borderRightWidth: 4,
    borderColor: C.primary,
    borderTopRightRadius: RADIUS.sm,
  },
  cornerBL: {
    position: 'absolute', bottom: 0, left: 0,
    width: 24, height: 24,
    borderBottomWidth: 4, borderLeftWidth: 4,
    borderColor: C.primary,
    borderBottomLeftRadius: RADIUS.sm,
  },
  cornerBR: {
    position: 'absolute', bottom: 0, right: 0,
    width: 24, height: 24,
    borderBottomWidth: 4, borderRightWidth: 4,
    borderColor: C.primary,
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
    color: C.primary,
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
    backgroundColor: C.surfaceLow,
    borderRadius: RADIUS.xl,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: C.outline + '12',
  },
  actionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.lg,
    backgroundColor: C.secondaryContainer + '40',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTextWrap: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontFamily: FONT.bold,
    color: C.onSurface,
  },
  actionDesc: {
    fontSize: 12,
    fontFamily: FONT.body,
    color: C.onSurfaceVariant,
    marginTop: 2,
  },
  tipCard: {
    backgroundColor: C.primary,
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
    color: C.primaryFixed,
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
  modalScreen: {
    flex: 1,
    backgroundColor: C.background,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: C.surfaceLowest, borderBottomWidth: 0.5, borderBottomColor: C.surfaceHigh,
  },
  modalTitle: {
    fontSize: 17, fontFamily: FONT.bold, color: C.onSurface,
  },
  scanItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.surfaceLowest, borderRadius: RADIUS.xl, padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  scanItemIcon: {
    width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  scanItemName: {
    fontSize: 14, fontFamily: FONT.bodySemiBold, color: C.onSurface,
  },
  scanItemDetail: {
    fontSize: 12, fontFamily: FONT.body, color: C.onSurfaceVariant, marginTop: 2,
  },
  });
}
