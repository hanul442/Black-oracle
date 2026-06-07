import { GoogleGenAI } from '@google/genai';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
let firebaseConfig;
try {
  firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf-8'));
} catch (e) {
  console.error("Could not read firebase-applet-config.json", e);
  process.exit(1);
}

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

async function clearDb() {
  const collections = ['sources', 'signals', 'questions', 'hypotheses', 'scenarios', 'reports'];
  for (const collName of collections) {
    const snaps = await getDocs(collection(db, collName));
    let deletedCount = 0;
    for (const d of snaps.docs) {
      await deleteDoc(d.ref);
      deletedCount++;
    }
    console.log(`Deleted ${deletedCount} documents from '${collName}'`);
  }
  console.log("Firebase DB completely reset/initialized!");
  process.exit(0);
}

clearDb();
