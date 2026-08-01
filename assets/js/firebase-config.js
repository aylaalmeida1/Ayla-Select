/* =========================================================================
   CONFIGURAÇÃO DO FIREBASE — Ayla Select | Clube VIP
   ========================================================================= */

const firebaseConfig = {
  apiKey: "AIzaSyBVutT8jfjEBg8pwKQMwb4xPYLnasewK7s",
  authDomain: "cartaofidelidade-studioayla.firebaseapp.com",
  projectId: "cartaofidelidade-studioayla",
  storageBucket: "cartaofidelidade-studioayla.firebasestorage.app",
  messagingSenderId: "1046694631454",
  appId: "1:1046694631454:web:515607cf09bfd22f6af60f"
};

// Inicializa o Firebase (usa a versão "compat", sem precisar de build tools)
firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();
const auth = firebase.auth();

// Nome da coleção no Firestore onde ficam as clientes
const COLECAO_CLIENTES = "clientes";

// URL base do seu site publicado (GitHub Pages)
const URL_BASE_DO_SITE = "https://aylaalmeida1.github.io/Ayla-Select";
