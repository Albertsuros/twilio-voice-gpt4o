require("dotenv").config();
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const axios = require('axios');
const { OpenAI } = require('openai');
const twilio = require('twilio');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Inicializar OpenAI
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Variables de entorno
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = process.env.VOICE_ID;
const BASE_URL = process.env.BASE_URL || `http://localhost:${port}`;

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static('public'));

// Historial de conversación
let conversationHistory = [
  {
    role: "system",
    content: `
Ets la Verònica, secretària virtual d'A S Asesores. Atens trucades amb calidesa, professionalitat i coneixement sobre serveis d'intel·ligència artificial per negocis. Parla de manera clara, natural, propera i en el mateix idioma del client. Fes una pregunta a la vegada. Quan el client digui "això és tot" o "gràcies", acomiada't amb amabilitat.
    `
  }
];

// Ruta principal
app.get('/', (req, res) => {
  res.send('Verònica - Assistència telefònica intel·ligent està activa.');
});

// Ruta de voz
app.post('/voice', async (req, res) => {
  console.log("📞 Nueva llamada recibida");
  const twilioResponse = new twilio.twiml.VoiceResponse();
  const speechResult = req.body.SpeechResult;
  console.log("🗣️ Texto detectado:", speechResult);

  if (!speechResult) {
    const gather = twilioResponse.gather({
      input: 'speech',
      action: '/voice',
      method: 'POST',
      language: 'ca-ES',
      timeout: 10
    });
    gather.say({ language: 'ca-ES', voice: 'woman' }, "Hola, sóc la Verònica, d' A S Asesores. En què et puc ajudar?");
    
    res.type('text/xml');
    return res.send(twilioResponse.toString());
  }

  try {
    conversationHistory.push({ role: 'user', content: speechResult });

    const historyLimit = 6;
    const recentMessages = conversationHistory.slice(-historyLimit);
    const messagesForAI = [conversationHistory[0], ...recentMessages];

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: messagesForAI,
    });

    const aiResponse = completion.choices[0].message.content.trim();
    console.log("🤖 Respuesta de OpenAI:", aiResponse);
    conversationHistory.push({ role: 'assistant', content: aiResponse });

    console.log("🎤 Sintetizando audio con ElevenLabs...");
    const audioUrl = await synthesizeWithElevenLabs(aiResponse, req);
    console.log("✅ Audio generado en:", audioUrl);

    twilioResponse.play(audioUrl);

    const gather = twilioResponse.gather({
      input: 'speech',
      action: '/voice',
      method: 'POST',
      language: 'ca-ES',
      timeout: 10
    });

    gather.say({ language: 'ca-ES', voice: 'woman' }, "");

    res.type('text/xml');
    return res.send(twilioResponse.toString());

  } catch (err) {
    console.error('❌ Error en /voice:', err.message);
    console.error('📛 Stack trace:', err.stack);

    twilioResponse.say({
      language: 'ca-ES',
      voice: 'woman'
    }, "Ho sento, hi ha hagut un problema tècnic. Torneu a intentar-ho, si us plau.");

    res.type('text/xml');
    return res.send(twilioResponse.toString());
  }
});

// Función para sintetizar con ElevenLabs
async function synthesizeWithElevenLabs(text, req) {
  if (!VOICE_ID || !ELEVENLABS_API_KEY) {
    throw new Error('Missing ElevenLabs configuration');
  }
  if (!text || text.trim().length === 0) {
    throw new Error('Text is required for synthesis');
  }

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream`;
  const filename = `${uuidv4()}.mp3`;
  const publicDir = path.join(__dirname, 'public');
  const filepath = path.join(publicDir, filename);

  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  try {
    const response = await axios.post(
      url,
      {
        text: text.trim(),
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.4,
          similarity_boost: 0.75
        }
      },
      {
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json"
        },
        responseType: 'arraybuffer'
      }
    );

    fs.writeFileSync(filepath, response.data);

    const baseUrl = BASE_URL || (req ? `https://${req.get('host')}` : 'http://localhost:3000');
    return `${baseUrl}/${filename}`;

  } catch (error) {
    console.error('Error synthesizing audio:', error.response?.data || error.message);
    throw new Error(`Audio synthesis failed: ${error.message}`);
  }
}

// Limpiar archivos viejos
function cleanupOldFiles() {
  const publicDir = path.join(__dirname, 'public');
  fs.readdir(publicDir, (err, files) => {
    if (err) return;

    files.forEach(file => {
      if (file.endsWith('.mp3')) {
        const filePath = path.join(publicDir, file);
        const stats = fs.statSync(filePath);
        const age = Date.now() - stats.mtime.getTime();

        if (age > 3600000) {
          fs.unlinkSync(filePath);
        }
      }
    });
  });
}

setInterval(cleanupOldFiles, 1800000);

// Iniciar servidor
app.listen(port, () => {
  console.log(`Servidor actiu al port ${port}`);
});
