// Firebase-initialisatie. Zolang de VITE_FIREBASE_* variabelen ontbreken, draait de app
// in "lokale modus": scans worden enkel in localStorage bewaard (handig om te testen).
import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const env = import.meta.env

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
}

export const firebaseEnabled = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId)

let db = null
if (firebaseEnabled) {
  const app = initializeApp(firebaseConfig)
  db = getFirestore(app)
}

export { db }
