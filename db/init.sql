-- Create work_orders table
CREATE TABLE IF NOT EXISTS work_orders (
    id SERIAL PRIMARY KEY,
    work_order_id VARCHAR(20) UNIQUE NOT NULL,
    service_provider VARCHAR(50),
    complexity VARCHAR(20),
    order_type VARCHAR(50),
    status VARCHAR(30),
    priority VARCHAR(20),
    created_date TIMESTAMP,
    completed_date TIMESTAMP,
    region VARCHAR(30),
    city VARCHAR(50),
    customer_type VARCHAR(30),
    vehicle_type VARCHAR(30),
    assigned_agent VARCHAR(100),
    resolution_time_hrs DECIMAL(10,2),
    cost_inr DECIMAL(12,2),
    issue_category VARCHAR(50),
    sla_met VARCHAR(10),
    customer_rating INTEGER,
    escalation_count INTEGER,
    notes TEXT
);

-- Create indexes for common queries
CREATE INDEX idx_provider ON work_orders(service_provider);
CREATE INDEX idx_status ON work_orders(status);
CREATE INDEX idx_priority ON work_orders(priority);
CREATE INDEX idx_city ON work_orders(city);
CREATE INDEX idx_region ON work_orders(region);
CREATE INDEX idx_created_date ON work_orders(created_date);

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO admin;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO admin;
