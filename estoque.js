import { db } from "./firebase.js";
import {
    collection, onSnapshot, doc, updateDoc, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 1️⃣ INICIALIZAÇÃO E ESCUTA EM TEMPO REAL
document.addEventListener("DOMContentLoaded", () => {
    const tabela = document.getElementById("tabela-estoque");

    if (!tabela) {
        console.warn("⚠️ Tabela não encontrada. Se você não estiver na página de estoque, ignore este aviso.");
        return;
    }

    onSnapshot(collection(db, "estoque"), (snapshot) => {
        tabela.innerHTML = "";

        if (snapshot.empty) {
            console.log("📭 Estoque vazio. Carregando itens padrão...");
            inicializarEstoquePadrao();
            return;
        }

        snapshot.forEach((docSnap) => {
            const item = docSnap.data();
            const id = docSnap.id;
            const tr = document.createElement("tr");

            // Alerta visual para estoque baixo (menos de 5 unidades)
            const estiloBaixo = item.quantidade < 5 ? "style='color: #ff5252; font-weight: bold;'" : "";

            tr.innerHTML = `
                <td>${id}</td>
                <td ${estiloBaixo}>${item.quantidade}</td>
                <td>
                    <button class="btn-acao" data-id="${id}" data-val="-1" style="padding: 5px 10px; cursor:pointer; background:#444; color:white; border:none; border-radius:4px;">-</button>
                    <button class="btn-acao" data-id="${id}" data-val="1" style="padding: 5px 10px; cursor:pointer; background:#28a745; color:white; border:none; border-radius:4px;">+</button>
                </td>
            `;
            tabela.appendChild(tr);
        });

        atribuirEventosBotoes();
    });
});

// 2️⃣ FUNÇÕES DE AJUSTE MANUAL (+ e -)
async function ajustarEstoque(id, mudanca) {
    try {
        const itemRef = doc(db, "estoque", id);
        const snap = await getDoc(itemRef);

        if (snap.exists()) {
            const novaQtd = Math.max(0, snap.data().quantidade + mudanca);
            await updateDoc(itemRef, { quantidade: novaQtd });
        }
    } catch (e) {
        console.error("❌ Erro ao ajustar estoque:", e);
    }
}

function atribuirEventosBotoes() {
    document.querySelectorAll(".btn-acao").forEach(btn => {
        btn.onclick = (e) => {
            const id = e.target.getAttribute("data-id");
            const valor = parseInt(e.target.getAttribute("data-val"));
            ajustarEstoque(id, valor);
        };
    });
}

// 3️⃣ CADASTRO DE NOVOS ITENS (Via formulário)
window.cadastrarNovoItem = async () => {
    const nomeInput = document.getElementById("novo-item-nome");
    const qtdInput = document.getElementById("novo-item-qtd");

    const nome = nomeInput.value.trim();
    const qtd = parseInt(qtdInput.value);

    if (nome && !isNaN(qtd)) {
        try {
            await setDoc(doc(db, "estoque", nome), { quantidade: qtd });
            nomeInput.value = "";
            qtdInput.value = "";
            alert(`✅ ${nome} adicionado!`);
        } catch (e) {
            alert("Erro ao salvar no banco.");
        }
    } else {
        alert("Preencha o nome e a quantidade corretamente.");
    }
};

// 4️⃣ CARGA INICIAL COMPLETA (Sua lista de espetos, lanches, insumos, etc)
// Procure a função inicializarEstoquePadrao e mude para:
window.inicializarEstoquePadrao = async () => {
    const todosItens = {
        // ESPETOS (Removidas as barras '/')
        "Fraldinha": 20,
        "Almôdega com Bacon": 20,
        "Fran Bacon": 20,
        "Costela Bovina": 20,
        "Linguiça Cuiabana com Queijo": 20,
        "Kafta com Queijo": 20,
        "Linguiça Toscana": 20,
        "Tulipa": 20,
        "Cupim Laranja": 20,
        "Costela Suina": 20,
        "Filé Mignon": 20,
        "Pão de alho": 20,
        "Coraçãozinho": 20,
        "Medalhão": 20,
        "Choripan": 20,

        // LANCHES E INSUMOS
        "Batata Frita M": 50,
        "Batata Frita P": 50,
        "Pão": 100,
        "Hambúrguer": 100,
        "Queijo": 100,
        "Bacon": 80,
        "Banana (Insumo)": 50,
        "Abacaxi": 40,

        // AÇAÍ E BEBIDAS
        "Açaí 400ml": 30,
        "Paçoca": 50,
        "Leite em pó": 50,
        "Granola": 50,
        "Leite condensado": 50,
        "Coca Cola 2L": 20,
        "Fanta Laranja 2L": 20,
        "Coca cola Lata 310ml": 20,
        "Heineken": 20
    };

    console.log("⏳ Iniciando carga de dados limpos...");

    try {
        // Importante: Usar for...of com await para respeitar as promessas
        for (const [nome, qtd] of Object.entries(todosItens)) {
            await setDoc(doc(db, "estoque", nome), {
                quantidade: qtd,
                ultimaAtualizacao: new Date()
            });
            console.log(`✅ Adicionado: ${nome}`);
        }
        alert("✅ Estoque inicial carregado com sucesso!");
    } catch (error) {
        console.error("❌ Erro na carga:", error);
        alert("Erro ao carregar estoque. Verifique o console.");
    }
};
// Adicione ao seu estoque.js para exportar a função de baixa
window.baixarEstoquePedido = async function (itensDoPedido) {
    const batch = writeBatch(db); // Usa batch para atualizar tudo de uma vez

    for (const [nome, qtd] of Object.entries(itensDoPedido)) {
        const itemRef = doc(db, "estoque", nome);
        const itemSnap = await getDoc(itemRef);

        if (itemSnap.exists()) {
            const novaQtd = itemSnap.data().quantidade - Number(qtd);
            batch.update(itemRef, { quantidade: novaQtd });
        }
    }
    await batch.commit();
    console.log("✅ Estoque atualizado após a venda!");
};