/**
 * Power BI Query Assistant - Refactored for Python Backend
 */

class App {
    constructor() {
        this.apiClient = new APIClient();
        this.currentResults = null;
        this.viewMode = 'web';

        // DOM Elements
        this.appContainer = document.querySelector('.app-container');
        this.chatMessages = document.getElementById('chatMessages');
        this.userInput = document.getElementById('userInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.quickActions = document.getElementById('quickActions');
        this.resultsArea = document.getElementById('resultsArea');
        this.viewToggle = document.getElementById('viewToggle');

        this.init();
    }

    async init() {
        this.bindEvents();
        this.showWelcomeMessage();
    }

    bindEvents() {
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        this.viewToggle.addEventListener('click', (e) => {
            const btn = e.target.closest('.toggle-btn');
            if (btn) this.setViewMode(btn.dataset.view);
        });

        this.quickActions.addEventListener('click', (e) => {
            if (e.target.classList.contains('quick-action-btn')) {
                this.userInput.value = e.target.dataset.value;
                this.sendMessage();
            }
        });
    }

    async sendMessage() {
        const message = this.userInput.value.trim();
        if (!message) return;

        this.addMessage(message, 'user');
        this.userInput.value = '';
        this.showAIThinking();

        try {
            const response = await this.apiClient.sendQuery(message);
            this.hideAIThinking();

            if (response.text) {
                this.addMessage(response.text, 'bot');
            }

            if (response.sql_query) {
                this.addSQLDisplay(response.sql_query);
            }

            if (response.data && response.data.length > 0) {
                this.handleAction({
                    type: 'show_results',
                    data: {
                        data: response.data,
                        summary: response.summary
                    }
                });
            }

            if (response.chart) {
                this.showChart(response.chart);
            }

            this.updateQuickActions(response.suggestions);

        } catch (error) {
            this.hideAIThinking();
            this.addMessage(`❌ Error: ${error.message}`, 'bot');
        }
    }

    setViewMode(mode) {
        this.viewMode = mode;
        this.appContainer.dataset.viewMode = mode;
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === mode);
        });
    }

    addMessage(text, sender) {
        const div = document.createElement('div');
        div.className = `message ${sender}`;
        div.innerHTML = `<div class="message-content">${text.replace(/\n/g, '<br>')}</div>`;
        this.chatMessages.appendChild(div);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    showAIThinking() {
        const div = document.createElement('div');
        div.className = 'message bot thinking';
        div.innerHTML = '<div class="message-content">AI is thinking...</div>';
        this.chatMessages.appendChild(div);
    }

    hideAIThinking() {
        const thinking = this.chatMessages.querySelector('.thinking');
        if (thinking) thinking.remove();
    }

    addSQLDisplay(sql) {
        const div = document.createElement('div');
        div.className = 'message bot sql-message';
        div.innerHTML = `<div class="message-content"><pre><code>${sql}</code></pre></div>`;
        this.chatMessages.appendChild(div);
    }

    handleAction(action) {
        if (action.type === 'show_results') {
            this.currentResults = action.data;
            this.renderTable(action.data.data);
        }
    }

    renderTable(data) {
        if (!data || data.length === 0) return;
        const keys = Object.keys(data[0]);
        let html = '<table class="result-table"><thead><tr>';
        keys.forEach(k => html += `<th>${k}</th>`);
        html += '</tr></thead><tbody>';
        data.forEach(row => {
            html += '<tr>';
            keys.forEach(k => html += `<td>${row[k]}</td>`);
            html += '</tr>';
        });
        html += '</tbody></table>';
        this.resultsArea.innerHTML = html;
    }

    showChart(chartConfig) {
        // Implementation for Chart.js would go here
        console.log('Rendering chart:', chartConfig);
    }

    updateQuickActions(suggestions) {
        this.quickActions.innerHTML = '';
        if (!suggestions) return;
        suggestions.forEach(s => {
            const btn = document.createElement('button');
            btn.className = 'quick-action-btn';
            btn.textContent = s;
            btn.dataset.value = s;
            this.quickActions.appendChild(btn);
        });
    }

    showWelcomeMessage() {
        this.addMessage("Hello! I'm your Power BI Assistant. How can I help you today?", 'bot');
        this.updateQuickActions(["Show me all orders", "What's the total cost?", "Visualize by status"]);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
