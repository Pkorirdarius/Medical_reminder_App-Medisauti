import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  USER:          'medisauti:user',
  PRESCRIPTIONS: 'medisauti:prescriptions',
  ADHERENCE:     'medisauti:adherence_logs',
};

// ─── User ────────────────────────────────────────────────────────────
export async function saveUser(user) {
  await AsyncStorage.setItem(KEYS.USER, JSON.stringify(user));
}

export async function getUser() {
  const raw = await AsyncStorage.getItem(KEYS.USER);
  return raw ? JSON.parse(raw) : null;
}

// ─── Prescriptions ───────────────────────────────────────────────────
export async function getPrescriptions() {
  const raw = await AsyncStorage.getItem(KEYS.PRESCRIPTIONS);
  return raw ? JSON.parse(raw) : [];
}

export async function savePrescription(prescription) {
  const list = await getPrescriptions();
  const idx = list.findIndex(p => p.id === prescription.id);
  if (idx >= 0) {
    list[idx] = prescription;
  } else {
    list.push({ ...prescription, id: prescription.id || Date.now().toString() });
  }
  await AsyncStorage.setItem(KEYS.PRESCRIPTIONS, JSON.stringify(list));
}

export async function deletePrescription(id) {
  const list = await getPrescriptions();
  const updated = list.filter(p => p.id !== id);
  await AsyncStorage.setItem(KEYS.PRESCRIPTIONS, JSON.stringify(updated));
}

// ─── Adherence Logs ──────────────────────────────────────────────────
export async function getLogs() {
  const raw = await AsyncStorage.getItem(KEYS.ADHERENCE);
  return raw ? JSON.parse(raw) : [];
}

/**
 * Log a dose event.
 * @param {string} prescriptionId
 * @param {'taken'|'missed'|'snoozed'} status
 * @param {string} scheduledTime  ISO string of the scheduled dose time
 */
export async function logDose(prescriptionId, status, scheduledTime) {
  const logs = await getLogs();
  logs.push({
    id:             Date.now().toString(),
    prescriptionId,
    status,
    scheduledTime,
    loggedAt:       new Date().toISOString(),
  });
  await AsyncStorage.setItem(KEYS.ADHERENCE, JSON.stringify(logs));
}

// ─── Analytics ───────────────────────────────────────────────────────
/**
 * Calculate adherence % for the past N days.
 * Returns { rate, taken, missed, total }
 */
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

/**
 * Returns an array of { date: 'YYYY-MM-DD', status: 'taken'|'missed'|'partial' }
 * for the past N days — useful for the weekly streak view.
 */
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
