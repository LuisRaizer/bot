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
let shrineRunning = false;

async function buscarEMandarShrine() {
  if (shrineRunning) {
    console.warn("Rotina do Shrine já está em execução; chamada ignorada.");
    return;
  }

  shrineRunning = true;
  const url = "https://api.nightlight.gg/v1/shrine?pretty=true";
  const channelId = process.env.CHANNEL_ID;

  if (!channelId) {
    console.error("Erro Crítico: CHANNEL_ID não configurado.");
    shrineRunning = false;
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
    // Não faça uma segunda chamada ao Discord quando a primeira já foi limitada.
    if (error.status !== 429) {
      try {
        await DiscordRequest(`channels/${channelId}/messages`, {
          method: 'POST',
          body: { content: "⚠️ Falha ao buscar o Shrine hoje. Verifique os logs." },
        });
      } catch (notificationError) {
        console.error("Erro ao enviar aviso para o Discord:", notificationError);
      }
    }
  } finally {
    shrineRunning = false;
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

  console.log("Despertador ativado! Respondendo ao cron-job imediatamente...");
  
  res.status(200).send("OK");

  setTimeout(() => {
    buscarEMandarShrine();
  }, 1000);
}); // <-- Certifique-se de que este parêntese e chave estão aqui!

// Inicializa o servidor
app.listen(PORT, () => {
  console.log('Servidor rodando na porta', PORT);
});