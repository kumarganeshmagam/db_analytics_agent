/**
 * Power BI Service - Handles Power BI REST API integration
 * For dynamic data retrieval and DAX query execution
 */

class PowerBIService {
    constructor(config = {}) {
        this.clientId = config.clientId || '';
        this.tenantId = config.tenantId || '';
        this.datasetId = config.datasetId || '';
        this.workspaceId = config.workspaceId || '';

        this.accessToken = null;
        this.tokenExpiry = null;

        // API endpoints
        this.authEndpoint = `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`;
        this.apiBase = 'https://api.powerbi.com/v1.0/myorg';
    }

    /**
     * Check if service is configured
     */
    isConfigured() {
        return this.clientId && this.tenantId && this.datasetId;
    }

    /**
     * Authenticate with Azure AD (requires backend for security)
     * In production, this should be done server-side
     */
    async authenticate(clientSecret) {
        // NOTE: This is for demo purposes. In production:
        // 1. Use a backend server to handle authentication
        // 2. Use MSAL.js for browser-based auth
        // 3. Never expose client secrets in frontend

        console.warn('Power BI authentication should be handled server-side for security');

        const params = new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: this.clientId,
            client_secret: clientSecret,
            scope: 'https://analysis.windows.net/powerbi/api/.default'
        });

        const response = await fetch(this.authEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });

        if (!response.ok) {
            throw new Error('Authentication failed');
        }

        const data = await response.json();
        this.accessToken = data.access_token;
        this.tokenExpiry = Date.now() + (data.expires_in * 1000);

        return true;
    }

    /**
     * Execute DAX query on Power BI dataset
     */
    async executeDAX(query) {
        if (!this.accessToken) {
            throw new Error('Not authenticated. Call authenticate() first.');
        }

        const url = `${this.apiBase}/groups/${this.workspaceId}/datasets/${this.datasetId}/executeQueries`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                queries: [{ query }],
                serializerSettings: {
                    includeNulls: true
                }
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'DAX query failed');
        }

        const data = await response.json();
        return data.results?.[0]?.tables?.[0]?.rows || [];
    }

    /**
     * Get work orders using DAX
     */
    async queryWorkOrders(filters = {}) {
        let daxFilters = [];

        if (filters.provider) {
            daxFilters.push(`'WorkOrders'[Provider] = "${filters.provider}"`);
        }
        if (filters.status) {
            daxFilters.push(`'WorkOrders'[Status] = "${filters.status}"`);
        }
        if (filters.priority) {
            daxFilters.push(`'WorkOrders'[Priority] = "${filters.priority}"`);
        }
        if (filters.city) {
            daxFilters.push(`CONTAINSSTRING('WorkOrders'[City], "${filters.city}")`);
        }

        const filterClause = daxFilters.length > 0
            ? `FILTER('WorkOrders', ${daxFilters.join(' && ')})`
            : `'WorkOrders'`;

        const query = `
            EVALUATE
            SELECTCOLUMNS(
                ${filterClause},
                "ID", 'WorkOrders'[ID],
                "Provider", 'WorkOrders'[Provider],
                "Status", 'WorkOrders'[Status],
                "Priority", 'WorkOrders'[Priority],
                "City", 'WorkOrders'[City],
                "Cost", 'WorkOrders'[CostINR]
            )
        `;

        return this.executeDAX(query);
    }

    /**
     * Get aggregated metrics
     */
    async getAggregatedMetrics(groupBy, metric = 'count') {
        let measureExpression;

        switch (metric) {
            case 'count':
                measureExpression = 'COUNT(\'WorkOrders\'[ID])';
                break;
            case 'sum_cost':
                measureExpression = 'SUM(\'WorkOrders\'[CostINR])';
                break;
            case 'avg_rating':
                measureExpression = 'AVERAGE(\'WorkOrders\'[CustomerRating])';
                break;
            case 'sla_rate':
                measureExpression = `
                    DIVIDE(
                        COUNTROWS(FILTER('WorkOrders', 'WorkOrders'[SLAMet] = "Yes")),
                        COUNTROWS(FILTER('WorkOrders', 'WorkOrders'[SLAMet] <> "Pending"))
                    ) * 100
                `;
                break;
            default:
                measureExpression = 'COUNT(\'WorkOrders\'[ID])';
        }

        const query = `
            EVALUATE
            SUMMARIZECOLUMNS(
                'WorkOrders'[${groupBy}],
                "Value", ${measureExpression}
            )
        `;

        return this.executeDAX(query);
    }

    /**
     * Placeholder for mock data (when Power BI is not connected)
     */
    static getMockConnection() {
        return {
            isConnected: false,
            message: "Power BI not connected. Using local mock data.",
            setupInstructions: [
                "1. Create Azure AD App Registration",
                "2. Grant Power BI API permissions",
                "3. Get clientId, tenantId from Azure Portal",
                "4. Get datasetId, workspaceId from Power BI",
                "5. Set up backend for secure token handling"
            ]
        };
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PowerBIService;
}
window.PowerBIService = PowerBIService;
