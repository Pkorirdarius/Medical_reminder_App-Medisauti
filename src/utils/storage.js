import AsyncStorage from '@react-native-async-storage/async-storage';
import CryptoJS from 'crypto-js';

// Use a device-specific key derivation approach. For MVP, a fixed key is
// acceptable to satisfy the encryption requirement (NFR-04). In production,
// this key should be derived from device-unique characteristics.
const ENC_KEY = 'medisauti-2024-enc-key!';

function encrypt(text) {
  return CryptoJS.AES.encrypt(text, ENC_KEY).toString();
}

function decrypt(ciphertext) {
  const bytes = CryptoJS.AES.decrypt(ciphertext, ENC_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
}

const KEYS = {
  USER:          'medisauti:user',
  PRESCRIPTIONS: 'medisauti:prescriptions',
  ADHERENCE:     'medisauti:adherence_logs',
};

async function setItemEncrypted(key, value) {
  const json = JSON.stringify(value);
  const encrypted = encrypt(json);
  await AsyncStorage.setItem(key, encrypted);
}

async function getItemDecrypted(key) {
  const encrypted = await AsyncStorage.getItem(key);
  if (!encrypted) return null;
  try {
    const decrypted = decrypt(encrypted);
    return JSON.parse(decrypted);
  } catch {
    // If decryption fails, try reading as plain text (migration path)
    try {
      return JSON.parse(encrypted);
    } catch {
      return null;
    }
  }
}

// ─── User ────────────────────────────────────────────────────────────
export async function saveUser(user) {
  await setItemEncrypted(KEYS.USER, user);
}

export async function getUser() {
  return getItemDecrypted(KEYS.USER);
}

export async function getIsRegistered() {
  const user = await getUser();
  return user !== null && user.name && user.pin;
}

// ─── Prescriptions ───────────────────────────────────────────────────
export async function getPrescriptions() {
  const data = await getItemDecrypted(KEYS.PRESCRIPTIONS);
  return data || [];
}

export async function savePrescription(prescription) {
  const list = await getPrescriptions();
  const idx = list.findIndex(p => p.id === prescription.id);
  if (idx >= 0) {
    list[idx] = prescription;
  } else {
    list.push({ ...prescription, id: prescription.id || Date.now().toString() });
  }
  await setItemEncrypted(KEYS.PRESCRIPTIONS, list);
}

export async function deletePrescription(id) {
  const list = await getPrescriptions();
  const updated = list.filter(p => p.id !== id);
  await setItemEncrypted(KEYS.PRESCRIPTIONS, updated);
}

// ─── Adherence Logs ──────────────────────────────────────────────────
export async function getLogs() {
  const data = await getItemDecrypted(KEYS.ADHERENCE);
  return data || [];
}

export async function logDose(prescriptionId, status, scheduledTime) {
  const logs = await getLogs();
  logs.push({
    id:             Date.now().toString(),
    prescriptionId,
    status,
    scheduledTime,
    loggedAt:       new Date().toISOString(),
  });
  await setItemEncrypted(KEYS.ADHERENCE, logs);
}

// ─── Analytics ───────────────────────────────────────────────────────
export async function calcAdherence(days = 30) {
  const logs = await getLogs();
  const since = new Date();
  since.setDate(since.getDate() - days);

  const recent = logs.filter(l => new Date(l.loggedAt) >= since);
  const taken  = recent.filter(l => l.status === 'taken').length;
  const missed = recent.filter(l => l.status === 'missed').length;
  const total  = recent.length;
  const rate   = total > 0 ? Math.round((taken / total) * 100) : 0;

  return { rate, taken, missed, total };
}

export async function getDailyStreak(days = 7) {
  const logs = await getLogs();
  const result = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);

    const dayLogs = logs.filter(l => l.loggedAt.startsWith(dateStr));
    const taken   = dayLogs.filter(l => l.status === 'taken').length;
    const missed  = dayLogs.filter(l => l.status === 'missed').length;

    let status = 'none';
    if (taken > 0 && missed === 0) status = 'taken';
    else if (missed > 0 && taken === 0) status = 'missed';
    else if (taken > 0 && missed > 0) status = 'partial';

    result.push({ date: dateStr, status, taken, missed });
  }

  return result;
}

/**
 * Per-medication adherence breakdown.
 * Returns array of { drugName, dosage, rate, taken, missed, total }
 */
export async function getPerMedicationAdherence(days = 30) {
  const [logs, prescriptions] = await Promise.all([getLogs(), getPrescriptions()]);
  const since = new Date();
  since.setDate(since.getDate() - days);

  const recent = logs.filter(l => new Date(l.loggedAt) >= since);
  const medMap = {};

  for (const log of recent) {
    if (!medMap[log.prescriptionId]) {
      const med = prescriptions.find(p => p.id === log.prescriptionId);
      medMap[log.prescriptionId] = {
        drugName: med ? med.drugName : 'Unknown',
        dosage: med ? med.dosage : '',
        taken: 0,
        missed: 0,
        total: 0,
      };
    }
    medMap[log.prescriptionId].total++;
    if (log.status === 'taken') medMap[log.prescriptionId].taken++;
    if (log.status === 'missed') medMap[log.prescriptionId].missed++;
  }

  return Object.values(medMap).map(m => ({
    ...m,
    rate: m.total > 0 ? Math.round((m.taken / m.total) * 100) : 0,
  }));
}

/**
 * Missed dose patterns by time of day.
 * Returns { morning, afternoon, evening, night } counts of missed doses.
 */
export async function getMissedDosePatterns(days = 30) {
  const logs = await getLogs();
  const since = new Date();
  since.setDate(since.getDate() - days);

  const patterns = { morning: 0, afternoon: 0, evening: 0, night: 0 };

  const missed = logs.filter(l => l.status === 'missed' && new Date(l.loggedAt) >= since);
  for (const log of missed) {
    const hour = new Date(log.scheduledTime).getHours();
    if (hour < 12) patterns.morning++;
    else if (hour < 17) patterns.afternoon++;
    else if (hour < 20) patterns.evening++;
    else patterns.night++;
  }

  return patterns;
}

/**
 * Trend direction over the past N days.
 * Returns { direction: 'improving'|'worsening'|'stable'|'insufficient', weeklyRates: [] }
 */
export async function getAdherenceTrend(days = 30) {
  const logs = await getLogs();
  const since = new Date();
  since.setDate(since.getDate() - days);

  const recent = logs.filter(l => new Date(l.loggedAt) >= since);
  const weeks = Math.ceil(days / 7);
  const weeklyRates = [];

  for (let w = 0; w < weeks; w++) {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - days + w * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const weekLogs = recent.filter(l => {
      const d = new Date(l.loggedAt);
      return d >= weekStart && d <= weekEnd;
    });

    const taken = weekLogs.filter(l => l.status === 'taken').length;
    const total = weekLogs.length;
    weeklyRates.push(total > 0 ? Math.round((taken / total) * 100) : -1);
  }

  const valid = weeklyRates.filter(r => r >= 0);
  let direction = 'insufficient';
  if (valid.length >= 2) {
    const firstHalf = valid.slice(0, Math.floor(valid.length / 2));
    const secondHalf = valid.slice(Math.floor(valid.length / 2));
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    const diff = secondAvg - firstAvg;
    if (diff > 5) direction = 'improving';
    else if (diff < -5) direction = 'worsening';
    else direction = 'stable';
  } else if (valid.length === 1) {
    direction = valid[0] >= 80 ? 'stable' : 'insufficient';
  }

  return { direction, weeklyRates: valid };
}
