const express = require('express');
const bodyParser = require('body-parser');
const { OpenAI } = require('openai');
const axios = require('axios');
const { twiml } = require('twilio');

const app = express();
const port = process.env.PORT || 3000;

// Configuración de OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));

// Ruta para recibir llamadas de Twilio
app.post('/voice', async (req, res) => {
  const speechResult = req.body.SpeechResult || '';

  let aiResponse = "Ho sento, no t'he entès. Pots repetir-ho, si us plau?";

  if (speechResult) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "Responde de forma natural, breve y educada. Usa el mismo idioma que el usuario, puede ser catalán, español o inglés." },
          { role: "user", content: speechResult }
        ],
      });
      aiResponse = completion.choices[0].message.content;
    } catch (error) {
      console.error('OpenAI Error:', error);
      aiResponse = "Ho sento, hi ha hagut un error processant la resposta.";
    }
  }

  let audioUrl;
  try {
    const response = await axios.post(
      'https://api.elevenlabs.io/v1/text-to-speech/' + process.env.ELEVEN_VOICE_ID,
      {
        text: aiResponse,
        model_id: process.env.ELEVEN_MODEL,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.7,
          style: 0.5,
          use_speaker_boost: true
        }
      },
      {
        headers: {
          'xi-api-key': process.env.ELEVEN_API_KEY,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer'
      }
    );

    // Subir audio a un bucket o a tu storage público si hace falta (o vía Base64 inline)
    // Pero como no queremos complicarlo ahora, Twilio necesita un URL directo de MP3
    // Aquí deberíamos guardar el audio y devolver URL (esto requiere almacenamiento público como S3, GCS...)

    console.error('⚠️ No se puede enviar audio desde buffer directamente a Twilio. Necesitas hosting de archivos.');

    // Respuesta provisional
    const twimlResponse = new twiml.VoiceResponse();
    twimlResponse.say({ language: 'ca-ES', voice: 'woman' }, aiResponse);
    res.type('text/xml');
    res.send(twimlResponse.toString());

  } catch (error) {
    console.error('ElevenLabs Error:', error);
    const fallbackResponse = new twiml.VoiceResponse();
    fallbackResponse.say({ language: 'ca-ES', voice: 'woman' }, aiResponse);
    res.type('text/xml');
    res.send(fallbackResponse.toString());
  }
});

// Prueba simple
app.get('/', (req, res) => {
  res.send('Twilio Voice Assistant with GPT-4o and ElevenLabs is running.');
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
