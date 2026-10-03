import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./style.css";

class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    return this.state.error ? (
      <main className="error-page">
        <h1>画面の読み込みで問題が起きました</h1>
        <p>保存された対局を残して、もう一度読み込めます。</p>
        <button onClick={() => location.reload()}>再読み込み</button>
        <details>
          <summary>エラーの詳細</summary>
          <pre>{String(this.state.error)}</pre>
        </details>
      </main>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
