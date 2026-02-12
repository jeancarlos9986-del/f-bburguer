// ==========================================
// 1️⃣ IMPORTS
// ==========================================
import { db } from "./firebase.js";
import {
    collection, query, orderBy, onSnapshot, doc, updateDoc, getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ==========================================
// 2️⃣ CONFIGURAÇÃO DE PRAÇA
// ==========================================
const urlParams = new URLSearchParams(window.location.search);
let pracaAtual = urlParams.get('praca') || localStorage.getItem('pracaSelecionada');

document.addEventListener("DOMContentLoaded", () => {
    if (pracaAtual) {
        document.title = `Cozinha - ${pracaAtual.toUpperCase()}`;
        const titulo = document.querySelector("h1");
        if (titulo) titulo.innerHTML = `<i class="fas fa-fire"></i> PEDIDOS: ${pracaAtual.toUpperCase()}`;
    }
});

// ==========================================
// 3️⃣ VARIÁVEIS DE SOM E CONTROLE
// ==========================================
let pedidosCarregados = new Set();
let somLiberado = false;
const audio = document.getElementById("som-pedido");
const lista = document.getElementById("lista-pedidos-cozinha");

window.liberarSom = () => {
    if (audio) {
        audio.play().then(() => {
            audio.pause();
            audio.currentTime = 0;
            somLiberado = true;
            const btn = document.getElementById("ativar-som");
            btn.innerHTML = '<i class="fas fa-volume-up"></i> Som Ativado';
            btn.style.background = "#28a745";
        });
    }
};

// ==========================================
// 4️⃣ LÓGICA DE BAIXA AUTOMÁTICA DE ESTOQUE
// ==========================================
async function darBaixaNoEstoque(pedido) {
    const itensParaBaixar = {
        ...(pedido.espetos || {}),
        ...(pedido.lanches || {})
    };

    for (let [nome, qtdVendida] of Object.entries(itensParaBaixar)) {
        if (qtdVendida <= 0) continue;
        let nomeLimpo = nome.replace("/", " com ");

        try {
            const itemRef = doc(db, "estoque", nomeLimpo);
            const snap = await getDoc(itemRef);

            if (snap.exists()) {
                const qtdAtual = snap.data().quantidade || 0;
                const novaQtd = Math.max(-10, qtdAtual - qtdVendida);

                await updateDoc(itemRef, {
                    quantidade: novaQtd,
                    ultimaSaida: new Date()
                });
            }
        } catch (error) {
            console.error(`❌ Erro ao baixar ${nome}:`, error);
        }
    }
}

// ==========================================
// 5️⃣ FUNÇÕES DE STATUS
// ==========================================
window.iniciarPedido = async (id) => {
    try {
        await updateDoc(doc(db, "pedidos", id), { status: "Em preparo" });
    } catch (e) { console.error(e); }
};

async function finalizarPedido(id) {
    const docRef = doc(db, "pedidos", id);
    const snap = await getDoc(docRef);
    const dados = snap.data();
    const agora = Date.now();

    let campoPronto = pracaAtual === 'lanches' ? 'prontoLanche' : 'prontoEspeto';

    // 1. Preparamos a atualização da PRAÇA ATUAL
    let updateData = {
        [campoPronto]: true,
        [`tempo_preparo_${pracaAtual}`]: Math.floor((Date.now() - dados.timestamp) / 60000)
    };

    // 2. CHECAGEM CRÍTICA: A outra praça já terminou ou sequer existe?
    const temOutraPraca = pracaAtual === 'lanches'
        ? (Object.values(dados.espetos || {}).some(q => q > 0) || !!dados.jantinhas?.quantidade)
        : (Object.values(dados.lanches || {}).some(q => q > 0));

    const outraPracaJaTaPronta = pracaAtual === 'lanches'
        ? (dados.prontoEspeto === true)
        : (dados.prontoLanche === true);

    // 3. Só encerra o pedido TOTAL se não houver outra praça ou se ela já terminou
    if (!temOutraPraca || outraPracaJaTaPronta) {
        updateData.status = "Pronto";
        updateData.timestamp_pronto = Date.now(); // <--- ADICIONE ESTA LINHA
    } else {
        // Caso contrário, mantém Pendente para a outra cozinha continuar vendo
        updateData.status = "Pendente";
    }

    await updateDoc(docRef, updateData);
}

// ==========================================
// 6️⃣ FUNÇÃO AUXILIAR DE ÍCONES
// ==========================================
function obterEtiquetaTipo(tipo) {
    const chave = tipo ? tipo.trim().toLowerCase() : 'padrão';
    const tipos = {
        'entrega': { texto: 'ENTREGA', icone: 'fa-motorcycle', cor: '#ff5252' },
        'local': { texto: 'NO LOCAL', icone: 'fa-utensils', cor: '#4caf50' },
        'balcao': { texto: 'RETIRADA', icone: 'fa-shopping-bag', cor: '#2196f3' }
    };
    const config = tipos[chave] || { texto: 'NÃO DEFINIDO', icone: 'fa-question', cor: '#777' };
    return `<span class="tipo-destaque" style="background: ${config.cor}; color: white; padding: 6px 14px; border-radius: 50px; font-size: 25px; font-weight: bold; display: inline-flex; align-items: center; gap: 6px;"><i class="fas ${config.icone}"></i> ${config.texto}</span>`;
}

// ==========================================
// 7️⃣ ESCUTA EM TEMPO REAL
// ==========================================
const q = query(collection(db, "pedidos"), orderBy("timestamp", "asc"));
onSnapshot(q, (snapshot) => {
    if (!lista) return;
    lista.innerHTML = "";
    const pedidosFiltrados = [];
    let novoPedidoDetectado = false;

    console.log("CyberTech: Snapshot recebido. Pedidos no banco:", snapshot.size);

    snapshot.forEach(docSnap => {
        const p = { id_db: docSnap.id, ...docSnap.data() };

        // --- VALIDAÇÃO DE HORÁRIO (A TRAVA) ---
        const agendado = p.horarioAgendado;
        if (!deveAparecerAgora(agendado)) {
            console.log(`Pedido de ${p.cliente} ocultado (Agendado para ${agendado})`);
            return; // Pula a renderização deste pedido
        }

        // --- LÓGICA DE PRAÇAS (LANCHES/ESPETOS) ---
        const dadosLanches = p.cozinha || p.lanches || p.lanche || {};
        const dadosEspetos = p.churrasqueira || p.espetos || p.espeto || {};

        const temLanche = Array.isArray(dadosLanches) ? dadosLanches.length > 0 : Object.values(dadosLanches).some(q => q > 0);
        const temChurrasco = Array.isArray(dadosEspetos) ? dadosEspetos.length > 0 : Object.values(dadosEspetos).some(q => q > 0) || (p.jantinhas?.quantidade > 0);

        let mostrar = false;

        if (pracaAtual === 'lanches' || pracaAtual === 'cozinha') {
            if (temLanche && !p.prontoLanche) mostrar = true;
        } else if (pracaAtual === 'espetos' || pracaAtual === 'churrasqueira') {
            if (temChurrasco && !p.prontoEspeto) mostrar = true;
        } else {
            if (p.status !== "Pronto") mostrar = true;
        }

        // --- FILTRO DE STATUS ---
        if (["Pendente", "Em preparo", "Preparando"].includes(p.status) && mostrar) {
            renderizarPedido(docSnap.id, p);
            pedidosFiltrados.push(p);

            if (!pedidosCarregados.has(docSnap.id)) {
                pedidosCarregados.add(docSnap.id);
                novoPedidoDetectado = true;
            }
        }
    });

    if (novoPedidoDetectado && somLiberado && audio) {
        audio.play().catch(e => console.log("Som bloqueado"));
    }
    atualizarResumoProducao(pedidosFiltrados);
});

// ==========================================
// 8️⃣ RENDERIZAÇÃO DE CARDS (CORRIGIDO)
// ==========================================
function renderizarPedido(id, p) {
    const div = document.createElement("div");
    const agora = Date.now();
    const criadoEm = p.timestamp || agora;
    const minutos = Math.floor((agora - criadoEm) / 60000);
    const corTimer = minutos >= 20 ? "#ff4d4d" : (minutos >= 10 ? "#ffcc00" : "#444");

    div.className = `pedido-card status-${p.status.replace(" ", "-")}`;

    let itensHTML = "";

    // Estilos Inline para garantir contraste
    const estiloNovo = `background-color: #fff3cd !important; color: #856404 !important; border-left: 5px solid #ffc107; padding: 10px; margin: 5px 0; border-radius: 4px; display: block; font-weight: bold; list-style: none;`;
    const estiloNormal = `color: #ffffff; padding: 5px 0; border-bottom: 1px dashed #444; list-style: none; display: block;`;

    // --- 🍢 ESPETOS ---
    if (pracaAtual === 'espetos' || !pracaAtual) {
        const jaFeitos = p.entreguesEspetos || {};

        // Jantinhas
        const totalJ = p.jantinhas?.quantidade || 0;
        const feitoJ = jaFeitos.jantinhas || 0;
        const saldoJ = totalJ - feitoJ;
        if (saldoJ > 0) {
            itensHTML += `<li style="${feitoJ > 0 ? estiloNovo : estiloNormal}"><i class="fas fa-utensil-spoon"></i> ${saldoJ}x Jantinha ${feitoJ > 0 ? '<span style="color: #000; font-size: 10px; background: #ffc107; padding: 2px 4px; border-radius: 3px; margin-left: 5px;">🆕 NOVO</span>' : ''}</li>`;
        }

        // Espetos (plural ou singular)
        Object.entries(p.espetos || p.espeto || {}).forEach(([nome, qtdTotal]) => {
            const qtdFeita = jaFeitos[nome] || 0;
            const saldo = qtdTotal - qtdFeita;
            if (saldo > 0) {
                itensHTML += `<li style="${qtdFeita > 0 ? estiloNovo : estiloNormal}"><i class="fas fa-fire"></i> ${saldo}x ${nome} ${qtdFeita > 0 ? '<span style="color: #000; font-size: 10px; background: #ffc107; padding: 2px 4px; border-radius: 3px; margin-left: 5px;">🆕 NOVO</span>' : ''}</li>`;
            }
        });
    }

    // --- 🍔 LANCHES ---
    if (pracaAtual === 'lanches' || !pracaAtual) {
        const jaFeitosL = p.entreguesLanches || {};
        Object.entries(p.lanches || p.lanche || {}).forEach(([nome, qtdTotal]) => {
            const qtdFeita = jaFeitosL[nome] || 0;
            const saldo = qtdTotal - qtdFeita;
            if (saldo > 0) {
                itensHTML += `<li style="${qtdFeita > 0 ? estiloNovo : estiloNormal}"><i class="fas fa-hamburger"></i> ${saldo}x ${nome} ${qtdFeita > 0 ? '<span style="color: #000; font-size: 10px; background: #ffc107; padding: 2px 4px; border-radius: 3px; margin-left: 5px;">🆕 NOVO</span>' : ''}</li>`;
            }
        });
    }

    if (itensHTML === "") return;

    div.innerHTML = `
        <div class="pedido-header">
            <span class="pedido-id">#${String(p.id).slice(-4)}</span>
            ${obterEtiquetaTipo(p.tipo_local)}
            <span style="background:${corTimer}; color:white; padding:2px 8px; border-radius:4px; font-size:14px;"><i class="far fa-clock"></i> ${minutos}m</span>
        </div>
        <div class="pedido-corpo">
            <strong class="cliente-nome"><i class="fas fa-user"></i> ${p.cliente_nome}</strong>
            <ul class="lista-itens" style="padding:0; margin:10px 0;">${itensHTML}</ul>
            ${p.observacao ? `<div class="observacao-box" style="border-left: 4px solid #ffc107; background: #ffffffff; padding: 5px 10px; font-style: italic; color: #333;">💬 ${p.observacao}</div>` : ''}
            ${p.ponto_carne && (pracaAtual === 'espetos' || !pracaAtual) ? `<div style="color:#666; font-size:13px; margin-top:5px;"><strong>Ponto:</strong> ${p.ponto_carne}</div>` : ''}
        </div>
        <div class="pedido-footer" style="display: flex; gap: 10px; margin-top: 15px;">
            <button class="btn-cozinha btn-preparar" style="flex:1;" onclick="iniciarPedido('${id}')">${p.status === "Pendente" ? "INICIAR" : "FAZENDO"}</button>
            <button class="btn-cozinha btn-finalizar" style="flex:1;" onclick="finalizarPedido('${id}')">PRONTO</button>
        </div>
    `;
    lista.appendChild(div);
}

function atualizarResumoProducao(pedidos) {
    const totais = {};
    const resumo = document.getElementById("totalizadores-itens");
    if (!resumo) return;
    pedidos.forEach(p => {
        let itensDaPraca = {};
        if (pracaAtual === 'lanches') itensDaPraca = p.lanches || p.lanche || {};
        else if (pracaAtual === 'espetos') itensDaPraca = { ...(p.espetos || p.espeto || {}), "Jantinha": p.jantinhas?.quantidade || 0 };
        else itensDaPraca = { ...(p.espetos || p.espeto || {}), ...(p.lanches || p.lanche || {}) };

        Object.entries(itensDaPraca).forEach(([n, q]) => {
            if (q > 0) totais[n] = (totais[n] || 0) + q;
        });
    });
    resumo.innerHTML = Object.entries(totais).map(([n, q]) => `<div class="resumo-tag"><strong>${q}x</strong> ${n}</div>`).join("");
}
// Faz as funções ficarem visíveis para os botões do HTML
window.finalizarPedido = finalizarPedido;
if (typeof iniciarPedido !== 'undefined') {
    window.iniciarPedido = iniciarPedido;
}
function deveAparecerAgora(horarioAgendado) {
    console.log("DEBUG: Recebi o horário:", horarioAgendado); // Isso TEM que aparecer no F12

    if (!horarioAgendado || horarioAgendado === "Imediato") {
        console.log("DEBUG: É imediato, liberando...");
        return true;
    }

    const agora = new Date();
    const [h, m] = horarioAgendado.split(':');
    const horarioPedido = new Date();
    horarioPedido.setHours(parseInt(h), parseInt(m), 0);

    const diferenca = (horarioPedido - agora) / 1000 / 60;
    console.log("DEBUG: Minutos para o pedido:", Math.round(diferenca));

    return diferenca <= 30;
}
// Exemplo de como deve ficar a função de concluir o pedido
async function marcarComoPronto(idPedido) {
    const docRef = doc(db, "pedidos", idPedido);
    await updateDoc(docRef, {
        status: "Pronto",
        timestamp_pronto: Date.now() // 🚀 Registra o momento exato da conclusão
    });

}
