import { db } from "./firebase.js";
import { collection, onSnapshot, doc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const listaEntregas = document.getElementById("lista-entregas");

// --- FUNÇÃO PRINCIPAL DE MONITORAMENTO ---
function iniciarPainelEntregador() {
    onSnapshot(collection(db, "pedidos"), (snapshot) => {
        listaEntregas.innerHTML = "";
        let temEntrega = false;

        snapshot.forEach((docSnap) => {
            const p = docSnap.data();
            const id = docSnap.id;

            const tipo = p.tipo_local ? p.tipo_local.toLowerCase() : "";
            const statusAtual = p.status ? p.status.toLowerCase() : "";

            // Filtro para mostrar apenas entregas ativas
            const statusValidos = ["pendente", "em preparo", "pronto", "em rota"];

            if (tipo === "entrega" && statusValidos.includes(statusAtual)) {
                temEntrega = true;
                renderizarCard(id, p);
            }
        });

        if (!temEntrega) {
            listaEntregas.innerHTML = "<p style='text-align:center; margin-top:20px; color: #fff;'>Nenhuma entrega pendente por enquanto. 🙌</p>";
        }
    });
}

// --- FUNÇÃO DE RENDERIZAÇÃO DO CARD ---
// --- FUNÇÃO DE RENDERIZAÇÃO DO CARD ATUALIZADA ---
function renderizarCard(id, p) {
    const card = document.createElement("div");
    card.className = "card-entrega";

    // Lógica de Pagamento
    const jaPago = p.pagamento?.status_pagamento === "Pago";
    const corAlerta = jaPago ? "#28a745" : "#d32f2f"; // Verde para Pago, Vermelho para Cobrar
    const textoAlerta = jaPago ? "✅ JÁ PAGO - NÃO COBRAR" : "💰 COBRAR NO ATO - R$ " + (p.total || 0).toFixed(2);

    let corStatus = "#666";
    let textoStatus = p.status || "Pendente";
    if (p.status === "Pronto") corStatus = "#28a745";
    else if (p.status === "Em preparo") corStatus = "#ff9800";
    else if (p.status === "Em rota") corStatus = "#4285F4";

    const enderecoFormatado = encodeURIComponent(p.endereco_entrega || "");
    const linkMaps = `https://www.google.com/maps/search/?api=1&query=${enderecoFormatado}`;

    card.innerHTML = `
        <div style="background: ${corAlerta}; color: white; text-align: center; padding: 12px; border-radius: 8px 8px 0 0; margin: -15px -15px 15px -15px; font-weight: bold; font-size: 1.1em; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            ${textoAlerta}
        </div>

        <div style="border-bottom: 1px solid #ddd; padding-bottom: 8px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
                <h3 style="margin:0; color:#000;">👤 ${p.cliente_nome}</h3>
                <small style="color:#333;">Status: <strong style="color: ${corStatus};">${textoStatus.toUpperCase()}</strong></small>
            </div>
            <button onclick="window.abrirZap('${p.cliente_fone}', '${p.cliente_nome}')" 
                    style="background: #25D366; border: none; border-radius: 50%; width: 45px; height: 45px; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">
                <span style="font-size: 24px;">💬</span>
            </button>
        </div>

        <p style="color:#000; margin: 10px 0;">📍 <strong>Endereço:</strong><br>${p.endereco_entrega || "Não informado"}</p>
        
        <div class="info-valor" style="color:#000; background: #f9f9f9; padding: 10px; border-radius: 5px;">
            <p style="margin:2px 0;">💰 <strong>Total Pedido:</strong> R$ ${(p.total || 0).toFixed(2)}</p>
            <p style="margin:2px 0;">💳 <strong>Método:</strong> ${p.pagamento?.metodo || 'A combinar'}</p>
            ${p.pagamento?.troco > 0 ? `<p style="margin:2px 0; color:#d32f2f; font-weight:bold;">💵 Levar Troco: R$ ${p.pagamento.troco.toFixed(2)}</p>` : ''}
        </div>

        <p style="font-size: 1.05em; color: #333; margin: 10px 0;">📋 <strong>Itens:</strong> ${formatarResumoItens(p)}</p>

        <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 15px;">
            <a href="${linkMaps}" target="_blank" style="text-align:center; background:#4285F4; color:white; padding:12px; border-radius:5px; text-decoration:none; font-weight:bold; display: block;">🗺️ Abrir Rota no GPS</a>
            
            <div style="display: flex; gap: 8px;">
                ${p.status === "Pronto" ?
            `<button onclick="atualizarStatus('${id}', 'Em rota')" style="flex:1; background:#ff9800; color:white; border:none; padding:12px; border-radius:5px; font-weight:bold; cursor:pointer;">🛵 INICIAR ENTREGA</button>` : ''
        }
                <button onclick="finalizarEntrega('${id}')" style="flex:1; background:#28a745; color:white; border:none; padding:12px; border-radius:5px; font-weight:bold; cursor:pointer;">✅ CONCLUIR</button>
            </div>
        </div>
    `;
    listaEntregas.appendChild(card);
}

// --- FUNÇÃO PARA LISTAR ITENS ---
function formatarResumoItens(p) {
    let itens = [];
    if (p.jantinhas?.quantidade) itens.push(`${p.jantinhas.quantidade}x Jantinha`);
    const extrair = (obj) => {
        if (!obj) return;
        Object.entries(obj).forEach(([nome, qtd]) => { if (qtd > 0) itens.push(`${qtd}x ${nome}`); });
    };
    extrair(p.espetos);
    extrair(p.refrigerantes);
    extrair(p.lanches);
    extrair(p.acai);
    return itens.length > 0 ? itens.join(", ") : "Detalhes no pedido";
}

// --- FUNÇÃO WHATSAPP MANUAL ---
window.abrirZap = (fone, nome) => {
    if (!fone) return alert("Telefone não cadastrado!");
    const msg = encodeURIComponent(`Olá ${nome}, aqui é do entregador da F&B Burguer! Tudo bem?`);
    window.open(`https://wa.me/55${fone}?text=${msg}`, '_blank');
};

// --- ATUALIZAR STATUS E GATILHO AUTOMÁTICO ---
window.atualizarStatus = async (id, novoStatus) => {
    try {
        const docRef = doc(db, "pedidos", id);
        await updateDoc(docRef, { status: novoStatus });

        if (novoStatus === "Em rota") {
            const snap = await getDoc(docRef);
            if (snap.exists()) {
                const p = snap.data();
                if (p.cliente_fone) {
                    const msg = `Olá *${p.cliente_nome}*! Seu pedido da *F&B Burguer* acabou de sair com o nosso entregador e chega em instantes! 🛵💨`;
                    window.open(`https://wa.me/55${p.cliente_fone}?text=${encodeURIComponent(msg)}`, '_blank');
                }
            }
        }
    } catch (e) {
        console.error("Erro ao atualizar status:", e);
    }
};

window.finalizarEntrega = async (id) => {
    if (confirm("Marcar esta entrega como concluída?")) {
        await window.atualizarStatus(id, "Concluído");
    }
};

iniciarPainelEntregador();