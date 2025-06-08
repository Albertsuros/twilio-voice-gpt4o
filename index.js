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

// Ruta para recibir llamadas de Twilio
app.post('/voice', async (req, res) => {
  const speechResult = req.body.SpeechResult || '';

  let aiResponse = "Ho sento, no t'he entès. Pots repetir-ho, si us plau?";

  if (speechResult) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "Responde en el mismo idioma que el usuario, de manera educada y breve." },
          { role: "user", content: speechResult }
        ],
      });
      aiResponse = completion.choices[0].message.content;
    } catch (error) {
      console.error('OpenAI Error:', error);
      aiResponse = "Ho sento, hi ha hagut un error processant la resposta.";
    }
  }

  const response = new twiml.VoiceResponse();
  response.say({ language: 'ca-ES', voice: 'woman' }, aiResponse);

  res.type('text/xml');
  res.send(response.toString());
});

app.get('/', (req, res) => {
  res.send('Twilio Voice Assistant with GPT-4o is running.');
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
