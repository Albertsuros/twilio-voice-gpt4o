require("dotenv").config();
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const axios = require('axios');
const { OpenAI } = require('openai');
const { twiml } = require('twilio');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Inicializar OpenAI
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Variables de entorno
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = process.env.VOICE_ID;

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static('public')); // para servir archivos mp3 a Twilio

// Historial de conversación
let conversationHistory = [
  {
    role: "system",
    content: `
Ets la Verònica, secretària virtual d’A S Asesores. Atens trucades amb calidesa, professionalitat i coneixement sobre serveis d'intel·ligència artificial per negocis. Parla de manera clara, natural, propera i en el mateix idioma del client. Fes una pregunta a la vegada. Quan el client digui "això és tot" o "gràcies", acomiada't amb amabilitat.
    `
  }
];

// Ruta principal
app.get('/', (req, res) => {
  res.send('Verònica - Assistència telefònica intel·ligent està activa.');
});

// Ruta de voz
app.post('/voice', async (req, res) => {
  const twilioResponse = new twiml.VoiceResponse();
  const speechResult = req.body.SpeechResult;

  if (!speechResult) {
    const gather = twilioResponse.gather({
      input: 'speech',
      action: '/voice',
      method: 'POST',
      language: 'ca-ES'
    });
    gather.say({ language: 'ca-ES', voice: 'woman' }, "Hola, sóc la Verònica, d’A S Asesores. En què puc ajudar-te?");
    res.type('text/xml');
    return res.send(twilioResponse.toString());
  }

  try {
    conversationHistory.push({ role: 'user', content: speechResult });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: conversationHistory,
    });

    const aiResponse = completion.choices[0].message.content.trim();
    conversationHistory.push({ role: 'assistant', content: aiResponse });

    const audioUrl = await synthesizeWithElevenLabs(aiResponse);

    const sayResponse = new twiml.VoiceResponse();
    sayResponse.play(audioUrl);

    const gather = sayResponse.gather({
      input: 'speech',
      action: '/voice',
      method: 'POST',
      language: 'ca-ES',
      timeout: 5
    });

    res.type('text/xml');
    return res.send(sayResponse.toString());
  } catch (err) {
    console.error('Error:', err);
    twilioResponse.say({ language: 'ca-ES', voice: 'woman' }, "Ho sento, hi ha hagut un problema tècnic.");
    res.type('text/xml');
    return res.send(twilioResponse.toString());
  }
});

// Función para generar el audio con ElevenLabs y servirlo
async function synthesizeWithElevenLabs(text) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream`;
  const filename = `public/${uuidv4()}.mp3`;

  const response = await axios.post(
    url,
    {
      text: text,
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

  fs.writeFileSync(filename, response.data);
  return `https://twilio-voice-gpt4o.onrender.com/${filename}`;
}

// Iniciar servidor
app.listen(port, () => {
  console.log(`Servidor actiu al port ${port}`);
});
