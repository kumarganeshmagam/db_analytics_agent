/**
 * APIClient - Coordination layer for backend communication
 */
class APIClient {
    constructor(baseURL = 'http://localhost:8000') {
        this.baseURL = baseURL;
        this.ws = null;
    }
    
    /**
     * Send query via REST API
     */
    async sendQuery(message, context = null) {
        try {
            const response = await fetch(`${this.baseURL}/api/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: message,
                    context: context
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || `API error: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API Client Error:', error);
            throw error;
        }
    }
    
    /**
     * Connect via WebSocket for real-time chat
     */
    connectWebSocket(onMessage, onError) {
        const wsUrl = this.baseURL.replace('http', 'ws') + '/ws/chat';
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            onMessage(data);
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket Error:', error);
            if (onError) onError(error);
        };
        
        this.ws.onclose = () => {
            console.log('WebSocket connection closed');
        };
        
        return this.ws;
    }
    
    /**
     * Send message via WebSocket
     */
    sendWebSocketMessage(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ message }));
        } else {
            console.warn('WebSocket is not connected');
        }
    }
}

// Export to window for easy access
window.APIClient = APIClient;
