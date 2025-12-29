// --- MANTÉM A SUA LÓGICA DE TEMA ESCURO ---
const themeBtn = document.getElementById('themeBtn');
const themeIcon = document.getElementById('themeIcon');
const body = document.body;

themeBtn.addEventListener('click', () => {
    if (body.getAttribute('data-theme') === 'dark') {
        body.removeAttribute('data-theme');
        themeIcon.className = 'ri-moon-line';
    } else {
        body.setAttribute('data-theme', 'dark');
        themeIcon.className = 'ri-sun-line';
    }
});

// --- MANTÉM OS SEUS ELEMENTOS ---
const el = {
    nome: document.getElementById("nome"),
    sugestoes: document.getElementById("sugestoes_box"),
    peso: document.getElementById("peso"),
    pesoCampo: document.getElementById("campo_de_peso"),
    idade: document.getElementById("idade"),
    idadeCampo: document.getElementById("campo_de_idade"),
    idadeUnidade: document.getElementById("unidade_de_idade"),
    dosagem: document.getElementById("dosagem"),
    dosagemCampo: document.getElementById("campo_de_dosagem"),
    dosagemUnidade: document.getElementById("unidade_de_dosagem"),
    intervalo: document.getElementById("intervalo"),
    dose: document.getElementById("dose"),
    via: document.getElementById("via"),
    resultado: document.getElementById("resultado"),
    pais: document.getElementById("pais"),
};

// --- NOVA LÓGICA DE DADOS (EXCEL) ---
let bancoDeDados = {
    universal: {},
    angola: {},
    brazil: {}
};

async function carregarDadosExcel() {
    try {
        const response = await fetch('medicamentos.xlsx');
        const data = await response.arrayBuffer();
        const workbook = XLSX.read(data);

        // Processa cada aba definida
        ["universal", "angola", "brazil"].forEach(abaNome => {
            const sheet = workbook.Sheets[abaNome];
            if (sheet) {
                const json = XLSX.utils.sheet_to_json(sheet);
                bancoDeDados[abaNome] = processarLinhasExcel(json);
            }
        });
        console.log("Excel carregado e processado com sucesso.");
    } catch (e) {
        console.error("Erro ao carregar Excel. Certifique-se de usar um servidor (Live Server).", e);
    }
}

function processarLinhasExcel(linhas) {
    let mapa = {};
    linhas.forEach(linha => {
        const id = String(linha.chave_Id || linha.nome).toLowerCase().trim();
        if (!mapa[id]) mapa[id] = [];

        mapa[id].push({
            nome_exibicao: linha.nome,
            // O check reconstrói a sua lógica antiga
            check: (d, i, p, v) => {
                const cDose = linha.dose ? d === linha.dose : true;
                const cVia = linha.via ? v === linha.via : true;
                const cIdade = i >= (linha.idade_minima || 0) && i <= (linha.idade_maxima || 999999);
                const cPeso = p >= (linha.peso_minimo || 0) && p <= (linha.peso_maximo || 999);
                return cDose && cVia && cIdade && cPeso;
            },
            campos: {
                via: !!linha.via,
                dose: !!linha.dose,
                peso: linha.peso_minimo || linha.peso_maximo ? [linha.peso_minimo || 0, linha.peso_maximo || 150] : null,
                idade: linha.idade_minima || linha.idade_maxima ? [linha.idade_minima || 0, linha.idade_maxima || 43800] : null,
                dosagem: [linha.dosagem_min || 0, linha.dosagem_maxima || 0, linha.dosagem_padrao || 0, linha.unidade || "mg"],
                intervalo: linha.intervalo ? String(linha.intervalo).split(',').map(Number) : [8, 12, 24]
            },
            concentracao: linha.concentracao || 1
        });
    });
    return mapa;
}

// --- FUNÇÕES DE BUSCA E INTERFACE ATUALIZADAS ---

function buscarMedicamento(nome) {
    const termo = nome.toLowerCase().trim();
    const pais = el.pais.value;
    
    // Procura no país selecionado, se não houver, procura no universal
    return bancoDeDados[pais][termo] || bancoDeDados["universal"][termo] || null;
}

function atualizarSugestoes() {
    const termo = el.nome.value.trim().toLowerCase();
    const pais = el.pais.value;
    el.sugestoes.innerHTML = "";

    if (termo === "") {
        el.sugestoes.style.display = "none";
        return;
    }

    // Combina chaves do país selecionado e do universal
    const chaves = [...new Set([...Object.keys(bancoDeDados[pais]), ...Object.keys(bancoDeDados["universal"])])];
    const filtrados = chaves.filter(m => m.includes(termo));

    if (filtrados.includes(termo)) {
        el.sugestoes.style.display = "none";
        return;
    }

    if (filtrados.length > 0) {
        filtrados.forEach(med => {
            const div = document.createElement("div");
            div.className = "sugestao_item";
            div.textContent = med;
            div.onclick = () => {
                el.nome.value = med;
                el.sugestoes.style.display = "none";
                mostrar_campos();
            };
            el.sugestoes.appendChild(div);
        });
        el.sugestoes.style.display = "block";
    } else {
        el.sugestoes.style.display = "none";
    }
}

function mostrar_campos() {
    const pesquisa = el.nome.value.trim().toLowerCase();
    const doseAtual = el.dose.value;
    const viaAtual = el.via.value;
    const mult = parseFloat(el.idadeUnidade.value);
    const idadeDias = (parseFloat(el.idade.value) || 0) * mult;
    const pesoAtual = parseFloat(el.peso.value) || 0;

    const dadosLista = buscarMedicamento(pesquisa); 

    if (!dadosLista) {
        [el.dose, el.intervalo, el.pesoCampo, el.idadeCampo, el.dosagemCampo, el.via].forEach(c => c.style.display = "none");
        el.resultado.textContent = "";
        return;
    }

    // Procura a linha correta no Excel baseada nos filtros
    const dados = dadosLista.find(item => item.check(doseAtual, idadeDias, pesoAtual, viaAtual)) || dadosLista[0];

    const gerir = (container, condicao, inputInterno) => {
        const deveMostrar = !!condicao;
        container.style.display = deveMostrar ? (container.tagName === 'SELECT' ? "block" : "flex") : "none";
    };
    
    gerir(el.via, dados.campos.via);
    gerir(el.dose, dados.campos.dose);
    gerir(el.pesoCampo, dados.campos.peso, el.peso);
    gerir(el.idadeCampo, dados.campos.idade, el.idade);
    gerir(el.dosagemCampo, dados.campos.dosagem, el.dosagem);

    if (dados.campos.intervalo) {
        const textoHoras = dados.campos.intervalo.join(',');
        if (el.intervalo.dataset.last !== textoHoras) {
            el.intervalo.innerHTML = "";
            dados.campos.intervalo.forEach(h => el.intervalo.add(new Option(`De ${h} em ${h}h`, 24 / h)));
            el.intervalo.dataset.last = textoHoras;
        }
        el.intervalo.style.display = "block";
    }

    if (dados.campos.dosagem) {
        el.dosagemUnidade.textContent = dados.campos.dosagem[3];
        if (dados.campos.dosagem[2] && el.dosagem.value === "") {
            el.dosagem.value = dados.campos.dosagem[2];
        }
    }
}

function calcular() {
    el.resultado.classList.remove("vibrar");
    void el.resultado.offsetWidth; 
    el.resultado.classList.add("vibrar");

    const pesquisa = el.nome.value.trim().toLowerCase();
    const doseAtual = el.dose.value;
    const viaAtual = el.via.value;
    const multIdade = parseFloat(el.idadeUnidade.value);
    const idadeDias = (parseFloat(el.idade.value) || 0) * multIdade;
    const pesoAtual = parseFloat(el.peso.value) || 0;

    const dadosLista = buscarMedicamento(pesquisa);
    if (!dadosLista) {
        el.resultado.innerHTML = "Não encontrado!";
        el.resultado.style.background = "red";
        return;
    }

    const dados = dadosLista.find(item => item.check(doseAtual, idadeDias, pesoAtual, viaAtual)) || dadosLista[0];

    // --- LÓGICA DE ALERTS E CORREÇÕES ---
    if (dados.campos.peso) {
        if (pesoAtual < dados.campos.peso[0] || pesoAtual > dados.campos.peso[1]) {
            alert(`Peso fora dos limites (${dados.campos.peso[0]}-${dados.campos.peso[1]}kg)`);
            return;
        }
    }

    // Cálculo Final
    const vDoseDigitada = parseFloat(el.dosagem.value) || 0;
    const vIntervalo = parseFloat(el.intervalo.value) || 1;
    
    // FÓRMULA PADRÃO: (Peso * Dose / Frequência) / Concentração
    const resultadoCalculado = ((pesoAtual * vDoseDigitada) / vIntervalo) / dados.concentracao;
    
    el.resultado.innerHTML = `${resultadoCalculado.toFixed(2)} ml de ${dados.nome_exibicao}`;
    el.resultado.style.background = "var(--primary)";
}

// --- EVENT LISTENERS ---
el.nome.addEventListener("input", () => { atualizarSugestoes(); mostrar_campos(); });
el.dose.addEventListener("change", mostrar_campos);
el.via.addEventListener("change", mostrar_campos);
el.peso.addEventListener("input", mostrar_campos);
el.idade.addEventListener("input", mostrar_campos);

el.pais.addEventListener('change', () => {
    el.resultado.innerHTML = "A carregar padrões...";
    setTimeout(() => {
        limpar();
        el.resultado.innerHTML = `Padrões de ${el.pais.value} carregados.`;
    }, 1000);
});

function limpar() {
    el.nome.value = ""; el.peso.value = ""; el.idade.value = ""; el.dosagem.value = "";
    el.resultado.innerHTML = "";
    mostrar_campos();
}

// Inicia o sistema carregando o Excel
carregarDadosExcel();