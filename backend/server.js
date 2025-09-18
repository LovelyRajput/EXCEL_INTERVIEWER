// backend/server.js
require('dotenv').config();
const express = require('express');
const { LowSync } = require('lowdb');
const { JSONFileSync } = require('lowdb/node');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const port = process.env.PORT || 3001;

// --- lowdb Database Setup ---
const adapter = new JSONFileSync('db.json');
const db = new LowSync(adapter, { interviews: [] });
db.read();
db.write();

// --- Middleware ---
app.use(express.json());

const axios = require('axios');

async function generateContent(prompt, history = []) {
    try {
        const messages = [];

        // Reconstruct chat history for OpenRouter
        for (const entry of history) {
            if (entry.role === 'user' || entry.role === 'model') {
                messages.push({
                    role: entry.role === 'user' ? 'user' : 'assistant',
                    content: entry.parts[0].text
                });
            }
        }

        // Add latest prompt
        messages.push({
            role: 'user',
            content: prompt
        });

        const response = await axios.post(
            'https://openrouter.ai/api/v1/chat/completions',
            {
                model: 'google/gemini-2.0-flash-exp:free', // ✅ Updated model ID
                messages: messages,
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`, // ✅ API key from .env
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'http://localhost:3000', // ✅ Required by OpenRouter
                    'X-Title': 'AI Excel Interviewer'        // ✅ Optional but good for tracking
                }
            }
        );

        return response.data.choices[0].message.content;
    } catch (error) {
        console.error('OpenRouter API error:', error.response?.data || error.message);
        throw new Error('Failed to get response from OpenRouter Gemini model.');
    }
}


// --- API Routes ---

// 1. Start a New Interview (Returns text)
app.post('/api/interview/start', async (req, res) => {
    const { candidateName } = req.body;
    if (!candidateName) {
        return res.status(400).json({ error: "Candidate name is required." });
    }

    const interviewId = uuidv4();
    const newInterview = {
        id: interviewId,
        candidateName,
        startTime: new Date(),
        status: 'in-progress',
        transcript: [],
        feedback: null,
        geminiHistory: [],
    };

    db.data.interviews.push(newInterview);
    db.write();

    try {
        const initialPrompt = `You are an AI Excel interviewer. Your task is to assess a candidate's Excel skills through a conversation. Start by greeting the candidate and asking your first conceptual or practical Excel question. Focus on one question at a time. Keep your questions clear and concise. Do not provide answers yet. The candidate's name is ${candidateName}. End the interview after 5-6 questions by greeting them properly.Make sure to ask different questions each time the interview starts.`;
        const geminiResponseText = await generateContent(initialPrompt);

        newInterview.transcript.push({ role: 'ai', text: geminiResponseText });
        newInterview.geminiHistory.push({ role: 'user', parts: [{ text: initialPrompt }] });
        newInterview.geminiHistory.push({ role: 'model', parts: [{ text: geminiResponseText }] });
        db.write();

        // Send the text response for the frontend to speak
        res.status(201).json({
            interviewId: interviewId,
            firstQuestion: geminiResponseText,
        });
    } catch (error) {
        console.error("Error starting interview:", error);
        res.status(500).json({ error: error.message });
    }
});

// 2. Submit Candidate Answer (Text) & Get Next Question (Text)
app.post('/api/interview/:id/answer', async (req, res) => {
    const { id } = req.params;
    // Expecting text answer from frontend now
    const { answer } = req.body;

    if (!answer) {
        return res.status(400).json({ error: "Answer is required." });
    }

    const interview = db.data.interviews.find(i => i.id === id);
    if (!interview || interview.status !== 'in-progress') {
        return res.status(404).json({ error: "Interview not found or already ended." });
    }

    interview.transcript.push({ role: 'candidate', text: answer });

    try {
        const interviewPrompt = `The candidate's previous answer was: "${answer}". Based on this, please evaluate their understanding and then ask the *next* Excel-related question. If their answer was insufficient, you can ask a follow-up or a clarifying question. Keep the interview moving towards assessing various Excel skills (formulas, functions, data manipulation, pivot tables, VLOOKUP, etc.). Do not provide the answer.`;

        interview.geminiHistory.push({ role: 'user', parts: [{ text: interviewPrompt }] });
        const geminiResponseText = await generateContent(interviewPrompt, interview.geminiHistory);

        interview.transcript.push({ role: 'ai', text: geminiResponseText });
        interview.geminiHistory.push({ role: 'model', parts: [{ text: geminiResponseText }] });
        db.write();

        // Send the text response for the frontend to speak
        res.json({ nextQuestion: geminiResponseText });
    } catch (error) {
        console.error("Error processing answer:", error);
        res.status(500).json({ error: error.message });
    }
});

// 3. End Interview and Get Feedback (Returns text)
app.post('/api/interview/:id/end', async (req, res) => {
    const { id } = req.params;

    const interview = db.data.interviews.find(i => i.id === id);
    if (!interview || interview.status !== 'in-progress') {
        return res.status(404).json({ error: "Interview not found or already ended." });
    }

    interview.status = 'completed';
    interview.endTime = new Date();

    try {
        const fullTranscript = interview.transcript.map(msg =>
            `${msg.role === 'ai' ? 'Interviewer' : 'Candidate'}: ${msg.text}`
        ).join('\n\n');

        const feedbackPrompt = `The following is an Excel interview transcript with ${interview.candidateName}:\n\n${fullTranscript}\n\nPlease analyze this transcript thoroughly and provide detailed feedback on the candidate's Excel skills. Cover strengths, weaknesses, specific areas for improvement, and an overall assessment. Structure the feedback clearly with headings. Provide constructive advice.`;

        const feedback = await generateContent(feedbackPrompt);

        interview.feedback = feedback;
        db.write();

        res.json({ message: "Interview ended and feedback generated.", feedback: feedback });
    } catch (error) {
        console.error("Error ending interview and generating feedback:", error);
        res.status(500).json({ error: error.message });
    }
});

// 4. Get All Interviews (No change)
app.get('/api/interviews', (req, res) => {
    res.json(db.data.interviews);
});

// 5. Get Single Interview Details (No change)
app.get('/api/interview/:id', (req, res) => {
    const { id } = req.params;
    const interview = db.data.interviews.find(i => i.id === id);
    if (!interview) {
        return res.status(404).json({ error: "Interview not found." });
    }
    res.json(interview);
});

// --- Serve React Frontend Static Files ---
const frontendBuildPath = path.join(__dirname, '..', 'frontend', 'build');
app.use(express.static(frontendBuildPath));

// Catch-all: Only serve React frontend for non-API routes
app.get('/*', (req, res) => {
    if (req.path.startsWith('/api')) {
        res.status(404).json({ error: 'API route not found' });
    } else {
        res.sendFile(path.join(frontendBuildPath, 'index.html'));
    }
});

// --- Start Server ---
app.listen(port, () => {
    console.log(`Backend server running at http://localhost:${port}`);
});