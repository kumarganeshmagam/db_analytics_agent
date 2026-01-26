/**
 * Tool Definitions for Gemini Function Calling
 * These define the available tools the AI agent can use
 */

const ToolDefinitions = {
    // All available tools
    tools: [
        {
            name: "query_work_orders",
            description: "Query work orders from the database with filters. Use this to get specific orders based on criteria.",
            parameters: {
                type: "object",
                properties: {
                    provider: {
                        type: "string",
                        enum: ["Ola", "Rapido", "Transit"],
                        description: "Filter by service provider"
                    },
                    status: {
                        type: "string",
                        enum: ["Completed", "In Progress", "Open", "Pending", "Escalated", "Cancelled"],
                        description: "Filter by order status"
                    },
                    priority: {
                        type: "string",
                        enum: ["Critical", "High", "Medium", "Low"],
                        description: "Filter by priority level"
                    },
                    city: {
                        type: "string",
                        description: "Filter by city name"
                    },
                    region: {
                        type: "string",
                        enum: ["North", "South", "East", "West", "Central"],
                        description: "Filter by region"
                    },
                    limit: {
                        type: "integer",
                        description: "Maximum number of results to return",
                        default: 50
                    }
                },
                required: []
            }
        },
        {
            name: "count_work_orders",
            description: "Get the count of work orders matching filters. Use for 'how many' questions.",
            parameters: {
                type: "object",
                properties: {
                    provider: { type: "string", enum: ["Ola", "Rapido", "Transit"] },
                    status: { type: "string" },
                    priority: { type: "string", enum: ["Critical", "High", "Medium", "Low"] },
                    city: { type: "string" },
                    region: { type: "string" }
                },
                required: []
            }
        },
        {
            name: "aggregate_metrics",
            description: "Get aggregated metrics like counts by category, SLA rates, averages. Use for breakdowns and summaries.",
            parameters: {
                type: "object",
                properties: {
                    metric: {
                        type: "string",
                        enum: ["count", "sla_rate", "avg_resolution_time", "avg_rating", "total_cost"],
                        description: "The metric to calculate"
                    },
                    groupBy: {
                        type: "string",
                        enum: ["provider", "status", "priority", "city", "region"],
                        description: "Dimension to group by"
                    },
                    filters: {
                        type: "object",
                        description: "Filters to apply before aggregation"
                    }
                },
                required: ["metric"]
            }
        },
        {
            name: "generate_visualization",
            description: "Generate a chart visualization. Use when user asks for a chart or visual breakdown.",
            parameters: {
                type: "object",
                properties: {
                    chartType: {
                        type: "string",
                        enum: ["pie", "bar", "doughnut", "line"],
                        description: "Type of chart to generate"
                    },
                    dimension: {
                        type: "string",
                        enum: ["provider", "status", "priority", "city"],
                        description: "Data dimension to visualize"
                    },
                    filters: {
                        type: "object",
                        description: "Filters to apply to data"
                    }
                },
                required: ["chartType", "dimension"]
            }
        },
        {
            name: "execute_dax_query",
            description: "Execute a DAX query on Power BI dataset. Use for advanced analytics.",
            parameters: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description: "DAX query to execute"
                    }
                },
                required: ["query"]
            }
        }
    ],

    // Get tools in Gemini format
    getGeminiTools() {
        return [{
            functionDeclarations: this.tools
        }];
    },

    // Get tool by name
    getTool(name) {
        return this.tools.find(t => t.name === name);
    }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ToolDefinitions;
}
window.ToolDefinitions = ToolDefinitions;
