import AsyncStorage from '@react-native-async-storage/async-storage';

const ENC_KEY = 'medisauti-2024-enc-key!';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

function b64encode(str) {
  let out = '';
  for (let i = 0; i < str.length; i += 3) {
    const a = str.charCodeAt(i) || 0;
    const b = str.charCodeAt(i + 1) || 0;
    const c = str.charCodeAt(i + 2) || 0;
    out += B64[a >> 2];
    out += B64[((a & 3) << 4) | (b >> 4)];
    out += B64[((b & 15) << 2) | (c >> 6)];
    out += B64[c & 63];
  }
  const pad = str.length % 3;
  if (pad === 1) { out = out.slice(0, -2) + '=='; }
  else if (pad === 2) { out = out.slice(0, -1) + '='; }
  return out;
}

function b64decode(str) {
  str = str.replace(/[^A-Za-z0-9+/=]/g, '');
  let out = '';
  for (let i = 0; i < str.length; i += 4) {
    const a = B64.indexOf(str[i] || '=');
    const b = B64.indexOf(str[i + 1] || '=');
    const c = B64.indexOf(str[i + 2] || '=');
    const d = B64.indexOf(str[i + 3] || '=');
    out += String.fromCharCode((a << 2) | (b >> 4));
    if (c !== 64) out += String.fromCharCode(((b & 15) << 4) | (c >> 2));
    if (d !== 64) out += String.fromCharCode(((c & 3) << 6) | d);
  }
  return out;
}

function simpleXOR(text, key) {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    out += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return out;
}

function encrypt(text) {
  const xor = simpleXOR(text, ENC_KEY);
  return b64encode(unescape(encodeURIComponent(xor)));
}

function decrypt(ciphertext) {
  try {
    const xor = decodeURIComponent(escape(b64decode(ciphertext)));
    return simpleXOR(xor, ENC_KEY);
  } catch {
    return '';
  }
}

const KEYS = {
  USER:          'medisauti:user',
  PRESCRIPTIONS: 'medisauti:prescriptions',
  ADHERENCE:     'medisauti:adherence_logs',
  DOCTORS:       'medisauti:doctors',
  MY_DOCTOR:     'medisauti:my_doctor',
  SCHEDULES:     'medisauti:schedules',
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
    try {
      return JSON.parse(encrypted);
    } catch {
      return null;
    }
  }
}

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

const CONDITION_PRESETS = {
  diabetes: [
    { drugName: 'Metformin', dosage: '500mg', frequency: 'Mara mbili kwa siku', times: ['08:00', '20:00'], notes: 'Pamoja na chakula', source: 'system', voiceNotif: true },
  ],
  bp: [
    { drugName: 'Amlodipine', dosage: '5mg', frequency: 'Mara moja kwa siku', times: ['08:00'], notes: 'Asubuhi baada ya kiamsha kinywa', source: 'system', voiceNotif: true },
  ],
  hiv: [
    { drugName: 'TLD (Tenofovir/Lamivudine/Dolutegravir)', dosage: '300/300/50mg', frequency: 'Mara moja kwa siku', times: ['20:00'], notes: 'Usiku kabla ya kulala', source: 'system', voiceNotif: true },
  ],
};

// ── Doctor / Role Management ──────────────────────────────────────────
export async function getDoctors() {
  const data = await getItemDecrypted(KEYS.DOCTORS);
  return data || [];
}

export async function saveDoctorProfile(doctor) {
  const list = await getDoctors();
  const idx = list.findIndex(d => d.phone === doctor.phone);
  if (idx >= 0) {
    list[idx] = { ...doctor, updatedAt: new Date().toISOString() };
  } else {
    list.push({ ...doctor, id: Date.now().toString(), createdAt: new Date().toISOString() });
  }
  await setItemEncrypted(KEYS.DOCTORS, list);
}

export async function getMyDoctor() {
  return getItemDecrypted(KEYS.MY_DOCTOR);
}

export async function setMyDoctor(doctor) {
  if (doctor) {
    await setItemEncrypted(KEYS.MY_DOCTOR, doctor);
  } else {
    await AsyncStorage.removeItem(KEYS.MY_DOCTOR);
  }
}

export async function addConditionPrescriptions(condition) {
  const c = condition.toLowerCase();
  let presets = [];
  if (c.includes('kisukari') || c.includes('diabetes')) presets = CONDITION_PRESETS.diabetes;
  else if (c.includes('shinikizo') || c.includes('blood pressure') || c.includes('bp') || c.includes('damu')) presets = CONDITION_PRESETS.bp;
  else if (c.includes('hiv') || c.includes('vvu')) presets = CONDITION_PRESETS.hiv;

  if (presets.length === 0) return [];

  const existing = await getPrescriptions();
  const created = [];
  for (const preset of presets) {
    const rx = {
      id: Date.now().toString() + Math.random().toString(36).slice(2, 8),
      ...preset,
      createdAt: new Date().toISOString(),
      active: true,
      notifIds: [],
    };
    existing.push(rx);
    created.push(rx);
  }
  await setItemEncrypted(KEYS.PRESCRIPTIONS, existing);
  return created;
}

export async function getCurrentStreak() {
  const logs = await getLogs();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let streak = 0;
  let checking = new Date(today);

  while (true) {
    const dateStr = checking.toISOString().slice(0, 10);
    const dayLogs = logs.filter(l => l.loggedAt.startsWith(dateStr));
    const taken = dayLogs.filter(l => l.status === 'taken').length;
    if (taken > 0) {
      streak++;
      checking.setDate(checking.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

export async function getBestStreak(days = 90) {
  const logs = await getLogs();
  const since = new Date();
  since.setDate(since.getDate() - days);
  const recent = logs.filter(l => new Date(l.loggedAt) >= since);

  const dayMap = {};
  for (const log of recent) {
    const day = log.loggedAt.slice(0, 10);
    if (log.status === 'taken') dayMap[day] = (dayMap[day] || 0) + 1;
  }

  let best = 0, current = 0;
  const sorted = Object.keys(dayMap).sort();
  for (let i = 0; i < sorted.length; i++) {
    if (i === 0 || new Date(sorted[i]) - new Date(sorted[i - 1]) <= 86400000) {
      current++;
    } else {
      current = 1;
    }
    if (current > best) best = current;
  }
  return best;
}

export async function saveSchedule(schedule) {
  const schedules = await getSchedules();
  schedules.push({ ...schedule, id: schedule.id || Date.now().toString() });
  await setItemEncrypted(KEYS.SCHEDULES, schedules);
}

export async function getSchedules() {
  const data = await getItemDecrypted(KEYS.SCHEDULES);
  return data || [];
}

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

export async function clearAllData() {
  const keys = Object.values(KEYS);
  await AsyncStorage.multiRemove(keys);
}
