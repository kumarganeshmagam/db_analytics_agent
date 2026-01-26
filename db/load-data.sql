-- Load data from CSV file
-- The CSV is mounted at /docker-entrypoint-initdb.d/data/work_orders_100k.csv

COPY work_orders(
    work_order_id,
    service_provider,
    complexity,
    order_type,
    status,
    priority,
    created_date,
    completed_date,
    region,
    city,
    customer_type,
    vehicle_type,
    assigned_agent,
    resolution_time_hrs,
    cost_inr,
    issue_category,
    sla_met,
    customer_rating,
    escalation_count,
    notes
)
FROM '/docker-entrypoint-initdb.d/data/work_orders_100k.csv'
DELIMITER ','
CSV HEADER;

-- Verify load
DO $$
DECLARE
    row_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO row_count FROM work_orders;
    RAISE NOTICE 'Loaded % work orders into database', row_count;
END $$;
