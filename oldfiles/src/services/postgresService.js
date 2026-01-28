/**
 * PostgreSQL Service - Queries PostgreSQL via PostgREST API
 * No backend needed - browser directly calls PostgREST REST API
 */

class PostgreSQLService {
    constructor(config = {}) {
        // PostgREST API endpoint (Docker container exposes this)
        this.apiUrl = config.apiUrl || 'http://localhost:3001';
        this.tableName = 'work_orders';
    }

    /**
     * Check if service is available
     */
    async isAvailable() {
        try {
            const response = await fetch(`${this.apiUrl}/`, { method: 'HEAD' });
            return response.ok;
        } catch {
            return false;
        }
    }

    /**
     * Query work orders with filters
     * PostgREST uses query params for filtering
     */
    async queryWorkOrders(filters = {}, options = {}) {
        const params = new URLSearchParams();

        // Apply filters using PostgREST syntax
        if (filters.provider) {
            params.append('service_provider', `eq.${filters.provider}`);
        }
        if (filters.status) {
            params.append('status', `eq.${filters.status}`);
        }
        if (filters.priority) {
            params.append('priority', `eq.${filters.priority}`);
        }
        if (filters.city) {
            params.append('city', `ilike.*${filters.city}*`);
        }
        if (filters.region) {
            params.append('region', `eq.${filters.region}`);
        }

        // Pagination
        if (options.limit) {
            params.append('limit', options.limit);
        }
        if (options.offset) {
            params.append('offset', options.offset);
        }

        // Order by
        params.append('order', options.orderBy || 'created_date.desc');

        const url = `${this.apiUrl}/${this.tableName}?${params.toString()}`;

        try {
            // Add abort controller for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(url, {
                headers: {
                    'Accept': 'application/json',
                    'Prefer': 'count=exact' // Get total count in header
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`Query failed: ${response.statusText}`);
            }

            const data = await response.json();
            const contentRange = response.headers.get('Content-Range');
            const totalCount = contentRange ? contentRange.split('/')[1] : data.length;

            return {
                success: true,
                data: data,
                total: parseInt(totalCount || 0),
                filters: filters
            };
        } catch (error) {
            console.error('PostgreSQL query error:', error);
            const isTimeout = error.name === 'AbortError';
            return {
                success: false,
                error: isTimeout ? 'Database connection timeout' : error.message,
                data: []
            };
        }
    }

    /**
     * Get count of work orders
     */
    async countWorkOrders(filters = {}) {
        const result = await this.queryWorkOrders(filters, { limit: 1 });
        return {
            success: result.success,
            count: result.total || 0
        };
    }

    /**
     * Get aggregated metrics
     * Note: PostgREST doesn't support aggregations directly,
     * so we fetch data and aggregate client-side (or use RPC functions)
     */
    async aggregateMetrics(metric, groupBy, filters = {}) {
        // For large datasets, you'd create PostgreSQL functions and use RPC
        // For now, we'll fetch limited data and aggregate

        const result = await this.queryWorkOrders(filters, { limit: 10000 });

        if (!result.success) {
            return result;
        }

        const data = result.data;
        const aggregation = {};

        switch (metric) {
            case 'count':
                if (groupBy) {
                    data.forEach(row => {
                        const key = row[this.mapColumnName(groupBy)] || 'Unknown';
                        aggregation[key] = (aggregation[key] || 0) + 1;
                    });
                } else {
                    return { success: true, count: result.total };
                }
                break;

            case 'sla_rate':
                const slaYes = data.filter(r => r.sla_met === 'Yes').length;
                const slaTotal = data.filter(r => r.sla_met !== 'Pending').length;
                return {
                    success: true,
                    rate: slaTotal > 0 ? ((slaYes / slaTotal) * 100).toFixed(1) : 0
                };

            case 'avg_rating':
                const ratings = data.filter(r => r.customer_rating > 0);
                const avg = ratings.length > 0
                    ? (ratings.reduce((s, r) => s + r.customer_rating, 0) / ratings.length).toFixed(1)
                    : 0;
                return { success: true, average: avg };

            case 'total_cost':
                const total = data.reduce((s, r) => s + (parseFloat(r.cost_inr) || 0), 0);
                return { success: true, total: total.toFixed(2) };
        }

        return { success: true, groupBy, aggregation };
    }

    /**
     * Execute raw SQL (requires PostgreSQL RPC function)
     */
    async executeSQL(query) {
        // This would require setting up an RPC function in PostgreSQL
        // For security, raw SQL isn't exposed via PostgREST by default
        console.warn('Raw SQL requires RPC function setup');
        return {
            success: false,
            message: 'Raw SQL not available. Use PostgREST query params or set up RPC functions.'
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
    module.exports = PostgreSQLService;
}
window.PostgreSQLService = PostgreSQLService;
