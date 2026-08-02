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
// por programa.
const LIMIARES_PROGRAMA = {
  12: { Prata: 3, Ouro: 6, Diamante: 12 },
  14: { Prata: 3, Ouro: 8, Diamante: 14 }
};

const VALIDADE_PADRAO_DIAS = 30;

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

function novoIdBeneficio() {
  return "ben_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
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

function somarDias(dataInicioISO, dias) {
  const d = new Date(dataInicioISO);
  d.setDate(d.getDate() + dias);
  return d.toISOString();
}

/**
 * Aplica um novo atendimento (normal ou bônus) a uma cliente e resolve
 * toda a evolução automática decorrente: categoria, benefícios liberados,
 * Minha Jornada, atendimentos bônus em cadeia (subir de categoria pode
 * gerar novo bônus que empurra para a categoria seguinte).
 *
 * @param {object} cliente - dados atuais da cliente (do Firestore)
 * @param {"atendimento"|"atendimentoBonus"|"indicacaoConvertida"} tipoEvento
 * @param {string} descricao - texto livre do serviço (opcional)
 * @returns {object} { dados, eventos, subiuDeCategoria, novasCategoria }
 *   dados: objeto pronto para dar merge/update no Firestore
 *   eventos: lista de eventos de histórico gerados
 *   subiuDeCategoria: array de categorias conquistadas nesta operação (0..n)
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

  // Garante que Bronze esteja registrado na Jornada (cadastro).
  if (minhaJornada.length === 0) {
    minhaJornada.push({ categoria: "Bronze", data: cliente.criadoEm || dataISO() });
  }

  function registrarEvento(tipo, texto) {
    historico.push({ data: dataISO(), tipo, servico: texto || null });
  }

  function liberarBeneficiosDaCategoria(cat) {
    const definicoes = definirBeneficiosDaCategoria(cat);
    definicoes.forEach((def) => {
      const agora = dataISO();
      beneficios.push({
        id: novoIdBeneficio(),
        nome: def.nome,
        icone: def.icone,
        categoriaOrigem: cat,
        tipo: def.tipo,
        opcoes: def.opcoes || null,
        escolhaFeita: def.tipo === "escolha_unica" ? null : undefined,
        recebidoEm: agora,
        validadeEm: def.validadeDias ? somarDias(agora, def.validadeDias) : null,
        usadoEm: null,
        status: def.tipo === "escolha_unica" ? "aguardando_escolha" : "disponivel"
      });
    });
  }

  // Processa um "+1 atendimento" (pode ser normal, bônus por evolução,
  // ou bônus por indicação) e resolve evolução em cadeia.
  function processarUmAtendimento(origem, textoServico) {
    atendimentos += 1;
    if (origem === "atendimentoBonus" || origem === "indicacaoConvertida") {
      atendimentosBonus += 1;
    }
    registrarEvento(origem, textoServico);

    const categoriaCalculada = calcularCategoriaPorAtendimentos(programa, atendimentos);
    if (categoriaCalculada !== categoria && ORDEM_CATEGORIAS.indexOf(categoriaCalculada) > ORDEM_CATEGORIAS.indexOf(categoria)) {
      // Pode pular mais de uma categoria de uma vez (ex.: indicações em lote).
      const indiceAtual = ORDEM_CATEGORIAS.indexOf(categoria);
      const indiceAlvo = ORDEM_CATEGORIAS.indexOf(categoriaCalculada);
      for (let i = indiceAtual + 1; i <= indiceAlvo; i++) {
        const cat = ORDEM_CATEGORIAS[i];
        categoria = cat;
        categoriasConquistadas.push(cat);
        minhaJornada.push({ categoria: cat, data: dataISO() });
        liberarBeneficiosDaCategoria(cat);
        // Toda categoria acima de Bronze concede +1 atendimento bônus automático.
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
    dados: { atendimentos, atendimentosBonus, categoria, beneficios, minhaJornada, historico },
    categoriasConquistadas
  };
}

/**
 * Cliente escolhe seu benefício único de Ouro. Só pode ser feito uma vez;
 * depois de escolhido, não pode ser alterado.
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
 * Deve ser chamado ao carregar a cliente (admin ou cartão) para manter tudo
 * sincronizado sem precisar de um job em segundo plano.
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
