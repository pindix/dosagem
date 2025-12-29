// --- ELEMENTOS ---
const el = {
    pais: document.getElementById("pais"),
    nome: document.getElementById("nome"),
    sugestoes: document.getElementById("sugestoes_box"),
    peso: document.getElementById("peso"),
    pesoDiv: document.getElementById("campo_de_peso"),
    idade: document.getElementById("idade"),
    idadeDiv: document.getElementById("campo_de_idade"),
    idadeUnidade: document.getElementById("unidade_de_idade"),
    dosagem: document.getElementById("dosagem"),
    dosagemDiv: document.getElementById("campo_de_dosagem"),
    dosagemUnidade: document.getElementById("unidade_de_dosagem"),
    dose: document.getElementById("dose"),
    via: document.getElementById("via"),
    intervalo: document.getElementById("intervalo"),
    resultado: document.getElementById("resultado")
};

let bancoDados = {};

// --- CARREGAMENTO ---
async function carregarExcel() {
    try {
        const resp = await fetch('medicamentos.xlsx');
        const data = await resp.arrayBuffer();
        const wb = XLSX.read(data);
        wb.SheetNames.forEach(n => bancoDados[n.toLowerCase()] = XLSX.utils.sheet_to_json(wb.Sheets[n]));
    } catch (e) { console.error("Erro ao carregar Excel."); }
}

// --- BUSCA E FILTRO ---
function buscarMedicamento() {
    const termo = el.nome.value.trim().toLowerCase();
    const pais = el.pais.value.toLowerCase();
    if (!termo) return null;

    // Procura no país, se não achar, procura no universal
    let lista = (bancoDados[pais] || []).filter(m => m.nome.toLowerCase() === termo);
    if (lista.length === 0 && pais !== "universal") {
        lista = (bancoDados["universal"] || []).filter(m => m.nome.toLowerCase() === termo);
    }
    
    if (lista.length === 0) return null;

    // O CHECK: Encontra a linha que bate com a Dose e Via selecionadas
    return lista.find(m => 
        String(m.dose || "").toLowerCase() === el.dose.value && 
        String(m.via || "").toLowerCase() === el.via.value
    ) || lista[0];
}

// --- INTERFACE DINÂMICA ---
function atualizarInterface() {
    const m = buscarMedicamento();
    
    if (!m) {
        // Se não encontrar o nome exato, esconde campos e limpa inputs (exceto SELECTS)
        [el.pesoDiv, el.idadeDiv, el.dosagemDiv, el.intervalo].forEach(d => d.style.display = "none");
        el.peso.value = ""; el.idade.value = ""; el.dosagem.value = "";
        return;
    }

    const campos = String(m.campos || "").toLowerCase();
    
    // Mostrar/Esconder Divs
    el.pesoDiv.style.display = campos.includes("peso") ? "flex" : "none";
    el.idadeDiv.style.display = campos.includes("idade") ? "flex" : "none";
    el.dosagemDiv.style.display = campos.includes("dosagem") ? "flex" : "none";

    // Configurar Dosagem e Unidade
    if (campos.includes("dosagem")) {
        el.dosagemUnidade.textContent = m.unidade || "mg/kg";
        if (!el.dosagem.value) el.dosagem.value = m.dosagem_padrao || "";
    }

    // Configurar Intervalo
    if (m.intervalo) {
        el.intervalo.style.display = "block";
        const opcoes = String(m.intervalo).split(",");
        if (el.intervalo.dataset.last !== String(m.intervalo)) {
            el.intervalo.innerHTML = "";
            opcoes.forEach(h => el.intervalo.add(new Option(`De ${h.trim()} em ${h.trim()}h`, h.trim())));
            el.intervalo.dataset.last = String(m.intervalo);
        }
    } else {
        el.intervalo.style.display = "none";
    }
}

// --- CÁLCULO ---
function calcular() {
    const m = buscarMedicamento();
    if (!m) {
        el.resultado.innerHTML = "⚠️ Medicamento não encontrado na base de dados.";
        el.resultado.style.background = "#ff4d4d";
        return;
    }

    let p = parseFloat(el.peso.value) || 0;
    let d = parseFloat(el.dosagem.value) || 0;
    let iVal = parseFloat(el.idade.value) || 0;
    let iDias = iVal * parseFloat(el.idadeUnidade.value);
    let h = parseFloat(el.intervalo.value) || 1;
    let c = m.concentracoao || 1;
    let n = m.nome;

    // Notificações de Correção (Alerts)
    if (el.pesoDiv.style.display !== "none") {
        if (p < m.peso_minimo || p > m.peso_maximo) {
            p = p < m.peso_minimo ? m.peso_minimo : m.peso_maximo;
            alert(`Peso corrigido para ${p}kg (Intervalo permitido: ${m.peso_minimo}-${m.peso_maximo}kg)`);
            el.peso.value = p;
        }
    }

    if (el.idadeDiv.style.display !== "none") {
        if (iDias < m.idade_minima || iDias > m.idade_maxima) {
            const novaIdadeDias = iDias < m.idade_minima ? m.idade_minima : m.idade_maxima;
            iVal = (novaIdadeDias / parseFloat(el.idadeUnidade.value)).toFixed(1);
            alert(`Idade corrigida para ${iVal} (Intervalo em dias: ${m.idade_minima}-${m.idade_maxima})`);
            el.idade.value = iVal;
            iDias = novaIdadeDias;
        }
    }

    if (el.dosagemDiv.style.display !== "none") {
        if (d < m.dosagem_minima || d > m.dosagem_maxima) {
            d = d < m.dosagem_minima ? m.dosagem_minima : m.dosagem_maxima;
            alert(`Dosagem corrigida para ${d}${m.unidade} (Intervalo: ${m.dosagem_minima}-${m.dosagem_maxima})`);
            el.dosagem.value = d;
        }
    }

    try {
        // Executa a fórmula do Excel como Template String
        const formulaFinal = eval("`" + m.formula + "`");
        el.resultado.innerHTML = formulaFinal;
        el.resultado.style.background = "var(--primary)";
        el.resultado.style.whiteSpace = "pre-wrap";
    } catch (e) {
        el.resultado.innerHTML = "Erro na fórmula do medicamento.";
    }
}

// --- SUGESTÕES ---
el.nome.addEventListener("input", () => {
    const termo = el.nome.value.toLowerCase().trim();
    el.sugestoes.innerHTML = "";
    if (termo.length < 2) { el.sugestoes.style.display = "none"; atualizarInterface(); return; }

    const pais = el.pais.value.toLowerCase();
    const listaSug = [...new Set([...(bancoDados[pais] || []), ...(bancoDados["universal"] || [])].map(m => m.nome))];
    const filtrados = listaSug.filter(n => n.toLowerCase().includes(termo));

    if (filtrados.length > 0) {
        el.sugestoes.style.display = "block";
        filtrados.forEach(n => {
            const div = document.createElement("div");
            div.textContent = n;
            div.onclick = () => { el.nome.value = n; el.sugestoes.style.display = "none"; atualizarInterface(); };
            el.sugestoes.appendChild(div);
        });
    }
    atualizarInterface();
});

// --- LIMPAR ---
function limpar() {
    ["peso", "idade", "dosagem", "resultado"].forEach(k => {
        if(el[k].tagName === "P") el[k].innerHTML = "";
        else el[k].value = "";
    });
    atualizarInterface();
}

// --- EVENTOS DE MUDANÇA ---
el.pais.addEventListener("change", () => {
    el.resultado.innerHTML = "Atualizando padrões...";
    setTimeout(() => { limpar(); el.resultado.innerHTML = ""; }, 600);
});

el.dose.addEventListener("change", atualizarInterface);
el.via.addEventListener("change", atualizarInterface);

// --- INICIALIZAÇÃO ---
carregarExcel();
document.addEventListener("click", (e) => { if (e.target !== el.nome) el.sugestoes.style.display = "none"; });

// Tema
const themeBtn = document.getElementById('themeBtn');
themeBtn.addEventListener('click', () => {
    const body = document.body;
    const icon = document.getElementById('themeIcon');
    if (body.getAttribute('data-theme') === 'dark') {
        body.removeAttribute('data-theme');
        icon.className = 'ri-moon-line';
    } else {
        body.setAttribute('data-theme', 'dark');
        icon.className = 'ri-sun-line';
    }
});