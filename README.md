# Clube VIP — Ayla Select

Sistema de fidelização digital: cada cliente tem um cartão VIP individual, aberto por QR Code, e você administra tudo pelo celular. 100% gratuito.

## Por que essa combinação de tecnologia

| Peça | Escolha | Motivo |
|---|---|---|
| Banco de dados (clientes, visitas, histórico) | **Firebase Firestore** (plano Spark, gratuito) | Atualiza em tempo real: quando você clica em "+1 visita", o cartão da cliente já mostra o número novo. Não precisa de servidor próprio. Não pede cartão de crédito no plano gratuito. |
| Login do painel admin | **Firebase Authentication** (e-mail/senha) | Único jeito de garantir que só você edita as clientes, sem custo. |
| Hospedagem do site (cartão + painel) | **GitHub Pages** | Gratuito para sempre, sem limite de mensalidade, funciona por link (não é app de loja). Alternativa: Firebase Hosting, que também é gratuito — use o que preferir. |
| Interface | HTML + CSS + JavaScript puro | Sem framework, sem build, roda em qualquer navegador de celular, carrega rápido. |
| QR Code | Biblioteca `qrcode.js` (via CDN, gratuita) | Gera o QR Code direto no navegador, sem depender de site externo. |

Google Sheets **não** foi usado porque não atualiza em tempo real de forma confiável para múltiplas clientes acessando ao mesmo tempo, e a aparência exigida (cartão premium) não combina com a estrutura de planilha.

## Estrutura de arquivos

```
studio-ayla-fidelidade/
├── index.html            (opcional — pode apontar para admin.html)
├── cartao.html           → página que a CLIENTE abre pelo QR Code
├── admin.html            → painel que só VOCÊ usa
├── firestore.rules       → regras de segurança (colar no console do Firebase)
├── assets/
│   ├── css/style.css     → toda a identidade visual (preto/branco/dourado)
│   └── js/
│       ├── firebase-config.js   → suas chaves do Firebase (você preenche)
│       ├── cartao.js            → lógica da página da cliente
│       └── admin.js             → lógica do painel administrativo
```

---

## Passo 1 — Criar o projeto no Firebase (gratuito)

1. Acesse **console.firebase.google.com** e clique em "Adicionar projeto".
2. Dê um nome, por exemplo `studio-ayla-fidelidade`. Pode desativar o Google Analytics (não é necessário).
3. Dentro do projeto, vá em **Compilação → Firestore Database → Criar banco de dados**.
   - Escolha "Iniciar no modo de produção".
   - Escolha a localização mais próxima (ex: `southamerica-east1`).
4. Vá em **Compilação → Authentication → Vamos começar**.
   - Ative o provedor **E-mail/senha**.
   - Na aba "Users", clique em "Adicionar usuário" e crie o seu login (o e-mail e senha que você vai usar para entrar no painel). Guarde essa senha.
5. Vá em **Configurações do projeto** (ícone de engrenagem) → role até "Seus apps" → clique no ícone `</>` (Web) → registre um app com qualquer apelido (não marque hosting).
6. Copie o bloco `firebaseConfig` que aparece.

## Passo 2 — Preencher a configuração

1. Abra o arquivo `assets/js/firebase-config.js`.
2. Substitua os valores `COLE_AQUI...` pelos valores reais copiados no passo anterior.
3. No final do arquivo, ajuste `URL_BASE_DO_SITE` para o link que seu site terá no GitHub Pages (você vai confirmar esse link no Passo 4 — pode voltar aqui depois).

## Passo 3 — Colar as regras de segurança

1. No console do Firebase, vá em **Firestore Database → Regras**.
2. Apague o conteúdo e cole o conteúdo do arquivo `firestore.rules`.
3. Clique em **Publicar**.

## Passo 4 — Publicar gratuitamente no GitHub Pages

1. Crie uma conta gratuita em **github.com** (se ainda não tiver).
2. Clique em "New repository", nomeie por exemplo `studio-ayla-fidelidade`, marque como **Public**, e crie.
3. Envie todos os arquivos desta pasta para esse repositório (pelo site do GitHub: "Add file → Upload files", arraste tudo mantendo a pasta `assets`).
4. Vá em **Settings → Pages**.
   - Em "Source", selecione a branch `main` e a pasta `/root`.
   - Salve.
5. Aguarde 1–2 minutos. Seu site ficará em:
   `https://SEU-USUARIO.github.io/studio-ayla-fidelidade/`
6. Volte no `firebase-config.js` e confirme que `URL_BASE_DO_SITE` está exatamente igual a esse link (sem barra `/` no final).
7. Reenvie o arquivo atualizado para o GitHub.

O painel ficará em:
`https://SEU-USUARIO.github.io/studio-ayla-fidelidade/admin.html`

O cartão de cada cliente ficará em:
`https://SEU-USUARIO.github.io/studio-ayla-fidelidade/cartao.html?id=ID-DA-CLIENTE`
(esse link completo é gerado automaticamente pelo painel, junto com o QR Code — você não precisa montá-lo manualmente).

---

## Passo 5 — Cadastrar a primeira cliente (exemplo: Juliana)

1. Abra `admin.html` no celular e entre com o e-mail/senha criados no Passo 1.
2. Toque no botão dourado **+** no canto inferior direito.
3. Preencha:
   - Nome: `Juliana Souza`
   - WhatsApp: `55` + DDD + número (ex: `5511999999999`)
   - Nível: `VIP`
   - Visitas para recompensa: `10`
   - Recompensa atual: `Manutenção grátis`
   - Benefícios (um por linha): `10% de desconto em esmaltação` / `Prioridade na agenda` / `Brinde de aniversário`
   - Cuidados pós-procedimento: cole a orientação padrão do seu Studio.
4. Toque em **Salvar cliente**. Ela aparecerá na lista com **0 visitas**.
5. Toque em **QR Code** no card dela → toque em **Baixar QR Code (PNG)**.
6. Imprima esse QR Code e coloque no envelope dela.

## Passo 6 — Uso diário

- Quando a cliente vem ao Studio: abra o painel, encontre o nome dela e toque em **+1 visita**. O número de visitas e o histórico atualizam na hora — inclusive no cartão dela, que ela pode abrir escaneando o mesmo QR Code novamente.
- Toque em **Histórico** para registrar o nome do serviço feito (ex: "Volume Russo", "Manutenção") em vez do rótulo genérico.
- Toque em **Editar** para trocar nível, recompensa, benefícios ou foto a qualquer momento.
- Toque em **Excluir** apenas se quiser remover a cliente definitivamente.

## Observações importantes

- O link do cartão (`cartao.html?id=...`) funciona sem senha de propósito — é isso que permite abrir direto pelo QR Code. Como o `id` é um código longo e aleatório gerado pelo Firebase, ele não pode ser adivinhado nem listado por terceiros.
- Tudo funciona dentro do navegador do celular (Safari ou Chrome) — não existe app para instalar, mas a cliente pode "Adicionar à Tela de Início" para abrir como se fosse um aplicativo.
- O plano gratuito do Firebase (Spark) suporta um volume alto de leituras/escritas por dia — mais do que suficiente para um Studio pequeno/médio.
