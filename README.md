# ⛰️ IMUTÁVEL Studio — Sabedoria da Montanha & Leis Universais

Plataforma web e mobile (PWA) para geração automática de vídeos animados compatíveis com **Instagram Reels (9:16)**, **Stories (9:16)** e **Feed (4:5 e 1:1)**, com **Voz Neural de Filósofo em Português-BR**, **Sincronização Automática de Tempo pelo Agente IA** e **Legenda PT-BR Visível**.

---

## 📁 Estrutura de Arquivos do App

```text
imutavel-studio/
├── api/
│   └── tts.js                  # Função Serverless de Voz Neural (para hospedagem gratuita na Vercel)
├── public/
│   ├── css/
│   │   └── styles.css          # Estilos responsivos Desktop + Mobile (Android / iOS)
│   ├── js/
│   │   ├── knowledge-base.js   # Cérebro do Agente IA com os Temas e Leis Universais da fonte
│   │   ├── character-engine.js # Engine 60fps (Cenários Naturais 3D, Fogueira, Áudio Natural e Personagem)
│   │   └── app.js              # Controlador da Plataforma, Login, Sincronização IA e Exportação MP4/WebM
│   ├── index.html              # Interface Principal (Login/Cadastro + Estúdio)
│   └── manifest.json           # Web App Manifest (permite instalar como App na Tela Inicial do celular)
├── private_agent_kb/           # Base de conhecimento original isolada (bloqueada para acesso público)
├── server.js                   # Servidor Node.js (para execução local ou Render.com / Railway)
├── vercel.json                 # Configuração pronta para deploy gratuito na Vercel
├── render.yaml                 # Configuração pronta para deploy gratuito no Render.com
└── package.json                # Dependências do projeto (msedge-tts)
```

---

## 🌐 Como Hospedar Gratuitamente (Para PC e Celular)

O aplicativo já está configurado para as **2 melhores plataformas gratuitas** do mercado:

### Opção 1: Vercel (Recomendado — 100% Gratuito, Ultra-Rápido e Nunca "Dorme")
1. Crie uma conta gratuita em [https://vercel.com](https://vercel.com) (pode entrar com GitHub ou Google).
2. Suba esta pasta para um repositório no seu GitHub **ou** instale a CLI da Vercel (`npx vercel`) dentro desta pasta.
3. Na Vercel, clique em **"Add New..." → "Project"** e importe o repositório (ou faça upload).
4. Clique em **Deploy**. O arquivo `vercel.json` e a rota `api/tts.js` já estão configurados automaticamente!
5. Você receberá um link seguro `https://seu-app.vercel.app` que abre instantaneamente em qualquer celular Android ou iPhone.

### Opção 2: Render.com (100% Gratuito — Servidor Node.js Contínuo)
1. Crie uma conta gratuita em [https://render.com](https://render.com).
2. Clique em **"New +" → "Web Service"** e conecte seu repositório GitHub com os arquivos deste `.zip`.
3. Configure:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`
4. Clique em **Create Web Service**.

---

## 📱 Como Instalar como App no Celular (Android e iPhone)
Assim que abrir o link hospedado no navegador do celular:
- **No Android (Chrome)**: Toque no menu `⋮` (canto superior direito) e selecione **"Adicionar à tela inicial"** / **"Instalar aplicativo"**.
- **No iPhone (Safari)**: Toque no botão **Compartilhar** (ícone com seta para cima) e toque em **"Adicionar à Tela de Início"**.
O **IMUTÁVEL Studio** ficará com ícone próprio na tela do celular e abrirá em tela cheia!
