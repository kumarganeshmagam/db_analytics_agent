/**
 * AI Agent with Gemini Function Calling
 * Uses tools to answer user queries dynamically
 */

class AIAgent {
    constructor(config = {}) {
        this.apiKey = config.apiKey || localStorage.getItem('gemini_api_key') || '';
        this.apiEndpoint = config.apiEndpoint || (typeof AppConfig !== 'undefined' ? AppConfig.api.geminiEndpoint : 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent');

        this.toolExecutor = new ToolExecutor();
        this.conversationHistory = [];
        this.maxHistoryLength = 10;

        // System prompt that explains the agent's role
        this.systemPrompt = `You are an AI analytics assistant for a ride-hailing work order system.
You have access to tools to query and analyze work order data from Ola, Rapido, and Transit.

AVAILABLE TOOLS:
1. query_work_orders - Get work orders with filters (provider, status, priority, city, region)
2. count_work_orders - Count orders matching criteria
3. aggregate_metrics - Get aggregated stats (count, sla_rate, avg_resolution_time, avg_rating, total_cost) with optional groupBy
4. generate_visualization - Create charts (pie, bar, doughnut)
5. execute_dax_query - Run DAX queries on Power BI

GUIDELINES:
- Use tools to get real data, don't make up numbers
- For "how many" questions, use count_work_orders
- For "show orders" questions, use query_work_orders with showData
- For "breakdown by" questions, use aggregate_metrics with groupBy
- Be concise and helpful`;
    }

    /**
     * Check if API key is configured
     */
    isConfigured() {
        return this.apiKey && this.apiKey.length > 10;
    }

    /**
     * Set API key
     */
    setApiKey(key) {
        this.apiKey = key;
        localStorage.setItem('gemini_api_key', key);
    }

    /**
     * Check if AI is enabled (configured)
     */
    isAIEnabled() {
        return this.isConfigured();
    }

    /**
     * Process user message with function calling
     */
    async processMessage(message) {
        if (!this.isConfigured()) {
            return {
                text: "⚠️ Please configure your Gemini API key first.",
                requiresConfig: true
            };
        }

        // Add to history
        this.conversationHistory.push({ role: 'user', content: message });

        try {
            // Step 1: Call Gemini with tools
            const response = await this.callGeminiWithTools(message);

            // Step 2: Check if function call is requested
            if (response.functionCall) {
                // Execute the tool
                const toolResult = await this.toolExecutor.execute(
                    response.functionCall.name,
                    response.functionCall.args
                );

                // Step 3: Send tool result back to Gemini for final response
                const finalResponse = await this.sendToolResult(
                    message,
                    response.functionCall,
                    toolResult
                );

                this.conversationHistory.push({ role: 'assistant', content: finalResponse.text });
                return finalResponse;
            }

            // No function call - direct response
            this.conversationHistory.push({ role: 'assistant', content: response.text });
            return response;

        } catch (error) {
            console.error('Agent error:', error);
            return {
                text: `❌ Error: ${error.message}`,
                options: [{ label: "Try again", value: message }]
            };
        }
    }

    /**
     * Call Gemini with function calling enabled
     */
    async callGeminiWithTools(message) {
        const tools = ToolDefinitions.getGeminiTools();

        const requestBody = {
            contents: [
                {
                    role: 'user',
                    parts: [{ text: this.systemPrompt }]
                },
                {
                    role: 'model',
                    parts: [{ text: 'I understand. I will use the available tools to answer queries about work orders.' }]
                },
                // Add conversation history
                ...this.conversationHistory.slice(-this.maxHistoryLength).map(msg => ({
                    role: msg.role === 'user' ? 'user' : 'model',
                    parts: [{ text: msg.content }]
                })),
                {
                    role: 'user',
                    parts: [{ text: message }]
                }
            ],
            tools: tools,
            generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 1024
            }
        };

        const response = await fetch(`${this.apiEndpoint}?key=${this.apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'API request failed');
        }

        const data = await response.json();
        const candidate = data.candidates?.[0];

        if (!candidate) {
            throw new Error('No response from API');
        }

        const part = candidate.content?.parts?.[0];

        // Check for function call
        if (part?.functionCall) {
            return {
                functionCall: {
                    name: part.functionCall.name,
                    args: part.functionCall.args || {}
                }
            };
        }

        // Text response
        return {
            text: part?.text || 'No response generated.'
        };
    }

    /**
     * Send tool result back to Gemini
     */
    async sendToolResult(originalMessage, functionCall, toolResult) {
        const requestBody = {
            contents: [
                {
                    role: 'user',
                    parts: [{ text: this.systemPrompt }]
                },
                {
                    role: 'model',
                    parts: [{ text: 'I will use tools to help answer your questions.' }]
                },
                {
                    role: 'user',
                    parts: [{ text: originalMessage }]
                },
                {
                    role: 'model',
                    parts: [{
                        functionCall: {
                            name: functionCall.name,
                            args: functionCall.args
                        }
                    }]
                },
                {
                    role: 'function',
                    parts: [{
                        functionResponse: {
                            name: functionCall.name,
                            response: toolResult
                        }
                    }]
                }
            ],
            generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 1024
            }
        };

        const response = await fetch(`${this.apiEndpoint}?key=${this.apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'API request failed');
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'I have processed the data.';

        // Build response with data and chart if applicable
        let result = { text };

        if (toolResult && toolResult.success) {
            if (toolResult.data && toolResult.data.length > 0) {
                result.action = { type: 'show_results', data: { data: toolResult.data, summary: toolResult.summary } };
            }
            if (toolResult.chart) {
                result.chartData = toolResult.chart;
            }
        }

        result.options = this.generateQuickActions(functionCall.name);
        return result;
    }

    /**
     * Generate quick action buttons
     */
    generateQuickActions(lastTool) {
        const actions = [];

        switch (lastTool) {
            case 'count_work_orders':
                actions.push({ label: "Show the data", value: "show me the orders" });
                actions.push({ label: "By provider", value: "breakdown by provider" });
                break;
            case 'query_work_orders':
                actions.push({ label: "Count only", value: "how many are there" });
                actions.push({ label: "Show chart", value: "show as pie chart" });
                break;
            case 'aggregate_metrics':
                actions.push({ label: "See details", value: "show the orders" });
                actions.push({ label: "Visualize", value: "show as chart" });
                break;
            default:
                actions.push({ label: "Count orders", value: "how many work orders" });
                actions.push({ label: "Show all", value: "show all work orders" });
        }

        actions.push({ label: "New query", value: "start new query" });
        return actions.slice(0, 4);
    }

    /**
     * Get welcome message
     */
    getWelcomeMessage() {
        if (!this.isConfigured()) {
            return {
                text: `👋 **AI Agent Ready**\n\n🔑 Configure your Gemini API key to enable tool-calling capabilities.`,
                options: [
                    { label: "Configure AI 🔑", value: "configure ai" }
                ],
                requiresConfig: true
            };
        }

        return {
            text: `👋 **AI Agent Ready**\n\n🤖 I can use tools to query, analyze, and visualize your work order data.\n\nTry: "How many Ola orders in Mumbai?" or "Show orders by priority"`,
            options: [
                { label: "Count orders", value: "how many work orders" },
                { label: "Show summary", value: "give me a summary" },
                { label: "By provider", value: "orders by provider" },
                { label: "High priority", value: "show high priority orders" }
            ]
        };
    }

    /**
     * Clear conversation history
     */
    clearHistory() {
        this.conversationHistory = [];
    }

    /**
     * Generate chart data for visualization (Compatibility with App.js)
     */
    generateChartData(results, chartType, dimension) {
        const data = results.data || [];
        const counts = {};

        // Map JS property to DB column if needed
        const mappedDim = this.toolExecutor.mapColumnName ? this.toolExecutor.mapColumnName(dimension) : dimension;

        data.forEach(item => {
            const key = item[mappedDim] || item[dimension] || 'Unknown';
            counts[key] = (counts[key] || 0) + 1;
        });

        const labels = Object.keys(counts);
        const values = Object.values(counts);

        const colors = [
            '#F2C811', '#00D4AA', '#4C9AFF', '#9D7BFF', '#FF5252',
            '#FFAA33', '#00BCD4', '#E91E63', '#8BC34A', '#FF9800'
        ];

        return {
            type: chartType,
            dimension,
            labels,
            datasets: [{
                data: values,
                backgroundColor: colors.slice(0, labels.length),
                borderWidth: 2
            }]
        };
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AIAgent;
}
window.AIAgent = AIAgent;
