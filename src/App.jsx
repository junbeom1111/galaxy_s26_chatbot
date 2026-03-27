import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./App.css";

function App() {
  const [conversations, setConversations] = useState([
    {
      id: 1,
      title: "새 상담",
      preview: "제품 관련 질문을 시작해보세요.",
      timestamp: "방금 전",
      messages: [
        {
          role: "assistant",
          text: "안녕하세요. **Galaxy S26 제품 상담 챗봇**입니다.\n\n궁금한 점을 입력하면 PDF 설명서와 MD, json 비교 문서를 바탕으로 답변해드릴게요.",
        },
      ],
      sources: [],
    },
  ]);

  const [activeConversationId, setActiveConversationId] = useState(1);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [topK, setTopK] = useState(4);
  const [historyQuery, setHistoryQuery] = useState("");
  const [openSources, setOpenSources] = useState({});
  const [selectedSourceText, setSelectedSourceText] = useState("");

  const messagesEndRef = useRef(null);

  const starterQuestions = [
    "S26과 S26+의 차이가 뭐야?",
    "물이 묻었을 때 어떻게 해야 해?",
    "배터리 관련 기능 설명해줘",
    "UWB 지원 여부 알려줘",
  ];

  const activeConversation =
    conversations.find((c) => c.id === activeConversationId) || conversations[0];

  const filteredConversations = useMemo(() => {
    const q = historyQuery.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.preview.toLowerCase().includes(q)
    );
  }, [conversations, historyQuery]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [activeConversation.messages, loading]);

  const createNewConversation = () => {
    const newId = Date.now();
    const newConversation = {
      id: newId,
      title: "새 상담",
      preview: "제품 관련 질문을 시작해보세요.",
      timestamp: "방금 전",
      messages: [
        {
          role: "assistant",
          text: "안녕하세요. **Galaxy S26 제품 상담 챗봇**입니다.\n\n궁금한 점을 입력하면 PDF 설명서와 MD, json 비교 문서를 바탕으로 답변해드릴게요.",
        },
      ],
      sources: [],
    };

    setConversations((prev) => [newConversation, ...prev]);
    setActiveConversationId(newId);
    setInput("");
    setOpenSources({});
    setSelectedSourceText("");
  };

  const updateConversation = (conversationId, updater) => {
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === conversationId ? updater(conv) : conv
      )
    );
  };

  const handleSend = async (questionFromButton = null) => {
    const question = (questionFromButton ?? input).trim();
    if (!question || loading) return;

    const currentId = activeConversationId;

    updateConversation(currentId, (conv) => ({
      ...conv,
      title: conv.title === "새 상담" ? question.slice(0, 18) : conv.title,
      preview: question,
      timestamp: "방금 전",
      messages: [...conv.messages, { role: "user", text: question }],
    }));

    setInput("");
    setLoading(true);
    setOpenSources({});
    setSelectedSourceText("");

    try {
      const API_BASE = import.meta.env.VITE_API_BASE_URL;
      const res = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question,
          top_k: topK,
        }),
      });

      if (!res.ok) {
        throw new Error("백엔드 응답 오류");
      }

      const data = await res.json();

      updateConversation(currentId, (conv) => ({
        ...conv,
        messages: [...conv.messages, { role: "assistant", text: data.answer }],
        sources: data.sources || [],
      }));
    } catch (error) {
      updateConversation(currentId, (conv) => ({
        ...conv,
        messages: [
          ...conv.messages,
          {
            role: "assistant",
            text:
              "오류가 발생했습니다.\n\n- FastAPI 서버 실행 여부\n- Ollama 실행 여부\n- Chroma DB 연결 상태\n\n를 확인해 주세요.",
          },
        ],
        sources: [],
      }));
    } finally {
      setLoading(false);
    }
  };

  const toggleSource = (sourceKey) => {
    setOpenSources((prev) => ({
      ...prev,
      [sourceKey]: !prev[sourceKey],
    }));
  };

  const handleSourceClick = (sourceKey, sourceText) => {
    toggleSource(sourceKey);
    setSelectedSourceText((prev) => (prev === sourceText ? "" : sourceText));
  };

  const escapeRegExp = (str) => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  };

  const getHighlightSnippet = (sourceText) => {
    if (!sourceText) return "";

    const normalized = sourceText.replace(/\s+/g, " ").trim();
    if (!normalized) return "";

    return normalized.slice(0, 40);
  };

  const renderAssistantTextWithHighlight = (text) => {
    if (!selectedSourceText) {
      return (
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {text}
        </ReactMarkdown>
      );
    }

    const snippet = getHighlightSnippet(selectedSourceText);

    if (!snippet || snippet.length < 6) {
      return (
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {text}
        </ReactMarkdown>
      );
    }

    const safeSnippet = escapeRegExp(snippet);
    const regex = new RegExp(`(${safeSnippet})`, "gi");
    const parts = text.split(regex);

    if (parts.length === 1) {
      return (
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {text}
        </ReactMarkdown>
      );
    }

    return (
      <div className="highlighted-text">
        {parts.map((part, idx) =>
          regex.test(part) ? (
            <mark key={idx} className="answer-highlight">
              {part}
            </mark>
          ) : (
            <ReactMarkdown
              key={idx}
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => <span>{children}</span>,
              }}
            >
              {part}
            </ReactMarkdown>
          )
        )}
      </div>
    );
  };

  return (
    <div className="page">
      <div className="layout">
        {/* 왼쪽 히스토리 */}
        <aside className="left-panel glass">
          <div className="brand-box">
            <div className="brand-icon">📱</div>
            <div>
              <h2>Galaxy S26 상담 챗봇</h2>
              <p>제품 상담 히스토리</p>
            </div>
          </div>

          <div className="panel-header-row">
            <h3>대화 목록</h3>
            <button className="new-chat-btn" onClick={createNewConversation}>
              + 새 상담
            </button>
          </div>

          <input
            className="search-input"
            type="text"
            placeholder="히스토리 검색"
            value={historyQuery}
            onChange={(e) => setHistoryQuery(e.target.value)}
          />

          <div className="history-list">
            {filteredConversations.map((conversation) => {
              const isActive = conversation.id === activeConversationId;
              return (
                <button
                  key={conversation.id}
                  className={`history-item ${isActive ? "active" : ""}`}
                  onClick={() => {
                    setActiveConversationId(conversation.id);
                    setOpenSources({});
                    setSelectedSourceText("");
                  }}
                >
                  <div className="history-title">{conversation.title}</div>
                  <div className="history-preview">{conversation.preview}</div>
                  <div className="history-time">{conversation.timestamp}</div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* 가운데 채팅 */}
        <main className="center-panel glass">
          <header className="chat-header">
            <div>
              <h1>Galaxy S26 제품 상담 챗봇</h1>
              <p>제품 설명서와 비교 문서를 바탕으로 답변합니다.</p>
            </div>
            <div className="online-badge">온라인</div>
          </header>

          <section className="starter-grid">
            {starterQuestions.map((q) => (
              <button
                key={q}
                className="starter-card"
                onClick={() => handleSend(q)}
              >
                {q}
              </button>
            ))}
          </section>

          <section className="messages">
            {activeConversation.messages.map((msg, idx) => (
              <div
                key={idx}
                className={`message-row ${
                  msg.role === "user" ? "user-row" : "assistant-row"
                }`}
              >
                <div
                  className={`message-bubble ${
                    msg.role === "user" ? "user-bubble" : "assistant-bubble"
                  }`}
                >
                  <div className="message-role">
                    {msg.role === "user" ? "사용자" : "챗봇"}
                  </div>

                  {msg.role === "assistant" ? (
                    <div className="markdown-content">
                      {renderAssistantTextWithHighlight(msg.text)}
                    </div>
                  ) : (
                    <div className="user-text">{msg.text}</div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="message-row assistant-row">
                <div className="message-bubble assistant-bubble">
                  <div className="message-role">챗봇</div>
                  <div className="loading-wrap">
                    <span className="dot" />
                    <span className="dot" />
                    <span className="dot" />
                    <span className="loading-text">답변 생성 중...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </section>

          <div className="chat-toolbar">
            <span className="toolbar-chip">
              현재 대화: {activeConversation.title}
            </span>
            <span className="toolbar-chip">Top-K {topK}</span>
            <span className="toolbar-chip">PDF + MD + json 기반 응답</span>
          </div>

          <section className="input-bar">
            <input
              type="text"
              placeholder="예: S26과 S26+의 차이가 뭐야?"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <button onClick={() => handleSend()} disabled={loading}>
              {loading ? "생성 중..." : "질문하기"}
            </button>
          </section>
        </main>

        {/* 오른쪽 패널 */}
        <aside className="right-panel glass">
          <div className="right-section">
            <h3>현재 구성</h3>

            <div className="info-card">
              <span className="info-label">Vector DB</span>
              <span className="info-value">Chroma</span>
            </div>

            <div className="info-card">
              <span className="info-label">Embedding</span>
              <span className="info-value">qwen3-embedding:8b</span>
            </div>

            <div className="info-card">
              <span className="info-label">LLM</span>
              <span className="info-value">qwen3:8b</span>
            </div>

            <div className="info-card">
              <span className="info-label">문서 형식</span>
              <span className="info-value">PDF + MD + json</span>
            </div>
          </div>

          <div className="right-section">
            <h3>Top-K 설정</h3>
            <div className="topk-slider">
              <input
                type="range"
                min="1"
                max="10"
                value={topK}
                onChange={(e) => setTopK(Number(e.target.value))}
              />
              <div className="topk-value">
                Top-K: <strong>{topK}</strong>
              </div>
            </div>
          </div>

          <div className="right-section">
            <h3>검색된 참고 문서</h3>

            {activeConversation.sources.length === 0 ? (
              <div className="empty-source">
                아직 검색된 문서가 없습니다. 질문을 입력하면 관련 문서가 여기에 표시됩니다.
              </div>
            ) : (
              <div className="source-list">
                {activeConversation.sources.map((source, idx) => {
                  const meta = source.metadata || {};
                  const rawSource = meta.source || "unknown";
                  const sourceName = rawSource.split(/[\\/]/).pop();
                  const page = meta.page_number;
                  const distance =
                    typeof source.distance === "number"
                      ? source.distance.toFixed(4)
                      : "-";

                  const sourceKey = `${activeConversation.id}-${idx}`;
                  const isOpen = !!openSources[sourceKey];

                  return (
                    <div key={sourceKey} className="source-card">
                      <div
                        className={`source-header ${
                          selectedSourceText === source.text ? "selected" : ""
                        }`}
                        onClick={() => handleSourceClick(sourceKey, source.text)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleSourceClick(sourceKey, source.text);
                          }
                        }}
                      >
                        <div className="source-badges">
                          <span className="source-badge">문서 {idx + 1}</span>
                          <span className="source-badge soft">
                            distance {distance}
                          </span>
                          {page !== undefined &&
                            page !== null &&
                            page !== "" && (
                              <span className="source-badge soft">
                                page {page}
                              </span>
                            )}
                        </div>

                        <div className="source-file">
                          {sourceName} {isOpen ? "▲" : "▼"}
                        </div>
                      </div>

                      {isOpen && (
                        <>
                          <div className="source-path">{rawSource}</div>
                          <div className="source-text">{source.text}</div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default App;