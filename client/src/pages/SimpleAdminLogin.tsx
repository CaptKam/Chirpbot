import { useState } from "react";

export function SimpleAdminLogin() {
  const [credentials, setCredentials] = useState({ username: "", password: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage("");

    try {
      console.log("Attempting login with:", { username: credentials.username, password: "***" });
      
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(credentials),
      });

      console.log("Response status:", response.status);
      const data = await response.json();
      console.log("Response data:", data);

      if (response.ok) {
        setMessage("Login successful! Redirecting...");
        setTimeout(() => {
          window.location.href = "/admin";
        }, 500);
      } else {
        setMessage(data.message || "Login failed");
      }
    } catch (error) {
      console.error("Login error:", error);
      setMessage("Network error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
      color: "white",
      fontFamily: "system-ui, sans-serif"
    }}>
      <div style={{
        background: "rgba(30, 41, 59, 0.8)",
        padding: "2rem",
        borderRadius: "8px",
        border: "1px solid #475569",
        width: "100%",
        maxWidth: "400px"
      }}>
        <h1 style={{ textAlign: "center", marginBottom: "2rem", fontSize: "1.5rem" }}>
          Admin Login
        </h1>
        
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>Username:</label>
            <input
              type="text"
              value={credentials.username}
              onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
              style={{
                width: "100%",
                padding: "0.75rem",
                borderRadius: "4px",
                border: "1px solid #475569",
                background: "#1e293b",
                color: "white",
                fontSize: "1rem"
              }}
              placeholder="admin"
              disabled={isLoading}
            />
          </div>
          
          <div>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>Password:</label>
            <input
              type="password"
              value={credentials.password}
              onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
              style={{
                width: "100%",
                padding: "0.75rem",
                borderRadius: "4px",
                border: "1px solid #475569",
                background: "#1e293b",
                color: "white",
                fontSize: "1rem"
              }}
              placeholder="password123"
              disabled={isLoading}
            />
          </div>
          
          <button
            type="submit"
            disabled={isLoading}
            style={{
              padding: "0.75rem",
              borderRadius: "4px",
              border: "none",
              background: isLoading ? "#475569" : "#3b82f6",
              color: "white",
              fontSize: "1rem",
              cursor: isLoading ? "not-allowed" : "pointer",
              marginTop: "1rem"
            }}
          >
            {isLoading ? "Logging in..." : "Login"}
          </button>
        </form>
        
        {message && (
          <div style={{
            marginTop: "1rem",
            padding: "0.75rem",
            borderRadius: "4px",
            background: message.includes("successful") ? "#16a34a" : "#dc2626",
            textAlign: "center"
          }}>
            {message}
          </div>
        )}
        
        <div style={{ marginTop: "2rem", fontSize: "0.875rem", color: "#94a3b8", textAlign: "center" }}>
          Use: <strong>admin</strong> / <strong>password123</strong>
        </div>
      </div>
    </div>
  );
}