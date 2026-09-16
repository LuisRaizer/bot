import 'dotenv/config';

export async function DiscordRequest(endpoint, options) {
  const url = 'https://discord.com/api/v10/' + endpoint;
  const requestOptions = {
    ...options,
    headers: {
      Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'User-Agent': 'DiscordBot (MeuBotShrine, 1.0.0)',
      ...options.headers,
    },
  };

  if (requestOptions.body && typeof requestOptions.body !== 'string') {
    requestOptions.body = JSON.stringify(requestOptions.body);
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const res = await fetch(url, requestOptions);

    if (res.ok) return res;

    const responseText = await res.text();
    let errorBody = responseText;

    try {
      errorBody = JSON.parse(responseText);
    } catch {
    }

    let retryAfterFromBody = Number(errorBody?.retry_after);

    if (res.status === 429 && !Number.isFinite(retryAfterFromBody)) {
      retryAfterFromBody = 5;
    }

    if (
      res.status !== 429 ||
      attempt === 2 ||
      !Number.isFinite(retryAfterFromBody) ||
      retryAfterFromBody < 0
    ) {
      const error = new Error(`Discord API ${res.status}: ${typeof errorBody === 'object' ? JSON.stringify(errorBody) : errorBody}`);
      error.status = res.status;
      throw error;
    }

    const retryAfter = Math.min(retryAfterFromBody, 30);
    console.warn(`Discord rate limitado; tentando novamente em ${retryAfter}s (Tentativa ${attempt + 1}/3)...`);
    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
  }
}

export async function InstallGlobalCommands(appId, commands) {
  const endpoint = `applications/${appId}/commands`;

  try {
    await DiscordRequest(endpoint, { method: 'PUT', body: commands });
  } catch (err) {
    console.error(err);
  }
}

export function getRandomEmoji() {
  const emojiList = ['😭','😄','😌','🤓','😎','😤','🤖','😶‍🌫️','🌏','📸','💿','👋','🌊','✨'];
  return emojiList[Math.floor(Math.random() * emojiList.length)];
}

export function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}