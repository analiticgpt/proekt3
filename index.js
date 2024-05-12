require('dotenv').config();
const express = require('express');
const session = require('express-session');
const admin = require('firebase-admin');
const axios = require('axios');

const app = express();
const port = 3000;

// Firebase initialization
const serviceAccount = require('C:\\Projects\\keyfb\\openwax-2d20c-firebase-adminsdk-5c1i6-d997468957.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

app.use(express.json());
app.use(express.static('public'));
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

// Middleware for handling CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

async function askGPT3(question) {
  const messages = [{
    role: "system",
    content: "This is a legal advice session related to bankruptcy."
  }, {
    role: "user",
    content: question
  }];
  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: "gpt-3.5-turbo",
      messages: messages,
      max_tokens: 150
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      }
    });

    let answer = response.data.choices[0].message.content.trim();
    answer += "\n\n👉 For further assistance, please click on 'Invite a Lawyer'.";
    return answer;
  } catch (error) {
    console.error('Error requesting GPT-3:', error);
    return "Sorry, an error occurred. I can't provide an answer.";
  }
}

// Обработчик GET-запросов на маршрут '/send-message'
app.get('/send-message', (req, res) => {
  res.send('GET request to /send-message');
});

// Обработчик POST-запросов на маршрут '/send-message'
app.post('/send-message', async (req, res) => {
  if (!req.session.userID) {
    req.session.userID = Date.now().toString();
  }

  const { message } = req.body;
  try {
    const conversationRef = db.collection('conversations').doc(req.session.userID);
    let answer = await askGPT3(message);

    await conversationRef.set({
      messages: admin.firestore.FieldValue.arrayUnion({
        timestamp: new Date(),
        message: message,
        answer: answer
      })
    }, { merge: true });

    res.status(200).send({ userID: req.session.userID, result: answer });
  } catch (error) {
    console.error('Error adding message:', error);
    res.status(500).send({ error: 'Error adding message to Firestore' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
