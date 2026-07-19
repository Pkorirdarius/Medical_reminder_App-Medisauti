import AsyncStorage from '@react-native-async-storage/async-storage';
import * as supabase from './supabase';

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
  if (pad === 1) out = out.slice(0, -2) + '==';
  else if (pad === 2) out = out.slice(0, -1) + '=';
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
    return JSON.parse(decrypt(encrypted));
  } catch {
    try {
      return JSON.parse(encrypted);
    } catch {
      return null;
    }
  }
}

// ── Firebase helpers ───────────────────────────────────────────────
function getUid() {
  const u = supabase.getCurrentUser();
  return u?.id || u?.uid || null;
}

async function isFB() {
  const uid = getUid();
  return supabase.isConfigured() && !!uid;
}

// ── User ────────────────────────────────────────────────────────────
export async function saveUser(user) {
  const uid = getUid();
  if (supabase.isConfigured() && uid) {
    try {
      await supabase.fbSaveUser(uid, user);
    } catch (e) {
      console.warn('fbSaveUser failed — saving locally only:', e.message);
    }
  }
  const existing = (await getItemDecrypted(KEYS.USER)) || {};
  await setItemEncrypted(KEYS.USER, { ...existing, ...user });
}

export async function getUser() {
  if (supabase.isConfigured()) {
    const uid = getUid();
    if (uid) {
      const fbUser = await supabase.fbGetUser(uid);
      if (fbUser) return fbUser;
    }
  }
  return getItemDecrypted(KEYS.USER);
}

export async function getIsRegistered() {
  const user = await getUser();
  return user !== null && user.name && user.pin;
}

// ── Prescriptions ───────────────────────────────────────────────────
export async function getPrescriptions() {
  if (await isFB()) {
    const data = await supabase.fbGetPrescriptions(getUid());
    if (data && data.length > 0) return data;
  }
  return (await getItemDecrypted(KEYS.PRESCRIPTIONS)) || [];
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
  if (await isFB()) {
    await supabase.fbSavePrescription(getUid(), prescription);
  }
}

export async function deletePrescription(id) {
  const list = await getPrescriptions();
  const updated = list.filter(p => p.id !== id);
  await setItemEncrypted(KEYS.PRESCRIPTIONS, updated);
  if (await isFB()) {
    await supabase.fbDeletePrescription(getUid(), id);
  }
}

// ── Adherence Logs ──────────────────────────────────────────────────
export async function getLogs() {
  if (await isFB()) {
    const data = await supabase.fbGetLogs(getUid());
    if (data && data.length > 0) return data;
  }
  return (await getItemDecrypted(KEYS.ADHERENCE)) || [];
}

export async function logDose(prescriptionId, status, scheduledTime) {
  const logs = await getLogs();
  const logEntry = {
    id: Date.now().toString(),
    prescriptionId,
    status,
    scheduledTime,
    loggedAt: new Date().toISOString(),
  };
  logs.push(logEntry);
  await setItemEncrypted(KEYS.ADHERENCE, logs);
  if (await isFB()) {
    await supabase.fbLogDose(getUid(), prescriptionId, status, scheduledTime);
  }
}

// ── Analytics (computed from local logs, always use local) ──────────
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
        taken: 0, missed: 0, total: 0,
      };
    }
    medMap[log.prescriptionId].total++;
    if (log.status === 'taken') medMap[log.prescriptionId].taken++;
    if (log.status === 'missed') medMap[log.prescriptionId].missed++;
  }
  return Object.values(medMap).map(m => ({ ...m, rate: m.total > 0 ? Math.round((m.taken / m.total) * 100) : 0 }));
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

export async function getCurrentStreak() {
  const logs = await getLogs();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let streak = 0;
  const checking = new Date(today);
  while (true) {
    const dateStr = checking.toISOString().slice(0, 10);
    const dayLogs = logs.filter(l => l.loggedAt.startsWith(dateStr));
    const taken = dayLogs.filter(l => l.status === 'taken').length;
    if (taken > 0) { streak++; checking.setDate(checking.getDate() - 1); }
    else break;
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

// ── Doctor Management ───────────────────────────────────────────────
export async function getDoctors() {
  if (supabase.isConfigured()) {
    const data = await supabase.fbGetDoctors();
    if (data && data.length > 0) return data;
  }
  return (await getItemDecrypted(KEYS.DOCTORS)) || [];
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
  if (supabase.isConfigured()) {
    await supabase.fbSaveDoctor(doctor);
  }
}

export async function getMyDoctor() {
  if (await isFB()) {
    const data = await supabase.fbGetMyDoctor(getUid());
    if (data) return data;
  }
  return getItemDecrypted(KEYS.MY_DOCTOR);
}

export async function setMyDoctor(doctor) {
  await setItemEncrypted(KEYS.MY_DOCTOR, doctor);
  if (await isFB()) {
    await supabase.fbSetMyDoctor(getUid(), doctor);
  } else if (!doctor) {
    await AsyncStorage.removeItem(KEYS.MY_DOCTOR);
  }
}

// ── Condition Presets ───────────────────────────────────────────────
const CONDITION_PRESETS = {
  diabetes: [
    { drugName: 'Metformin', dosage: '500mg', dosageQuantity: '1', dosageForm: 'tablet', frequency: 'Mara mbili kwa siku', times: ['08:00', '20:00'], notes: 'Pamoja na chakula', source: 'system', voiceNotif: true },
    { drugName: 'Insulin Glargine (Lantus)', dosage: '10 units', dosageQuantity: '1', dosageForm: 'injection', frequency: 'Mara moja kwa siku', times: ['21:00'], notes: 'Kabla ya kulala — sindano chini ya ngozi', source: 'system', voiceNotif: true },
  ],
  bp: [
    { drugName: 'Amlodipine', dosage: '5mg', dosageQuantity: '1', dosageForm: 'tablet', frequency: 'Mara moja kwa siku', times: ['08:00'], notes: 'Asubuhi baada ya kiamsha kinywa', source: 'system', voiceNotif: true },
    { drugName: 'Enalapril', dosage: '5mg', dosageQuantity: '1', dosageForm: 'tablet', frequency: 'Mara moja kwa siku', times: ['08:00'], notes: 'Asubuhi pamoja na Amlodipine', source: 'system', voiceNotif: true },
  ],
  hiv: [
    { drugName: 'TLD (Tenofovir/Lamivudine/Dolutegravir)', dosage: '300/300/50mg', dosageQuantity: '1', dosageForm: 'tablet', frequency: 'Mara moja kwa siku', times: ['20:00'], notes: 'Usiku kabla ya kulala — usikose dozi', source: 'system', voiceNotif: true },
  ],
};

function generateSystemPrescriptions(condition) {
  const c = condition.toLowerCase();
  const parts = c.split(',').map(s => s.trim()).filter(Boolean);
  let allPresets = [];
  for (const cond of parts) {
    if (cond.includes('kisukari') || cond.includes('diabetes')) allPresets.push(...CONDITION_PRESETS.diabetes);
    if (cond.includes('shinikizo') || cond.includes('blood pressure') || cond.includes('bp') || cond.includes('damu')) allPresets.push(...CONDITION_PRESETS.bp);
    if (cond.includes('hiv') || cond.includes('vvu')) allPresets.push(...CONDITION_PRESETS.hiv);
  }
  if (allPresets.length === 0) return [];
  const seen = new Set();
  const deduped = [];
  for (const preset of allPresets) {
    const key = `${preset.drugName}|${preset.dosage}`;
    if (!seen.has(key)) { seen.add(key); deduped.push(preset); }
  }
  return deduped.map(preset => ({
    id: Date.now().toString() + Math.random().toString(36).slice(2, 8),
    ...preset,
    createdAt: new Date().toISOString(),
    active: true,
    notifIds: [],
  }));
}

export async function addConditionPrescriptions(condition) {
  const created = generateSystemPrescriptions(condition);
  if (created.length === 0) return [];
  for (const rx of created) {
    if (await isFB()) await supabase.fbSavePrescription(getUid(), rx);
  }
  await setItemEncrypted(KEYS.PRESCRIPTIONS, created);
  return created;
}

export async function syncConditionPrescriptions(condition) {
  const existing = await getPrescriptions();
  const manual = existing.filter(rx => rx.source !== 'system');
  const newSystem = generateSystemPrescriptions(condition);
  const merged = [...manual, ...newSystem];
  await setItemEncrypted(KEYS.PRESCRIPTIONS, merged);
  if (await isFB()) {
    for (const rx of newSystem) await supabase.fbSavePrescription(getUid(), rx);
  }
  return newSystem;
}

// ── Schedules ───────────────────────────────────────────────────────
export async function saveSchedule(schedule) {
  const schedules = await getSchedules();
  schedules.push({ ...schedule, id: schedule.id || Date.now().toString() });
  await setItemEncrypted(KEYS.SCHEDULES, schedules);
  if (await isFB()) {
    await supabase.fbSaveSchedule(getUid(), schedule);
  }
}

export async function getSchedules() {
  if (await isFB()) {
    const data = await supabase.fbGetSchedules(getUid());
    if (data && data.length > 0) return data;
  }
  return (await getItemDecrypted(KEYS.SCHEDULES)) || [];
}

// ── Clear All (local only — keeps Firebase data intact) ────────────
export async function clearAllData() {
  const keys = Object.values(KEYS);
  await AsyncStorage.multiRemove(keys);
}

// ── Clear user-specific data (prescriptions, logs, schedules) ─────
export async function clearUserData() {
  await AsyncStorage.multiRemove([
    KEYS.PRESCRIPTIONS,
    KEYS.ADHERENCE,
    KEYS.SCHEDULES,
    KEYS.MY_DOCTOR,
  ]);
}

// ── Duration Enforcement ────────────────────────────────────────
export async function enforceExpiredPrescriptions() {
  const prescriptions = await getPrescriptions();
  let changed = false;
  const now = new Date();
  for (const rx of prescriptions) {
    if (rx.active === false) continue;
    if (!rx.durationValue || !rx.startDate) continue;
    const start = new Date(rx.startDate);
    const dur = parseInt(rx.durationValue, 10);
    if (!dur) continue;
    let ms;
    switch (rx.durationUnit) {
      case 'weeks': ms = dur * 7 * 86400000; break;
      case 'months': ms = dur * 30 * 86400000; break;
      default: ms = dur * 86400000;
    }
    if (now.getTime() > start.getTime() + ms) {
      rx.active = false;
      changed = true;
    }
  }
  if (changed) {
    await setItemEncrypted(KEYS.PRESCRIPTIONS, prescriptions);
    if (await isFB()) {
      for (const rx of prescriptions) {
        if (rx.active === false) await supabase.fbSavePrescription(getUid(), rx);
      }
    }
  }
  return prescriptions;
}

// ── Medication Stock ──────────────────────────────────────────
export async function updateMedicationStock(prescriptionId, stock) {
  const list = await getPrescriptions();
  const rx = list.find(p => p.id === prescriptionId);
  if (rx) {
    rx.stock = stock;
    await setItemEncrypted(KEYS.PRESCRIPTIONS, list);
    if (await isFB()) await supabase.fbSavePrescription(getUid(), rx);
  }
}

// ── Data Export ───────────────────────────────────────────────
export async function exportDataAsJSON() {
  const [prescriptions, logs, user] = await Promise.all([
    getPrescriptions(), getLogs(), getUser(),
  ]);
  return JSON.stringify({ user, prescriptions, adherenceLogs: logs }, null, 2);
}

export async function exportDataAsCSV() {
  const logs = await getLogs();
  const prescriptions = await getPrescriptions();
  const header = 'Date,Drug Name,Dosage,Status,Scheduled Time,Logged At\n';
  const rows = logs.map(l => {
    const rx = prescriptions.find(p => p.id === l.prescriptionId);
    return `${l.loggedAt?.slice(0, 10) || ''},${rx?.drugName || 'Unknown'},${rx?.dosage || ''},${l.status},${l.scheduledTime || ''},${l.loggedAt || ''}`;
  }).join('\n');
  return header + rows;
}
