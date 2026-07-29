import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import aesjs from 'aes-js';
import * as supabase from './supabase';

const _locks = {};
function withLock(key, fn) {
  if (!_locks[key]) _locks[key] = Promise.resolve();
  const chain = _locks[key].then(() => fn());
  _locks[key] = chain.catch(() => {});
  return chain;
}

// ── Encryption (AES-256-CTR via aes-js) ──────────────────────
// Key stored in SecureStore (hardware-backed). Data at rest uses
// AES-256-CTR with 256-bit keys for proper encryption.
const ENC_KEY_STORE = 'medisauti.enc_key';
const PIN_SALT_STORE = 'medisauti.pin_salt';
const PIN_HASH_STORE = 'medisauti.pin_hash';
const SB_PASS_STORE = 'medisauti.sb_password';

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function bytesToB64(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1] || 0, c = bytes[i + 2] || 0;
    out += B64_CHARS[a >> 2];
    out += B64_CHARS[((a & 3) << 4) | (b >> 4)];
    if (i + 1 < bytes.length) out += B64_CHARS[((b & 15) << 2) | (c >> 6)];
    else out += '=';
    if (i + 2 < bytes.length) out += B64_CHARS[c & 63];
    else out += '=';
  }
  return out;
}

function b64ToBytes(b64) {
  const str = b64.replace(/[^A-Za-z0-9+/=]/g, '');
  const out = [];
  for (let i = 0; i < str.length; i += 4) {
    const a = B64_CHARS.indexOf(str[i] || '=');
    const b = B64_CHARS.indexOf(str[i + 1] || '=');
    const c = B64_CHARS.indexOf(str[i + 2] || '=');
    const d = B64_CHARS.indexOf(str[i + 3] || '=');
    out.push((a << 2) | (b >> 4));
    if (c !== 64) out.push(((b & 15) << 4) | (c >> 2));
    if (d !== 64) out.push(((c & 3) << 6) | d);
  }
  return new Uint8Array(out);
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  return bytes;
}

function bytesToHex(bytes) {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0');
  return hex;
}

function utf8ToBytes(str) {
  const bin = unescape(encodeURIComponent(str));
  const b = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
  return b;
}

function bytesToUtf8(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return decodeURIComponent(escape(bin));
}

async function getAesKey() {
  let keyHex = await SecureStore.getItemAsync(ENC_KEY_STORE);
  if (!keyHex) {
    const bytes = Crypto.getRandomBytes(32);
    keyHex = bytesToHex(bytes);
    await SecureStore.setItemAsync(ENC_KEY_STORE, keyHex);
  }
  return hexToBytes(keyHex);
}

async function encrypt(text) {
  const key = await getAesKey();
  const iv = Crypto.getRandomBytes(16);
  const textBytes = utf8ToBytes(text);
  const ctr = new aesjs.ModeOfOperation.ctr(key, iv);
  const encryptedBytes = ctr.encrypt(textBytes);
  const combined = new Uint8Array(iv.length + encryptedBytes.length);
  combined.set(iv);
  combined.set(encryptedBytes, iv.length);
  return bytesToB64(combined);
}

async function decrypt(ciphertext, storageKey) {
  if (!ciphertext) return { plain: '', migrated: false };
  try {
    const key = await getAesKey();
    const combined = b64ToBytes(ciphertext);
    const iv = combined.slice(0, 16);
    const encryptedBytes = combined.slice(16);
    const ctr = new aesjs.ModeOfOperation.ctr(key, iv);
    const decryptedBytes = ctr.decrypt(encryptedBytes);
    const plain = bytesToUtf8(decryptedBytes);
    return { plain, migrated: false };
  } catch {
    // Try legacy XOR decryption for migration from old format
    try {
      const legacyKeys = ['medisauti-2024-enc-key!'];
      for (const legacyKey of legacyKeys) {
        try {
          const xored = decodeURIComponent(escape(atob(ciphertext)));
          let plain = '';
          for (let i = 0; i < xored.length; i++) {
            plain += String.fromCharCode(xored.charCodeAt(i) ^ legacyKey.charCodeAt(i % legacyKey.length));
          }
          if (plain) {
            if (storageKey) {
              const reEncrypted = await encrypt(plain);
              AsyncStorage.setItem(storageKey, reEncrypted).catch(() => {});
            }
            return { plain, migrated: true };
          }
        } catch {}
      }
      return { plain: '', migrated: false };
    } catch {
      return { plain: '', migrated: false };
    }
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
  const encrypted = await encrypt(json);
  await AsyncStorage.setItem(key, encrypted);
}

async function getItemDecrypted(key) {
  const encrypted = await AsyncStorage.getItem(key);
  if (!encrypted) return null;
  try {
    const { plain } = await decrypt(encrypted, key);
    return JSON.parse(plain);
  } catch {
    try {
      return JSON.parse(encrypted);
    } catch {
      return null;
    }
  }
}

// ── PIN Hashing (SHA-256 + salt via expo-crypto + SecureStore) ─
export async function hashPin(pin) {
  let salt = await SecureStore.getItemAsync(PIN_SALT_STORE);
  if (!salt) {
    // First-time: generate salt from phone-based entropy
    const user = await getItemDecrypted(KEYS.USER);
    salt = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `${pin}-${Date.now()}-${Math.random()}`
    );
    await SecureStore.setItemAsync(PIN_SALT_STORE, salt.slice(0, 16));
    salt = await SecureStore.getItemAsync(PIN_SALT_STORE);
  }
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${salt}:${pin}`
  );
  return hash;
}

export async function verifyPin(pin, storedHash) {
  if (!storedHash) return false;
  const hash = await hashPin(pin);
  if (hash === storedHash) return true;
  // Legacy check: plain text pin (for migration)
  return false;
}

export async function getStoredPinHash() {
  return SecureStore.getItemAsync(PIN_HASH_STORE);
}

export async function storePinHash(hash) {
  await SecureStore.setItemAsync(PIN_HASH_STORE, hash);
}

export async function generateRandomPassword() {
  const bytes = [];
  for (let i = 0; i < 32; i++) {
    bytes.push(Math.floor(Math.random() * 256));
  }
  return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function getSupabasePassword() {
  return SecureStore.getItemAsync(SB_PASS_STORE);
}

export async function storeSupabasePassword(pw) {
  await SecureStore.setItemAsync(SB_PASS_STORE, pw);
}

// ── Supabase helpers ───────────────────────────────────────────────
let _cachedUid = null;

export function setCachedUid(uid) {
  _cachedUid = uid;
}

function getUid() {
  return _cachedUid;
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
      await supabase.sbSaveUser(uid, user);
    } catch (e) {
      console.warn('sbSaveUser failed — saving locally only:', e.message);
    }
  }
  const existing = (await getItemDecrypted(KEYS.USER)) || {};
  await setItemEncrypted(KEYS.USER, { ...existing, ...user });
}

export async function getUser() {
  if (supabase.isConfigured()) {
    const uid = getUid();
    if (uid) {
      const sbUser = await supabase.sbGetUser(uid);
      if (sbUser) return sbUser;
    }
  }
  return getItemDecrypted(KEYS.USER);
}

export async function getIsRegistered() {
  const user = await getUser();
  if (!user || !user.name) return false;
  // Check for pinHash (new) or pin (legacy migration)
  if (user.pinHash) return true;
  if (user.pin) return true;
  return false;
}

// ── Prescriptions ───────────────────────────────────────────────────
export async function getPrescriptions(targetUid) {
  const local = (await getItemDecrypted(KEYS.PRESCRIPTIONS)) || [];
  if (await isFB()) {
    let remote = [];
    let remoteError = false;
    try {
      remote = targetUid
        ? (await supabase.sbGetPatientPrescriptions(targetUid)) || []
        : (await supabase.sbGetPrescriptions(getUid())) || [];
    } catch (e) {
      remoteError = true;
      console.warn('Remote getPrescriptions failed:', e.message);
    }
    if (!remoteError) {
      const byId = new Map();
      for (const item of remote) byId.set(item.id, item);
      for (const item of local) {
        const existing = byId.get(item.id);
        if (!existing) {
          byId.set(item.id, item);
        } else {
          const rTime = new Date(existing.createdAt || 0).getTime();
          const lTime = new Date(item.createdAt || 0).getTime();
          if (lTime > rTime) byId.set(item.id, item);
        }
      }
      const merged = Array.from(byId.values());
      await setItemEncrypted(KEYS.PRESCRIPTIONS, merged);
      return merged;
    }
    return local;
  }
  return local;
}

export async function savePrescription(prescription, targetUid) {
  return withLock('prescriptions', async () => {
    const list = await getPrescriptions();
    const idx = list.findIndex(p => p.id === prescription.id);
    if (idx >= 0) {
      list[idx] = prescription;
    } else {
      list.push({ ...prescription, id: prescription.id || Date.now().toString() });
    }
    await setItemEncrypted(KEYS.PRESCRIPTIONS, list);
    if (await isFB()) {
      const uid = targetUid || getUid();
      try { await supabase.sbSavePrescription(uid, prescription); } catch (e) { console.warn('Remote save failed:', e.message); }
    }
  });
}

export async function deletePrescription(id) {
  return withLock('prescriptions', async () => {
    const list = await getPrescriptions();
    const updated = list.filter(p => p.id !== id);
    await setItemEncrypted(KEYS.PRESCRIPTIONS, updated);
    if (await isFB()) {
      try { await supabase.sbDeletePrescription(getUid(), id); } catch (e) { console.warn('Remote delete failed:', e.message); }
    }
  });
}

// ── Adherence Logs ──────────────────────────────────────────────────
export async function getLogs(targetUid) {
  const local = (await getItemDecrypted(KEYS.ADHERENCE)) || [];
  if (await isFB()) {
    let remote = [];
    let remoteError = false;
    try {
      remote = targetUid
        ? (await supabase.sbGetPatientLogs(targetUid)) || []
        : (await supabase.sbGetLogs(getUid())) || [];
    } catch (e) {
      remoteError = true;
      console.warn('Remote getLogs failed:', e.message);
    }
    if (!remoteError) {
      const byId = new Map();
      for (const item of remote) byId.set(item.id, item);
      for (const item of local) {
        const existing = byId.get(item.id);
        if (!existing) {
          byId.set(item.id, item);
        } else {
          const rTime = new Date(existing.loggedAt || 0).getTime();
          const lTime = new Date(item.loggedAt || 0).getTime();
          if (lTime > rTime) byId.set(item.id, item);
        }
      }
      const merged = Array.from(byId.values());
      await setItemEncrypted(KEYS.ADHERENCE, merged);
      return merged;
    }
    return local;
  }
  return local;
}

export async function logDose(prescriptionId, status, scheduledTime) {
  return withLock('logs', async () => {
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
      try { await supabase.sbLogDose(getUid(), prescriptionId, status, scheduledTime); } catch (e) { console.warn('Remote logDose failed:', e.message); }
    }
  });
}

// ── Analytics (computed from local logs, always use local) ──────────
export async function calcAdherence(days = 30, targetUid) {
  const logs = await getLogs(targetUid);
  const since = new Date();
  since.setDate(since.getDate() - days);
  const recent = logs.filter(l => new Date(l.loggedAt) >= since);
  const taken  = recent.filter(l => l.status === 'taken').length;
  const missed = recent.filter(l => l.status === 'missed').length;
  const total  = recent.length;
  const rate   = total > 0 ? Math.round((taken / total) * 100) : 0;
  return { rate, taken, missed, total };
}

export async function getDailyStreak(days = 7, targetUid) {
  const logs = await getLogs(targetUid);
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

export async function getPerMedicationAdherence(days = 30, targetUid) {
  const [logs, prescriptions] = await Promise.all([getLogs(targetUid), getPrescriptions(targetUid)]);
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

export async function getMissedDosePatterns(days = 30, targetUid) {
  const logs = await getLogs(targetUid);
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

export async function getCurrentStreak(targetUid) {
  const logs = await getLogs(targetUid);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let streak = 0;
  const checking = new Date(today);
  const maxDays = 365;
  for (let i = 0; i < maxDays; i++) {
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

export async function getAdherenceTrend(days = 30, targetUid) {
  const logs = await getLogs(targetUid);
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
    const data = await supabase.sbGetDoctors();
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
    await supabase.sbSaveDoctor(doctor);
  }
}

export async function getMyDoctor() {
  if (await isFB()) {
    try {
      const data = await supabase.sbGetMyDoctor(getUid());
      if (data) {
        await setItemEncrypted(KEYS.MY_DOCTOR, data);
        return data;
      }
    } catch (e) { console.warn('Remote getMyDoctor failed:', e.message); }
  }
  return getItemDecrypted(KEYS.MY_DOCTOR);
}

export async function setMyDoctor(doctor) {
  await setItemEncrypted(KEYS.MY_DOCTOR, doctor);
  if (await isFB()) {
    let doctorUid = doctor?.uid || null;
    if (!doctorUid && doctor?.phone) {
      try {
        const doctors = await getDoctors();
        const found = doctors.find(d => d.phone === doctor.phone);
        if (found?.uid) doctorUid = found.uid;
      } catch (e) { console.warn('Doctor lookup uid failed:', e.message); }
    }
    const patientData = await getUser();
    await supabase.sbSetMyDoctor(getUid(), doctor, doctorUid, patientData);
  } else if (!doctor) {
    await AsyncStorage.removeItem(KEYS.MY_DOCTOR);
  }
}

export async function getDoctorPatients() {
  const u = await getUser();
  if (!u || u.role !== 'doctor') return [];
  if (await isFB()) {
    let doctorUid = u.uid || getUid();
    if (!doctorUid && u.phone) {
      try {
        const doctors = await getDoctors();
        const found = doctors.find(d => d.phone === u.phone);
        if (found?.uid) doctorUid = found.uid;
      } catch (e) { console.warn('Doctors fetch for uid failed:', e.message); }
    }
    if (!doctorUid) return [];
    try {
      return await supabase.sbGetDoctorPatients(doctorUid);
    } catch (e) { console.warn('Doctor patients fetch failed:', e.message); }
  }
  return [];
}

// ── Condition Presets ───────────────────────────────────────────────
const CONDITION_PRESETS = {
  diabetes: [
    { drugName: 'Metformin', dosage: '500mg', dosageQuantity: '1', dosageForm: 'tablet', frequencyKey: 'freq_twice', times: ['08:00', '20:00'], notesKey: 'system_notes_with_food', source: 'system', voiceNotif: true },
    { drugName: 'Insulin Glargine (Lantus)', dosage: '10 units', dosageQuantity: '1', dosageForm: 'injection', frequencyKey: 'freq_once', times: ['21:00'], notesKey: 'system_notes_before_sleep_injection', source: 'system', voiceNotif: true },
  ],
  bp: [
    { drugName: 'Amlodipine', dosage: '5mg', dosageQuantity: '1', dosageForm: 'tablet', frequencyKey: 'freq_once', times: ['08:00'], notesKey: 'system_notes_morning_breakfast', source: 'system', voiceNotif: true },
    { drugName: 'Enalapril', dosage: '5mg', dosageQuantity: '1', dosageForm: 'tablet', frequencyKey: 'freq_once', times: ['08:00'], notesKey: 'system_notes_morning_with_amlodipine', source: 'system', voiceNotif: true },
  ],
  hiv: [
    { drugName: 'TLD (Tenofovir/Lamivudine/Dolutegravir)', dosage: '300/300/50mg', dosageQuantity: '1', dosageForm: 'tablet', frequencyKey: 'freq_once', times: ['20:00'], notesKey: 'system_notes_night_no_miss', source: 'system', voiceNotif: true },
  ],
};

function generateSystemPrescriptions(condition, t) {
  const tr = typeof t === 'function' ? t : (k) => k;
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
    drugName: preset.drugName,
    dosage: preset.dosage,
    dosageQuantity: preset.dosageQuantity,
    dosageForm: preset.dosageForm,
    frequency: tr(preset.frequencyKey),
    times: preset.times,
    notes: preset.notesKey ? tr(preset.notesKey) : '',
    source: preset.source,
    voiceNotif: preset.voiceNotif,
    createdAt: new Date().toISOString(),
    active: true,
    notifIds: [],
  }));
}

export async function addConditionPrescriptions(condition, t) {
  const created = generateSystemPrescriptions(condition, t);
  if (created.length === 0) return [];
  const existing = (await getItemDecrypted(KEYS.PRESCRIPTIONS)) || [];
  const merged = [...existing, ...created];
  await setItemEncrypted(KEYS.PRESCRIPTIONS, merged);
  if (await isFB()) {
    for (const rx of created) {
      try { await supabase.sbSavePrescription(getUid(), rx); } catch (e) { console.warn('Remote save condition rx failed:', e.message); }
    }
  }
  return created;
}

export async function syncConditionPrescriptions(condition, t) {
  const existing = await getPrescriptions();
  const oldSystem = existing.filter(rx => rx.source === 'system');
  const manual = existing.filter(rx => rx.source !== 'system');
  const newSystem = generateSystemPrescriptions(condition, t);
  const merged = [...manual, ...newSystem];
  await setItemEncrypted(KEYS.PRESCRIPTIONS, merged);
  if (await isFB()) {
    for (const rx of oldSystem) {
      try { await supabase.sbDeletePrescription(getUid(), rx.id); } catch (e) { console.warn('Remote delete during sync failed:', e.message); }
    }
    for (const rx of newSystem) await supabase.sbSavePrescription(getUid(), rx);
  }
  return newSystem;
}

// ── Schedules ───────────────────────────────────────────────────────
export async function saveSchedule(schedule) {
  const schedules = await getSchedules();
  schedules.push({ ...schedule, id: schedule.id || Date.now().toString() });
  await setItemEncrypted(KEYS.SCHEDULES, schedules);
  if (await isFB()) {
    await supabase.sbSaveSchedule(getUid(), schedule);
  }
}

export async function getSchedules() {
  if (await isFB()) {
    const data = await supabase.sbGetSchedules(getUid());
    if (data && data.length > 0) return data;
  }
  return (await getItemDecrypted(KEYS.SCHEDULES)) || [];
}

// ── Clear All (local only — keeps Supabase data intact) ────────────
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
    const dur = parseInt(rx.durationValue, 10);
    if (!dur) continue;
    const end = new Date(start);
    switch (rx.durationUnit) {
      case 'weeks': end.setDate(end.getDate() + dur * 7); break;
      case 'months': end.setMonth(end.getMonth() + dur); break;
      default: end.setDate(end.getDate() + dur); break;
    }
    if (now.getTime() > end.getTime()) {
      rx.active = false;
      changed = true;
    }
  }
  if (changed) {
    await setItemEncrypted(KEYS.PRESCRIPTIONS, prescriptions);
    if (await isFB()) {
      for (const rx of prescriptions) {
        if (rx.active === false) await supabase.sbSavePrescription(getUid(), rx);
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
    if (await isFB()) await supabase.sbSavePrescription(getUid(), rx);
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
  function esc(val) {
    const s = String(val == null ? '' : val);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? '"' + s.replace(/"/g, '""') + '"'
      : s;
  }
  const header = 'Date,Drug Name,Dosage,Status,Scheduled Time,Logged At\n';
  const rows = logs.map(l => {
    const rx = prescriptions.find(p => p.id === l.prescriptionId);
    return [
      esc(l.loggedAt?.slice(0, 10) || ''),
      esc(rx?.drugName || 'Unknown'),
      esc(rx?.dosage || ''),
      esc(l.status),
      esc(l.scheduledTime || ''),
      esc(l.loggedAt || ''),
    ].join(',');
  }).join('\n');
  return header + rows;
}
