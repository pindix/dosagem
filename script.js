// 1. Elementos da Interface
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
    resultado: document.getElementById("resultado"),
    themeBtn: document.getElementById("themeBtn"),
    themeIcon: document.getElementById("themeIcon")
};

let bancoDados = {}; // Onde guardaremos as abas do Excel

// 2. Carregar Excel
async function carregarExcel() {
    try {
        const response = await fetch('medicamentos.xlsx');
        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer);
        
        // Carrega cada aba
        workbook.SheetNames.forEach(aba => {
            bancoDados[aba.toLowerCase()] = XLSX.utils.sheet_to_json(workbook.Sheets[aba]);
        });
        console.log("Dados carregados:", Object.keys(bancoDados));
    } catch (err) {
        console.error("Erro ao carregar Excel. Use o Live Server!", err);
    }
}

// 3. Busca Inteligente (País + Universal)
function buscarDadosMedicamento(nomeMedicamento) {
    const pais = el.pais.value.toLowerCase();
    const termo = nomeMedicamento.toLowerCase().trim();
    
    // Primeiro tenta no país selecionado
    let lista = (bancoDados[pais] || []).filter(m => m.nome.toLowerCase() === termo);
    
    // Se não achou e não for a aba universal, tenta na universal
    if (lista.length === 0 && pais !== "universal") {
        lista = (bancoDados["universal"] || []).filter(m => m.nome.toLowerCase() === termo);
    }
    return lista.length > 0 ? lista : null;
}

// 4. Sugestões
el.nome.addEventListener("input", () => {
    const termo = el.nome.value.toLowerCase().trim();
    const pais = el.pais.value.toLowerCase();
    el.sugestoes.innerHTML = "";

    if (termo.length < 2) { el.sugestoes.style.display = "none"; return; }

    // Junta nomes do país + universal (sem duplicados)
    const nomesPais = (bancoDados[pais] || []).map(m => m.nome);
    const nomesUni = (bancoDados["universal"] || []).map(m => m.nome);
    const todosNomes = [...new Set([...nomesPais, ...nomesUni])];

    const filtrados = todosNomes.filter(n => n.toLowerCase().includes(termo));

    if (filtrados.length > 0) {
        el.sugestoes.style.display = "block";
        filtrados.forEach(n => {
            const item = document.createElement("div");
            item.className = "sugestao_item";
            item.textContent = n;
            item.onclick = () => { el.nome.value = n; el.sugestoes.style.display = "none"; mostrarCampos(); };
            el.sugestoes.appendChild(item);
        });
    }
});

// 5. Exibir Campos Dinâmicos
function mostrarCampos() {
    const dados = buscarDadosMedicamento(el.nome.value);
    if (!dados) return esconderTudo();

    // Pegamos a primeira ocorrência para configurar a interface
    const med = dados[0]; 
    const camposPermitidos = String(med.campos || "").toLowerCase();

    // Lógica de visibilidade
    el.pesoDiv.style.display = camposPermitidos.includes("peso") ? "flex" : "none";
    el.idadeDiv.style.display = camposPermitidos.includes("idade") ? "flex" : "none";
    el.dosagemDiv.style.display = camposPermitidos.includes("dosagem") ? "flex" : "none";
    el.via.style.display = med.via ? "block" : "none";
    el.dose.style.display = med.dose ? "block" : "none";

    // Configura Dosagem Padrão e Unidade
    if (camposPermitidos.includes("dosagem")) {
        el.dosagem.value = med.dosagem_padrao || "";
        el.dosagemUnidade.textContent = med.unidade || "mg/kg";
    }

    // Configura Intervalos
    if (med.intervalo) {
        el.intervalo.innerHTML = "";
        String(med.intervalo).split(",").forEach(h => {
            el.intervalo.add(new Option(`De ${h.trim()} em ${h.trim()}h`, h.trim()));
        });
        el.intervalo.style.display = "block";
    } else {
        el.intervalo.style.display = "none";
    }
}

// 6. Calcular com Alertas e Correções
function calcular() {
    const dados = buscarDadosMedicamento(el.nome.value);
    if (!dados) { alert("Medicamento não encontrado!"); return; }

    // Pega os valores atuais
    let p = parseFloat(el.peso.value) || 0;
    let d = parseFloat(el.dosagem.value) || 0;
    let iValor = parseFloat(el.idade.value) || 0;
    let iMult = parseFloat(el.idadeUnidade.value);
    let idadeDias = iValor * iMult;
    let h = parseFloat(el.intervalo.value) || 1;

    // Tenta encontrar a linha específica (ex: filtrando por via/dose se existirem)
    const med = dados.find(m => 
        (m.via ? m.via.toLowerCase() === el.via.value.toLowerCase() : true) &&
        (m.dose ? m.dose.toLowerCase() === el.dose.value.toLowerCase() : true)
    ) || dados[0];

    // --- CORREÇÕES ---
    if (el.pesoDiv.style.display !== "none") {
        if (p < med.peso_minimo) { p = med.peso_minimo; alert("Peso abaixo do limite. Corrigido."); el.peso.value = p; }
        if (p > med.peso_maximo) { p = med.peso_maximo; alert("Peso acima do limite. Corrigido."); el.peso.value = p; }
    }

    if (el.idadeDiv.style.display !== "none") {
        if (idadeDias < med.idade_minima) { 
            iValor = med.idade_minima / iMult; 
            alert("Idade abaixo do limite. Corrigida."); 
            el.idade.value = iValor.toFixed(1);
        }
    }

    if (el.dosagemDiv.style.display !== "none") {
        if (d < med.dosagem_minima) { d = med.dosagem_minima; alert("Dosagem baixa. Corrigida."); el.dosagem.value = d; }
        if (d > med.dosagem_maxima) { d = med.dosagem_maxima; alert("Dosagem alta. Corrigida."); el.dosagem.value = d; }
    }

    // --- CÁLCULO FINAL (Executa a string do Excel) ---
    try {
        const c = med.concentracacoao || 1; // Nome da sua coluna no Excel
        const n = med.nome;
        const res = eval("`" + med.formula + "`"); // Executa o Template String do Excel
        el.resultado.innerHTML = res;
        el.resultado.style.whiteSpace = "pre-wrap";
    } catch (err) {
        el.resultado.innerHTML = "Erro na fórmula do Excel.";
    }
}

// 7. Funções de Apoio
function limpar() {
    ["peso", "idade", "dosagem", "resultado"].forEach(id => el[id].value = el[id].innerHTML = "");
    esconderTudo();
}

function esconderTudo() {
    [el.pesoDiv, el.idadeDiv, el.dosagemDiv, el.intervalo, el.via, el.dose].forEach(d => d.style.display = "none");
}

// Troca de País Feedback
el.pais.addEventListener("change", () => {
    el.resultado.innerHTML = "A carregar padrões de " + el.pais.options[el.pais.selectedIndex].text + "...";
    setTimeout(() => { limpar(); el.resultado.innerHTML = ""; }, 800);
});

// Tema
el.themeBtn.onclick = () => {
    const dark = document.body.getAttribute("data-theme") === "dark";
    document.body.setAttribute("data-theme", dark ? "" : "dark");
    el.themeIcon.className = dark ? "ri-moon-line" : "ri-sun-line";
};

// Iniciar
carregarExcel();
document.addEventListener("click", (e) => { if (e.target !== el.nome) el.sugestoes.style.display = "none"; });