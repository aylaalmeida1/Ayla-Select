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
  const texto = encodeURIComponent(mensagem || "Olá! Vim através do meu cartão VIP do Ayla Select 💛");
  return `https://wa.me/${somenteNumeros}?text=${texto}`;
}

function formatarData(valor){
  if(!valor) return "";
  const data = valor.toDate ? valor.toDate() : new Date(valor);
  if(isNaN(data.getTime())) return valor;
  return data.toLocaleDateString("pt-BR");
}

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

  tpl.querySelector('[data-campo="nome"]').textContent = cliente.nome || "Cliente VIP";
  tpl.querySelector('[data-campo="nivel"]').textContent = cliente.nivel || "VIP";

  const meta = Number(cliente.meta) > 0 ? Number(cliente.meta) : 10;
  const visitas = Number(cliente.visitas) || 0;
  const visitasNoCiclo = visitas % meta === 0 && visitas > 0 ? meta : visitas % meta;
  const faltam = meta - visitasNoCiclo;

  tpl.querySelector('[data-campo="visitas-legenda"]').textContent = `${visitas} no total`;

  const bracelete = tpl.querySelector('[data-campo="bracelete"]');
  for(let i=1; i<=meta; i++){
    const conta = document.createElement("span");
    conta.className = "conta" + (i <= visitasNoCiclo ? " preenchida" : "");
    bracelete.appendChild(conta);
  }

  tpl.querySelector('[data-campo="faltam"]').textContent =
    faltam === 0 ? "Disponível agora ✦" : `${faltam} visita${faltam>1?"s":""}`;
  tpl.querySelector('[data-campo="recompensa"]').textContent = cliente.recompensa || "Recompensa surpresa";

  const listaBeneficios = tpl.querySelector('[data-campo="beneficios"]');
  const beneficios = Array.isArray(cliente.beneficios) ? cliente.beneficios : [];
  if(beneficios.length === 0){
    listaBeneficios.innerHTML = `<li>Em breve novos benefícios exclusivos</li>`;
  } else {
    beneficios.forEach(b=>{
      const li = document.createElement("li");
      li.textContent = b;
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
      linha.innerHTML = `<span>${formatarData(item.data)}</span><span>${item.servico || "Atendimento"}</span>`;
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
      renderizarEstadoVazio("Não encontramos este cartão VIP.");
      return;
    }
    renderizarCartao(doc.data());
  }catch(erro){
    console.error(erro);
    renderizarEstadoVazio("Não foi possível carregar seu cartão agora.");
  }
}

iniciar();
