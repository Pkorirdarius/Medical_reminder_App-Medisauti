import * as Notifications from 'expo-notifications';
import * as Speech from 'expo-speech';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIF_SOUND_KEY = 'medisauti:notifSound';
const DEFAULT_SOUND = 'default';

export const SOUND_OPTIONS = [
  { key: 'default',   sw: 'Sauti ya kawaida',   en: 'Default' },
  { key: 'none',      sw: 'Hakuna sauti',        en: 'None' },
];

// ─── Notification Setup ──────────────────────────────────────────────
export async function requestNotificationPermission() {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function getNotificationPermissionStatus() {
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
  }),
});

// ─── Notification Sound Preferences ──────────────────────────────────
export async function saveNotificationSound(soundKey) {
  await AsyncStorage.setItem(NOTIF_SOUND_KEY, soundKey);
  if (Platform.OS === 'android') {
    const soundName = soundKey === 'none' ? null : soundKey === 'default' ? null : soundKey;
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.HIGH,
      sound: soundName,
      vibrationPattern: [0, 250, 250, 250],
    });
  }
}

export async function getNotificationSound() {
  const saved = await AsyncStorage.getItem(NOTIF_SOUND_KEY);
  return saved || DEFAULT_SOUND;
}

/**
 * Normalize a time string to HH:MM format.
 * '8' → '08:00', '8:5' → '08:05', '08:00' → '08:00'
 */
export function normalizeTime(t) {
  if (!t || !t.includes(':')) {
    const h = String(parseInt(t, 10) || 0).padStart(2, '0');
    return `${h}:00`;
  }
  const [h, m] = t.split(':');
  return `${String(parseInt(h, 10) || 0).padStart(2, '0')}:${String(parseInt(m, 10) || 0).padStart(2, '0')}`;
}

// ─── Schedule a recurring local notification ─────────────────────────
/**
 * @param {Object} prescription  - { id, drugName, dosage, times: ['08:00', '18:00'] }
 * @param {string} time          - e.g. '08:00'
 * @param {string} language      - 'sw' (Swahili) | 'en' (English)
 * @returns notificationId
 */
export async function scheduleReminder(prescription, time, language = 'sw') {
  const normalized = normalizeTime(time);
  const [hour, minute] = normalized.split(':').map(Number);

  const body =
    language === 'sw'
      ? `Ni wakati wa kuchukua ${prescription.drugName} ${prescription.dosage}`
      : `Time to take your ${prescription.drugName} ${prescription.dosage}`;

  const title =
    language === 'sw' ? 'Dawa - Kikumbusho' : 'Medication Reminder';

  const savedSound = await getNotificationSound();
  const soundValue = savedSound === 'none' ? undefined : savedSound === 'default' ? true : savedSound;

  const notifId = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: {
        prescriptionId: prescription.id,
        scheduledTime:  time,
        action:         'reminder',
      },
      sound: soundValue,
    },
    trigger: {
      type: 'daily',
      hour,
      minute,
    },
  });

  return notifId;
}

export async function cancelReminder(notificationId) {
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

export async function cancelAllReminders() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// ─── Swahili Text-to-Speech ──────────────────────────────────────────
/**
 * Speak a medication reminder in Swahili (falls back to English).
 * @param {string} drugName
 * @param {string} dosage
 * @param {string} timeLabel  - e.g. 'asubuhi' | 'jioni' | 'usiku'
 * @param {'sw'|'en'} language
 */
export function speakReminder(drugName, dosage, timeLabel = 'sasa', language = 'sw') {
  const text =
    language === 'sw'
      ? `Karibu. Ni wakati wa kuchukua dawa yako ya ${drugName}, ${dosage}, ${timeLabel}. Tafadhali kumbuka kuchukua dawa yako.`
      : `Hello. It is time to take your medication, ${drugName}, ${dosage}. Please remember to take your medicine.`;

  Speech.speak(text, {
    language:  language === 'sw' ? 'sw-KE' : 'en-KE',
    pitch:     1.0,
    rate:      0.85,
    onDone:    () => console.log('Speech done'),
    onError:   () => {
      // Fallback to English if Swahili TTS not available
      Speech.speak(
        `Time to take your ${drugName} ${dosage}`,
        { language: 'en-US', pitch: 1.0, rate: 0.9 }
      );
    },
  });
}

export function stopSpeaking() {
  Speech.stop();
}

// ─── Time label helpers ──────────────────────────────────────────────
export function getTimeLabel(time24, language = 'sw') {
  const hour = parseInt(time24.split(':')[0], 10);

  if (language === 'sw') {
    if (hour < 12)  return 'asubuhi';
    if (hour < 17)  return 'mchana';
    if (hour < 20)  return 'jioni';
    return 'usiku';
  } else {
    if (hour < 12)  return 'morning';
    if (hour < 17)  return 'afternoon';
    if (hour < 20)  return 'evening';
    return 'night';
  }
}

export function formatTime12(time24) {
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
}

// ─── Test Notification ──────────────────────────────────────────────
export async function sendTestNotification(language = 'sw', drugName = 'Test', dosage = '500mg') {
  const title = language === 'sw' ? 'Dawa - Jaribio la Kikumbusho' : 'Medication Reminder - Test';
  const body = language === 'sw'
    ? `Huu ni jaribio la kikumbusho cha ${drugName} ${dosage}`
    : `This is a test reminder for ${drugName} ${dosage}`;

  const savedSound = await getNotificationSound();
  const soundValue = savedSound === 'none' ? undefined : savedSound === 'default' ? true : savedSound;

  const notifId = await Notifications.scheduleNotificationAsync({
    content: { title, body, data: { action: 'test' }, sound: soundValue },
    trigger: null,
  });

  speakReminder(drugName, dosage, 'sasa', language);

  return notifId;
}
