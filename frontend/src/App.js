import React, { useState, useEffect } from "react";
import axios from "axios";
import "./App.css";

function formatAnswer(text) {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    const trimmed = line.trim();
    const withBold = trimmed.split(/(\*\*[^*]+\*\*)/g).map((part, j) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={j}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });

    if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
      return <li key={i}>{withBold}</li>;
    }
    if (trimmed === "") {
      return null;
    }
    return <p key={i}>{withBold}</p>;
  });
}

function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");
  const [uploading, setUploading] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.body.setAttribute("data-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setFileName(e.target.files[0]?.name || "");
    setUploadStatus("");
  };

  const handleUpload = async () => {
    if (!file) {
      setUploadStatus("error:Please choose a PDF file first");
      return;
    }
    const formData = new FormData();
    formData.append("file", file);

    setUploading(true);
    setUploadStatus("");
    try {
      const res = await axios.post("http://127.0.0.1:8000/upload", formData);
      setUploadStatus(`success:PDF processed — ${res.data.chunks} chunks indexed`);
    } catch (err) {
      setUploadStatus("error:Upload failed. Please check the file and try again.");
    }
    setUploading(false);
  };

  const handleAsk = async () => {
    if (!question.trim()) return;
    setLoading(true);
    setAnswer("");
    setSources([]);
    try {
      const res = await axios.post(
        `http://127.0.0.1:8000/ask?question=${encodeURIComponent(question)}`
      );
      setAnswer(res.data.answer);
      setSources(res.data.sources || []);
    } catch (err) {
      setAnswer("Something went wrong. Please make sure a PDF is uploaded first.");
    }
    setLoading(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") handleAsk();
  };

  const isSuccess = uploadStatus.startsWith("success:");
  const isError = uploadStatus.startsWith("error:");
  const statusText = uploadStatus.split(":")[1];

  return (
    <div className="page">
      <div className="container">
        <header className="header">
          <div className="header-left">
            <div className="logo-badge">AI</div>
            <div>
              <h1>Study Assistant</h1>
              <p className="subtitle">Ask questions about any PDF using AI-powered retrieval</p>
            </div>
          </div>
          <button className="theme-toggle" onClick={() => setDarkMode(!darkMode)}>
            {darkMode ? "☀️ Light" : "🌙 Dark"}
          </button>
        </header>

        <section className="card">
          <div className="card-title">
            <span className="step-number">1</span>
            <h2>Upload your document</h2>
          </div>

          <div className="upload-row">
            <label className="file-picker">
              <input type="file" accept="application/pdf" onChange={handleFileChange} hidden />
              {fileName ? fileName : "Choose PDF file"}
            </label>
            <button className="btn primary" onClick={handleUpload} disabled={uploading}>
              {uploading ? "Uploading..." : "Upload"}
            </button>
          </div>

          {uploadStatus && (
            <div className={`status ${isSuccess ? "status-success" : ""} ${isError ? "status-error" : ""}`}>
              {statusText}
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-title">
            <span className="step-number">2</span>
            <h2>Ask a question</h2>
          </div>

          <div className="ask-row">
            <input
              type="text"
              className="question-input"
              placeholder="e.g. Summarize the key points of this document"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyPress={handleKeyPress}
            />
            <button className="btn primary" onClick={handleAsk} disabled={loading}>
              {loading ? "Thinking..." : "Ask"}
            </button>
          </div>

          {loading && (
            <div className="loading-box">
              <div className="spinner"></div>
              <span>Generating answer...</span>
            </div>
          )}

          {answer && !loading && (
            <div className="answer-box">
              <div className="answer-label">Answer</div>
              <div className="answer-content">{formatAnswer(answer)}</div>

              {sources.length > 0 && (
                <details className="sources">
                  <summary>View source excerpts ({sources.length})</summary>
                  {sources.map((s, i) => (
                    <div key={i} className="source-chunk">
                      {s}
                    </div>
                  ))}
                </details>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default App;
