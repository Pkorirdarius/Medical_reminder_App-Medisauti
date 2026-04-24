import * as Notifications from 'expo-notifications';
import * as Speech from 'expo-speech';

// ─── Notification Setup ──────────────────────────────────────────────
export async function requestNotificationPermission() {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
  }),
});

// ─── Schedule a recurring local notification ─────────────────────────
/**
 * @param {Object} prescription  - { id, drugName, dosage, times: ['08:00', '18:00'] }
 * @param {string} time          - e.g. '08:00'
 * @param {string} language      - 'sw' (Swahili) | 'en' (English)
 * @returns notificationId
 */
export async function scheduleReminder(prescription, time, language = 'sw') {
  const [hour, minute] = time.split(':').map(Number);

  const body =
    language === 'sw'
      ? `Ni wakati wa kuchukua ${prescription.drugName} ${prescription.dosage}`
      : `Time to take your ${prescription.drugName} ${prescription.dosage}`;

  const title =
    language === 'sw' ? '💊 Dawa yako inakungoja!' : '💊 Medication reminder';

  const notifId = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: {
        prescriptionId: prescription.id,
        scheduledTime:  time,
        action:         'reminder',
      },
      sound: true,
    },
    trigger: {
      hour,
      minute,
      repeats: true,
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
