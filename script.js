// 1. GESTÃO DE TEMA (Mantido)
const themeBtn = document.getElementById('themeBtn');
const themeIcon = document.getElementById('themeIcon');
themeBtn.addEventListener('click', () => {
    if (document.body.getAttribute('data-theme') === 'dark') {
        document.body.removeAttribute('data-theme');
        themeIcon.className = 'ri-moon-line';
    } else {
        document.body.setAttribute('data-theme', 'dark');
        themeIcon.className = 'ri-sun-line';
    }
});

// 2. MAPEAMENTO DE ELEMENTOS
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

// 3. BASE DE DADOS E CARREGAMENTO EXCEL
let bancoDeDados = { universal: {}, angola: {}, brazil: {} };

async function carregarDadosExcel() {
    try {
        const response = await fetch('medicamentos.xlsx');
        const data = await response.arrayBuffer();
        const workbook = XLSX.read(data);

        ["universal", "angola", "brazil"].forEach(abaNome => {
            const sheet = workbook.Sheets[abaNome];
            if (sheet) {
                const json = XLSX.utils.sheet_to_json(sheet);
                bancoDeDados[abaNome] = processarLinhasExcel(json);
            }
        });
        console.log("Sistema pronto e Excel carregado.");
    } catch (e) {
        console.error("Erro ao carregar Excel:", e);
    }
}

function processarLinhasExcel(linhas) {
    let mapa = {};
    linhas.forEach(linha => {
        const id = String(linha.chave_Id || linha.nome || "").toLowerCase().trim();
        if (!id) return;

        if (!mapa[id]) mapa[id] = [];
        
        const cRaw = String(linha.campos || "").toLowerCase();

        mapa[id].push({
            nome_exibicao: linha.nome,
            formulaRaw: linha.formula ? String(linha.formula) : "",
            check: (d, i, p, v) => {
                const cDose = linha.dose ? String(d) === String(linha.dose) : true;
                const cVia = linha.via ? String(v) === String(linha.via) : true;
                return cDose && cVia;
            },
            visibilidade: {
                via: cRaw.includes("via"),
                dose: cRaw.includes("dose"),
                peso: cRaw.includes("peso"),
                idade: cRaw.includes("idade"),
                dosagem: cRaw.includes("dosagem")
            },
            limites: {
                peso: [Number(linha.peso_minimo) || 0, Number(linha.peso_maximo) || 500],
                idade: [Number(linha.idade_minima) || 0, Number(linha.idade_maxima) || 43800],
                dosagem: [Number(linha.dosagem_min) || 0, Number(linha.dosagem_maxima) || 0, Number(linha.dosagem_padrao) || 0, String(linha.unidade || "mg")],
                intervalo: linha.intervalo ? String(linha.intervalo).split(',').map(Number) : [8, 12, 24],
                concentracao: Number(linha.concentracao) || 1
            }
        });
    });
    return mapa;
}

// 4. LÓGICA DE INTERFACE
function buscarMedicamento(nome) {
    const termo = nome.toLowerCase().trim();
    const pais = el.pais.value;
    return bancoDeDados[pais][termo] || bancoDeDados["universal"][termo] || null;
}

function mostrar_campos() {
    const pesquisa = el.nome.value.trim().toLowerCase();
    const dadosLista = buscarMedicamento(pesquisa); 

    if (!dadosLista) {
        [el.dose, el.intervalo, el.pesoCampo, el.idadeCampo, el.dosagemCampo, el.via].forEach(c => c.style.display = "none");
        return;
    }

    const item = dadosLista.find(i => i.check(el.dose.value, 0, 0, el.via.value)) || dadosLista[0];

    // CORREÇÃO: Aplica visibilidade baseada na coluna 'campos'
    el.via.style.display = item.visibilidade.via ? "block" : "none";
    el.dose.style.display = item.visibilidade.dose ? "block" : "none";
    el.pesoCampo.style.display = item.visibilidade.peso ? "flex" : "none";
    el.idadeCampo.style.display = item.visibilidade.idade ? "flex" : "none";
    el.dosagemCampo.style.display = item.visibilidade.dosagem ? "flex" : "none";
    el.intervalo.style.display = item.visibilidade.dosagem ? "block" : "none";

    if (item.visibilidade.dosagem) {
        el.dosagemUnidade.textContent = item.limites.dosagem[3];
        if (el.dosagem.value === "") el.dosagem.value = item.limites.dosagem[2];
        
        // Atualiza intervalos
        const textoInt = item.limites.intervalo.join(',');
        if (el.intervalo.dataset.last !== textoInt) {
            el.intervalo.innerHTML = "";
            item.limites.intervalo.forEach(h => el.intervalo.add(new Option(`De ${h} em ${h}h`, 24 / h)));
            el.intervalo.dataset.last = textoInt;
        }
    }
}

// 5. CÁLCULO E ALERTS CORRETIVOS
function calcular() {
    const pesquisa = el.nome.value.trim().toLowerCase();
    const dadosLista = buscarMedicamento(pesquisa);
    if (!dadosLista) return;

    // Efeito de vibração
    el.resultado.classList.remove("vibrar");
    void el.resultado.offsetWidth;
    el.resultado.classList.add("vibrar");

    const multIdade = parseFloat(el.idadeUnidade.value);
    let idadeDias = (parseFloat(el.idade.value) || 0) * multIdade;
    let pesoAtual = parseFloat(el.peso.value) || 0;
    let doseDigitada = parseFloat(el.dosagem.value) || 0;

    const item = dadosLista.find(i => i.check(el.dose.value, idadeDias, pesoAtual, el.via.value)) || dadosLista[0];

    // ALERT E CORREÇÃO AUTOMÁTICA
    if (item.visibilidade.idade) {
        const [min, max] = item.limites.idade;
        if (idadeDias < min || idadeDias > max) {
            const novaIdade = idadeDias < min ? min : max;
            const corrigida = (novaIdade / multIdade).toFixed(1);
            alert(`Idade fora do limite. Corrigido para: ${corrigida}`);
            el.idade.value = corrigida;
            idadeDias = novaIdade;
        }
    }

    if (item.visibilidade.peso) {
        const [min, max] = item.limites.peso;
        if (pesoAtual < min || pesoAtual > max) {
            pesoAtual = pesoAtual < min ? min : max;
            alert(`Peso fora do limite. Corrigido para: ${pesoAtual} kg`);
            el.peso.value = pesoAtual;
        }
    }

    if (item.visibilidade.dosagem) {
        const [min, max] = item.limites.dosagem;
        if (doseDigitada < min || doseDigitada > max) {
            doseDigitada = doseDigitada < min ? min : max;
            alert(`Dose fora do limite. Corrigida para: ${doseDigitada}`);
            el.dosagem.value = doseDigitada;
        }
    }

    // EXECUÇÃO DA FÓRMULA DO EXCEL
    try {
        const p = pesoAtual;
        const d = doseDigitada;
        const c = item.limites.concentracao;
        const h = parseFloat(el.intervalo.value) || 1;
        const n = item.nome_exibicao;

        const fRaw = item.formulaRaw || "`${(p*d/h/c).toFixed(1)} ml`";
        const resultadoFinal = eval(fRaw);

        el.resultado.innerHTML = resultadoFinal;
        el.resultado.style.whiteSpace = "pre-wrap";
        el.resultado.style.background = "var(--primary)";
        el.resultado.style.textAlign = "left";
    } catch (e) {
        el.resultado.innerHTML = "Erro na fórmula do Excel!";
        el.resultado.style.background = "red";
    }
}

// 6. EVENTOS
el.nome.addEventListener("input", () => { atualizarSugestoes(); mostrar_campos(); });
el.pais.addEventListener("change", () => {
    el.resultado.innerHTML = "A carregar padrões...";
    setTimeout(() => { limpar(); el.resultado.innerHTML = "Padrões carregados."; }, 1000);
});
// (Incluir as outras funções de sugestões e limpar que já tinhas)
carregarDadosExcel();