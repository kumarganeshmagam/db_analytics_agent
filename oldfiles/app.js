/**
 * Power BI Query Assistant - Main Application
 * Supports Web View & Bot View with AI-powered query generation
 */

class App {
    constructor() {
        // Use the new AIAgent from src/
        this.agent = new AIAgent();
        this.currentResults = null;
        this.viewMode = 'web'; // 'web' or 'bot'

        // DOM Elements
        this.appContainer = document.querySelector('.app-container');
        this.chatContainer = document.getElementById('chatContainer');
        this.chatMessages = document.getElementById('chatMessages');
        this.userInput = document.getElementById('userInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.minimizeBtn = document.getElementById('minimizeBtn');
        this.quickActions = document.getElementById('quickActions');
        this.resultsArea = document.getElementById('resultsArea');
        this.viewToggle = document.getElementById('viewToggle');
        this.aiIndicator = document.getElementById('aiIndicator');

        this.init();
    }

    /**
     * Initialize application
     */
    async init() {
        this.bindEvents();
        // Wait for agent/tool executor to check connection
        await this.agent.toolExecutor.init();
        this.updateAIIndicator();
        this.showWelcomeMessage();
    }

    /**
     * Update AI indicator based on configuration
     */
    updateAIIndicator() {
        if (this.aiIndicator) {
            const isAI = this.agent.isConfigured();
            this.aiIndicator.classList.toggle('active', isAI);
            this.aiIndicator.querySelector('.ai-label').textContent = isAI ? 'AI Active' : 'AI Mode';
            this.aiIndicator.style.cursor = 'pointer';
            this.aiIndicator.title = isAI ? 'AI Mode: Gemini API active' : 'Click to configure AI';
        }
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Send message on button click
        this.sendBtn.addEventListener('click', () => this.sendMessage());

        // Send message on Enter key
        this.userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Minimize/expand chat
        this.minimizeBtn.addEventListener('click', () => {
            this.chatContainer.classList.toggle('minimized');
        });

        // AI Indicator click - open config
        if (this.aiIndicator) {
            this.aiIndicator.addEventListener('click', () => {
                this.showAPIKeyDialog();
            });
        }

        // View toggle buttons
        this.viewToggle.addEventListener('click', (e) => {
            const btn = e.target.closest('.toggle-btn');
            if (btn && !btn.classList.contains('active')) {
                const newView = btn.dataset.view;
                this.setViewMode(newView);
            }
        });

        // Quick action buttons (delegated)
        this.quickActions.addEventListener('click', (e) => {
            if (e.target.classList.contains('quick-action-btn')) {
                const value = e.target.dataset.value;

                // Handle special actions
                if (value === 'configure ai') {
                    this.showAPIKeyDialog();
                    return;
                }

                this.userInput.value = value;
                this.sendMessage();
            }
        });

        // Chat messages events (delegated)
        this.chatMessages.addEventListener('click', (e) => {
            // Expand/collapse inline result card
            if (e.target.closest('.inline-result-header') || e.target.closest('.inline-expand-btn')) {
                const card = e.target.closest('.inline-result-card');
                if (card) {
                    const currentState = card.dataset.state;
                    card.dataset.state = currentState === 'expanded' ? 'minimized' : 'expanded';
                }
            }

            // CSV export (inline)
            if (e.target.closest('.inline-csv-btn')) {
                this.exportCSV();
            }

            // PDF export (inline)
            if (e.target.closest('.inline-pdf-btn')) {
                this.exportPDF();
            }
        });

        // Results area events (delegated)
        this.resultsArea.addEventListener('click', (e) => {
            if (e.target.closest('.expand-btn') || e.target.closest('.result-card-header')) {
                const card = e.target.closest('.result-card');
                if (card) {
                    const currentState = card.dataset.state;
                    card.dataset.state = currentState === 'expanded' ? 'minimized' : 'expanded';
                }
            }

            if (e.target.closest('.csv-btn')) this.exportCSV();
            if (e.target.closest('.pdf-btn')) this.exportPDF();
        });
    }

    /**
     * Show API Key configuration dialog
     */
    showAPIKeyDialog() {
        // Use global APIKeyDialog (from aiService.js or we can move it)
        const dialog = new APIKeyDialog(this.agent, () => {
            this.updateAIIndicator();
            this.addMessage("🎉 **AI Mode Activated!** I am now connected to Gemini and PostgreSQL (100k records).", 'bot');
            this.showWelcomeMessage(); // Refresh actions
        });
        dialog.show();
    }

    /**
     * Set view mode
     */
    setViewMode(mode) {
        this.viewMode = mode;
        this.appContainer.dataset.viewMode = mode;

        this.viewToggle.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === mode);
        });

        if (mode === 'web' && this.currentResults) {
            this.showResultsInPanel(this.currentResults);
        }
    }

    /**
     * Send user message and get response (async for AI)
     */
    async sendMessage() {
        const message = this.userInput.value.trim();
        if (!message) return;

        console.log(`💬 User: ${message}`);

        // Disable input while processing
        this.userInput.value = '';
        this.userInput.disabled = true;
        this.sendBtn.disabled = true;

        // Add user message
        this.addMessage(message, 'user');

        // Show AI thinking indicator
        this.showAIThinking();

        try {
            // Process message via AIAgent (new system)
            const response = await this.agent.processMessage(message);
            console.log(`🤖 AI Response:`, response);

            this.hideAIThinking();

            if (!response.text && !response.action && !response.chartData) {
                this.addMessage("⚠️ I received an empty response. Please try again with a more specific query.", 'bot');
            } else {
                if (response.text) {
                    this.addMessage(response.text, 'bot');
                }

                // Handle chart if present
                if (response.chartData) {
                    this.showChart(response.chartData);
                }

                this.updateQuickActions(response.options);

                // Handle data table
                if (response.action) {
                    this.handleAction(response.action);
                }
            }
        } catch (error) {
            console.error('❌ Error processing message:', error);
            this.hideAIThinking();

            let errorMsg = "❌ Sorry, I encountered an error.";
            if (error.message.includes('API')) errorMsg += " AI API failure. Check your key.";
            else if (error.message.includes('fetch')) errorMsg += " Network connection issue.";
            else errorMsg += ` ${error.message}`;

            this.addMessage(errorMsg, 'bot');
        }

        // Re-enable input
        this.userInput.disabled = false;
        this.sendBtn.disabled = false;
        this.userInput.focus();
    }

    /**
     * Add chart toggle button to chat (BOT VIEW ONLY)
     */
    addChartToggle(chartConfig) {
        const toggleId = 'chart-toggle-' + Date.now();

        const toggleDiv = document.createElement('div');
        toggleDiv.className = 'message bot chart-toggle-message';
        toggleDiv.innerHTML = `
            <div class="message-avatar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 20V10M12 20V4M6 20v-6"/>
                </svg>
            </div>
            <div class="message-content chart-toggle-content">
                <button class="chart-toggle-btn" id="${toggleId}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 20V10M12 20V4M6 20v-6"/>
                    </svg>
                    <span>📊 View Chart</span>
                </button>
                <div class="chart-container" id="${toggleId}-chart" style="display: none;"></div>
            </div>
        `;

        this.chatMessages.appendChild(toggleDiv);
        this.scrollToBottom();

        // Store config for later
        this.pendingCharts = this.pendingCharts || {};
        this.pendingCharts[toggleId] = chartConfig;

        // Bind toggle event
        document.getElementById(toggleId).addEventListener('click', () => {
            this.toggleChart(toggleId);
        });
    }

    /**
     * Toggle chart visibility
     */
    toggleChart(toggleId) {
        const btn = document.getElementById(toggleId);
        const container = document.getElementById(toggleId + '-chart');
        const config = this.pendingCharts[toggleId];

        if (!container || !config) return;

        const isHidden = container.style.display === 'none';

        if (isHidden) {
            // Show chart
            container.style.display = 'block';
            btn.querySelector('span').textContent = 'Hide Chart';
            btn.classList.add('active');

            // Render chart if not already rendered
            if (!container.hasChildNodes()) {
                const canvasId = toggleId + '-canvas';
                container.innerHTML = `<canvas id="${canvasId}" width="280" height="180"></canvas>`;

                const chartData = this.agent.generateChartData(
                    config.results,
                    config.type,
                    config.dimension
                );

                setTimeout(() => this.renderChart(canvasId, chartData), 50);
            }
        } else {
            // Hide chart
            container.style.display = 'none';
            btn.querySelector('span').textContent = 'Show Chart';
            btn.classList.remove('active');
        }

        this.scrollToBottom();
    }

    /**
     * Show chart visualization in chat
     */
    showChart(chartData) {
        const chartId = 'chart-' + Date.now();

        const messageDiv = document.createElement('div');
        messageDiv.className = 'message bot chart-message';
        messageDiv.innerHTML = `
            <div class="message-avatar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 20V10M12 20V4M6 20v-6"/>
                </svg>
            </div>
            <div class="message-content chart-content">
                <div class="chart-wrapper">
                    <canvas id="${chartId}" width="300" height="200"></canvas>
                </div>
                <div class="chart-legend" id="${chartId}-legend"></div>
            </div>
        `;

        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();

        // Render chart after DOM update
        setTimeout(() => {
            this.renderChart(chartId, chartData);
        }, 100);
    }

    /**
     * Render Chart.js chart
     */
    renderChart(canvasId, chartData) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        const isDoughnut = chartData.type === 'doughnut' || chartData.type === 'pie';

        new Chart(ctx, {
            type: chartData.type || 'pie',
            data: {
                labels: chartData.labels,
                datasets: chartData.datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom',
                        labels: {
                            color: '#a0a0b0',
                            font: { size: 11 },
                            padding: 10
                        }
                    }
                },
                ...(isDoughnut ? {} : {
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { color: '#a0a0b0' },
                            grid: { color: 'rgba(255,255,255,0.05)' }
                        },
                        x: {
                            ticks: { color: '#a0a0b0' },
                            grid: { color: 'rgba(255,255,255,0.05)' }
                        }
                    }
                })
            }
        });
    }

    /**
     * Show welcome message
     */
    showWelcomeMessage() {
        const welcome = this.agent.getWelcomeMessage();
        this.addMessage(welcome.text, 'bot');
        this.updateQuickActions(welcome.options);
    }

    /**
     * Add message to chat
     */
    addMessage(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;

        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'message-avatar';
        avatarDiv.innerHTML = sender === 'user'
            ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'
            : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.innerHTML = this.parseMessageText(text);

        messageDiv.appendChild(avatarDiv);
        messageDiv.appendChild(contentDiv);

        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
    }

    /**
     * Parse markdown
     */
    parseMessageText(text) {
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>')
            .replace(/• /g, '&bull; ');
    }

    /**
     * Update quick actions
     */
    updateQuickActions(options) {
        this.quickActions.innerHTML = '';
        if (!options || options.length === 0) return;

        options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'quick-action-btn';
            btn.textContent = opt.label;
            btn.dataset.value = opt.value;
            this.quickActions.appendChild(btn);
        });
    }

    /**
     * Show AI thinking indicator
     */
    showAIThinking() {
        const indicator = document.createElement('div');
        indicator.className = 'message bot thinking-message';
        const aiText = this.agent.isAIEnabled() ? 'AI is analyzing...' : 'Processing...';
        indicator.innerHTML = `
            <div class="message-avatar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
            </div>
            <div class="message-content">
                <div class="ai-thinking">
                    <div class="ai-thinking-dots"><span></span><span></span><span></span></div>
                    <span>${aiText}</span>
                </div>
            </div>
        `;
        this.chatMessages.appendChild(indicator);
        this.scrollToBottom();
    }

    /**
     * Hide thinking indicator
     */
    hideAIThinking() {
        const indicator = this.chatMessages.querySelector('.thinking-message');
        if (indicator) indicator.remove();
    }

    /**
     * Scroll to bottom
     */
    scrollToBottom() {
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    /**
     * Handle actions
     */
    handleAction(action) {
        if (action.type === 'show_results') {
            this.currentResults = action.data;

            if (this.viewMode === 'bot') {
                this.showInlineResults(action.data);
            } else {
                this.showResultsInPanel(action.data);
            }
        }
    }

    /**
     * Show inline results (Bot View)
     */
    showInlineResults(results) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message bot result-message';

        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'message-avatar';
        avatarDiv.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.innerHTML = this.buildInlineResultCard(results);

        messageDiv.appendChild(avatarDiv);
        messageDiv.appendChild(contentDiv);
        this.chatMessages.appendChild(messageDiv);

        setTimeout(() => {
            const card = messageDiv.querySelector('.inline-result-card');
            if (card) card.dataset.state = 'expanded';
            this.scrollToBottom();
        }, 300);
    }

    /**
     * Build inline result card
     */
    buildInlineResultCard(results) {
        const { data, summary } = results;
        const displayData = data.slice(0, 8);
        const hasMore = data.length > 8;

        const tableRows = displayData.map(wo => `
            <tr>
                <td>${wo.id}</td>
                <td><span class="provider-badge ${wo.provider?.toLowerCase() || ''}">${wo.provider || '-'}</span></td>
                <td><span class="inline-badge ${wo.status?.toLowerCase().replace(' ', '-') || ''}">${wo.status || '-'}</span></td>
                <td><span class="inline-badge ${wo.priority?.toLowerCase() || ''}">${wo.priority || '-'}</span></td>
                <td>${wo.city || '-'}</td>
                <td>₹${wo.costInr?.toLocaleString() || '0'}</td>
            </tr>
        `).join('');

        return `
            <div class="inline-result-card" data-state="minimized">
                <div class="inline-result-header">
                    <div class="inline-result-info">
                        <svg class="inline-result-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                        </svg>
                        <span class="inline-result-title">Query Results</span>
                        <span class="inline-result-count">${summary.total.toLocaleString()} total</span>
                    </div>
                    <button class="inline-expand-btn" aria-label="Expand">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 9l-7 7-7-7"/></svg>
                    </button>
                </div>
                <div class="inline-result-body">
                    <div class="inline-summary">
                        <div class="inline-summary-item"><div class="inline-summary-value">${summary.total.toLocaleString()}</div><div class="inline-summary-label">Total</div></div>
                        <div class="inline-summary-item"><div class="inline-summary-value">${summary.slaCompliance}%</div><div class="inline-summary-label">SLA Met</div></div>
                        <div class="inline-summary-item"><div class="inline-summary-value">₹${parseFloat(summary.totalCost || 0).toLocaleString()}</div><div class="inline-summary-label">Cost</div></div>
                        <div class="inline-summary-item"><div class="inline-summary-value">${summary.avgRating || '-'}</div><div class="inline-summary-label">Rating</div></div>
                    </div>
                    <div class="inline-table-wrapper">
                        <table class="inline-table">
                            <thead><tr><th>ID</th><th>Provider</th><th>Status</th><th>Priority</th><th>City</th><th>Cost</th></tr></thead>
                            <tbody>${tableRows}</tbody>
                        </table>
                        ${hasMore ? `<div style="text-align:center;padding:8px;color:var(--text-muted);font-size:0.7rem">... and ${data.length - 8} more</div>` : ''}
                    </div>
                    <div class="inline-result-actions">
                        <button class="inline-export-btn inline-csv-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8m8 4H8m2-8H8"/></svg>CSV</button>
                        <button class="inline-export-btn inline-pdf-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M12 18v-6m-3 3l3-3 3 3"/></svg>PDF</button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Show results in panel (Web View)
     */
    showResultsInPanel(results) {
        const { data, summary } = results;

        const tableRows = data.map(wo => `
            <tr>
                <td>${wo.id}</td>
                <td><span class="provider-badge ${wo.provider?.toLowerCase() || ''}">${wo.provider || '-'}</span></td>
                <td><span class="status-badge ${wo.status?.toLowerCase().replace(' ', '-') || ''}">${wo.status || '-'}</span></td>
                <td><span class="priority-badge ${wo.priority?.toLowerCase() || ''}">${wo.priority || '-'}</span></td>
                <td>${wo.city || '-'}</td>
                <td>${wo.orderType || '-'}</td>
                <td>₹${wo.costInr?.toLocaleString() || '0'}</td>
                <td>${wo.assignedAgent || '-'}</td>
            </tr>
        `).join('');

        this.resultsArea.innerHTML = `
            <div class="result-card" data-state="expanded">
                <div class="result-card-header">
                    <div class="result-info">
                        <svg class="result-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                        </svg>
                        <span class="result-title">Query Results</span>
                        <span class="result-count">${summary.total.toLocaleString()} items total</span>
                    </div>
                    <button class="expand-btn" aria-label="Toggle">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 9l-7 7-7-7"/></svg>
                    </button>
                </div>
                <div class="result-card-body">
                    <div class="result-summary">
                        <div class="summary-item"><div class="summary-value">${summary.total.toLocaleString()}</div><div class="summary-label">Total Orders</div></div>
                        <div class="summary-item"><div class="summary-value">${summary.slaCompliance}%</div><div class="summary-label">SLA Compliance</div></div>
                        <div class="summary-item"><div class="summary-value">₹${parseFloat(summary.totalCost || 0).toLocaleString()}</div><div class="summary-label">Total Cost</div></div>
                        <div class="summary-item"><div class="summary-value">${summary.avgRating || '-'}</div><div class="summary-label">Avg Rating</div></div>
                        <div class="summary-item"><div class="summary-value">${summary.avgResolutionTime || '-'}h</div><div class="summary-label">Avg Resolution</div></div>
                        <div class="summary-item"><div class="summary-value">${summary.byStatus?.Completed || 0}</div><div class="summary-label">Completed</div></div>
                    </div>
                    <div class="result-table-wrapper">
                        <table class="result-table">
                            <thead><tr><th>ID</th><th>Provider</th><th>Status</th><th>Priority</th><th>City</th><th>Type</th><th>Cost</th><th>Agent</th></tr></thead>
                            <tbody>${tableRows}</tbody>
                        </table>
                    </div>
                    <div class="result-actions">
                        <button class="export-btn csv-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8m8 4H8m2-8H8"/></svg>Export CSV</button>
                        <button class="export-btn pdf-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M12 18v-6m-3 3l3-3 3 3"/></svg>Export PDF</button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Export to CSV
     */
    exportCSV() {
        if (!this.currentResults?.data?.length) return;
        const filename = ExportUtils.generateFilename('work_orders', 'csv');
        ExportUtils.toCSV(this.currentResults.data, filename);
    }

    /**
     * Export to PDF
     */
    exportPDF() {
        if (!this.currentResults?.data?.length) return;
        const filename = ExportUtils.generateFilename('work_orders', 'pdf');
        ExportUtils.toPDF(
            this.currentResults.data,
            this.currentResults.summary,
            this.currentResults.query,
            filename
        );
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
