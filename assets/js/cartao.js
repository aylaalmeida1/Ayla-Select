const $ = (seletor) => document.querySelector(seletor);

const ROTULO_TIPO_HISTORICO = {
  atendimento: "✔ Atendimento",
  atendimentoBonus: "⬆ Atendimento bônus",
  indicacaoConvertida: "👤 Indicação convertida"
};
const ROTULO_STATUS_BENEFICIO = {
  disponivel: "Disponível",
  utilizado: "Utilizado",
  expirado: "Expirado",
  aguardando_escolha: "Aguardando escolha"
};

const REGULAMENTO_PADRAO = `Participação
O Ayla Select é um programa gratuito e exclusivo para clientes do Studio Ayla Almeida.

Contagem
Cada atendimento equivale a um atendimento no programa. Mesmo realizando mais de um procedimento no mesmo dia, conta apenas um atendimento.

Categorias
Bronze, Prata, Ouro e Diamante. A evolução acontece automaticamente conforme o programa escolhido (12 ou 14 atendimentos).

Atendimento bônus
Ao subir de categoria, você recebe +1 atendimento bônus. Ao indicar uma nova cliente que realize o primeiro atendimento pago, você também recebe +1 atendimento bônus.

Benefícios
Os benefícios são concedidos apenas uma única vez, quando a categoria é conquistada.

Validade
Benefícios com prazo possuem validade de 30 dias a partir do recebimento.

Descontos
Os descontos não são cumulativos com outras promoções, não podem ser convertidos em dinheiro, são pessoais e intransferíveis.

Categoria
Depois de conquistada, a categoria permanece para sempre. O programa nunca reinicia.

Alterações
O Studio Ayla Almeida poderá alterar benefícios e regras do programa futuramente. Sempre que isso acontecer, será solicitado um novo aceite deste regulamento.`;

let clienteAtual = null;
let clienteIdAtual = null;

function pegarIdDaUrl(){
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

function iniciaisDoNome(nome){
  return (nome || "?")
    .trim()
    .split(/\s+/)
    .slice(0,2)
    .map(p => p[0])
    .join("")
    .toUpperCase();
}

function montarLinkWhatsapp(numero, mensagem){
  const somenteNumeros = (numero || "").replace(/\D/g,"");
  const texto = encodeURIComponent(mensagem || "Olá! Vim através do meu cartão do Ayla Select 💛");
  return `https://wa.me/${somenteNumeros}?text=${texto}`;
}

function formatarData(valor){
  if(!valor) return "";
  const data = valor.toDate ? valor.toDate() : new Date(valor);
  if(isNaN(data.getTime())) return valor;
  return data.toLocaleDateString("pt-BR");
}

function mesAnoPtBR(valor){
  if(!valor) return "";
  const data = new Date(valor);
  if(isNaN(data.getTime())) return "";
  const meses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  return `${meses[data.getMonth()]}/${data.getFullYear()}`;
}

function rotuloHistoricoItem(item){
  const base = ROTULO_TIPO_HISTORICO[item.tipo] || "Atendimento";
  return item.servico ? `${base} — ${item.servico}` : base;
}

function renderizarEstadoVazio(mensagem){
  $("#tela-regulamento").classList.add("oculto");
  $("#tela").classList.remove("oculto");
  $("#conteudo").innerHTML = `
    <div class="estado-vazio">
      <p class="serif" style="font-size:19px;color:#E8D9B5;">${mensagem}</p>
      <p style="font-size:12.5px;">Fale com o Ayla Select caso precise de ajuda.</p>
    </div>`;
}

/* =============================================================
   REGULAMENTO — primeiro acesso e atualizações
   ============================================================= */
function precisaAceitarRegulamento(cliente){
  const aceite = cliente.regulamentoAceite;
  if(!aceite || !aceite.aceito) return true;
  const versaoAtual = CONFIG_GERAL.versaoRegulamento || 1;
  return Number(aceite.versao || 0) !== Number(versaoAtual);
}

function mostrarTelaRegulamento(){
  document.querySelectorAll('[data-campo="marca-nome"]').forEach(el=>{
    el.childNodes[0].textContent = (CONFIG_GERAL.nomePrograma || "Ayla Select") + " ";
  });
  document.querySelectorAll('[data-campo="marca-nome-inline"]').forEach(el=>{
    el.textContent = CONFIG_GERAL.nomePrograma || "Ayla Select";
  });
  $("#regulamento-texto").textContent = CONFIG_GERAL.textoRegulamento || REGULAMENTO_PADRAO;
  $("#chk-regulamento").checked = false;
  $("#btn-entrar-regulamento").disabled = true;

  $("#tela").classList.add("oculto");
  $("#tela-regulamento").classList.remove("oculto");
}

if($("#chk-regulamento")){
  $("#chk-regulamento").addEventListener("change", (e)=>{
    $("#btn-entrar-regulamento").disabled = !e.target.checked;
  });
}

if($("#btn-entrar-regulamento")){
  $("#btn-entrar-regulamento").addEventListener("click", async ()=>{
    const agora = new Date().toISOString();
    const dados = {
      regulamentoAceite: {
        aceito: true,
        versao: CONFIG_GERAL.versaoRegulamento || 1,
        dataLeitura: agora,
        dataAceite: agora
      }
    };
    try{
      await db.collection(COLECAO_CLIENTES).doc(clienteIdAtual).update(dados);
      clienteAtual = { ...clienteAtual, ...dados };
      $("#tela-regulamento").classList.add("oculto");
      montarCartao();
    }catch(erro){
      console.error(erro);
      alert("Não foi possível registrar seu aceite agora. Tente novamente.");
    }
  });
}

/* =============================================================
   CARTÃO
   ============================================================= */
function renderizarCartao(cliente){
  const tpl = $("#tpl-cartao").content.cloneNode(true);

  if(CONFIG_GERAL.fundoCartaoUrl){
    const cartaoEl = tpl.querySelector(".cartao-vip");
    cartaoEl.style.backgroundImage = `linear-gradient(155deg, rgba(31,30,36,.88), rgba(22,21,26,.92) 70%), url("${CONFIG_GERAL.fundoCartaoUrl}")`;
    cartaoEl.style.backgroundSize = "cover";
    cartaoEl.style.backgroundPosition = "center";
  }

  const slot = tpl.getElementById("avatar-slot");
  if(cliente.foto){
    slot.innerHTML = `<img class="avatar" src="${cliente.foto}" alt="${cliente.nome}">`;
  } else {
    const div = document.createElement("div");
    div.className = "avatar-fallback";
    div.textContent = iniciaisDoNome(cliente.nome);
    slot.appendChild(div);
  }

  const programa = Number(cliente.programa) || 12;
  const categoria = cliente.categoria || "Bronze";
  const atendimentos = Number(cliente.atendimentos) || 0;
  const iconeCategoria = ICONE_CATEGORIA[categoria] || "";
  const beneficios = Array.isArray(cliente.beneficios) ? cliente.beneficios : [];

  tpl.querySelector('[data-campo="nome"]').textContent = cliente.nome || "Cliente";
  tpl.querySelector('[data-campo="nivel"]').textContent = `${iconeCategoria} ${categoria}`;

  const tempoSlot = tpl.querySelector('[data-campo="tempo-relacionamento"]');
  tempoSlot.textContent = cliente.clienteDesde ? tempoDeRelacionamento(cliente.clienteDesde) : "";

  /* --- Avisos de vencimento --- */
  const avisosSlot = tpl.querySelector('[data-campo="avisos"]');
  const avisosHtml = beneficios
    .filter(b => b.status === "disponivel" && b.validadeEm)
    .map(b => {
      const dias = diasRestantes(b.validadeEm);
      if(dias === null || dias > 7) return "";
      if(dias < 0) return "";
      const nome = b.nome || "benefício";
      const texto = nome.toLowerCase().includes("off")
        ? `Seu desconto expira em ${dias} dia${dias === 1 ? "" : "s"}.`
        : `Faltam ${dias} dia${dias === 1 ? "" : "s"} para utilizar seu ${nome}.`;
      return `<div class="aviso-vencimento">⏰ ${texto}</div>`;
    }).join("");
  avisosSlot.innerHTML = avisosHtml;

  /* --- Aviso de anamnese --- */
  const avisoAnamneseSlot = tpl.querySelector('[data-campo="aviso-anamnese"]');
  const statusAnam = statusAnamnese(cliente);
  if(statusAnam.situacao === "vencida"){
    avisoAnamneseSlot.innerHTML = `<div class="aviso-vencimento expirado">⚠️ Sua ficha de anamnese está vencida.<br>Antes do próximo atendimento, será necessário preencher uma nova ficha.</div>`;
  } else if(["vence_7","vence_15","vence_30"].includes(statusAnam.situacao)){
    avisoAnamneseSlot.innerHTML = `<div class="aviso-vencimento">📄 Sua ficha de anamnese vence em ${statusAnam.dias} dia${statusAnam.dias===1?"":"s"}.<br>Na sua próxima visita, faremos a atualização para manter seu cadastro em dia.</div>`;
  } else {
    avisoAnamneseSlot.innerHTML = "";
  }

  /* --- Barra de progresso --- */
  tpl.querySelector('[data-campo="visitas-legenda"]').textContent = `${atendimentos} no total`;
  const info = atendimentosParaProximaCategoria(programa, categoria, atendimentos);
  const bracelete = tpl.querySelector('[data-campo="bracelete"]');
  if(info){
    const limiares = LIMIARES_PROGRAMA[programa] || LIMIARES_PROGRAMA[12];
    const ordem = ORDEM_CATEGORIAS;
    const baseAnterior = ordem.indexOf(categoria) === 0 ? 0 : limiares[categoria] || 0;
    const alvo = limiares[info.proxima];
    const totalCiclo = Math.max(alvo - baseAnterior, 1);
    const feitosNoCiclo = Math.max(atendimentos - baseAnterior, 0);
    for(let i=1;i<=totalCiclo;i++){
      const conta = document.createElement("span");
      conta.className = "conta" + (i <= feitosNoCiclo ? " preenchida" : "");
      bracelete.appendChild(conta);
    }
    tpl.querySelector('[data-campo="faltam"]').textContent =
      info.faltam === 0 ? "Disponível agora ✦" : `Faltam ${info.faltam} atendimento${info.faltam>1?"s":""}`;
    tpl.querySelector('[data-campo="recompensa"]').textContent = `${ICONE_CATEGORIA[info.proxima]} ${info.proxima}`;
  } else {
    tpl.querySelector('[data-campo="faltam"]').textContent = "Categoria máxima alcançada ✦";
    tpl.querySelector('[data-campo="recompensa"]').textContent = "Você faz parte do nível máximo do Ayla Select";
  }

  /* --- Benefício desbloqueado (só os disponíveis / aguardando escolha) --- */
  const slotDesbloqueados = tpl.querySelector('[data-campo="beneficios-desbloqueados"]');
  const visiveis = beneficios.filter(b => b.status === "disponivel" || b.status === "aguardando_escolha");
  if(visiveis.length === 0){
    slotDesbloqueados.innerHTML = `<p style="font-size:12.5px;color:#8A8780;">Em breve novos benefícios exclusivos.</p>`;
  } else {
    slotDesbloqueados.innerHTML = visiveis.map(b=>{
      if(b.status === "aguardando_escolha" && Array.isArray(b.opcoes)){
        const botoes = b.opcoes.map(o=>`<button class="mini-btn" data-escolher-ben="${b.id}" data-opcao="${o.id}" type="button">${o.icone||""} ${o.nome}</button>`).join(" ");
        return `<div style="margin-bottom:14px;">
          <div style="font-size:13.5px;color:var(--dourado-claro);margin-bottom:8px;">🎁 Escolha seu benefício:</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">${botoes}</div>
        </div>`;
      }
      const situacao = b.validadeEm
        ? `Válido até ${formatarData(b.validadeEm)}`
        : (b.tipo === "fixo" ? "Aguardando retirada" : "Disponível");
      return `<div class="lista-beneficios" style="margin-bottom:6px;"><div style="padding-left:20px;position:relative;">✔ ${b.nome} — <span style="color:var(--dourado-claro);">${situacao}</span></div></div>`;
    }).join("");
  }

  /* --- Avaliação Google --- */
  const secaoAvaliacao = tpl.querySelector('[data-campo="secao-avaliacao"]');
  if(!CONFIG_GERAL.ativarAvaliacaoGoogle){
    secaoAvaliacao.remove();
  } else {
    const mensagemSlot = tpl.querySelector('[data-campo="avaliacao-mensagem"]');
    const elegivel = categoria !== "Bronze" || atendimentos >= 3;
    mensagemSlot.textContent = elegivel
      ? "💛 Sua opinião é muito importante para mim. Se você gostou do atendimento, sua avaliação no Google ajuda meu Studio a crescer e faz toda a diferença."
      : "";

    const btnAvaliar = tpl.querySelector("#btn-avaliar-google");
    const blocoPergunta = tpl.querySelector("#bloco-pergunta-avaliacao");
    const msgFeita = tpl.querySelector("#msg-avaliacao-feita");

    if(cliente.avaliacaoGoogle === "avaliou"){
      btnAvaliar.classList.add("oculto");
      msgFeita.classList.remove("oculto");
    } else {
      btnAvaliar.href = CONFIG_GERAL.linkAvaliacaoGoogle || "#";
      btnAvaliar.addEventListener("click", async (e)=>{
        if(!CONFIG_GERAL.linkAvaliacaoGoogle){
          e.preventDefault();
          alert("O link de avaliação ainda não foi configurado.");
          return;
        }
        blocoPergunta.classList.remove("oculto");
        try{
          await db.collection(COLECAO_CLIENTES).doc(clienteIdAtual).update({ avaliacaoGoogle: "pendente" });
        }catch(erro){ console.error(erro); }
      });
      blocoPergunta.querySelector("#btn-avaliacao-sim").addEventListener("click", async ()=>{
        try{
          await db.collection(COLECAO_CLIENTES).doc(clienteIdAtual).update({ avaliacaoGoogle: "avaliou" });
        }catch(erro){ console.error(erro); }
        blocoPergunta.classList.add("oculto");
        btnAvaliar.classList.add("oculto");
        msgFeita.classList.remove("oculto");
      });
      blocoPergunta.querySelector("#btn-avaliacao-depois").addEventListener("click", ()=>{
        blocoPergunta.classList.add("oculto");
      });
    }
  }

  /* --- Histórico de Benefícios (todos, com status) --- */
  const histBenSlot = tpl.querySelector('[data-campo="historico-beneficios"]');
  if(beneficios.length === 0){
    histBenSlot.innerHTML = `<p style="font-size:12.5px;color:#8A8780;">Nenhum benefício recebido ainda.</p>`;
  } else {
    histBenSlot.innerHTML = [...beneficios].reverse().map(b=>{
      const partes = [`Recebido: ${formatarData(b.recebidoEm)}`];
      if(b.usadoEm) partes.push(`Utilizado: ${formatarData(b.usadoEm)}`);
      if(b.status === "expirado" && b.validadeEm) partes.push(`Expirou: ${formatarData(b.validadeEm)}`);
      return `<div class="beneficio-hist-item">
        <span>${b.icone||"✦"} ${b.nome}<br><small class="status-mini">${partes.join(" · ")}</small></span>
        <span class="status-tag status-${b.status}">${ROTULO_STATUS_BENEFICIO[b.status] || b.status}</span>
      </div>`;
    }).join("");
  }

  /* --- Minha Jornada --- */
  const jornadaSlot = tpl.querySelector('[data-campo="jornada"]');
  const jornada = Array.isArray(cliente.minhaJornada) ? cliente.minhaJornada : [];
  if(jornada.length === 0){
    jornadaSlot.innerHTML = `<p style="font-size:12.5px;color:#8A8780;">Sua jornada está apenas começando.</p>`;
  } else {
    jornadaSlot.innerHTML = jornada.map(j => `
      <div class="jornada-item">
        <span>${ICONE_CATEGORIA[j.categoria]||""} ${j.categoria}</span>
        <span>Conquistado em ${mesAnoPtBR(j.data)}</span>
      </div>
    `).join("");
  }

  /* --- Histórico de atendimentos --- */
  const historicoSlot = tpl.querySelector('[data-campo="historico"]');
  const historico = Array.isArray(cliente.historico) ? [...cliente.historico].reverse() : [];
  if(historico.length === 0){
    historicoSlot.innerHTML = `<p style="font-size:12.5px;color:#8A8780;">Nenhum atendimento registrado ainda.</p>`;
  } else {
    historico.slice(0,8).forEach(item=>{
      const linha = document.createElement("div");
      linha.className = "historico-item";
      const rotulo = rotuloHistoricoItem(item);
      linha.innerHTML = `<span>${formatarData(item.data)}</span><span>${rotulo}</span>`;
      historicoSlot.appendChild(linha);
    });
  }

  /* --- Foto (a cliente adiciona ou exclui a própria foto) --- */
  const fotoAtualWrap = tpl.querySelector("#foto-atual-wrap");
  const fotoUploadWrap = tpl.querySelector("#foto-upload-wrap");
  if(cliente.foto){
    tpl.querySelector("#foto-atual").src = cliente.foto;
    fotoAtualWrap.classList.remove("oculto");
    fotoUploadWrap.classList.add("oculto");
  } else {
    fotoAtualWrap.classList.add("oculto");
    fotoUploadWrap.classList.remove("oculto");
  }

  const btnExcluirFoto = tpl.querySelector("#btn-excluir-foto");
  if(btnExcluirFoto){
    btnExcluirFoto.addEventListener("click", async ()=>{
      try{
        await db.collection(COLECAO_CLIENTES).doc(clienteIdAtual).update({ foto: "" });
        clienteAtual = { ...clienteAtual, foto: "" };
        montarCartao();
      }catch(erro){
        console.error(erro);
        alert("Não foi possível excluir a foto agora. Tente novamente.");
      }
    });
  }

  const btnAddFoto = tpl.querySelector("#btn-add-foto");
  if(btnAddFoto){
    btnAddFoto.addEventListener("click", async ()=>{
      const inputFoto = tpl.querySelector("#input-foto");
      const arquivo = inputFoto.files[0];
      if(!arquivo){ alert("Escolha uma imagem primeiro."); return; }
      const textoOriginal = btnAddFoto.textContent;
      btnAddFoto.textContent = "Enviando...";
      btnAddFoto.disabled = true;
      try{
        const ref = storage.ref(`fotos/${clienteIdAtual}/foto.jpg`);
        await ref.put(arquivo);
        const url = await ref.getDownloadURL();
        await db.collection(COLECAO_CLIENTES).doc(clienteIdAtual).update({ foto: url });
        clienteAtual = { ...clienteAtual, foto: url };
        montarCartao();
      }catch(erro){
        console.error(erro);
        alert("Não foi possível enviar a foto agora. Tente novamente.");
        btnAddFoto.textContent = textoOriginal;
        btnAddFoto.disabled = false;
      }
    });
  }

  $("#conteudo").innerHTML = "";
  $("#conteudo").appendChild(tpl);

  document.querySelectorAll('[data-campo="marca-nome"]').forEach(el=>{
    el.childNodes[0].textContent = (CONFIG_GERAL.nomePrograma || "Ayla Select") + " ";
  });
}

$("#conteudo") && document.addEventListener("click", async (e)=>{
  const btn = e.target.closest("button[data-escolher-ben]");
  if(!btn || !clienteAtual) return;
  const resultado = escolherBeneficioOuro(clienteAtual, btn.dataset.escolherBen, btn.dataset.opcao);
  if(resultado.erro){ alert(resultado.erro); return; }
  try{
    await db.collection(COLECAO_CLIENTES).doc(clienteIdAtual).update({ beneficios: resultado.dados.beneficios });
    clienteAtual = { ...clienteAtual, beneficios: resultado.dados.beneficios };
    montarCartao();
  }catch(erro){
    console.error(erro);
    alert("Não foi possível registrar sua escolha agora. Tente novamente.");
  }
});

function montarCartao(){
  $("#tela-regulamento").classList.add("oculto");
  $("#tela").classList.remove("oculto");
  renderizarCartao(clienteAtual);
}

/* =============================================================
   INICIALIZAÇÃO
   ============================================================= */
async function iniciar(){
  const id = pegarIdDaUrl();
  if(!id){
    renderizarEstadoVazio("Cartão não encontrado.");
    return;
  }
  clienteIdAtual = id;
  try{
    const configSnap = await db.doc(DOC_CONFIGURACOES).get();
    if(configSnap.exists) aplicarConfiguracoes(configSnap.data());
    aplicarTemaVisual(CONFIG_GERAL);

    const doc = await db.collection(COLECAO_CLIENTES).doc(id).get();
    if(!doc.exists){
      renderizarEstadoVazio("Não encontramos este cartão.");
      return;
    }
    let cliente = doc.data();

    const { mudou, beneficios } = atualizarStatusBeneficios(cliente);
    if(mudou){
      cliente = { ...cliente, beneficios };
      db.collection(COLECAO_CLIENTES).doc(id).update({ beneficios }).catch(err => console.error(err));
    }

    clienteAtual = cliente;

    if(precisaAceitarRegulamento(cliente)){
      mostrarTelaRegulamento();
    } else {
      montarCartao();
    }
  }catch(erro){
    console.error(erro);
    renderizarEstadoVazio("Não foi possível carregar seu cartão agora.");
  }
}

iniciar();
