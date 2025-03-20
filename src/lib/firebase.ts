// Importações do Firebase
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

// Configuração do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyDIFTiiEz1NhKuU1PMUYGi1YS9cF0pIXLM",
    authDomain: "contigo-a9a2c.firebaseapp.com",
    projectId: "contigo-a9a2c",
    storageBucket: "contigo-a9a2c.firebasestorage.app",
    messagingSenderId: "852185149598",
    appId: "1:852185149598:web:632b7238fe08afd9194b8f",
    measurementId: "G-VHQQWF0648"
};

// Inicializa o Firebase
const app: FirebaseApp = initializeApp(firebaseConfig);

// Exporta instâncias dos serviços
export const auth: Auth = getAuth(app);
export const googleProvider: GoogleAuthProvider = new GoogleAuthProvider();
export const db: Firestore = getFirestore(app);

// Configure a autenticação do Google para pedir o perfil do usuário
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export default app; 