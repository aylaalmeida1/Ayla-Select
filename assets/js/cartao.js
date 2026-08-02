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

const ROTULO_TIPO_HISTORICO = {
  atendimento: "✔ Atendimento",
  atendimentoBonus: "⬆ Atendimento bônus",
  indicacaoConvertida: "👤 Indicação convertida"
};

function renderizarEstadoVazio(mensagem){
  document.getElementById("conteudo").innerHTML = `
    <div class="estado-vazio">
      <p class="serif" style="font-size:19px;color:#E8D9B5;">${mensagem}</p>
      <p style="font-size:12.5px;">Fale com o Ayla Select caso precise de ajuda.</p>
    </div>`;
}

function renderizarCartao(cliente){
  const tpl = document.getElementById("tpl-cartao").content.cloneNode(true);

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

  tpl.querySelector('[data-campo="nome"]').textContent = cliente.nome || "Cliente";
  tpl.querySelector('[data-campo="nivel"]').textContent = `${iconeCategoria} ${categoria}`;

  const clienteDesde = cliente.clienteDesde;
  const tempoSlot = tpl.querySelector('[data-campo="tempo-relacionamento"]');
  tempoSlot.textContent = clienteDesde ? tempoDeRelacionamento(clienteDesde) : "";

  tpl.querySelector('[data-campo="visitas-legenda"]').textContent = `${atendimentos} no total`;

  const info = atendimentosParaProximaCategoria(programa, categoria, atendimentos);
  const bracelete = tpl.querySelector('[data-campo="bracelete"]');

  if(info){
    // Desenha a barra do ciclo atual até a próxima categoria.
    const limiares = { 12: { Prata: 3, Ouro: 6, Diamante: 12 }, 14: { Prata: 3, Ouro: 8, Diamante: 14 } }[programa];
    const ordem = ["Bronze","Prata","Ouro","Diamante"];
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

  const listaBeneficios = tpl.querySelector('[data-campo="beneficios"]');
  const beneficios = Array.isArray(cliente.beneficios) ? cliente.beneficios : [];
  const beneficiosVisiveis = beneficios.filter(b => b.status !== "expirado");
  if(beneficiosVisiveis.length === 0){
    listaBeneficios.innerHTML = `<li>Em breve novos benefícios exclusivos</li>`;
  } else {
    beneficiosVisiveis.forEach(b=>{
      const li = document.createElement("li");
      li.textContent = `${b.icone || "✦"} ${b.nome}`;
      listaBeneficios.appendChild(li);
    });
  }

  const historicoSlot = tpl.querySelector('[data-campo="historico"]');
  const historico = Array.isArray(cliente.historico) ? [...cliente.historico].reverse() : [];
  if(historico.length === 0){
    historicoSlot.innerHTML = `<p style="font-size:12.5px;color:#8A8780;">Nenhum atendimento registrado ainda.</p>`;
  } else {
    historico.slice(0,8).forEach(item=>{
      const linha = document.createElement("div");
      linha.className = "historico-item";
      const rotulo = ROTULO_TIPO_HISTORICO[item.tipo] || item.servico || "Atendimento";
      linha.innerHTML = `<span>${formatarData(item.data)}</span><span>${rotulo}</span>`;
      historicoSlot.appendChild(linha);
    });
  }

  tpl.querySelector('[data-campo="cuidados"]').textContent =
    cliente.cuidados || "Evite molhar a região nas primeiras 24h, não use produtos oleosos próximos aos olhos e escove os fios diariamente com o escovinha específico.";

  const linkWhats = tpl.querySelector('[data-campo="link-whatsapp"]');
  linkWhats.href = montarLinkWhatsapp(cliente.whatsapp);

  const linkAgendar = tpl.querySelector('[data-campo="link-agendar"]');
  linkAgendar.href = cliente.linkAgendamento || montarLinkWhatsapp(cliente.whatsapp, "Olá! Quero agendar meu próximo horário 💛");

  document.getElementById("conteudo").innerHTML = "";
  document.getElementById("conteudo").appendChild(tpl);
}

async function iniciar(){
  const id = pegarIdDaUrl();
  if(!id){
    renderizarEstadoVazio("Cartão não encontrado.");
    return;
  }
  try{
    const doc = await db.collection(COLECAO_CLIENTES).doc(id).get();
    if(!doc.exists){
      renderizarEstadoVazio("Não encontramos este cartão.");
      return;
    }
    renderizarCartao(doc.data());
  }catch(erro){
    console.error(erro);
    renderizarEstadoVazio("Não foi possível carregar seu cartão agora.");
  }
}

iniciar();
