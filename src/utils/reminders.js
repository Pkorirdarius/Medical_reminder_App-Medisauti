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

// ─── Dosage Detail Helpers ─────────────────────────────────────────
/**
 * Build a human-readable dosage instruction string.
 * @param {Object} prescription - { drugName, dosage, dosageQuantity, dosageForm }
 * @param {'sw'|'en'} language
 * @returns e.g. "Chukua moja tablet ya Metformin (500mg)" or "Take one tablet of Metformin (500mg)"
 */
export function buildDosageText(prescription, language = 'sw') {
  const { drugName, dosage, dosageQuantity, dosageForm } = prescription;
  const qty = parseInt(dosageQuantity, 10) || 0;
  const form = dosageForm || 'tablet';
  const formLabel = language === 'sw' ? FORM_LABELS_SW[form] || FORM_LABELS_SW.tablet : form;

  if (qty > 0) {
    const qtyWord = language === 'sw' ? QTY_WORDS_SW[qty] || String(qty) : String(qty);
    return language === 'sw'
      ? `Chukua ${qtyWord} ${formLabel} ya ${drugName}${dosage ? ' (' + dosage + ')' : ''}`
      : `Take ${qtyWord} ${formLabel} of ${drugName}${dosage ? ' (' + dosage + ')' : ''}`;
  }
  return language === 'sw'
    ? `Chukua ${drugName} ${dosage || ''}`
    : `Take ${drugName} ${dosage || ''}`;
}

/**
 * Build a TTS-friendly spoken dosage instruction string.
 */
export function buildDosageSpeech(prescription, timeLabel = 'sasa', language = 'sw') {
  const { drugName, dosage, dosageQuantity, dosageForm } = prescription;
  const qty = parseInt(dosageQuantity, 10) || 0;
  const form = dosageForm || 'tablet';
  const formLabel = language === 'sw' ? FORM_LABELS_SW[form] || FORM_LABELS_SW.tablet : form;

  if (qty > 0) {
    const qtyWord = language === 'sw' ? QTY_WORDS_SW[qty] || String(qty) : String(qty);
    return language === 'sw'
      ? `Karibu. Ni wakati wa kuchukua ${qtyWord} ${formLabel} ya ${drugName}${dosage ? ', ' + dosage : ''}, ${timeLabel}. Tafadhali kumbuka kuchukua dawa yako.`
      : `Hello. It is time to take ${qtyWord} ${formLabel} of ${drugName}${dosage ? ', ' + dosage : ''}, ${timeLabel}. Please remember to take your medicine.`;
  }
  return language === 'sw'
    ? `Karibu. Ni wakati wa kuchukua dawa yako ya ${drugName}${dosage ? ', ' + dosage : ''}, ${timeLabel}. Tafadhali kumbuka kuchukua dawa yako.`
    : `Hello. It is time to take your medication, ${drugName}${dosage ? ', ' + dosage : ''}, ${timeLabel}. Please remember to take your medicine.`;
}

const QTY_WORDS_SW = {
  1: 'moja', 2: 'mbili', 3: 'tatu', 4: 'nne', 5: 'tano',
  6: 'sita', 7: 'saba', 8: 'nane', 9: 'tisa', 10: 'kumi',
};

const FORM_LABELS_SW = {
  tablet: 'tableti', capsule: 'kapsuli', injection: 'sindano',
  syrup: 'dawa ya kunywa', drops: 'matone', inhaler: 'vutea',
  cream: 'krimu', ointment: 'dawa ya kupaka', suppository: 'viashiria',
  patch: 'patchi',
};

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

// ─── Android-compatible trigger builder ─────────────────────────────
function secondsUntil(hour, minute) {
  const now = new Date();
  const target = new Date(now);
  target.setHours(hour, minute, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  return Math.floor((target.getTime() - now.getTime()) / 1000);
}

function buildTrigger(hour, minute) {
  if (Platform.OS === 'android') {
    return { type: 'timeInterval', seconds: secondsUntil(hour, minute) };
  }
  return { type: 'daily', hour, minute };
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

  const body = buildDosageText(prescription, language);

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
        scheduledTime:  normalized,
        drugName:        prescription.drugName,
        dosage:          prescription.dosage,
        dosageQuantity:  prescription.dosageQuantity,
        dosageForm:      prescription.dosageForm,
        action:          'reminder',
      },
      sound: soundValue,
    },
    trigger: buildTrigger(hour, minute),
  });

  return notifId;
}

// ─── Auto-reschedule listener (Android) ─────────────────────────────
let _rescheduleSubscription = null;

export function setupReminderReschedule() {
  if (_rescheduleSubscription) return;
  if (Platform.OS !== 'android') return;

  _rescheduleSubscription = Notifications.addNotificationReceivedListener(
    async (notification) => {
      const { data } = notification.request.content;
      if (data?.action !== 'reminder') return;

      const normalized = normalizeTime(data.scheduledTime);
      const [h, m] = normalized.split(':').map(Number);

      const savedSound = await getNotificationSound();
      const soundValue = savedSound === 'none' ? undefined : savedSound === 'default' ? true : savedSound;

      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: notification.request.content.title,
            body:  notification.request.content.body,
            data,
            sound: soundValue,
          },
          trigger: buildTrigger(h, m),
        });
      } catch (e) {
        console.warn('Could not reschedule notification for', normalized, e);
      }
    },
  );
}

export function teardownReminderReschedule() {
  if (_rescheduleSubscription) {
    _rescheduleSubscription.remove();
    _rescheduleSubscription = null;
  }
}

export async function cancelReminder(notificationId) {
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

export async function cancelAllReminders() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function snoozeReminder(item, language = 'sw') {
  const savedSound = await getNotificationSound();
  const soundValue = savedSound === 'none' ? undefined : savedSound === 'default' ? true : savedSound;

  const title = language === 'sw' ? 'Dawa - Kikumbusho' : 'Medication Reminder';
  const body = buildDosageText({
    drugName: item.drugName,
    dosage: item.dosage,
    dosageQuantity: item.dosageQuantity,
    dosageForm: item.dosageForm,
  }, language);

  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: { prescriptionId: item.prescriptionId, scheduledTime: item.time, action: 'reminder' },
      sound: soundValue,
    },
    trigger: { type: 'timeInterval', seconds: 600 },
  });
}

// ─── Swahili Text-to-Speech ──────────────────────────────────────────
/**
 * Speak a medication reminder in Swahili (falls back to English).
 * @param {string|Object} drugOrRx - drug name string OR full prescription object
 * @param {string} dosageArg       - dosage (if passing string)
 * @param {string} timeLabel       - e.g. 'asubuhi' | 'jioni' | 'usiku'
 * @param {'sw'|'en'} language
 */
export function speakReminder(drugOrRx, dosageArg = '', timeLabel = 'sasa', language = 'sw') {
  let text;
  if (typeof drugOrRx === 'object' && drugOrRx !== null) {
    text = buildDosageSpeech(drugOrRx, timeLabel, language);
  } else {
    text = buildDosageSpeech({ drugName: drugOrRx, dosage: dosageArg }, timeLabel, language);
  }

  Speech.speak(text, {
    language:  language === 'sw' ? 'sw-KE' : 'en-KE',
    pitch:     1.0,
    rate:      0.85,
    onDone:    () => console.log('Speech done'),
    onError:   () => {
      const drugName = typeof drugOrRx === 'object' ? drugOrRx.drugName : drugOrRx;
      const dosage = typeof drugOrRx === 'object' ? drugOrRx.dosage : dosageArg;
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
export async function sendTestNotification(language = 'sw', drugName = 'Test', dosage = '500mg', dosageQuantity = '', dosageForm = 'tablet') {
  const rx = { drugName, dosage, dosageQuantity, dosageForm };
  const title = language === 'sw' ? 'Dawa - Jaribio la Kikumbusho' : 'Medication Reminder - Test';
  const body = buildDosageText(rx, language);

  const savedSound = await getNotificationSound();
  const soundValue = savedSound === 'none' ? undefined : savedSound === 'default' ? true : savedSound;

  const notifId = await Notifications.scheduleNotificationAsync({
    content: { title, body, data: { action: 'test' }, sound: soundValue },
    trigger: null,
  });

  speakReminder(rx, '', '', language);

  return notifId;
}
