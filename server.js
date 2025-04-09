require('dotenv').config({ path: './keys.env' });

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
const FormData = require('form-data');
const { OpenAI } = require('openai');
const session = require('express-session');
const multer = require('multer'); // Import multer

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));

app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Initialize multer (you can configure storage if needed)
const upload = multer();

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Use multer.none() to parse multipart/form-data without file uploads
app.post('/submit', upload.none(), async (req, res) => {
    const { name, birthdate, birthtime, City } = req.body;

    try {
        const form = new FormData();
        form.append('name', name);
        form.append('birthdate', birthdate);
        form.append('birthtime', birthtime);
        form.append('City', City);

        const apiResponse = await axios.post('https://kundli1.p.rapidapi.com/', form, {
            headers: {
                ...form.getHeaders(),
                'x-rapidapi-key': process.env.RAPIDAPI_KEY,
                'x-rapidapi-host': 'kundli1.p.rapidapi.com'
            }
        });

        const html = apiResponse.data;
        const $ = cheerio.load(html);

        // Store Kundli data in session (but don't send charts to frontend)
        req.session.kundliData = {
            text: $('body').text().replace(/\s+/g, ' ').trim().slice(0, 12000)
        };

        // Initial welcome message instead of analysis
        const welcomeMessage = "Your Kundli has been successfully generated. You can now ask me any questions about it!";

        // Initialize conversation history
        req.session.conversation = [
            {
                role: "system",
                content: `You are an expert astrologer analyzing the user's Kundli.
                Here's the Kundli data: ${req.session.kundliData.text}
                Be detailed and specific in your answers.`
            },
            { role: "assistant", content: welcomeMessage }
        ];

        res.json({
            success: true,
            message: welcomeMessage
        });

    } catch (error) {
        console.error(error.message);
        res.status(500).json({ error: "Error generating your Kundli." });
    }
});

app.post('/chat', async (req, res) => {
    try {
        if (!req.session.kundliData) {
            return res.status(400).json({ error: "Please generate a Kundli first." });
        }

        const { message } = req.body;

        req.session.conversation.push({ role: "user", content: message });

        const chatResponse = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: `You are an expert astrologer analyzing the user's Kundli. User does not understand much about all the planets. Just tell them what/when/why/how/who details (if any). Keep it crisp and engaging
                    Refer to this data when answering: ${req.session.kundliData.text}`
                },
                ...req.session.conversation.slice(-6) // Keep last 6 messages for context
            ]
        });

        const assistantReply = chatResponse.choices[0].message.content;
        req.session.conversation.push({ role: "assistant", content: assistantReply });

        res.json({ reply: assistantReply });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ error: "Error processing your message." });
    }
});

app.listen(3000, () => {
    console.log('Server running at http://localhost:3000');
});