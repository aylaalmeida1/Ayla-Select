let clientesCache = [];
let clienteEmEdicao = null;        // cópia de trabalho (mutável) — benefícios/anamnese ficam aqui até salvar
let snapshotAntesDaEdicao = null;  // cópia intocada da cliente, usada pelo "Desfazer última ação"
let jornadaEdicaoAtual = [];
let clienteHistoricoAtual = null;
let resolverConfirmacao = null;

const $ = (seletor) => document.querySelector(seletor);
const telaLogin = $("#tela-login");
const telaPainel = $("#tela-painel");

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

auth.onAuthStateChanged((usuario)=>{
  if(usuario){
    telaLogin.classList.add("oculto");
    telaPainel.classList.remove("oculto");
        carregarConfiguracoes().then(()=>{
      aplicarTemaVisual(CONFIG_GERAL);
      escutarClientes();
    });
  } else {
    telaLogin.classList.remove("oculto");
    telaPainel.classList.add("oculto");
  }
});

$("#btn-entrar").addEventListener("click", async ()=>{
  const email = $("#login-email").value.trim();
  const senha = $("#login-senha").value;
  $("#login-erro").textContent = "";
  try{
    await auth.signInWithEmailAndPassword(email, senha);
  }catch(erro){
    $("#login-erro").textContent = "E-mail ou senha incorretos.";
  }
});

$("#btn-sair").addEventListener("click", ()=> auth.signOut());

/* =============================================================
   CONFIRMAÇÃO GENÉRICA (substitui os confirm() nativos)
   ============================================================= */
function confirmarAcao(texto, subtexto){
  $("#confirmar-texto").textContent = texto;
  $("#confirmar-subtexto").textContent = subtexto || "";
  $("#modal-confirmar").classList.remove("oculto");
  return new Promise((resolve)=>{ resolverConfirmacao = resolve; });
}
$("#btn-confirmar-ok").addEventListener("click", ()=>{
  $("#modal-confirmar").classList.add("oculto");
  if(resolverConfirmacao){ resolverConfirmacao(true); resolverConfirmacao = null; }
});
$("#btn-confirmar-cancelar").addEventListener("click", ()=>{
  $("#modal-confirmar").classList.add("oculto");
  if(resolverConfirmacao){ resolverConfirmacao(false); resolverConfirmacao = null; }
});

/* =============================================================
   REGISTRO DE ALTERAÇÕES (log)
   ============================================================= */
async function registrarLog(texto){
  try{
    await db.collection(COLECAO_LOG).add({ data: new Date().toISOString(), texto, por: "Ayla" });
  }catch(erro){ console.error(erro); }
}

/* =============================================================
   CONFIGURAÇÕES GERAIS
   ============================================================= */
async function carregarConfiguracoes(){
  try{
    const snap = await db.doc(DOC_CONFIGURACOES).get();
    if(snap.exists) aplicarConfiguracoes(snap.data());
  }catch(erro){ console.error(erro); }
}

$("#btn-mais").addEventListener("click", ()=> $("#modal-mais").classList.remove("oculto"));

$("#btn-abrir-config").addEventListener("click", async ()=>{
  fecharModais();
  try{
    const snap = await db.doc(DOC_CONFIGURACOES).get();
    const cfg = snap.exists ? snap.data() : {};
    $("#cfg-nome-programa").value = cfg.nomePrograma || CONFIG_GERAL.nomePrograma;
    $("#cfg-link-google").value = cfg.linkAvaliacaoGoogle || "";
    $("#cfg-validade-dias").value = cfg.validadeBeneficiosDias || VALIDADE_PADRAO_DIAS;
    $("#cfg-12-prata").value = cfg.limiarPrograma12Prata || LIMIARES_PROGRAMA[12].Prata;
    $("#cfg-12-ouro").value = cfg.limiarPrograma12Ouro || LIMIARES_PROGRAMA[12].Ouro;
    $("#cfg-12-diamante").value = cfg.limiarPrograma12Diamante || LIMIARES_PROGRAMA[12].Diamante;
    $("#cfg-14-prata").value = cfg.limiarPrograma14Prata || LIMIARES_PROGRAMA[14].Prata;
    $("#cfg-14-ouro").value = cfg.limiarPrograma14Ouro || LIMIARES_PROGRAMA[14].Ouro;
    $("#cfg-14-diamante").value = cfg.limiarPrograma14Diamante || LIMIARES_PROGRAMA[14].Diamante;
    $("#cfg-regulamento").value = cfg.textoRegulamento || "";
    $("#cfg-ativar-qr").checked = cfg.ativarQr !== false;
    $("#cfg-ativar-animacoes").checked = cfg.ativarAnimacoes !== false;
    $("#cfg-ativar-indicacoes").checked = cfg.ativarIndicacoes !== false;
    $("#cfg-ativar-bonus").checked = cfg.ativarAtendimentoBonus !== false;
    $("#cfg-ativar-avaliacao").checked = cfg.ativarAvaliacaoGoogle !== false;
    $("#modal-config").classList.remove("oculto");
  }catch(erro){
    console.error(erro);
    alert("Não foi possível carregar as configurações.");
  }
});

$("#btn-salvar-config").addEventListener("click", async ()=>{
  try{
    const atual = await db.doc(DOC_CONFIGURACOES).get();
    const textoNovo = $("#cfg-regulamento").value;
    const textoAnterior = atual.exists ? (atual.data().textoRegulamento || "") : "";
    const versaoAnterior = atual.exists && atual.data().versaoRegulamento ? atual.data().versaoRegulamento : 0;

    const cfg = {
      nomePrograma: $("#cfg-nome-programa").value.trim() || "Ayla Select",
      linkAvaliacaoGoogle: $("#cfg-link-google").value.trim(),
      validadeBeneficiosDias: Number($("#cfg-validade-dias").value) || 30,
      limiarPrograma12Prata: Number($("#cfg-12-prata").value) || 3,
      limiarPrograma12Ouro: Number($("#cfg-12-ouro").value) || 6,
      limiarPrograma12Diamante: Number($("#cfg-12-diamante").value) || 12,
      limiarPrograma14Prata: Number($("#cfg-14-prata").value) || 3,
      limiarPrograma14Ouro: Number($("#cfg-14-ouro").value) || 8,
      limiarPrograma14Diamante: Number($("#cfg-14-diamante").value) || 14,
      textoRegulamento: textoNovo,
      versaoRegulamento: textoAnterior !== textoNovo ? versaoAnterior + 1 : (versaoAnterior || 1),
      ativarQr: $("#cfg-ativar-qr").checked,
      ativarAnimacoes: $("#cfg-ativar-animacoes").checked,
      ativarIndicacoes: $("#cfg-ativar-indicacoes").checked,
      ativarAtendimentoBonus: $("#cfg-ativar-bonus").checked,
      ativarAvaliacaoGoogle: $("#cfg-ativar-avaliacao").checked
    };

    await db.doc(DOC_CONFIGURACOES).set(cfg, { merge: true });
    aplicarConfiguracoes(cfg);
    registrarLog("⚙ Configurações gerais atualizadas");
    fecharModais();
    renderizarLista(clientesCache);
  }catch(erro){
    console.error(erro);
    alert("Não foi possível salvar as configurações.");
  }
});

/* =============================================================
   REGISTRO DE ALTERAÇÕES (tela)
   ============================================================= */
$("#btn-abrir-log").addEventListener("click", async ()=>{
  fecharModais();
  const container = $("#lista-log");
  container.innerHTML = `<p style="font-size:12.5px;color:#8A8780;">Carregando...</p>`;
  $("#modal-log").classList.remove("oculto");
  try{
    const snap = await db.collection(COLECAO_LOG).orderBy("data", "desc").limit(100).get();
    if(snap.empty){
      container.innerHTML = `<p style="font-size:12.5px;color:#8A8780;">Nenhum registro ainda.</p>`;
      return;
    }
    container.innerHTML = snap.docs.map(doc=>{
      const d = doc.data();
      const data = new Date(d.data);
      return `<div class="historico-item"><span>${data.toLocaleDateString("pt-BR")} ${data.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</span><span>${d.texto} — Por ${d.por || "Ayla"}</span></div>`;
    }).join("");
  }catch(erro){
    console.error(erro);
    container.innerHTML = `<p style="font-size:12.5px;color:#8A8780;">Não foi possível carregar o registro.</p>`;
  }
});

/* =============================================================
   BACKUP
   ============================================================= */
$("#btn-exportar-backup").addEventListener("click", async ()=>{
  try{
    const snap = await db.collection(COLECAO_CLIENTES).get();
    const clientes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const configSnap = await db.doc(DOC_CONFIGURACOES).get();
    const backup = { geradoEm: new Date().toISOString(), clientes, configuracoes: configSnap.exists ? configSnap.data() : null };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `ayla-select-backup-${new Date().toISOString().slice(0,10)}.json`;
    link.click();
    registrarLog("⬇ Backup exportado");
  }catch(erro){
    console.error(erro);
    alert("Não foi possível gerar o backup.");
  }
});

$("#btn-importar-backup").addEventListener("click", ()=> $("#input-importar-backup").click());

$("#input-importar-backup").addEventListener("change", async (e)=>{
  const arquivo = e.target.files[0];
  if(!arquivo) return;
  const ok = await confirmarAcao("Importar este backup?", "Os dados das clientes com o mesmo ID atual serão sobrescritos.");
  if(!ok){ e.target.value = ""; return; }
  try{
    const texto = await arquivo.text();
    const backup = JSON.parse(texto);
    const lote = db.batch();
    (backup.clientes || []).forEach(c=>{
      const { id, ...dados } = c;
      if(!id) return;
      lote.set(db.collection(COLECAO_CLIENTES).doc(id), dados);
    });
    if(backup.configuracoes){
      lote.set(db.doc(DOC_CONFIGURACOES), backup.configuracoes);
    }
    await lote.commit();
    registrarLog("⬆ Backup importado");
    alert("Backup importado com sucesso.");
  }catch(erro){
    console.error(erro);
    alert("Não foi possível importar este arquivo. Verifique se é um backup válido.");
  }finally{
    e.target.value = "";
  }
});

/* =============================================================
   DASHBOARD
   ============================================================= */
function renderizarDashboard(lista){
  const porCategoria = { Bronze: 0, Prata: 0, Ouro: 0, Diamante: 0 };
  let beneficiosPendentes = 0;
  let beneficiosVencendo = 0;
  let aniversariantes = 0;
  const mesAtual = new Date().getMonth();

  lista.forEach(c=>{
    porCategoria[c.categoria || "Bronze"] = (porCategoria[c.categoria || "Bronze"] || 0) + 1;
    (Array.isArray(c.beneficios) ? c.beneficios : []).forEach(b=>{
      if(b.status === "disponivel" || b.status === "aguardando_escolha") beneficiosPendentes++;
      if(b.status === "disponivel" && b.validadeEm){
        const dias = diasRestantes(b.validadeEm);
        if(dias !== null && dias >= 0 && dias <= 7) beneficiosVencendo++;
      }
    });
    if(c.aniversario){
      const mesAniv = new Date(c.aniversario + "T00:00:00").getMonth();
      if(mesAniv === mesAtual) aniversariantes++;
    }
  });

  $("#dashboard").innerHTML = `
    <div class="dash-card"><b>${lista.length}</b><span>Clientes</span></div>
    <div class="dash-card"><b>${porCategoria.Bronze}</b><span>🥉 Bronze</span></div>
    <div class="dash-card"><b>${porCategoria.Prata}</b><span>🥈 Prata</span></div>
    <div class="dash-card"><b>${porCategoria.Ouro}</b><span>🥇 Ouro</span></div>
    <div class="dash-card"><b>${porCategoria.Diamante}</b><span>💎 Diamante</span></div>
    <div class="dash-card alerta"><b>${beneficiosPendentes}</b><span>Benefícios pendentes</span></div>
    <div class="dash-card alerta"><b>${beneficiosVencendo}</b><span>Vencendo em 7 dias</span></div>
    <div class="dash-card"><b>${aniversariantes}</b><span>🎂 Aniversariantes do mês</span></div>
  `;
}

/* =============================================================
   LISTA DE CLIENTES
   ============================================================= */
function escutarClientes(){
  db.collection(COLECAO_CLIENTES).orderBy("nome").onSnapshot((snapshot)=>{
    clientesCache = [];
    snapshot.forEach(doc => clientesCache.push({ id: doc.id, ...doc.data() }));
    renderizarDashboard(clientesCache);
    renderizarLista(clientesCache);
  }, (erro)=>{
    console.error(erro);
    $("#lista-clientes").innerHTML = `<p style="color:#8A8780;font-size:13px;">Não foi possível carregar as clientes.</p>`;
  });
}

function renderizarLista(lista){
  const container = $("#lista-clientes");
  if(lista.length === 0){
    container.innerHTML = `<p style="color:#8A8780;font-size:13px;text-align:center;margin-top:40px;">Nenhuma cliente cadastrada ainda.<br>Toque no botão dourado para adicionar a primeira.</p>`;
    return;
  }
  container.innerHTML = "";
  lista.forEach(cliente=>{
    const categoria = cliente.categoria || "Bronze";
    const icone = ICONE_CATEGORIA[categoria] || "";
    const atendimentos = Number(cliente.atendimentos) || 0;
    const card = document.createElement("div");
    card.className = "cliente-card";
    card.innerHTML = `
      <div class="cliente-card-topo">
        <div>
          <div class="serif">${cliente.nome}</div>
          <div class="cliente-visitas">${icone} ${categoria} · <b>${atendimentos}</b> atendimento(s)</div>
        </div>
      </div>
      <div class="cliente-acoes">
        <button class="mini-btn destaque" data-acao="atendimento" data-id="${cliente.id}">➕ Atendimento</button>
        ${CONFIG_GERAL.ativarAtendimentoBonus ? `<button class="mini-btn" data-acao="bonus" data-id="${cliente.id}">⬆️ Bônus</button>` : ""}
        ${CONFIG_GERAL.ativarIndicacoes ? `<button class="mini-btn" data-acao="indicacao" data-id="${cliente.id}">👤 Indicação</button>` : ""}
        <button class="mini-btn" data-acao="anamnese" data-id="${cliente.id}">📄 Anamnese</button>
        <button class="mini-btn" data-acao="historico" data-id="${cliente.id}">Histórico</button>
        <button class="mini-btn" data-acao="editar" data-id="${cliente.id}">✏️ Editar</button>
        ${CONFIG_GERAL.ativarQr ? `<button class="mini-btn" data-acao="qr" data-id="${cliente.id}">QR Code</button>` : ""}
        <button class="mini-btn" data-acao="desfazer" data-id="${cliente.id}">↩️ Desfazer</button>
        <button class="mini-btn" data-acao="excluir" data-id="${cliente.id}">🗑️ Excluir</button>
      </div>
    `;
    container.appendChild(card);
  });
}

$("#busca-cliente").addEventListener("input", (e)=>{
  const termo = e.target.value.toLowerCase();
  renderizarLista(clientesCache.filter(c =>
    (c.nome || "").toLowerCase().includes(termo) ||
    (c.whatsapp || "").toLowerCase().includes(termo)
  ));
});

$("#lista-clientes").addEventListener("click", (e)=>{
  const btn = e.target.closest("button[data-acao]");
  if(!btn) return;
  const id = btn.dataset.id;
  const cliente = clientesCache.find(c => c.id === id);
  const acao = btn.dataset.acao;

  if(acao === "atendimento") registrarAtendimento(cliente, "atendimento");
  if(acao === "bonus") registrarAtendimento(cliente, "atendimentoBonus");
  if(acao === "indicacao") registrarAtendimento(cliente, "indicacaoConvertida", "Indicação convertida");
  if(acao === "historico") abrirHistorico(cliente);
  if(acao === "editar" || acao === "anamnese") abrirFormulario(cliente);
  if(acao === "qr") abrirQr(cliente);
  if(acao === "excluir") excluirCliente(cliente);
  if(acao === "desfazer") desfazerUltimaAcao(cliente);
});

/* =============================================================
   ATENDIMENTO / BÔNUS / INDICAÇÃO
   ============================================================= */
async function registrarAtendimento(cliente, tipoEvento, descricao){
  if(!cliente) return;
  const resultado = aplicarNovoAtendimento(cliente, tipoEvento, descricao);
  await db.collection(COLECAO_CLIENTES).doc(cliente.id).update(resultado.dados);
  registrarLog(`${ROTULO_TIPO_HISTORICO[tipoEvento] || "Atendimento"} — ${cliente.nome}`);

  if(resultado.categoriasConquistadas.length > 0){
    const ultima = resultado.categoriasConquistadas[resultado.categoriasConquistadas.length - 1];
    mostrarConquista(cliente.nome, ultima);
  }
}

function mostrarConquista(nome, categoria){
  if(!CONFIG_GERAL.ativarAnimacoes) return;
  const icone = ICONE_CATEGORIA[categoria] || "🎉";
  alert(`${icone} ${nome} acabou de conquistar a categoria ${categoria}!\nOs novos benefícios já estão disponíveis no cartão dela.`);
}

/* =============================================================
   DESFAZER ÚLTIMA AÇÃO
   ============================================================= */
async function desfazerUltimaAcao(cliente){
  if(!cliente) return;
  if(!cliente.ultimaAcaoTipo){
    alert("Não há nenhuma ação recente para desfazer nesta cliente.");
    return;
  }
  const ok = await confirmarAcao("Desfazer a última ação desta cliente?", "Categoria, barra de progresso, benefícios e Minha Jornada voltam ao estado anterior.");
  if(!ok) return;

  const ref = db.collection(COLECAO_CLIENTES).doc(cliente.id);

  if(cliente.ultimaAcaoTipo === "evento"){
    const historicoRestante = (cliente.historico || []).filter(h => h.acaoId !== cliente.ultimaAcaoId);
    const recomputado = recalcularEstadoAPartirDoHistorico(Number(cliente.programa) || 12, historicoRestante, cliente.criadoEm);
    await ref.update({
      ...recomputado,
      ultimaAcaoTipo: firebase.firestore.FieldValue.delete(),
      ultimaAcaoId: firebase.firestore.FieldValue.delete()
    });
  } else if(cliente.ultimaAcaoTipo === "edicao"){
    const s = cliente.ultimaAcaoSnapshot || {};
    await ref.update({
      categoria: s.categoria || "Bronze",
      atendimentos: s.atendimentos || 0,
      atendimentosBonus: s.atendimentosBonus || 0,
      beneficios: s.beneficios || [],
      minhaJornada: s.minhaJornada || [],
      programa: s.programa || 12,
      historico: s.historico || [],
      ultimaAcaoTipo: firebase.firestore.FieldValue.delete(),
      ultimaAcaoSnapshot: firebase.firestore.FieldValue.delete()
    });
  }
  registrarLog(`↩ Última ação desfeita — ${cliente.nome}`);
}

/* =============================================================
   HISTÓRICO
   ============================================================= */
function abrirHistorico(cliente){
  clienteHistoricoAtual = cliente;
  $("#historico-titulo").textContent = `Histórico · ${cliente.nome}`;
  renderizarHistoricoModal(cliente);
  $("#modal-historico").classList.remove("oculto");
}

function renderizarHistoricoModal(cliente){
  const lista = $("#lista-historico");
  const historico = Array.isArray(cliente.historico) ? [...cliente.historico].reverse() : [];
  if(historico.length === 0){
    lista.innerHTML = `<p style="font-size:13px;color:#8A8780;">Nenhum atendimento registrado.</p>`;
    return;
  }
  lista.innerHTML = historico.map(item => `
    <div class="historico-item">
      <span>${new Date(item.data).toLocaleDateString("pt-BR")}</span>
      <span>${ROTULO_TIPO_HISTORICO[item.tipo] || item.servico || "Atendimento"}</span>
      ${item.id ? `<button class="mini-btn" data-excluir-hist="${item.id}" type="button" style="padding:4px 8px;">✕</button>` : ""}
    </div>
  `).join("");
}

$("#btn-add-historico").addEventListener("click", async ()=>{
  const servico = $("#hist-servico").value.trim();
  if(!clienteHistoricoAtual || !servico) return;
  await registrarAtendimento(clienteHistoricoAtual, "atendimento", servico);
  $("#hist-servico").value = "";
  const atualizado = clientesCache.find(c => c.id === clienteHistoricoAtual.id);
  if(atualizado){
    clienteHistoricoAtual = atualizado;
    renderizarHistoricoModal(atualizado);
  }
});

$("#lista-historico").addEventListener("click", async (e)=>{
  const btn = e.target.closest("button[data-excluir-hist]");
  if(!btn || !clienteHistoricoAtual) return;
  const idAlvo = btn.dataset.excluirHist;
  const ok = await confirmarAcao("Excluir este atendimento do histórico?", "A categoria e os benefícios desta cliente serão recalculados automaticamente.");
  if(!ok) return;
  const historicoRestante = (clienteHistoricoAtual.historico || []).filter(h => h.id !== idAlvo);
  const recomputado = recalcularEstadoAPartirDoHistorico(Number(clienteHistoricoAtual.programa) || 12, historicoRestante, clienteHistoricoAtual.criadoEm);
  await db.collection(COLECAO_CLIENTES).doc(clienteHistoricoAtual.id).update(recomputado);
  registrarLog(`🗑 Atendimento removido do histórico — ${clienteHistoricoAtual.nome}`);
  const atualizado = clientesCache.find(c => c.id === clienteHistoricoAtual.id);
  if(atualizado){
    clienteHistoricoAtual = atualizado;
    renderizarHistoricoModal(atualizado);
  }
});

/* =============================================================
   FORMULÁRIO — CADASTRAR / EDITAR CLIENTE
   ============================================================= */
$("#btn-add").addEventListener("click", ()=> abrirFormulario(null));

function abrirFormulario(cliente){
  clienteEmEdicao = cliente ? JSON.parse(JSON.stringify(cliente)) : null;
  snapshotAntesDaEdicao = cliente ? JSON.parse(JSON.stringify(cliente)) : null;
  jornadaEdicaoAtual = cliente && Array.isArray(cliente.minhaJornada) ? JSON.parse(JSON.stringify(cliente.minhaJornada)) : [];

  $("#modal-form-titulo").textContent = cliente ? "Editar cliente" : "Nova cliente";
  $("#form-id").value = cliente ? cliente.id : "";
  $("#form-nome").value = cliente ? (cliente.nome || "") : "";
  $("#form-whatsapp").value = cliente ? (cliente.whatsapp || "") : "";
  $("#form-aniversario").value = cliente ? (cliente.aniversario || "") : "";
  $("#form-cliente-desde").value = cliente ? (cliente.clienteDesde || "") : new Date().toISOString().slice(0,10);
  $("#form-programa").value = cliente ? String(cliente.programa || 12) : "12";
  $("#form-foto").value = cliente ? (cliente.foto || "") : "";
  $("#form-cuidados").value = cliente ? (cliente.cuidados || "") : "";
  $("#form-link-agendamento").value = cliente ? (cliente.linkAgendamento || "") : "";

  const secoes = $("#secoes-edicao");
  const btnExcluir = $("#btn-excluir-cliente");

  if(cliente){
    secoes.classList.remove("oculto");
    btnExcluir.classList.remove("oculto");
    $("#form-categoria").value = cliente.categoria || "Bronze";
    $("#form-atendimentos").value = cliente.atendimentos || 0;
    $("#form-atendimentos-bonus").value = cliente.atendimentosBonus || 0;
    $("#form-link-jotform").value = cliente.linkJotform || "";
    $("#form-observacoes").value = cliente.observacoesInternas || "";
    renderizarBeneficiosEdicao();
    renderizarJornadaEdicao();
    renderizarAnamneseList();
  } else {
    secoes.classList.add("oculto");
    btnExcluir.classList.add("oculto");
  }

  $("#modal-form").classList.remove("oculto");
}

/* --- Benefícios (dentro da edição) --- */
function renderizarBeneficiosEdicao(){
  const container = $("#lista-beneficios-edicao");
  const beneficios = clienteEmEdicao && Array.isArray(clienteEmEdicao.beneficios) ? clienteEmEdicao.beneficios : [];
  if(beneficios.length === 0){
    container.innerHTML = `<p style="font-size:12.5px;color:#8A8780;">Nenhum benefício ainda.</p>`;
    return;
  }
  container.innerHTML = beneficios.map(b=>{
    let acoes = "";
    if(b.status === "disponivel"){
      acoes = `<button class="mini-btn" data-acao-ben="usar" data-ben-id="${b.id}" type="button">Marcar utilizado</button>`;
    } else if(b.status === "utilizado"){
      acoes = `<button class="mini-btn" data-acao-ben="reabrir" data-ben-id="${b.id}" type="button">Reabrir</button>`;
    } else if(b.status === "aguardando_escolha" && Array.isArray(b.opcoes)){
      acoes = b.opcoes.map(o => `<button class="mini-btn" data-acao-ben="escolher" data-ben-id="${b.id}" data-opcao-id="${o.id}" type="button">${o.icone || ""} ${o.nome}</button>`).join(" ");
    }
    const validade = b.validadeEm ? `válido até ${new Date(b.validadeEm).toLocaleDateString("pt-BR")}` : (b.tipo === "fixo" && !b.validadeDias ? "sem validade — aguardando retirada" : "");
    return `
      <div class="beneficio-linha" style="flex-direction:column;align-items:flex-start;">
        <div style="display:flex;justify-content:space-between;width:100%;gap:8px;">
          <span>${b.icone || "✦"} ${b.nome} <small style="color:#8A8780;">(${b.categoriaOrigem})</small></span>
          <span class="status-tag status-${b.status}">${ROTULO_STATUS_BENEFICIO[b.status] || b.status}</span>
        </div>
        <div style="font-size:11px;color:#8A8780;margin-top:2px;">${validade}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;">${acoes}</div>
      </div>`;
  }).join("");
}

$("#lista-beneficios-edicao").addEventListener("click", (e)=>{
  const btn = e.target.closest("button[data-acao-ben]");
  if(!btn || !clienteEmEdicao) return;
  const benId = btn.dataset.benId;
  const acao = btn.dataset.acaoBen;

  if(acao === "escolher"){
    const resultado = escolherBeneficioOuro(clienteEmEdicao, benId, btn.dataset.opcaoId);
    if(resultado.erro){ alert(resultado.erro); return; }
    clienteEmEdicao.beneficios = resultado.dados.beneficios;
    renderizarBeneficiosEdicao();
    return;
  }

  const beneficios = [...(clienteEmEdicao.beneficios || [])];
  const idx = beneficios.findIndex(b => b.id === benId);
  if(idx === -1) return;
  if(acao === "usar"){
    beneficios[idx] = { ...beneficios[idx], status: "utilizado", usadoEm: new Date().toISOString() };
  } else if(acao === "reabrir"){
    beneficios[idx] = { ...beneficios[idx], status: "disponivel", usadoEm: null };
  }
  clienteEmEdicao.beneficios = beneficios;
  renderizarBeneficiosEdicao();
});

/* --- Minha Jornada (dentro da edição) --- */
function renderizarJornadaEdicao(){
  const container = $("#lista-jornada-edicao");
  if(jornadaEdicaoAtual.length === 0){
    container.innerHTML = `<p style="font-size:12.5px;color:#8A8780;">Nenhum registro ainda.</p>`;
    return;
  }
  container.innerHTML = jornadaEdicaoAtual.map((j, i) => `
    <div class="jornada-linha">
      <span>${ICONE_CATEGORIA[j.categoria] || ""} ${j.categoria}</span>
      <input class="campo" type="date" data-jornada-idx="${i}" value="${(j.data || "").slice(0,10)}" style="max-width:150px;margin-top:0;">
    </div>
  `).join("");
}

$("#lista-jornada-edicao").addEventListener("change", (e)=>{
  const input = e.target.closest("input[data-jornada-idx]");
  if(!input) return;
  const idx = Number(input.dataset.jornadaIdx);
  if(!input.value) return;
  jornadaEdicaoAtual[idx] = { ...jornadaEdicaoAtual[idx], data: new Date(input.value + "T00:00:00").toISOString() };
});

/* --- Ficha de anamnese (dentro da edição) --- */
function renderizarAnamneseList(){
  const container = $("#lista-anamnese");
  const fichas = clienteEmEdicao && Array.isArray(clienteEmEdicao.fichasAnamnese)
    ? [...clienteEmEdicao.fichasAnamnese].sort((a,b) => new Date(b.data) - new Date(a.data))
    : [];
  if(fichas.length === 0){
    container.innerHTML = `<p style="font-size:12.5px;color:#8A8780;">Nenhuma ficha adicionada ainda.</p>`;
    return;
  }
  container.innerHTML = fichas.map(f => `
    <div class="anamnese-linha">
      <a href="${f.url}" target="_blank">📄 ${f.rotulo || "Ficha de anamnese"} — ${new Date(f.data).toLocaleDateString("pt-BR")}</a>
    </div>
  `).join("");
}

$("#btn-abrir-jotform").addEventListener("click", ()=>{
  const link = $("#form-link-jotform").value.trim();
  if(!link){ alert("Nenhum link do Jotform cadastrado para esta cliente."); return; }
  window.open(link, "_blank");
});

$("#btn-add-anamnese-link").addEventListener("click", ()=>{
  const url = $("#input-anamnese-link").value.trim();
  if(!url || !clienteEmEdicao) return;
  const fichas = Array.isArray(clienteEmEdicao.fichasAnamnese) ? [...clienteEmEdicao.fichasAnamnese] : [];
  fichas.push({ id: novoId("ficha"), tipo: "link", url, data: new Date().toISOString(), rotulo: fichas.length === 0 ? "Ficha de anamnese" : "Atualização da ficha" });
  clienteEmEdicao.fichasAnamnese = fichas;
  $("#input-anamnese-link").value = "";
  renderizarAnamneseList();
});

$("#btn-add-anamnese-pdf").addEventListener("click", async ()=>{
  const input = $("#input-anamnese-pdf");
  const arquivo = input.files[0];
  if(!arquivo || !clienteEmEdicao || !clienteEmEdicao.id){ alert("Escolha um arquivo PDF."); return; }
  const btn = $("#btn-add-anamnese-pdf");
  const textoOriginal = btn.textContent;
  btn.textContent = "Enviando...";
  btn.disabled = true;
  try{
    const caminho = `anamnese/${clienteEmEdicao.id}/${Date.now()}_${arquivo.name}`;
    const ref = storage.ref(caminho);
    await ref.put(arquivo);
    const url = await ref.getDownloadURL();
    const fichas = Array.isArray(clienteEmEdicao.fichasAnamnese) ? [...clienteEmEdicao.fichasAnamnese] : [];
    fichas.push({ id: novoId("ficha"), tipo: "pdf", url, data: new Date().toISOString(), rotulo: fichas.length === 0 ? "Ficha de anamnese" : "Atualização da ficha" });
    clienteEmEdicao.fichasAnamnese = fichas;
    input.value = "";
    renderizarAnamneseList();
  }catch(erro){
    console.error(erro);
    alert("Não foi possível enviar o PDF. Verifique as regras do Firebase Storage.");
  }finally{
    btn.textContent = textoOriginal;
    btn.disabled = false;
  }
});

/* --- Salvar --- */
$("#btn-salvar-cliente").addEventListener("click", async ()=>{
  const nome = $("#form-nome").value.trim();
  if(!nome){ alert("Informe o nome da cliente."); return; }

  const idExistente = $("#form-id").value;

  if(idExistente){
    const categoriaNova = $("#form-categoria").value;
    const programaNovo = Number($("#form-programa").value) || 12;
    const categoriaAlterada = categoriaNova !== (snapshotAntesDaEdicao.categoria || "Bronze");
    const programaAlterado = programaNovo !== Number(snapshotAntesDaEdicao.programa || 12);

    if(categoriaAlterada || programaAlterado){
      const ok = await confirmarAcao(
        "Tem certeza que deseja realizar esta alteração?",
        "Essa ação pode alterar a categoria, benefícios e histórico da cliente."
      );
      if(!ok) return;
    }

    const dados = {
      nome,
      whatsapp: $("#form-whatsapp").value.trim(),
      aniversario: $("#form-aniversario").value,
      clienteDesde: $("#form-cliente-desde").value,
      foto: $("#form-foto").value.trim(),
      cuidados: $("#form-cuidados").value.trim(),
      linkAgendamento: $("#form-link-agendamento").value.trim(),
      programa: programaNovo,
      categoria: categoriaNova,
      atendimentos: Number($("#form-atendimentos").value) || 0,
      atendimentosBonus: Number($("#form-atendimentos-bonus").value) || 0,
      beneficios: clienteEmEdicao.beneficios || [],
      minhaJornada: jornadaEdicaoAtual,
      linkJotform: $("#form-link-jotform").value.trim(),
      fichasAnamnese: clienteEmEdicao.fichasAnamnese || [],
      observacoesInternas: $("#form-observacoes").value.trim(),
      ultimaAcaoTipo: "edicao",
      ultimaAcaoSnapshot: {
        categoria: snapshotAntesDaEdicao.categoria || "Bronze",
        atendimentos: snapshotAntesDaEdicao.atendimentos || 0,
        atendimentosBonus: snapshotAntesDaEdicao.atendimentosBonus || 0,
        beneficios: snapshotAntesDaEdicao.beneficios || [],
        minhaJornada: snapshotAntesDaEdicao.minhaJornada || [],
        programa: snapshotAntesDaEdicao.programa || 12,
        historico: snapshotAntesDaEdicao.historico || []
      }
    };
    await db.collection(COLECAO_CLIENTES).doc(idExistente).update(dados);
    registrarLog(`✏ Cliente editada — ${nome}`);
  } else {
    const agora = new Date().toISOString();
    const clienteDesde = $("#form-cliente-desde").value || agora.slice(0,10);
    const novoRef = db.collection(COLECAO_CLIENTES).doc();
    await novoRef.set({
      nome,
      whatsapp: $("#form-whatsapp").value.trim(),
      aniversario: $("#form-aniversario").value,
      clienteDesde,
      programa: Number($("#form-programa").value) || 12,
      foto: $("#form-foto").value.trim(),
      cuidados: $("#form-cuidados").value.trim(),
      linkAgendamento: $("#form-link-agendamento").value.trim(),
      linkJotform: "",
      categoria: "Bronze",
      atendimentos: 0,
      atendimentosBonus: 0,
      beneficios: [],
      minhaJornada: [{ categoria: "Bronze", data: agora }],
      historico: [],
      fichasAnamnese: [],
      observacoesInternas: "",
      criadoEm: agora
    });
    registrarLog(`➕ Cliente cadastrada — ${nome}`);
  }

  fecharModais();
});

$("#btn-excluir-cliente").addEventListener("click", ()=> excluirCliente(clienteEmEdicao));

async function excluirCliente(cliente){
  if(!cliente) return;
  const ok = await confirmarAcao(
    "Tem certeza que deseja excluir esta cliente?",
    `"${cliente.nome}" — categoria, benefícios e histórico serão apagados. Esta ação não pode ser desfeita.`
  );
  if(!ok) return;
  await db.collection(COLECAO_CLIENTES).doc(cliente.id).delete();
  registrarLog(`🗑 Cliente excluída — ${cliente.nome}`);
  fecharModais();
}

/* =============================================================
   QR CODE
   ============================================================= */
function abrirQr(cliente){
  const url = `${URL_BASE_DO_SITE}/cartao.html?id=${cliente.id}`;
  $("#qr-titulo").textContent = `QR · ${cliente.nome}`;
  $("#qr-link-txt").textContent = url;

  const alvo = $("#qr-render");
  alvo.innerHTML = "";
  new QRCode(alvo, {
    text: url,
    width: 200,
    height: 200,
    colorDark: "#0B0B0C",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
  });

  $("#btn-baixar-qr").onclick = ()=>{
    const canvas = alvo.querySelector("canvas");
    if(!canvas) return;
    const link = document.createElement("a");
    link.download = `qr-${cliente.nome.replace(/\s+/g,"-").toLowerCase()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  $("#modal-qr").classList.remove("oculto");
}

/* =============================================================
   MODAIS — fechar
   ============================================================= */
function fecharModais(){
  document.querySelectorAll(".modal-fundo").forEach(m => m.classList.add("oculto"));
}

document.querySelectorAll("[data-fechar]").forEach(btn=>{
  btn.addEventListener("click", fecharModais);
});

document.querySelectorAll(".modal-fundo").forEach(fundo=>{
  fundo.addEventListener("click", (e)=>{
    if(e.target === fundo){
      if(fundo.id === "modal-confirmar" && resolverConfirmacao){
        resolverConfirmacao(false);
        resolverConfirmacao = null;
      }
      fundo.classList.add("oculto");
    }
  });
});
