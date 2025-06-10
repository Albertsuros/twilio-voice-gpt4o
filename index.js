const express = require('express');
const bodyParser = require('body-parser');
const { OpenAI } = require('openai');
const { twiml } = require('twilio');

const app = express();
const port = process.env.PORT || 3000;

// Configuración de OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));

// Historial básico (en producción deberías usar sesiones por llamada)
let conversationHistory = [
  {
    role: "system",
    content: `
Ets la Verònica, secretària virtual d’A S Asesores, especialitzada en atenció telefònica professional. El teu objectiu és atendre amb amabilitat, gestionar cites de manera eficient i derivar les trucades al departament adequat.
També ets una assistent professional, intel·ligent i especialista en intel·ligència artificial, automatitzacions, creació de personal virtual i serveis relacionats. Coneixes perfectament les solucions que ofereix A S Asesores.
Quan el client pregunti pels preus, pots explicar que, en molts casos, els nostres serveis no superen els 500 €, però sempre es prepara un pressupost adaptat a cada necessitat.

Parla de manera natural, clara i pausada. Fes només una pregunta a la vegada. Mantingues frases curtes i properes. Respon sempre en el mateix idioma que utilitzi el client. Si el client diu expressions com “no, gràcies” o “això és tot”, acomiada’t amb educació.`
  }
];

// Ruta para recibir llamadas de Twilio
app.post('/voice', async (req, res) => {
  const speechResult = req.body.SpeechResult || '';
  const response = new twiml.VoiceResponse();

  if (!speechResult) {
    // Saludo inicial (audio mp3 de bienvenida)
    response.play('https://drive.google.com/uc?export=download&id=1yCTN5n9QJoE10IIQjOOeh2DbrfpZb4y_');
  } else {
    try {
      // Añadir entrada del usuario al historial
      conversationHistory.push({ role: "user", content: speechResult });

      // Obtener respuesta de GPT-4o
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: conversationHistory,
      });

      const aiResponse = completion.choices[0].message.content;

      // Añadir respuesta al historial
      conversationHistory.push({ role: "assistant", content: aiResponse });

      // Responder por voz (TTS de Twilio por ahora)
      response.say({ language: 'ca-ES', voice: 'woman' }, aiResponse);
    } catch (error) {
      console.error('OpenAI Error:', error);
      response.say({ language: 'ca-ES', voice: 'woman' }, "Ho sento, hi ha hagut un error tècnic.");
    }
  }

  res.type('text/xml');
  res.send(response.toString());
});

// Página principal
app.get('/', (req, res) => {
  res.send('Verònica - Centraleta AI de AS Asesores està activa.');
});

app.listen(port, () => {
  console.log(`Servidor actiu al port ${port}`);
});
