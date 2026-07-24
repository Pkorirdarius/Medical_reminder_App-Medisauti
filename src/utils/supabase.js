import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

function generateId() {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 10);
  return `${t}-${r}`;
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

let supabase = null;
let _configured = false;

function isConfigured() {
  return _configured;
}

function init() {
  if (supabase) return;
  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl === 'https://your-project.supabase.co') {
    console.warn('[Supabase] Not configured — using local AsyncStorage.');
    _configured = false;
    return;
  }
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  _configured = true;
  console.log('[Supabase] Initialized.');
}

init();

function makeEmail(phone) {
  const digits = (phone || '').replace(/\D/g, '');
  return `${digits}@medisauti.app`;
}

async function makePassword(pinOrHash) {
  // Use SHA-256 hash as Supabase password — never store weak passwords
  if (pinOrHash.length === 64) return pinOrHash; // already a hash
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `ms:${pinOrHash}`);
}

function getAuthInstance() {
  return supabase?.auth || null;
}

function getCurrentUser() {
  return supabase?.auth?.currentUser || null;
}

function getClient() {
  return supabase;
}

async function registerUser(phone, pin, userData) {
  const email = makeEmail(phone);
  const password = await makePassword(pin);
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  const uid = data.user.id;
  try {
    await supabase.from('users').insert({
      id: uid,
      phone,
      data: {
        ...userData,
        phone,
        pin,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (e) {
    console.warn('users table insert failed — using local storage fallback:', e.message);
  }
  return uid;
}

async function loginUser(phone, pin) {
  const email = makeEmail(phone);
  const password = await makePassword(pin);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user.id;
}

async function logoutUser() {
  if (supabase) await supabase.auth.signOut();
}

function onAuthChanged(callback) {
  if (!supabase) {
    callback(null);
    return () => {};
  }
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user || null);
  });
  return () => subscription?.unsubscribe();
}

async function updateUserPassword(currentPin, newPin) {
  const password = await makePassword(newPin);
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

// ── Edge Functions (SMS verification) ─────────────────────────
async function sendSmsCode(phone) {
  if (!supabaseUrl) throw new Error('Supabase not configured');
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${supabaseUrl}/functions/v1/send-sms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token || supabaseAnonKey}`,
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify({ phone }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to send SMS');
  return json;
}

async function verifySmsCode(phone, code, newPassword) {
  if (!supabaseUrl) throw new Error('Supabase not configured');
  const res = await fetch(`${supabaseUrl}/functions/v1/verify-sms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: supabaseAnonKey },
    body: JSON.stringify({ phone, code, new_password: newPassword }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Verification failed');
  return json;
}

async function sbGetUser(uid) {
  if (!supabase) return null;
  const { data, error } = await supabase.from('users').select('*').eq('id', uid).maybeSingle();
  if (error || !data) return null;
  return { uid, ...data.data, phone: data.phone };
}

async function sbSaveUser(uid, userData) {
  if (!supabase) return;
  await supabase.from('users').upsert({
    id: uid,
    phone: userData.phone || '',
    data: { ...userData, updatedAt: new Date().toISOString() },
  });
}

async function sbGetPrescriptions(uid) {
  if (!supabase) return [];
  const { data } = await supabase.from('prescriptions').select('*').eq('user_id', uid);
  return (data || []).map(r => ({ id: r.id, ...r.data }));
}

async function sbSavePrescription(uid, prescription) {
  if (!supabase) return;
  const id = prescription.id || generateId();
  await supabase.from('prescriptions').upsert({
    id,
    user_id: uid,
    data: { ...prescription, userId: uid, id, updatedAt: new Date().toISOString() },
  });
  return id;
}

async function sbDeletePrescription(uid, id) {
  if (!supabase) return;
  await supabase.from('prescriptions').delete().eq('id', id).eq('user_id', uid);
}

async function sbDeleteAllPrescriptions(uid) {
  if (!supabase) return;
  await supabase.from('prescriptions').delete().eq('user_id', uid);
}

async function sbGetLogs(uid) {
  if (!supabase) return [];
  const { data } = await supabase
    .from('adherence_logs')
    .select('*')
    .eq('user_id', uid)
    .order('logged_at', { ascending: false })
    .limit(500);
  return (data || []).map(r => ({ id: r.id, ...r.data }));
}

async function sbLogDose(uid, prescriptionId, status, scheduledTime) {
  if (!supabase) return;
  const id = generateId();
  const loggedAt = new Date().toISOString();
  await supabase.from('adherence_logs').insert({
    id,
    user_id: uid,
    logged_at: loggedAt,
    data: {
      userId: uid,
      prescriptionId,
      status,
      scheduledTime,
      loggedAt,
    },
  });
}

async function sbDeleteAllLogs(uid) {
  if (!supabase) return;
  await supabase.from('adherence_logs').delete().eq('user_id', uid);
}

async function sbGetDoctors() {
  if (!supabase) return [];
  const { data } = await supabase.from('doctors').select('*');
  return (data || []).map(r => ({ id: r.id, ...r.data }));
}

async function sbSaveDoctor(doctor) {
  if (!supabase) return;
  const { data: existing } = await supabase.from('doctors').select('*').eq('phone', doctor.phone).maybeSingle();
  if (existing) {
    await supabase.from('doctors').update({
      data: { ...doctor, updatedAt: new Date().toISOString() },
    }).eq('id', existing.id);
  } else {
    await supabase.from('doctors').insert({
      phone: doctor.phone,
      data: { ...doctor, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    });
  }
}

async function sbGetSchedules(uid) {
  if (!supabase) return [];
  const { data } = await supabase.from('schedules').select('*').eq('user_id', uid);
  return (data || []).map(r => ({ id: r.id, ...r.data }));
}

async function sbSaveSchedule(uid, schedule) {
  if (!supabase) return;
  const id = generateId();
  await supabase.from('schedules').insert({
    id,
    user_id: uid,
    data: { ...schedule, userId: uid, id, createdAt: new Date().toISOString() },
  });
}

async function sbDeleteAllSchedules(uid) {
  if (!supabase) return;
  await supabase.from('schedules').delete().eq('user_id', uid);
}

async function sbGetMyDoctor(uid) {
  if (!supabase) return null;
  const { data } = await supabase.from('my_doctor').select('*').eq('id', uid).maybeSingle();
  return data?.data || null;
}

async function sbGetDoctorPatients(doctorUid) {
  if (!supabase) return [];
  const { data } = await supabase.from('my_doctor').select('*').eq('doctor_uid', doctorUid);
  if (!data || data.length === 0) return [];
  return data.map(r => {
    const patient = r.data?.patient || {};
    return { uid: r.user_id, ...patient };
  }).filter(p => p.name);
}

async function sbGetUserByPhone(phone) {
  if (!supabase) return null;
  const { data } = await supabase.from('users').select('*').eq('phone', phone).maybeSingle();
  if (!data) return null;
  return { uid: data.id, ...data.data, phone: data.phone };
}

async function sbGetPatientPrescriptions(patientUid) {
  if (!supabase) return [];
  const { data } = await supabase.from('prescriptions').select('*').eq('user_id', patientUid);
  return (data || []).map(r => ({ id: r.id, ...r.data }));
}

async function sbGetPatientLogs(patientUid) {
  if (!supabase) return [];
  const { data } = await supabase
    .from('adherence_logs')
    .select('*')
    .eq('user_id', patientUid)
    .order('logged_at', { ascending: false })
    .limit(500);
  return (data || []).map(r => ({ id: r.id, ...r.data }));
}

async function sbSetMyDoctor(uid, doctor, doctorUid, patientData) {
  if (!supabase) return;
  if (doctor) {
    await supabase.from('my_doctor').upsert({
      id: uid,
      user_id: uid,
      doctor_uid: doctorUid || null,
      data: { doctor, patient: patientData || null },
    });
  } else {
    await supabase.from('my_doctor').delete().eq('id', uid);
  }
}

async function sbGetConditionPresets() {
  if (!supabase) return [];
  const { data } = await supabase.from('condition_presets').select('*');
  return (data || []).map(r => ({ id: r.id, ...r.data }));
}

async function sbDeleteAllUserData(uid) {
  if (!supabase) return;
  await Promise.all([
    sbDeleteAllPrescriptions(uid),
    sbDeleteAllLogs(uid),
    sbDeleteAllSchedules(uid),
  ]);
}

export {
  isConfigured, init,
  getAuthInstance, getCurrentUser, getClient, registerUser, loginUser, logoutUser, onAuthChanged, updateUserPassword,
  sendSmsCode, verifySmsCode,
  sbGetUser, sbSaveUser,
  sbGetPrescriptions, sbSavePrescription, sbDeletePrescription,
  sbGetLogs, sbLogDose,
  sbGetDoctors, sbSaveDoctor,
  sbGetSchedules, sbSaveSchedule,
  sbGetMyDoctor, sbSetMyDoctor,
  sbGetDoctorPatients, sbGetUserByPhone,
  sbGetPatientPrescriptions, sbGetPatientLogs,
  sbGetConditionPresets,
  sbDeleteAllUserData,
};
