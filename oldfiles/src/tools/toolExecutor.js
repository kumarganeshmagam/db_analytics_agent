/**
 * Tool Executor - Executes tools called by the AI agent
 * Connects to PostgreSQL via PostgREST API (dynamic data)
 */

class ToolExecutor {
    constructor() {
        // Use PostgreSQL service for dynamic data
        this.pgService = new PostgreSQLService({
            apiUrl: AppConfig?.postgrest?.apiUrl || 'http://localhost:3001'
        });
    }

    /**
     * Check if PostgreSQL is available
     */
    async init() {
        const available = await this.pgService.isAvailable();
        if (!available) {
            console.error('❌ PostgreSQL not available. Please ensure Docker containers are running.');
        } else {
            console.log('✅ Connected to PostgreSQL via PostgREST');
        }
        return available;
    }

    /**
     * Execute a tool by name with given arguments
     */
    async execute(toolName, args) {
        console.log(`🔧 Executing tool: ${toolName}`, args);

        switch (toolName) {
            case 'query_work_orders':
                return this.queryWorkOrders(args);
            case 'count_work_orders':
                return this.countWorkOrders(args);
            case 'aggregate_metrics':
                return this.aggregateMetrics(args);
            case 'generate_visualization':
                return this.generateVisualization(args);
            case 'execute_sql':
                return this.executeSQL(args);
            default:
                throw new Error(`Unknown tool: ${toolName}`);
        }
    }

    /**
     * Query work orders with filters
     */
    async queryWorkOrders(args) {
        const result = await this.pgService.queryWorkOrders({
            provider: args.provider,
            status: args.status,
            priority: args.priority,
            city: args.city,
            region: args.region
        }, {
            limit: args.limit || 100,
            offset: args.offset || 0
        });

        if (result.success) {
            result.source = 'postgresql';
            // Calculate metrics based on the returned chunk
            result.summary = this.calculateSummary(result.data);
            // OVERRIDE: Total must be the actual database count (e.g. 100,000)
            result.summary.total = result.total;
            console.log(`📊 PostgreSQL Query: Found ${result.total} total records, using sample of ${result.data.length} for summary.`);
        }

        return result;
    }

    /**
     * Count work orders
     */
    async countWorkOrders(args) {
        const result = await this.pgService.countWorkOrders({
            provider: args.provider,
            status: args.status,
            priority: args.priority,
            city: args.city,
            region: args.region
        });

        result.source = 'postgresql';
        // Ensure count is available in a standard property
        result.total = result.count;
        return result;
    }

    /**
     * Aggregate metrics with groupBy
     */
    async aggregateMetrics(args) {
        const result = await this.pgService.aggregateMetrics(
            args.metric,
            args.groupBy,
            args.filters || {}
        );

        result.source = 'postgresql';
        return result;
    }

    /**
     * Generate visualization data
     */
    async generateVisualization(args) {
        // Fetch a larger sample for visualization (up to 10k)
        const dataResult = await this.pgService.queryWorkOrders(args.filters || {}, {
            limit: 10000
        });

        if (!dataResult.success) {
            return dataResult;
        }

        const data = dataResult.data;
        const dimension = this.mapColumnName(args.dimension);

        // Count by dimension
        const counts = {};
        data.forEach(row => {
            const key = row[dimension] || row[args.dimension] || 'Unknown';
            counts[key] = (counts[key] || 0) + 1;
        });

        const labels = Object.keys(counts);
        const values = Object.values(counts);

        const colors = [
            '#F2C811', '#00D4AA', '#4C9AFF', '#9D7BFF', '#FF5252',
            '#FFAA33', '#00BCD4', '#E91E63', '#8BC34A', '#FF9800'
        ];

        return {
            success: true,
            chart: {
                type: args.chartType,
                dimension: args.dimension,
                labels,
                datasets: [{
                    data: values,
                    backgroundColor: colors.slice(0, labels.length),
                    borderWidth: 2
                }]
            },
            source: 'postgresql'
        };
    }

    /**
     * Execute SQL query
     */
    async executeSQL(args) {
        return this.pgService.executeSQL(args.query);
    }

    /**
     * Calculate summary metrics from a sample data array
     */
    calculateSummary(data) {
        if (!data || data.length === 0) {
            return {
                total: 0,
                totalCost: "0.00",
                avgRating: 0,
                slaCompliance: 0,
                avgResolutionTime: 0,
                byStatus: {},
                byProvider: {},
                byPriority: {}
            };
        }

        let totalCost = 0;
        let totalRating = 0;
        let ratingCount = 0;
        let slaYes = 0;
        let slaTotal = 0;
        let totalResTime = 0;
        let resTimeCount = 0;

        const byStatus = {};
        const byProvider = {};
        const byPriority = {};

        data.forEach(row => {
            // Cost
            const cost = parseFloat(row.cost_inr || row.costInr || 0);
            totalCost += cost;

            // Rating
            const rating = parseFloat(row.customer_rating || row.customerRating || 0);
            if (rating > 0) {
                totalRating += rating;
                ratingCount++;
            }

            // SLA
            const sla = row.sla_met || row.slaMet;
            if (sla === 'Yes' || sla === 'No') {
                slaTotal++;
                if (sla === 'Yes') slaYes++;
            }

            // Resolution Time
            const resTime = parseFloat(row.resolution_time_hrs || row.resolutionTimeHrs || 0);
            if (resTime > 0) {
                totalResTime += resTime;
                resTimeCount++;
            }

            const status = row.status;
            const provider = row.service_provider || row.provider;
            const priority = row.priority;

            if (status) byStatus[status] = (byStatus[status] || 0) + 1;
            if (provider) byProvider[provider] = (byProvider[provider] || 0) + 1;
            if (priority) byPriority[priority] = (byPriority[priority] || 0) + 1;
        });

        return {
            total: data.length,
            totalCost: totalCost.toFixed(2),
            avgRating: ratingCount > 0 ? (totalRating / ratingCount).toFixed(1) : 0,
            slaCompliance: slaTotal > 0 ? ((slaYes / slaTotal) * 100).toFixed(1) : 0,
            avgResolutionTime: resTimeCount > 0 ? (totalResTime / resTimeCount).toFixed(1) : 0,
            byStatus,
            byProvider,
            byPriority
        };
    }

    /**
     * Map column names between JS and PostgreSQL
     */
    mapColumnName(jsName) {
        const mapping = {
            'provider': 'service_provider',
            'resolutionTimeHrs': 'resolution_time_hrs',
            'costInr': 'cost_inr',
            'customerType': 'customer_type',
            'vehicleType': 'vehicle_type',
            'assignedAgent': 'assigned_agent',
            'issueCategory': 'issue_category',
            'slaMet': 'sla_met',
            'customerRating': 'customer_rating',
            'escalationCount': 'escalation_count',
            'createdDate': 'created_date',
            'completedDate': 'completed_date',
            'workOrderId': 'work_order_id',
            'orderType': 'order_type'
        };
        return mapping[jsName] || jsName;
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ToolExecutor;
}
window.ToolExecutor = ToolExecutor;
