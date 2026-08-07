/* =============================================================
   AYLA SELECT — MOTOR DE REGRAS
   -------------------------------------------------------------
   Arquivo compartilhado entre admin.js e cartao.js.
   Aqui vive TODA a lógica de negócio do programa de fidelidade:
   programas, categorias, benefícios automáticos, Minha Jornada
   e o cálculo de evolução. Nada aqui toca no Firestore — só
   recebe dados de uma cliente e devolve os dados atualizados.
   ============================================================= */

const ORDEM_CATEGORIAS = ["Bronze", "Prata", "Ouro", "Diamante"];

const ICONE_CATEGORIA = {
  Bronze: "🥉",
  Prata: "🥈",
  Ouro: "🥇",
  Diamante: "💎"
};

// Atendimentos necessários (acumulados) para alcançar cada categoria,
// por programa. "let" porque a tela de Configurações pode sobrescrever
// esses valores em tempo de execução (ver aplicarConfiguracoes()).
let LIMIARES_PROGRAMA = {
  12: { Prata: 3, Ouro: 6, Diamante: 12 },
  14: { Prata: 3, Ouro: 8, Diamante: 14 }
};

let VALIDADE_PADRAO_DIAS = 30;

let CONFIG_GERAL = {
  nomePrograma: "Ayla Select",
  linkAvaliacaoGoogle: "",
  textoRegulamento: "",
  versaoRegulamento: 1,
  ativarQr: true,
  ativarAnimacoes: true,
  ativarIndicacoes: true,
  ativarAtendimentoBonus: true,
  ativarAvaliacaoGoogle: true,
  logoUrl: "",
  fundoCartaoUrl: "",
  corDourado: "#C6A15B",
  corDouradoClaro: "#E8D9B5",
  corFundo: "#0B0B0C"
};

/**
 * Aplica os valores salvos em /configuracoes/geral (Firestore) por cima
 * dos padrões. Deve ser chamada uma vez, logo após carregar o documento
 * de configurações, tanto no admin quanto no cartão da cliente.
 */
function aplicarConfiguracoes(config) {
  if (!config) return;
  if (config.limiarPrograma12Prata || config.limiarPrograma12Ouro || config.limiarPrograma12Diamante) {
    LIMIARES_PROGRAMA[12] = {
      Prata: Number(config.limiarPrograma12Prata) || LIMIARES_PROGRAMA[12].Prata,
      Ouro: Number(config.limiarPrograma12Ouro) || LIMIARES_PROGRAMA[12].Ouro,
      Diamante: Number(config.limiarPrograma12Diamante) || LIMIARES_PROGRAMA[12].Diamante
    };
  }
  if (config.limiarPrograma14Prata || config.limiarPrograma14Ouro || config.limiarPrograma14Diamante) {
    LIMIARES_PROGRAMA[14] = {
      Prata: Number(config.limiarPrograma14Prata) || LIMIARES_PROGRAMA[14].Prata,
      Ouro: Number(config.limiarPrograma14Ouro) || LIMIARES_PROGRAMA[14].Ouro,
      Diamante: Number(config.limiarPrograma14Diamante) || LIMIARES_PROGRAMA[14].Diamante
    };
  }
  if (config.validadeBeneficiosDias) VALIDADE_PADRAO_DIAS = Number(config.validadeBeneficiosDias);
  CONFIG_GERAL = { ...CONFIG_GERAL, ...config };
}

/**
 * Aplica a identidade visual (logo, cores, fundo do cartão) na página
 * atual. Chamar depois de aplicarConfiguracoes(), tanto no admin quanto
 * no cartão da cliente. Sem nenhuma configuração salva, não muda nada —
 * o visual padrão (preto/dourado) continua exatamente como está.
 */
function aplicarTemaVisual(cfg) {
  const c = cfg || CONFIG_GERAL;
  const raiz = document.documentElement;
  if (c.corDourado) raiz.style.setProperty("--dourado", c.corDourado);
  if (c.corDouradoClaro) raiz.style.setProperty("--dourado-claro", c.corDouradoClaro);
  if (c.corFundo) raiz.style.setProperty("--preto", c.corFundo);

  document.querySelectorAll('[data-campo="logo-marca"]').forEach((img) => {
    if (c.logoUrl) {
      img.src = c.logoUrl;
      img.classList.remove("oculto");
    } else {
      img.classList.add("oculto");
    }
  });
}

// Define o que cada categoria libera automaticamente ao ser alcançada.
// tipo "fixo": entra direto na lista de benefícios da cliente.
// tipo "escolha_unica": entra como pendente até a cliente escolher.
function definirBeneficiosDaCategoria(categoria) {
  switch (categoria) {
    case "Prata":
      return [
        { nome: "Spa Labial", icone: "👄", tipo: "fixo", validadeDias: VALIDADE_PADRAO_DIAS }
      ];
    case "Ouro":
      return [
        {
          nome: "Escolha seu benefício Ouro",
          icone: "🎁",
          tipo: "escolha_unica",
          validadeDias: VALIDADE_PADRAO_DIAS,
          opcoes: [
            { id: "10off", nome: "10% OFF", icone: "🤑" },
            { id: "spa_labial", nome: "Spa Labial", icone: "👄" },
            { id: "kit_cuidados", nome: "Kit de cuidados", icone: "🎁", descricao: "Kit para cílios ou sobrancelhas + docinho" }
          ]
        }
      ];
    case "Diamante":
      return [
        { nome: "Spa Labial", icone: "👄", tipo: "fixo", validadeDias: VALIDADE_PADRAO_DIAS },
        { nome: "Kit Surpresa", icone: "🎁", tipo: "fixo", validadeDias: null } // sem validade, só controle de entrega
      ];
    default:
      return [];
  }
}

function novoId(prefixo) {
  return (prefixo || "id") + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
}

function calcularCategoriaPorAtendimentos(programa, atendimentos) {
  const limiares = LIMIARES_PROGRAMA[programa] || LIMIARES_PROGRAMA[12];
  if (atendimentos >= limiares.Diamante) return "Diamante";
  if (atendimentos >= limiares.Ouro) return "Ouro";
  if (atendimentos >= limiares.Prata) return "Prata";
  return "Bronze";
}

function proximaCategoria(categoriaAtual) {
  const i = ORDEM_CATEGORIAS.indexOf(categoriaAtual);
  if (i === -1 || i === ORDEM_CATEGORIAS.length - 1) return null;
  return ORDEM_CATEGORIAS[i + 1];
}

function atendimentosParaProximaCategoria(programa, categoriaAtual, atendimentos) {
  const proxima = proximaCategoria(categoriaAtual);
  if (!proxima) return null;
  const limiares = LIMIARES_PROGRAMA[programa] || LIMIARES_PROGRAMA[12];
  const alvo = limiares[proxima];
  return { proxima, faltam: Math.max(alvo - atendimentos, 0) };
}

function dataISO() {
  return new Date().toISOString();
}

/**
 * Converte "DD/MM/AAAA" digitado pela administradora para "AAAA-MM-DD"
 * (formato salvo no Firestore). Retorna "" se o texto não estiver completo.
 */
function dataBRParaISO(dataBR) {
  const m = (dataBR || "").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return "";
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/**
 * Converte "AAAA-MM-DD" (ou um ISO completo) salvo no Firestore para
 * "DD/MM/AAAA", para exibir no campo de texto.
 */
function dataISOParaBR(dataISOStr) {
  const m = (dataISOStr || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/**
 * Aplica máscara DD/MM/AAAA enquanto a pessoa digita, sem precisar de
 * calendário nenhum. Chamar uma vez por input de texto de data.
 */
function aplicarMascaraData(input) {
  input.addEventListener("input", () => {
    let digitos = input.value.replace(/\D/g, "").slice(0, 8);
    let formatado = digitos;
    if (digitos.length > 4) formatado = `${digitos.slice(0,2)}/${digitos.slice(2,4)}/${digitos.slice(4)}`;
    else if (digitos.length > 2) formatado = `${digitos.slice(0,2)}/${digitos.slice(2)}`;
    input.value = formatado;
  });
}

function somarDias(dataInicioISO, dias) {
  const d = new Date(dataInicioISO);
  d.setDate(d.getDate() + dias);
  return d.toISOString();
}

function liberarBeneficiosDaCategoria(cat, dataEvento, beneficiosDestino) {
  const definicoes = definirBeneficiosDaCategoria(cat);
  const agora = dataEvento || dataISO();
  definicoes.forEach((def) => {
    beneficiosDestino.push({
      id: novoId("ben"),
      nome: def.nome,
      icone: def.icone,
      categoriaOrigem: cat,
      tipo: def.tipo,
      opcoes: def.opcoes || null,
            escolhaFeita: null,
      recebidoEm: agora,
      validadeEm: def.validadeDias ? somarDias(agora, def.validadeDias) : null,
      usadoEm: null,
      status: def.tipo === "escolha_unica" ? "aguardando_escolha" : "disponivel"
    });
  });
}

/**
 * Aplica um novo atendimento (normal ou bônus) a uma cliente e resolve
 * toda a evolução automática decorrente: categoria, benefícios liberados,
 * Minha Jornada, atendimentos bônus em cadeia (subir de categoria pode
 * gerar novo bônus que empurra para a categoria seguinte).
 *
 * Todas as entradas de histórico geradas nesta chamada recebem o mesmo
 * "acaoId" — é isso que permite o botão "Desfazer última ação" reverter
 * a operação inteira (atendimento + bônus em cadeia) de uma vez.
 */
function aplicarNovoAtendimento(cliente, tipoEvento, descricao) {
  const programa = Number(cliente.programa) || 12;
  let atendimentos = Number(cliente.atendimentos) || 0;
  let atendimentosBonus = Number(cliente.atendimentosBonus) || 0;
  let categoria = cliente.categoria || "Bronze";
  const beneficios = Array.isArray(cliente.beneficios) ? [...cliente.beneficios] : [];
  const minhaJornada = Array.isArray(cliente.minhaJornada) ? [...cliente.minhaJornada] : [];
  const historico = Array.isArray(cliente.historico) ? [...cliente.historico] : [];

  const categoriasConquistadas = [];
  const acaoId = novoId("acao");

  if (minhaJornada.length === 0) {
    minhaJornada.push({ categoria: "Bronze", data: cliente.criadoEm || dataISO() });
  }

  function registrarEvento(tipo, texto) {
    historico.push({ id: novoId("hist"), data: dataISO(), tipo, servico: texto || null, acaoId });
  }

  function processarUmAtendimento(origem, textoServico) {
    atendimentos += 1;
    if (origem === "atendimentoBonus" || origem === "indicacaoConvertida") {
      atendimentosBonus += 1;
    }
    registrarEvento(origem, textoServico);

    const categoriaCalculada = calcularCategoriaPorAtendimentos(programa, atendimentos);
    if (ORDEM_CATEGORIAS.indexOf(categoriaCalculada) > ORDEM_CATEGORIAS.indexOf(categoria)) {
      const indiceAtual = ORDEM_CATEGORIAS.indexOf(categoria);
      const indiceAlvo = ORDEM_CATEGORIAS.indexOf(categoriaCalculada);
      for (let i = indiceAtual + 1; i <= indiceAlvo; i++) {
        const cat = ORDEM_CATEGORIAS[i];
        categoria = cat;
        categoriasConquistadas.push(cat);
        minhaJornada.push({ categoria: cat, data: dataISO() });
        liberarBeneficiosDaCategoria(cat, dataISO(), beneficios);
        if (cat !== "Bronze") {
          atendimentos += 1;
          atendimentosBonus += 1;
          registrarEvento("atendimentoBonus", `Bônus por conquistar categoria ${cat}`);
        }
      }
    }
  }

  processarUmAtendimento(tipoEvento, descricao);

  return {
    dados: { atendimentos, atendimentosBonus, categoria, beneficios, minhaJornada, historico, ultimaAcaoTipo: "evento", ultimaAcaoId: acaoId },
    categoriasConquistadas
  };
}

/**
 * Reconstrói atendimentos, atendimentosBonus, categoria, benefícios e
 * Minha Jornada inteiramente a partir do histórico (ordenado por data).
 * Usado ao excluir uma entrada de histórico ou ao desfazer uma ação —
 * garante que tudo fique consistente de novo, sem editar campos à mão.
 */
function recalcularEstadoAPartirDoHistorico(programa, historico, criadoEm) {
  const ordenado = [...historico].sort((a, b) => new Date(a.data) - new Date(b.data));
  let atendimentos = 0;
  let atendimentosBonus = 0;
  let categoria = "Bronze";
  const beneficios = [];
  const minhaJornada = [{ categoria: "Bronze", data: criadoEm || dataISO() }];

  ordenado.forEach((evento) => {
    atendimentos += 1;
    if (evento.tipo === "atendimentoBonus" || evento.tipo === "indicacaoConvertida") {
      atendimentosBonus += 1;
    }
    const categoriaCalculada = calcularCategoriaPorAtendimentos(programa, atendimentos);
    if (ORDEM_CATEGORIAS.indexOf(categoriaCalculada) > ORDEM_CATEGORIAS.indexOf(categoria)) {
      const indiceAtual = ORDEM_CATEGORIAS.indexOf(categoria);
      const indiceAlvo = ORDEM_CATEGORIAS.indexOf(categoriaCalculada);
      for (let i = indiceAtual + 1; i <= indiceAlvo; i++) {
        const cat = ORDEM_CATEGORIAS[i];
        categoria = cat;
        minhaJornada.push({ categoria: cat, data: evento.data });
        liberarBeneficiosDaCategoria(cat, evento.data, beneficios);
      }
    }
  });

  return { atendimentos, atendimentosBonus, categoria, beneficios, minhaJornada, historico: ordenado };
}

/**
 * Cliente (ou a administradora, temporariamente) escolhe o benefício
 * único de Ouro. Só pode ser feito uma vez; depois de escolhido, não
 * pode ser alterado.
 */
function escolherBeneficioOuro(cliente, idBeneficio, idOpcaoEscolhida) {
  const beneficios = Array.isArray(cliente.beneficios) ? [...cliente.beneficios] : [];
  const idx = beneficios.findIndex((b) => b.id === idBeneficio);
  if (idx === -1) return { erro: "Benefício não encontrado." };
  const beneficio = beneficios[idx];
  if (beneficio.tipo !== "escolha_unica") return { erro: "Este benefício não é de escolha única." };
  if (beneficio.escolhaFeita) return { erro: "Esta escolha já foi feita e não pode ser alterada." };

  const opcao = (beneficio.opcoes || []).find((o) => o.id === idOpcaoEscolhida);
  if (!opcao) return { erro: "Opção inválida." };

  beneficios[idx] = {
    ...beneficio,
    escolhaFeita: opcao.id,
    nome: opcao.nome,
    icone: opcao.icone,
    status: "disponivel"
  };

  return { dados: { beneficios } };
}

/**
 * Recalcula status de todos os benefícios (expira os que passaram da validade).
 */
function atualizarStatusBeneficios(cliente) {
  const agora = new Date();
  let mudou = false;
  const beneficios = (Array.isArray(cliente.beneficios) ? cliente.beneficios : []).map((b) => {
    if (b.status === "disponivel" && b.validadeEm && new Date(b.validadeEm) < agora) {
      mudou = true;
      return { ...b, status: "expirado" };
    }
    return b;
  });
  return { mudou, beneficios };
}

function diasRestantes(dataISOAlvo) {
  if (!dataISOAlvo) return null;
  const diff = new Date(dataISOAlvo).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

const VALIDADE_ANAMNESE_MESES = 6;

function somarMeses(dataISOStr, meses) {
  const d = new Date(dataISOStr);
  d.setMonth(d.getMonth() + meses);
  return d.toISOString();
}

/**
 * Retorna a ficha de anamnese mais recente da cliente (pela data), ou
 * null se ela ainda não tiver nenhuma.
 */
function obterFichaMaisRecente(cliente) {
  const fichas = Array.isArray(cliente.fichasAnamnese) ? cliente.fichasAnamnese : [];
  if (fichas.length === 0) return null;
  return [...fichas].sort((a, b) => new Date(b.data) - new Date(a.data))[0];
}

/**
 * Calcula a situação da anamnese da cliente com base na ficha mais
 * recente: validadeEm (6 meses após o preenchimento) e uma das
 * situações "sem_ficha" | "vencida" | "vence_7" | "vence_15" | "vence_30" | "valida".
 */
function statusAnamnese(cliente) {
  const ficha = obterFichaMaisRecente(cliente);
  if (!ficha) return { situacao: "sem_ficha", dias: null, validadeEm: null, ficha: null };
  const validadeEm = somarMeses(ficha.data, VALIDADE_ANAMNESE_MESES);
  const dias = diasRestantes(validadeEm);
  let situacao;
  if (dias < 0) situacao = "vencida";
  else if (dias <= 7) situacao = "vence_7";
  else if (dias <= 15) situacao = "vence_15";
  else if (dias <= 30) situacao = "vence_30";
  else situacao = "valida";
  return { situacao, dias, validadeEm, ficha };
}

function tempoDeRelacionamento(clienteDesdeISO) {
  if (!clienteDesdeISO) return "";
  const inicio = new Date(clienteDesdeISO);
  const agora = new Date();
  let meses = (agora.getFullYear() - inicio.getFullYear()) * 12 + (agora.getMonth() - inicio.getMonth());
  if (agora.getDate() < inicio.getDate()) meses -= 1;
  if (meses < 0) meses = 0;
  const anos = Math.floor(meses / 12);
  const mesesRestantes = meses % 12;
  const partes = [];
  if (anos > 0) partes.push(`${anos} ano${anos > 1 ? "s" : ""}`);
  if (mesesRestantes > 0 || anos === 0) partes.push(`${mesesRestantes} ${mesesRestantes === 1 ? "mês" : "meses"}`);
  return `Há ${partes.join(" e ")}`;
}
