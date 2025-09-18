// frontend/src/App.js
import React, { useState, useEffect, useRef } from 'react'; // Import useRef
import ReactMarkdown from 'react-markdown';
import './App.css'; // We'll create this for basic styling

const API_BASE_URL = '/api'; // Your backend API

function App() {
  const [candidateName, setCandidateName] = useState('');
  const [interviewId, setInterviewId] = useState(null);
  const [messages, setMessages] = useState([]); // { role: 'ai'/'candidate', text: '' }
  // const [inputMessage, setInputMessage] = useState(''); // No longer needed for spoken answers
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [viewingInterviews, setViewingInterviews] = useState(false);
  const [allInterviews, setAllInterviews] = useState([]);
  const [selectedInterview, setSelectedInterview] = useState(null);

  // --- Speech API State and Refs ---
  const [listening, setListening] = useState(false); // True when candidate's mic is active
  const [aiIsSpeaking, setAiIsSpeaking] = useState(false); // True when AI is speaking
  const recognitionRef = useRef(null); // Reference to SpeechRecognition object
  const utteranceQueueRef = useRef([]); // Queue for AI messages to speak
  const isSpeakingCurrentlyRef = useRef(false); // Internal flag to manage TTS flow

  // --- Helper to process the TTS queue ---
  const processSpeechQueue = () => {
    if (isSpeakingCurrentlyRef.current || utteranceQueueRef.current.length === 0) {
      return; // Already speaking or nothing to speak
    }

    isSpeakingCurrentlyRef.current = true;
    setAiIsSpeaking(true); // Update UI state

    const nextText = utteranceQueueRef.current.shift();
    const utterance = new SpeechSynthesisUtterance(nextText);
    utterance.lang = 'en-US'; // Set desired language

    utterance.onend = () => {
      isSpeakingCurrentlyRef.current = false;
      setAiIsSpeaking(false); // Update UI state
      if (utteranceQueueRef.current.length > 0) {
        processSpeechQueue(); // Speak the next message if available
      } else {
        // If AI has finished speaking its last message, and we are in an interview,
        // it's the candidate's turn to speak.
        if (interviewId && !feedback) { // Only enable listening if interview is active and no feedback is displayed
          startListening();
        }
      }
    };

    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      isSpeakingCurrentlyRef.current = false;
      setAiIsSpeaking(false);
      // Even on error, try to process the next item
      if (utteranceQueueRef.current.length > 0) {
        processSpeechQueue();
      } else {
        // Same logic as onend, but consider if listening should be enabled after an error
        if (interviewId && !feedback) {
          startListening();
        }
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  // --- Function to add text to the TTS queue ---
  const speakText = (text) => {
    utteranceQueueRef.current.push(text);
    processSpeechQueue(); // Attempt to process the queue
  };

  // --- Speech Recognition Setup useEffect ---
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false; // Listen for a single utterance
      recognition.interimResults = false; // Only get final results
      recognition.lang = 'en-US'; // Set language

      recognition.onstart = () => {
        setListening(true);
        setError(''); // Clear any previous errors when starting to listen
        console.log('Voice recognition started. Speak now.');
      };

      recognition.onresult = async (event) => {
        const transcript = Array.from(event.results)
          .map(result => result[0].transcript)
          .join('');
        console.log('You said:', transcript);

        // Send the transcribed answer to the backend
        // We'll rename sendAnswer to sendTextAnswer to be explicit
        if (transcript.trim()) { // Only send if something was transcribed
          await sendTextAnswer(transcript);
        } else {
          // If nothing was said or recognized, the AI might need to re-prompt
          setError("I didn't catch that. Could you please repeat?");
          // After displaying error, re-enable listening (or wait for user action)
          // For simplicity, let's just wait for user to click "Speak" again
          // For a real interview, you might want the AI to automatically re-prompt.
        }
      };

      recognition.onend = () => {
        setListening(false);
        console.log('Voice recognition ended.');
        // If AI isn't speaking and interview is active, re-enable listening
        // (This might be tricky if onresult already triggered next AI speech)
        // Better to let AI's onend handler trigger next listening phase.
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setListening(false);
        setError(`Speech recognition error: ${event.error}. Please try again.`);
      };

      recognitionRef.current = recognition; // Store the recognition object
    } else {
      setError('Web Speech API is not supported in this browser. Please use Chrome, Edge, or Firefox.');
      console.warn('Web Speech API is not supported in this browser.');
    }

    // Cleanup function for useEffect
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [interviewId, feedback]); // Re-run if interviewId or feedback changes to potentially enable listening

  // --- Start Listening Function ---
  const startListening = () => {
    if (recognitionRef.current && !listening && !isLoading && !aiIsSpeaking) {
      setError(''); // Clear previous errors
      recognitionRef.current.start();
    } else if (!recognitionRef.current) {
      setError('Speech recognition not available.');
    }
  };

  // --- Interviewer/Candidate View ---
  const startInterview = async () => {
    setError('');
    setIsLoading(true);
    setMessages([]);
    setFeedback(null);
    utteranceQueueRef.current = []; // Clear queue for new interview
    isSpeakingCurrentlyRef.current = false;
    if (window.speechSynthesis) window.speechSynthesis.cancel(); // Stop any ongoing speech

    try {
      const response = await fetch(`${API_BASE_URL}/interview/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateName }),
      });
      const data = await response.json();
      if (response.ok) {
        setInterviewId(data.interviewId);
        setMessages([{ role: 'ai', text: data.firstQuestion }]);
        setIsLoading(false); // Stop loading before AI speaks

        // AI speaks the first question
        speakText(data.firstQuestion);

      } else {
        setError(data.error || 'Failed to start interview.');
        setIsLoading(false);
      }
    } catch (err) {
      setError('Network error or server unavailable.');
      console.error(err);
      setIsLoading(false);
    }
  };

  // Renamed to explicitly show it sends text
  const sendTextAnswer = async (answerText) => {
    if (!answerText.trim() || !interviewId) return;

    // Add candidate's spoken answer to messages
    const newMessages = [...messages, { role: 'candidate', text: answerText }];
    setMessages(newMessages);
    // setInputMessage(''); // No longer needed
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/interview/${interviewId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer: answerText }), // Send the transcribed text
      });
      const data = await response.json();
      if (response.ok) {
        setMessages(prev => [...prev, { role: 'ai', text: data.nextQuestion }]);
        setIsLoading(false); // Stop loading before AI speaks

        // AI speaks the next question
        speakText(data.nextQuestion);

      } else {
        setError(data.error || 'Failed to send answer.');
        setIsLoading(false);
      }
    } catch (err) {
      setError('Network error or server unavailable.');
      console.error(err);
      setIsLoading(false);
    }
  };

  const endInterview = async () => {
    if (!interviewId) return;
    setIsLoading(true);
    setError('');
    utteranceQueueRef.current = []; // Clear queue
    isSpeakingCurrentlyRef.current = false;
    if (window.speechSynthesis) window.speechSynthesis.cancel(); // Stop any ongoing speech

    try {
      const response = await fetch(`${API_BASE_URL}/interview/${interviewId}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      if (response.ok) {
        setFeedback(data.feedback);
        setInterviewId(null); // End session
        setIsLoading(false);

        // Optional: AI says a farewell message
        speakText("Thank you for completing the interview. Your feedback has been generated.");

      } else {
        setError(data.error || 'Failed to end interview.');
        setIsLoading(false);
      }
    } catch (err) {
      setError('Network error or server unavailable.');
      console.error(err);
      setIsLoading(false);
    }
  };

  // --- Recruiter View (No changes needed for speech here) ---
  const fetchAllInterviews = async () => {
    setError('');
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/interviews`);
      const data = await response.json();
      if (response.ok) {
        setAllInterviews(data);
      } else {
        setError(data.error || 'Failed to fetch interviews.');
      }
    } catch (err) {
      setError('Network error or server unavailable.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const viewInterviewDetails = async (id) => {
    setError('');
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/interview/${id}`);
      const data = await response.json();
      if (response.ok) {
        setSelectedInterview(data);
        setViewingInterviews(true); // Ensure we're in viewing mode
      } else {
        setError(data.error || 'Failed to fetch interview details.');
      }
    } catch (err) {
      setError('Network error or server unavailable.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (viewingInterviews) {
      fetchAllInterviews();
    }
  }, [viewingInterviews]);

  return (
    <div className="App">
      <h1>AI Excel Interviewer</h1>

      {error && <div className="error">{error}</div>}
      {isLoading && <div className="loading">Loading...</div>}

      <div className="nav-buttons">
        <button onClick={() => {
            setViewingInterviews(false);
            setSelectedInterview(null);
            setFeedback(null);
            utteranceQueueRef.current = []; // Clear queue
            isSpeakingCurrentlyRef.current = false;
            if (window.speechSynthesis) window.speechSynthesis.cancel(); // Stop any ongoing speech
            if (recognitionRef.current) recognitionRef.current.stop(); // Stop listening
            setListening(false);
        }}>
          {interviewId ? "Interview In Progress" : "Candidate Interview"}
        </button>
        <button onClick={() => {
            setViewingInterviews(true);
            setSelectedInterview(null);
            setFeedback(null);
            utteranceQueueRef.current = []; // Clear queue
            isSpeakingCurrentlyRef.current = false;
            if (window.speechSynthesis) window.speechSynthesis.cancel(); // Stop any ongoing speech
            if (recognitionRef.current) recognitionRef.current.stop(); // Stop listening
            setListening(false);
        }}>
          Recruiter Dashboard
        </button>
      </div>

      {viewingInterviews ? (
        <div className="recruiter-dashboard">
          <h2>Recruiter Dashboard</h2>
          {!selectedInterview ? (
            <div>
              <h3>All Interviews</h3>
              {allInterviews.length === 0 && !isLoading ? (
                <p>No interviews conducted yet.</p>
              ) : (
                <ul>
                  {allInterviews.map(int => (
                    <li key={int.id}>
                      {int.candidateName} - {new Date(int.startTime).toLocaleString()} - Status: {int.status}
                      <button onClick={() => viewInterviewDetails(int.id)}>View Details</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="interview-details">
              <h3>Interview Details for {selectedInterview.candidateName}</h3>
              <p>Status: {selectedInterview.status}</p>
              <p>Start Time: {new Date(selectedInterview.startTime).toLocaleString()}</p>
              {selectedInterview.endTime && (
                <p>End Time: {new Date(selectedInterview.endTime).toLocaleString()}</p>
              )}

              <h4>Transcript:</h4>
              <div className="chat-window">
                {selectedInterview.transcript.map((msg, index) => (
                  <div key={index} className={`message ${msg.role}`}>
                    <strong>{msg.role === 'ai' ? 'Interviewer' : 'Candidate'}:</strong> {msg.text}
                  </div>
                ))}
              </div>

              {selectedInterview.feedback && (
                <>
                  <h4>Feedback:</h4>
                  <div className="feedback-display">
                    <ReactMarkdown>{selectedInterview.feedback}</ReactMarkdown>
                  </div>
                </>
              )}
              <button onClick={() => setSelectedInterview(null)}>Back to All Interviews</button>
            </div>
          )}
        </div>
      ) : (
        <div className="candidate-interview">
          {interviewId ? (
            <div className="chat-container">
              <div className="chat-window">
                {messages.map((msg, index) => (
                  <div key={index} className={`message ${msg.role}`}>
                    <strong>{msg.role === 'ai' ? 'Interviewer' : 'You'}:</strong> {msg.text}
                  </div>
                ))}
                {/* Visual feedback for speech */}
                {aiIsSpeaking && <div className="status-message ai-speaking">Interviewer is speaking...</div>}
                {listening && <div className="status-message candidate-listening">Listening for your answer...</div>}
                {isLoading && <div className="status-message loading">AI is thinking...</div>}
              </div>
              <div className="chat-input">
                {/* Replaced text input with a Speak button */}
                <button
                  onClick={startListening}
                  disabled={isLoading || listening || aiIsSpeaking || !recognitionRef.current}
                >
                  {listening ? 'Listening...' : 'Speak Your Answer'}
                </button>
                <button onClick={endInterview} disabled={isLoading || listening || aiIsSpeaking}>
                  End Interview & Get Feedback
                </button>
              </div>
            </div>
          ) : (
            <>
              {feedback ? (
                <div className="feedback-display">
                  <h2>Interview Feedback</h2>
                  <ReactMarkdown>{feedback}</ReactMarkdown>
                  <button onClick={() => setFeedback(null)}>Start New Interview</button>
                </div>
              ) : (
                <div className="start-screen">
                  <h2>Welcome!</h2>
                  <p>Enter your name to start the Excel assessment.</p>
                  <input
                    type="text"
                    value={candidateName}
                    onChange={(e) => setCandidateName(e.target.value)}
                    placeholder="Your Name"
                  />
                  <button onClick={startInterview} disabled={isLoading || !candidateName.trim()}>
                    Start Interview
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default App;