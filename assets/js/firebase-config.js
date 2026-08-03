const firebaseConfig = {
  apiKey: "AIzaSyBVutT8jfjEBg8pwKQMwb4xPYLnasewK7s",
  authDomain: "cartaofidelidade-studioayla.firebaseapp.com",
  projectId: "cartaofidelidade-studioayla",
  storageBucket: "cartaofidelidade-studioayla.firebasestorage.app",
  messagingSenderId: "1046694631454",
  appId: "1:1046694631454:web:515607cf09bfd22f6af60f"
};

firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();
const auth = firebase.auth();
const storage = firebase.storage();

const COLECAO_CLIENTES = "clientes";
const COLECAO_LOG = "logAlteracoes";
const DOC_CONFIGURACOES = "configuracoes/geral";

const URL_BASE_DO_SITE = "https://aylaalmeida1.github.io/Ayla-Select";
