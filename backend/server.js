// backend/server.js
require('dotenv').config();
const express = require('express');
// Removed `cors` here, as it's typically not needed when the backend serves the frontend (same origin)
// If you still encounter CORS errors for other external API calls, you might re-add it with specific origins.
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { LowSync } = require('lowdb');
const { JSONFileSync } = require('lowdb/node');
const { v4: uuidv4 } = require('uuid'); // For generating unique interview IDs
const path = require('path'); // <<< ADDED: Import the path module

const app = express();
// Use process.env.PORT for deployment, fallback to 3001 for local development
const port = process.env.PORT || 3001; 

// --- lowdb Database Setup ---
const adapter = new JSONFileSync('db.json');
const db = new LowSync(adapter, { interviews: [] });
db.read();
db.write();

// --- Gemini API Setup ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" }); // Specify Gemini 1.5 Pro

// --- Middleware ---
app.use(express.json()); // To parse JSON request bodies

// --- Helper for Gemini Interaction ---
async function generateContent(prompt, history = []) {
    try {
        const chat = model.startChat({
            history: history,
            generationConfig: {
                maxOutputTokens: 500, // Limit response length
            },
        });
        const result = await chat.sendMessage(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("Error calling Gemini API:", error);
        throw new Error("Failed to get response from AI model.");
    }
}

// --- API Routes ---
// These routes should be placed BEFORE the static file serving and catch-all route

// 1. Start a New Interview
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
        transcript: [], // Stores conversation history
        feedback: null,
        geminiHistory: [], // Stores Gemini's internal chat history format
    };

    db.data.interviews.push(newInterview);
    db.write();

    try {
        const initialPrompt = `You are an AI Excel interviewer. Your task is to assess a candidate's Excel skills through a conversation. Start by greeting the candidate and asking your first conceptual or practical Excel question. Focus on one question at a time. Keep your questions clear and concise. Do not provide answers yet. The candidate's name is ${candidateName}. end the innterview after 5-6 questions by greeting them properly`;
        const geminiResponse = await generateContent(initialPrompt);

        // Store the initial AI message in the transcript and Gemini's history
        newInterview.transcript.push({ role: 'ai', text: geminiResponse });
        newInterview.geminiHistory.push({ role: 'user', parts: [{ text: initialPrompt }] }); // The user prompt for Gemini
        newInterview.geminiHistory.push({ role: 'model', parts: [{ text: geminiResponse }] }); // Gemini's response
        db.write();

        res.status(201).json({
            interviewId: interviewId,
            firstQuestion: geminiResponse,
        });
    } catch (error) {
        console.error("Error starting interview:", error);
        res.status(500).json({ error: error.message });
    }
});

// 2. Submit Candidate Answer & Get Next Question
app.post('/api/interview/:id/answer', async (req, res) => {
    const { id } = req.params;
    const { answer } = req.body;

    if (!answer) {
        return res.status(400).json({ error: "Answer is required." });
    }

    const interview = db.data.interviews.find(i => i.id === id);
    if (!interview || interview.status !== 'in-progress') {
        return res.status(404).json({ error: "Interview not found or already ended." });
    }

    // Add candidate's answer to transcript
    interview.transcript.push({ role: 'candidate', text: answer });

    try {
        // Build the prompt for Gemini to evaluate and ask the next question
        const interviewPrompt = `The candidate's previous answer was: "${answer}". Based on this, please evaluate their understanding and then ask the *next* Excel-related question. If their answer was insufficient, you can ask a follow-up or a clarifying question. Keep the interview moving towards assessing various Excel skills (formulas, functions, data manipulation, pivot tables, VLOOKUP, etc.). Do not provide the answer.`;

        // Send the updated history to Gemini to maintain context
        interview.geminiHistory.push({ role: 'user', parts: [{ text: interviewPrompt }] });
        const geminiResponse = await generateContent(interviewPrompt, interview.geminiHistory);

        // Add Gemini's response to transcript and history
        interview.transcript.push({ role: 'ai', text: geminiResponse });
        interview.geminiHistory.push({ role: 'model', parts: [{ text: geminiResponse }] });
        db.write();

        res.json({ nextQuestion: geminiResponse });
    } catch (error) {
        console.error("Error processing answer:", error);
        res.status(500).json({ error: error.message });
    }
});

// 3. End Interview and Get Feedback
app.post('/api/interview/:id/end', async (req, res) => {
    const { id } = req.params;

    const interview = db.data.interviews.find(i => i.id === id);
    if (!interview || interview.status !== 'in-progress') {
        return res.status(404).json({ error: "Interview not found or already ended." });
    }

    interview.status = 'completed';
    interview.endTime = new Date();

    try {
        // Compile the full transcript for feedback generation
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

// 4. Get All Interviews (for recruiter view)
app.get('/api/interviews', (req, res) => {
    res.json(db.data.interviews);
});

// 5. Get Single Interview Details (for recruiter to view feedback)
app.get('/api/interview/:id', (req, res) => {
    const { id } = req.params;
    const interview = db.data.interviews.find(i => i.id === id);
    if (!interview) {
        return res.status(404).json({ error: "Interview not found." });
    }
    res.json(interview);
});


// --- Serve React Frontend Static Files (CRUCIAL MODIFICATION) ---
// This assumes your backend folder is at the same level as your frontend folder
// and that the 'build' output is inside the 'frontend' folder.
// __dirname is the directory of the current script (backend/server.js)
// '..' goes up one level to the project root (ai-excel-interviewer/)
// 'frontend' then points to the frontend folder
// 'build' points to the compiled React app
const frontendBuildPath = path.join(__dirname, '..', 'frontend', 'build');
app.use(express.static(frontendBuildPath)); // <<< ADDED: Middleware to serve static files

// --- Catch-all for React Router (CRUCIAL MODIFICATION - PLACED LAST) ---
// For any request that isn't one of your API routes, serve the React app's index.html
// This is vital for React Router to work when refreshing sub-paths.
app.get('*', (req, res) => {
    res.sendFile(path.join(frontendBuildPath, 'index.html'));
});


// Start the server
app.listen(port, () => {
    console.log(`Backend server running at http://localhost:${port}`);
});