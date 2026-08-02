let clientesCache = [];

const $ = (seletor) => document.querySelector(seletor);
const telaLogin = $("#tela-login");
const telaPainel = $("#tela-painel");

auth.onAuthStateChanged((usuario)=>{
  if(usuario){
    telaLogin.classList.add("oculto");
    telaPainel.classList.remove("oculto");
    escutarClientes();
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

function escutarClientes(){
  db.collection(COLECAO_CLIENTES).orderBy("nome").onSnapshot((snapshot)=>{
    clientesCache = [];
    snapshot.forEach(doc => clientesCache.push({ id: doc.id, ...doc.data() }));
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
    const card = document.createElement("div");
    card.className = "cliente-card";
    card.innerHTML = `
      <div class="cliente-card-topo">
        <div>
          <div class="serif">${cliente.nome}</div>
          <div class="cliente-visitas"><b>${cliente.visitas || 0}</b> visita(s) · ${cliente.nivel || "VIP"}</div>
        </div>
      </div>
      <div class="cliente-acoes">
        <button class="mini-btn destaque" data-acao="mais1" data-id="${cliente.id}">+1 visita</button>
        <button class="mini-btn" data-acao="historico" data-id="${cliente.id}">Histórico</button>
        <button class="mini-btn" data-acao="editar" data-id="${cliente.id}">Editar</button>
        <button class="mini-btn" data-acao="qr" data-id="${cliente.id}">QR Code</button>
        <button class="mini-btn" data-acao="excluir" data-id="${cliente.id}">Excluir</button>
      </div>
    `;
    container.appendChild(card);
  });
}

$("#busca-cliente").addEventListener("input", (e)=>{
  const termo = e.target.value.toLowerCase();
  renderizarLista(clientesCache.filter(c => (c.nome || "").toLowerCase().includes(termo)));
});

$("#lista-clientes").addEventListener("click", (e)=>{
  const btn = e.target.closest("button[data-acao]");
  if(!btn) return;
  const id = btn.dataset.id;
  const cliente = clientesCache.find(c => c.id === id);
  const acao = btn.dataset.acao;

  if(acao === "mais1") adicionarVisita(id, "Atendimento");
  if(acao === "historico") abrirHistorico(cliente);
  if(acao === "editar") abrirFormulario(cliente);
  if(acao === "qr") abrirQr(cliente);
  if(acao === "excluir") excluirCliente(cliente);
});

async function adicionarVisita(id, servico){
  const entrada = { data: new Date().toISOString(), servico: servico || "Atendimento" };
  await db.collection(COLECAO_CLIENTES).doc(id).update({
    visitas: firebase.firestore.FieldValue.increment(1),
    historico: firebase.firestore.FieldValue.arrayUnion(entrada)
  });
}

let clienteHistoricoAtual = null;

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
      <span>${item.servico || "Atendimento"}</span>
    </div>
  `).join("");
}

$("#btn-add-historico").addEventListener("click", async ()=>{
  const servico = $("#hist-servico").value.trim();
  if(!clienteHistoricoAtual || !servico) return;
  await adicionarVisita(clienteHistoricoAtual.id, servico);
  $("#hist-servico").value = "";
  const atualizado = clientesCache.find(c => c.id === clienteHistoricoAtual.id);
  if(atualizado){
    clienteHistoricoAtual = atualizado;
    renderizarHistoricoModal(atualizado);
  }
});

$("#btn-add").addEventListener("click", ()=> abrirFormulario(null));

function abrirFormulario(cliente){
  $("#modal-form-titulo").textContent = cliente ? "Editar cliente" : "Nova cliente";
  $("#form-id").value = cliente ? cliente.id : "";
  $("#form-nome").value = cliente ? (cliente.nome || "") : "";
  $("#form-whatsapp").value = cliente ? (cliente.whatsapp || "") : "";
  $("#form-aniversario").value = cliente ? (cliente.aniversario || "") : "";
  $("#form-nivel").value = cliente ? (cliente.nivel || "VIP") : "VIP";
  $("#form-meta").value = cliente ? (cliente.meta || 10) : 10;
  $("#form-foto").value = cliente ? (cliente.foto || "") : "";
  $("#form-recompensa").value = cliente ? (cliente.recompensa || "") : "";
  $("#form-beneficios").value = cliente && Array.isArray(cliente.beneficios) ? cliente.beneficios.join("\n") : "";
  $("#form-cuidados").value = cliente ? (cliente.cuidados || "") : "";
  $("#form-link-agendamento").value = cliente ? (cliente.linkAgendamento || "") : "";
  $("#modal-form").classList.remove("oculto");
}

$("#btn-salvar-cliente").addEventListener("click", async ()=>{
  const nome = $("#form-nome").value.trim();
  if(!nome){ alert("Informe o nome da cliente."); return; }

  const dados = {
    nome,
    whatsapp: $("#form-whatsapp").value.trim(),
    aniversario: $("#form-aniversario").value,
    nivel: $("#form-nivel").value,
    meta: Number($("#form-meta").value) || 10,
    foto: $("#form-foto").value.trim(),
    recompensa: $("#form-recompensa").value.trim(),
    beneficios: $("#form-beneficios").value.split("\n").map(s=>s.trim()).filter(Boolean),
    cuidados: $("#form-cuidados").value.trim(),
    linkAgendamento: $("#form-link-agendamento").value.trim()
  };

  const idExistente = $("#form-id").value;

  if(idExistente){
    await db.collection(COLECAO_CLIENTES).doc(idExistente).update(dados);
  } else {
    const novoRef = db.collection(COLECAO_CLIENTES).doc();
    await novoRef.set({ ...dados, visitas: 0, historico: [], criadoEm: new Date().toISOString() });
  }

  fecharModais();
});

async function excluirCliente(cliente){
  if(!cliente) return;
  const confirmar = confirm(`Excluir "${cliente.nome}" do Clube VIP? Esta ação não pode ser desfeita.`);
  if(!confirmar) return;
  await db.collection(COLECAO_CLIENTES).doc(cliente.id).delete();
}

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
    link.download = `qr-vip-${cliente.nome.replace(/\s+/g,"-").toLowerCase()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  $("#modal-qr").classList.remove("oculto");
}

function fecharModais(){
  document.querySelectorAll(".modal-fundo").forEach(m => m.classList.add("oculto"));
}

document.querySelectorAll("[data-fechar]").forEach(btn=>{
  btn.addEventListener("click", fecharModais);
});

document.querySelectorAll(".modal-fundo").forEach(fundo=>{
  fundo.addEventListener("click", (e)=>{
    if(e.target === fundo) fecharModais();
  });
});
