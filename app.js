import 'dotenv/config';
import express from 'express';
import {
  InteractionResponseFlags,
  InteractionResponseType,
  InteractionType,
  MessageComponentTypes,
  verifyKeyMiddleware,
} from 'discord-interactions';
import { getRandomEmoji, DiscordRequest } from './utils.js';

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// 1. ENDPOINT PADRÃO DO DISCORD
// ==========================================
app.post('/interactions', verifyKeyMiddleware(process.env.PUBLIC_KEY), async function (req, res) {
  const { type, data } = req.body;

  if (type === InteractionType.PING) {
    return res.send({ type: InteractionResponseType.PONG });
  }

  if (type === InteractionType.APPLICATION_COMMAND) {
    const { name } = data;
    if (name === 'test') {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          flags: InteractionResponseFlags.IS_COMPONENTS_V2,
          content: `Bot operando 100% ${getRandomEmoji()}`
        },
      });
    }
    return res.status(400).json({ error: 'Comando desconhecido' });
  }
});

// ==========================================
// 2. LÓGICA DE BUSCAR E ENVIAR O SHRINE
// ==========================================
async function buscarEMandarShrine() {
  const url = "https://api.nightlight.gg/v1/shrine?pretty=true";
  const channelId = process.env.CHANNEL_ID;

  if (!channelId) {
    console.error("Erro Crítico: CHANNEL_ID não configurado.");
    return;
  }

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json'
  };

  try {
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`API retornou status: ${response.status}`);

    const textoOriginal = await response.text();
    let textoPopup = "";

    if (textoOriginal.trim().startsWith('{') || textoOriginal.trim().startsWith('[')) {
      const dados = JSON.parse(textoOriginal);
      const perks = dados?.shrine?.perks;
      if (perks && perks.length > 0) {
        textoPopup = "**Shrine of Secrets Diário:**\n" + perks.map(p => `• ${p.id || p}`).join('\n');
      } else {
        textoPopup = `\`\`\`json\n${JSON.stringify(dados, null, 2)}\n\`\`\``;
      }
    } else {
      textoPopup = `**Shrine of Secrets Diário:**\n${textoOriginal}`;
    }

    await DiscordRequest(`channels/${channelId}/messages`, {
      method: 'POST',
      body: { content: textoPopup },
    });
    console.log("Shrine enviado com sucesso!");

  } catch (error) {
    console.error("Erro na rotina do Shrine:", error);
    // Envia aviso de erro pro Discord para você saber que falhou
    await DiscordRequest(`channels/${channelId}/messages`, {
      method: 'POST',
      body: { content: "⚠️ Falha ao buscar o Shrine hoje. Verifique os logs." },
    });
  }
}

// ==========================================
// 3. ROTA DO DESPERTADOR (CRON-JOB)
// ==========================================
app.get('/cron-shrine', (req, res) => {
  const senhaInformada = req.query.senha;
  const senhaCorreta = process.env.CRON_SECRET;

  if (!senhaCorreta || senhaInformada !== senhaCorreta) {
    console.log("Tentativa de acesso negada ao /cron-shrine");
    return res.status(401).send("Acesso Negado.");
  }

  // Responde logo com um texto minúsculo para o cron-job ficar feliz e fechar a conexão
  res.status(200).send("OK");

  // Executa a busca em segundo plano DEPOIS de já ter respondido ao site
  setTimeout(() => {
    buscarEMandarShrine();
  }, 1000);
});