import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Configuração corrigida para o projeto fb-pedidos (conforme sua imagem)
const firebaseConfig = {
    apiKey: "AIzaSyDIcG9NqxQ7PLUB9Qu45FUWwvD1K7of-2s",
    authDomain: "fb-pedidos.firebaseapp.com",
    projectId: "fb-pedidos",
    storageBucket: "fb-pedidos.appspot.com",
    messagingSenderId: "702648413709",
    appId: "1:702648413709:web:ce059405977b5e628bef44"
};

// Inicializa o Firebase garantindo que não duplique a conexão
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const db = getFirestore(app);

// Expõe o db globalmente para scripts que não usam import (como o seu firebasePedidos.js)
window.db = db;