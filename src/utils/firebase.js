import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, updatePassword as fbUpdatePassword,
} from 'firebase/auth';
import {
  getFirestore, doc, setDoc, getDoc, getDocs, addDoc, updateDoc,
  deleteDoc, collection, query, where, orderBy, limit, Timestamp,
  writeBatch,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey:             process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain:         process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:          process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:      process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId:  process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:              process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

let app = null;
let auth = null;
let db = null;
let _configured = false;

function isConfigured() {
  return _configured;
}

function init() {
  if (app) return;
  if (!firebaseConfig.apiKey || firebaseConfig.apiKey === 'your_api_key' || !firebaseConfig.projectId) {
    console.warn('[Firebase] Not configured — using local AsyncStorage.');
    _configured = false;
    return;
  }
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }
  auth = getAuth(app);
  db = getFirestore(app);
  _configured = true;
  console.log('[Firebase] Initialized.');
}

init();

// ── Helpers ────────────────────────────────────────────────────────
function makeEmail(phone) {
  const digits = (phone || '').replace(/\D/g, '');
  return `${digits}@medisauti.app`;
}

function makePassword(pin) {
  return `md${pin}`;
}

// ── Auth ────────────────────────────────────────────────────────────
function getAuthInstance() {
  return auth;
}

function getCurrentUser() {
  return auth?.currentUser || null;
}

async function registerUser(phone, pin, userData) {
  const email = makeEmail(phone);
  const password = makePassword(pin);
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;
  await setDoc(doc(db, 'users', uid), {
    ...userData,
    phone,
    pin,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return uid;
}

async function loginUser(phone, pin) {
  const email = makeEmail(phone);
  const password = makePassword(pin);
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user.uid;
}

async function logoutUser() {
  if (auth) await signOut(auth);
}

function onAuthChanged(callback) {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

async function updateUserPassword(currentPin, newPin) {
  const user = auth?.currentUser;
  if (!user) throw new Error('Not authenticated');
  await fbUpdatePassword(user, makePassword(newPin));
}

// ── Firestore: User ─────────────────────────────────────────────────
async function fbGetUser(uid) {
  if (!db) return null;
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? { uid, ...snap.data() } : null;
}

async function fbSaveUser(uid, data) {
  if (!db) return;
  await setDoc(doc(db, 'users', uid), { ...data, updatedAt: new Date().toISOString() }, { merge: true });
}

// ── Firestore: Prescriptions ────────────────────────────────────────
async function fbGetPrescriptions(uid) {
  if (!db) return [];
  const q = query(collection(db, 'prescriptions'), where('userId', '==', uid));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function fbSavePrescription(uid, prescription) {
  if (!db) return;
  const ref = prescription.id ? doc(db, 'prescriptions', prescription.id) : doc(collection(db, 'prescriptions'));
  await setDoc(ref, { ...prescription, userId: uid, updatedAt: new Date().toISOString() }, { merge: true });
  return ref.id;
}

async function fbDeletePrescription(uid, id) {
  if (!db) return;
  await deleteDoc(doc(db, 'prescriptions', id));
}

async function fbDeleteAllPrescriptions(uid) {
  if (!db) return;
  const q = query(collection(db, 'prescriptions'), where('userId', '==', uid));
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
}

// ── Firestore: Adherence Logs ───────────────────────────────────────
async function fbGetLogs(uid) {
  if (!db) return [];
  const q = query(collection(db, 'adherence_logs'), where('userId', '==', uid), orderBy('loggedAt', 'desc'), limit(500));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function fbLogDose(uid, prescriptionId, status, scheduledTime) {
  if (!db) return;
  const ref = doc(collection(db, 'adherence_logs'));
  await setDoc(ref, {
    userId: uid,
    prescriptionId,
    status,
    scheduledTime,
    loggedAt: new Date().toISOString(),
  });
}

async function fbDeleteAllLogs(uid) {
  if (!db) return;
  const q = query(collection(db, 'adherence_logs'), where('userId', '==', uid));
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
}

// ── Firestore: Doctors ──────────────────────────────────────────────
async function fbGetDoctors() {
  if (!db) return [];
  const snap = await getDocs(collection(db, 'doctors'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function fbSaveDoctor(doctor) {
  if (!db) return;
  const q = query(collection(db, 'doctors'), where('phone', '==', doctor.phone));
  const snap = await getDocs(q);
  if (!snap.empty) {
    await updateDoc(snap.docs[0].ref, { ...doctor, updatedAt: new Date().toISOString() });
  } else {
    await addDoc(collection(db, 'doctors'), { ...doctor, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  }
}

// ── Firestore: Schedules ────────────────────────────────────────────
async function fbGetSchedules(uid) {
  if (!db) return [];
  const q = query(collection(db, 'schedules'), where('userId', '==', uid));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function fbSaveSchedule(uid, schedule) {
  if (!db) return;
  const ref = doc(collection(db, 'schedules'));
  await setDoc(ref, { ...schedule, userId: uid, createdAt: new Date().toISOString() });
}

async function fbDeleteAllSchedules(uid) {
  if (!db) return;
  const q = query(collection(db, 'schedules'), where('userId', '==', uid));
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
}

// ── Firestore: My Doctor ────────────────────────────────────────────
async function fbGetMyDoctor(uid) {
  if (!db) return null;
  const snap = await getDoc(doc(db, 'my_doctor', uid));
  return snap.exists() ? snap.data() : null;
}

async function fbSetMyDoctor(uid, doctor) {
  if (!db) return;
  if (doctor) {
    await setDoc(doc(db, 'my_doctor', uid), doctor);
  } else {
    await deleteDoc(doc(db, 'my_doctor', uid));
  }
}

// ── Firestore: Condition Presets ────────────────────────────────────
async function fbGetConditionPresets() {
  if (!db) return [];
  const snap = await getDocs(collection(db, 'condition_presets'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Firestore: Delete all user data ─────────────────────────────────
async function fbDeleteAllUserData(uid) {
  if (!db) return;
  await Promise.all([
    fbDeleteAllPrescriptions(uid),
    fbDeleteAllLogs(uid),
    fbDeleteAllSchedules(uid),
  ]);
}

export {
  // Config
  isConfigured, init,
  // Auth
  getAuthInstance, getCurrentUser, registerUser, loginUser, logoutUser, onAuthChanged, updateUserPassword,
  // Firestore User
  fbGetUser, fbSaveUser,
  // Firestore Prescriptions
  fbGetPrescriptions, fbSavePrescription, fbDeletePrescription,
  // Firestore Logs
  fbGetLogs, fbLogDose,
  // Firestore Doctors
  fbGetDoctors, fbSaveDoctor,
  // Firestore Schedules
  fbGetSchedules, fbSaveSchedule,
  // Firestore My Doctor
  fbGetMyDoctor, fbSetMyDoctor,
  // Firestore Condition Presets
  fbGetConditionPresets,
  // Firestore Delete
  fbDeleteAllUserData,
};
