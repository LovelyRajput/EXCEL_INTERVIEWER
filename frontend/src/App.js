// frontend/src/App.js
import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import './App.css'; // We'll create this for basic styling

const API_BASE_URL = 'http://localhost:3001/api'; // Your backend API

function App() {
  const [candidateName, setCandidateName] = useState('');
  const [interviewId, setInterviewId] = useState(null);
  const [messages, setMessages] = useState([]); // { role: 'ai'/'candidate', text: '' }
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [viewingInterviews, setViewingInterviews] = useState(false);
  const [allInterviews, setAllInterviews] = useState([]);
  const [selectedInterview, setSelectedInterview] = useState(null); // For viewing detailed feedback

  // --- Interviewer/Candidate View ---
  const startInterview = async () => {
    setError('');
    setIsLoading(true);
    setMessages([]);
    setFeedback(null);
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
      } else {
        setError(data.error || 'Failed to start interview.');
      }
    } catch (err) {
      setError('Network error or server unavailable.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const sendAnswer = async () => {
    if (!inputMessage.trim() || !interviewId) return;

    const newMessages = [...messages, { role: 'candidate', text: inputMessage }];
    setMessages(newMessages);
    setInputMessage('');
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/interview/${interviewId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer: inputMessage }),
      });
      const data = await response.json();
      if (response.ok) {
        setMessages(prev => [...prev, { role: 'ai', text: data.nextQuestion }]);
      } else {
        setError(data.error || 'Failed to send answer.');
      }
    } catch (err) {
      setError('Network error or server unavailable.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const endInterview = async () => {
    if (!interviewId) return;
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/interview/${interviewId}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      if (response.ok) {
        setFeedback(data.feedback);
        setInterviewId(null); // End session
      } else {
        setError(data.error || 'Failed to end interview.');
      }
    } catch (err) {
      setError('Network error or server unavailable.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Recruiter View ---
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
        <button onClick={() => { setViewingInterviews(false); setSelectedInterview(null); setFeedback(null); }}>
          {interviewId ? "Interview In Progress" : "Candidate Interview"}
        </button>
        <button onClick={() => { setViewingInterviews(true); setSelectedInterview(null); setFeedback(null); }}>
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
                {isLoading && <div className="loading">AI is thinking...</div>}
              </div>
              <div className="chat-input">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendAnswer()}
                  placeholder="Type your answer..."
                  disabled={isLoading}
                />
                <button onClick={sendAnswer} disabled={isLoading || !inputMessage.trim()}>
                  Send
                </button>
                <button onClick={endInterview} disabled={isLoading}>
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