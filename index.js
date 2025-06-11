require("dotenv").config();
const express = require('express');
const bodyParser = require('body-parser');
const { OpenAI } = require('openai');
const { twiml } = require('twilio');

const app = express();
const port = process.env.PORT || 3000;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

let conversationHistory = [
  {
    role: "system",
    content: `
Ets la Verònica, secretària virtual d’A S Asesores. Atens trucades amb calidesa, professionalitat i coneixement sobre serveis d'intel·ligència artificial per negocis. Parla de manera clara, natural, propera i en el mateix idioma del client. Fes una pregunta a la vegada. Quan el client digui "això és tot" o "gràcies", acomiada't amb amabilitat.
    `
  }
];

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

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

    const response = new twiml.VoiceResponse();
    response.say({ language: 'ca-ES', voice: 'woman' }, aiResponse);

    const gather = response.gather({
      input: 'speech',
      action: '/voice',
      method: 'POST',
      language: 'ca-ES',
      timeout: 5
    });

    res.type('text/xml');
    return res.send(response.toString());
  } catch (err) {
    console.error('Error:', err);
    twilioResponse.say({ language: 'ca-ES', voice: 'woman' }, "Ho sento, hi ha hagut un problema tècnic.");
    res.type('text/xml');
    return res.send(twilioResponse.toString());
  }
});

app.get('/', (req, res) => {
  res.send('Verònica - Assistència telefònica intel·ligent està activa.');
});

app.listen(port, () => {
  console.log(`Servidor actiu al port ${port}`);
});
