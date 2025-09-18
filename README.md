## 🚀 Project Overview

The AI Excel Interviewer is an automated, conversational system designed to assess a candidate's Excel proficiency. Leveraging the advanced capabilities of Google Gemini 1.5 Pro, this application simulates a real-world interview experience, asking targeted questions, intelligently evaluating responses, and providing a detailed performance feedback report. This tool aims to streamline the recruitment process for roles requiring strong Excel skills, offering a consistent, scalable, and objective assessment method.

## ✨ Features

*   **Structured Interview Flow:** Conducts multi-turn conversations, introducing itself, explaining the process, asking a series of progressively challenging Excel questions, and providing a conclusion.
*   **Intelligent Answer Evaluation:** Utilizes Gemini 1.5 Pro to understand and evaluate candidate responses based on correctness, depth of knowledge, and practical application.
*   **Agentic Behavior & State Management:** The AI interviewer maintains context throughout the conversation, ensuring a coherent and adaptive interview experience.
*   **Constructive Feedback Report:** Generates a comprehensive, markdown-formatted performance summary at the end of each interview, detailing strengths, weaknesses, areas for improvement, and an overall assessment.
*   **Candidate Interview View:** An intuitive chat-like interface for candidates to interact with the AI.
*   **Recruiter Dashboard:** A dedicated view for recruiters to manage and review all conducted interviews, including full transcripts and detailed feedback reports.
*   **Professional Dark Theme:** A sleek, modern dark UI with an Excel-green accent, gradients, and subtle hover animations for an enhanced user experience.

## 🛠️ Technologies Used

**Frontend:**
*   **React.js:** A JavaScript library for building user interfaces.
*   **HTML5 & CSS3:** For structuring and styling the web content (with a custom dark/gradient theme).
*   **JavaScript (ES6+):** Programming language.
*   **`react-markdown`:** For rendering markdown content in the feedback reports.
*   **`npm`:** Package manager.

**Backend:**
*   **Node.js:** JavaScript runtime environment.
*   **Express.js:** Web application framework for Node.js, used to build the REST API.
*   **google/gemini-2.0-flash-exp:free:** The Large Language Model (LLM) powering the AI interviewer's intelligence.
*   **`OpenRouter`:**Unified API gateway to access Gemini and other LLMs..
*   **`dotenv`:** To manage environment variables (like your API key) securely.
*   **`cors`:** Middleware to enable Cross-Origin Resource Sharing.
*   **`lowdb`:** A lightweight, local JSON database for simple data persistence (for MVP).
*   **`uuid`:** For generating unique interview IDs.
*   **`npm`:** Package manager.

**Development Tools:**
*   **Git:** Version control system.
*   **Visual Studio Code (VS Code):** Recommended code editor.

## 🚀 Getting Started

Follow these steps to set up and run the AI Excel Interviewer locally on your machine.

### Prerequisites

Before you begin, ensure you have the following installed:

*   **Node.js (LTS version recommended) & npm:** Download from [nodejs.org](https://nodejs.org/).
*   **A Google Gemini 1.5 Pro API Key:**
    1.  Go to OpenRouter.ai.
    2.  Sign in using your Google, GitHub, or email account.
    3.  Visit the API Keys page once logged in.
    4.  Click on "Create API Key" and copy the generated key.
    5.  Add this key to your backend .env file like this:
       ```bash
       OPENROUTER_API_KEY=your_openrouter_api_key_here
       ```
    7.  **Keep this API key secret! Never expose it in your frontend code.**

### 1. Clone the Repository

```bash
git clone https://github.com/LovelyRajput/ai-excel-interviewer.git
cd ai-excel-interviewer
```
### 2. Backend Setup (Node.js)

The backend server handles all communication with the Google Gemini API and manages interview data.

1.  **Navigate to the `backend` directory:**
    ```bash
    cd backend
    ```

2.  **Install backend dependencies:**
    ```bash
    npm install
    ```

3.  **Create a `.env` file:**
    In the `backend` directory, create a file named `.env` and add your Gemini API key:
    ```
    OPEN_ROUTER_KEY =YOUR_OPEN_ROUTER_API_KEY_HERE
    ```
    Replace `YOUR_OPEN_ROUTER_API_KEY_HERE` with the actual API key you obtained from OPENROUTER.

4.  **Start the backend server:**
    ```bash
    node server.js
    ```
    You should see a message indicating the backend server is running, typically at `http://localhost:3001`. Keep this terminal window open.

    *   **Troubleshooting:**
        *   If you encounter a `429 Too Many Requests` error, your Gemini API free tier quota might be exceeded. Wait a few minutes/hours (or until the next day) and try again.
        *   If you see an "API key not valid" error, double-check your `.env` file and regenerate your API key if necessary.
5. **Required Packages for OpenRouter Integration:**
   1. axios – For making HTTP requests to OpenRouter's API:
      ```bash
      npm install axios
      ```
   2. dotenv – To load your OpenRouter API key securely from the .env file:
      ```bash
      npm install dotenv
      ```
### 3. Frontend Setup (React.js)

The frontend is the user interface where candidates take interviews and recruiters view results.

1.  **Open a new terminal window** (keep the backend running in the first one).
2.  **Navigate to the `frontend` directory:**
    ```bash
    cd ../frontend
    ```

3.  **Install frontend dependencies:**
    ```bash
    npm install
    ```

4.  **Start the React development server:**
    ```bash
    npm start
    ```
    This will open the application in your web browser, usually at `http://localhost:3000`. If it doesn't open automatically, navigate to this URL manually.

## 📈 Future Enhancements

*   **Adaptive Interview Logic:** Implement dynamic difficulty scaling and skill-tree based questioning.
*   **Interactive Excel Environment:** Integrate a sandbox environment for practical task evaluation.
*   **Voice Input/Output:** Add speech-to-text and text-to-speech for an enhanced experience.
*   **Authentication & Authorization:** Secure recruiter dashboard with user login.
*   **Database Migration:** Move from `lowdb` to a production-grade database (e.g., PostgreSQL, MongoDB).
*   **Comprehensive Analytics:** Provide detailed analytics and trends for recruiters.
*   **Multi-language Support:** Offer interviews in various languages.
