/**
 * Application Configuration
 */

const AppConfig = {
    // API Configuration
    api: {
        geminiEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
        geminiModel: 'gemini-2.0-flash'
    },

    // PostgreSQL via PostgREST (Primary data source)
    postgrest: {
        apiUrl: 'http://localhost:3001',  // PostgREST container
        enabled: true
    },

    // Power BI Configuration (optional, for enterprise)
    powerBI: {
        clientId: '',      // Azure AD App Client ID
        tenantId: '',      // Azure AD Tenant ID
        datasetId: '',     // Power BI Dataset ID
        workspaceId: '',   // Power BI Workspace ID
        useMockData: false // Now using PostgreSQL
    },

    // Agent Configuration
    agent: {
        maxHistoryLength: 10,
        temperature: 0.3,
        maxOutputTokens: 1024
    },

    // UI Configuration
    ui: {
        defaultView: 'web',  // 'web' or 'bot'
        theme: 'dark',
        chartColors: [
            '#F2C811', '#00D4AA', '#4C9AFF', '#9D7BFF', '#FF5252',
            '#FFAA33', '#00BCD4', '#E91E63', '#8BC34A', '#FF9800'
        ]
    },

    // Feature Flags
    features: {
        enableDAXQueries: false,
        enableChartExport: true,
        enableVoiceInput: false,
        enablePowerBIEmbed: false
    }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AppConfig;
}
window.AppConfig = AppConfig;
