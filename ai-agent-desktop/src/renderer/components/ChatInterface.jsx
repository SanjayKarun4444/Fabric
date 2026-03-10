import React, { useState, useEffect, useRef } from 'react';

function ChatInterface({ onCommand }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hello! I\'m your AI assistant. How can I help you today?', timestamp: new Date() }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputValue.trim() || isTyping) return;

    const userMessage = { role: 'user', content: inputValue, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    const result = await window.electronAPI.sendCommand('chat', { message: inputValue, history: messages });
    setIsTyping(false);

    const assistantMessage = {
      role: 'assistant',
      content: result.success ? result.result.response : `Sorry, error: ${result.error}`,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, assistantMessage]);
  };

  return (
    <div className="chat-interface">
      <header className="panel-header">
        <h2>💬 Chat with AI Agent</h2>
      </header>

      <div className="chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            <div className="message-avatar">{msg.role === 'user' ? '👤' : '🤖'}</div>
            <div className="message-content">
              <p>{msg.content}</p>
              <span className="message-time">{msg.timestamp.toLocaleTimeString()}</span>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="message assistant">
            <div className="message-avatar">🤖</div>
            <div className="message-content typing">
              <span></span><span></span><span></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSend} className="chat-input-form">
        <input type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)}
               placeholder="Type your message..." className="chat-input" disabled={isTyping} />
        <button type="submit" className="btn-send" disabled={isTyping || !inputValue.trim()}>Send</button>
      </form>
    </div>
  );
}

export default ChatInterface;
