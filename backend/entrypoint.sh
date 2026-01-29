#!/bin/sh

# Wait for the database to be ready
echo "Waiting for PostgreSQL to be ready..."
while ! pg_isready -h postgres -p 5432 -U admin -d workorders > /dev/null 2>&1; do
  sleep 1
done
echo "PostgreSQL is ready."

# Load the data
echo "Loading data into work_orders table..."
psql "postgresql://admin:admin123@postgres:5432/workorders" -f /app/db/load-data.sql

# Start the application
echo "Starting the application..."
uvicorn main:app --host 0.0.0.0 --port 8000