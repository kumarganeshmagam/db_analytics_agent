"""
Synthetic Work Orders Data Generator
Generates 100,000 work orders for Ola, Rapido, and Transit services
with varying complexity levels for Power BI reporting.
"""

import csv
import random
import os
from datetime import datetime, timedelta
from typing import List, Tuple

# Configuration
NUM_RECORDS = 100000
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), 'data')
OUTPUT_FILE = os.path.join(OUTPUT_DIR, 'work_orders_100k.csv')

# Data Sources
SERVICE_PROVIDERS = ['Ola', 'Rapido', 'Transit']
PROVIDER_WEIGHTS = [0.45, 0.35, 0.20]

COMPLEXITY_LEVELS = ['Simple', 'Medium', 'Complex']
COMPLEXITY_WEIGHTS = [0.40, 0.35, 0.25]

ORDER_TYPES = {
    'Ola': ['Ride', 'Outstation', 'Rental', 'Corporate'],
    'Rapido': ['Bike Ride', 'Auto', 'Delivery', 'Food Delivery'],
    'Transit': ['Bus', 'Metro', 'Suburban Train', 'Multi-Modal Pass']
}

STATUS_OPTIONS = ['Pending', 'In Progress', 'Completed', 'Cancelled', 'Escalated']
STATUS_WEIGHTS = {
    'Simple': [0.05, 0.10, 0.75, 0.08, 0.02],
    'Medium': [0.08, 0.15, 0.60, 0.10, 0.07],
    'Complex': [0.10, 0.20, 0.45, 0.12, 0.13]
}

PRIORITY_LEVELS = ['Low', 'Medium', 'High', 'Critical']
PRIORITY_WEIGHTS = {
    'Simple': [0.50, 0.35, 0.12, 0.03],
    'Medium': [0.25, 0.40, 0.25, 0.10],
    'Complex': [0.10, 0.25, 0.40, 0.25]
}

CITIES = [
    ('Mumbai', 'West'), ('Delhi', 'North'), ('Bangalore', 'South'),
    ('Chennai', 'South'), ('Hyderabad', 'South'), ('Kolkata', 'East'),
    ('Pune', 'West'), ('Ahmedabad', 'West'), ('Jaipur', 'North'),
    ('Lucknow', 'North'), ('Chandigarh', 'North'), ('Indore', 'Central'),
    ('Bhopal', 'Central'), ('Nagpur', 'Central'), ('Kochi', 'South'),
    ('Coimbatore', 'South'), ('Vizag', 'South'), ('Guwahati', 'East'),
    ('Patna', 'East'), ('Ranchi', 'East')
]

CUSTOMER_TYPES = ['Individual', 'Corporate', 'Premium', 'VIP']
CUSTOMER_WEIGHTS = [0.60, 0.20, 0.15, 0.05]

VEHICLE_TYPES = {
    'Ola': ['Mini', 'Sedan', 'SUV', 'Auto', 'Electric'],
    'Rapido': ['Bike', 'Auto', 'E-Bike'],
    'Transit': ['Bus', 'Metro Rail', 'Local Train', 'E-Bus']
}

ISSUE_CATEGORIES = [
    'Booking Issue', 'Payment Problem', 'Driver/Operator Complaint',
    'Technical Error', 'Safety Concern', 'Refund Request',
    'Route Issue', 'Fare Dispute', 'App Bug', 'Cancellation Issue'
]

ISSUE_WEIGHTS = {
    'Simple': [0.25, 0.20, 0.15, 0.10, 0.02, 0.15, 0.05, 0.05, 0.02, 0.01],
    'Medium': [0.15, 0.20, 0.18, 0.12, 0.05, 0.12, 0.08, 0.05, 0.03, 0.02],
    'Complex': [0.08, 0.15, 0.20, 0.10, 0.15, 0.10, 0.08, 0.07, 0.04, 0.03]
}

# Agent names - common Indian names
FIRST_NAMES = [
    'Amit', 'Priya', 'Rahul', 'Neha', 'Vikram', 'Sneha', 'Rohit', 'Pooja',
    'Arjun', 'Meera', 'Karan', 'Anjali', 'Suresh', 'Divya', 'Anil', 'Kavita',
    'Ravi', 'Sunita', 'Deepak', 'Nidhi', 'Sanjay', 'Preeti', 'Manish', 'Swati',
    'Vijay', 'Rekha', 'Rajesh', 'Shweta', 'Manoj', 'Pallavi'
]

LAST_NAMES = [
    'Sharma', 'Patel', 'Kumar', 'Singh', 'Gupta', 'Verma', 'Joshi', 'Reddy',
    'Nair', 'Mehta', 'Iyer', 'Rao', 'Das', 'Chatterjee', 'Mukherjee', 'Banerjee',
    'Agarwal', 'Mishra', 'Pandey', 'Saxena'
]

NOTES_TEMPLATES = {
    'Simple': [
        "Quick resolution provided via chat support.",
        "Customer satisfied with immediate response.",
        "Standard procedure followed, issue resolved.",
        "First call resolution achieved.",
        "Automated system handled the request."
    ],
    'Medium': [
        "Required coordination with driver partner.",
        "Payment gateway issue escalated to finance team.",
        "Multiple interactions needed for resolution.",
        "Partial refund processed after investigation.",
        "Technical team involved for app-side fix."
    ],
    'Complex': [
        "Multi-department coordination required. Safety team involved.",
        "Legal review pending. Customer compensation approved.",
        "Fraud investigation initiated. Account under review.",
        "Senior management escalation. VIP customer handling.",
        "Insurance claim filed. Awaiting third-party response."
    ]
}


def generate_agents(count: int = 500) -> List[str]:
    """Generate unique agent names."""
    agents = set()
    while len(agents) < count:
        name = f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"
        agents.add(name)
    return list(agents)


def generate_date_range(start_year: int = 2024, end_year: int = 2025) -> Tuple[datetime, datetime]:
    """Generate a random date range within the specified years."""
    start = datetime(start_year, 1, 1)
    end = datetime(end_year, 12, 31)
    
    days_range = (end - start).days
    created_date = start + timedelta(days=random.randint(0, days_range))
    
    return created_date


def generate_completion_date(created_date: datetime, complexity: str, status: str) -> str:
    """Generate completion date based on complexity and status."""
    if status in ['Pending', 'In Progress']:
        return ''
    
    if status == 'Cancelled':
        hours = random.uniform(0.5, 4)
    elif complexity == 'Simple':
        hours = random.uniform(0.5, 4)
    elif complexity == 'Medium':
        hours = random.uniform(4, 24)
    else:  # Complex
        hours = random.uniform(24, 72)
    
    completed = created_date + timedelta(hours=hours)
    return completed.strftime('%Y-%m-%d %H:%M:%S')


def generate_resolution_time(complexity: str, status: str) -> float:
    """Generate resolution time in hours based on complexity."""
    if status in ['Pending', 'In Progress']:
        return 0.0
    
    if complexity == 'Simple':
        return round(random.uniform(0.5, 4), 2)
    elif complexity == 'Medium':
        return round(random.uniform(4, 24), 2)
    else:  # Complex
        return round(random.uniform(24, 72), 2)


def generate_cost(provider: str, complexity: str, order_type: str) -> float:
    """Generate cost based on provider and complexity."""
    base_costs = {
        'Ola': {'Simple': (100, 500), 'Medium': (500, 2000), 'Complex': (2000, 15000)},
        'Rapido': {'Simple': (50, 200), 'Medium': (200, 800), 'Complex': (800, 5000)},
        'Transit': {'Simple': (20, 100), 'Medium': (100, 500), 'Complex': (500, 3000)}
    }
    
    min_cost, max_cost = base_costs[provider][complexity]
    return round(random.uniform(min_cost, max_cost), 2)


def generate_rating(status: str, complexity: str) -> int:
    """Generate customer rating based on status and handling."""
    if status == 'Cancelled':
        return random.choices([1, 2, 3], weights=[0.4, 0.4, 0.2])[0]
    elif status == 'Escalated':
        return random.choices([1, 2, 3, 4], weights=[0.2, 0.3, 0.3, 0.2])[0]
    elif complexity == 'Complex':
        return random.choices([2, 3, 4, 5], weights=[0.1, 0.2, 0.4, 0.3])[0]
    elif complexity == 'Medium':
        return random.choices([3, 4, 5], weights=[0.2, 0.4, 0.4])[0]
    else:  # Simple
        return random.choices([3, 4, 5], weights=[0.1, 0.3, 0.6])[0]


def generate_escalation_count(complexity: str, status: str) -> int:
    """Generate escalation count based on complexity."""
    if status == 'Escalated':
        if complexity == 'Complex':
            return random.randint(2, 5)
        elif complexity == 'Medium':
            return random.randint(1, 3)
        else:
            return random.randint(1, 2)
    elif complexity == 'Complex':
        return random.choices([0, 1, 2, 3], weights=[0.3, 0.3, 0.25, 0.15])[0]
    elif complexity == 'Medium':
        return random.choices([0, 1, 2], weights=[0.6, 0.3, 0.1])[0]
    else:
        return random.choices([0, 1], weights=[0.9, 0.1])[0]


def generate_sla_met(complexity: str, resolution_time: float, status: str) -> str:
    """Determine if SLA was met based on resolution time."""
    if status in ['Pending', 'In Progress']:
        return 'Pending'
    
    sla_thresholds = {'Simple': 4, 'Medium': 24, 'Complex': 48}
    
    if resolution_time <= sla_thresholds[complexity]:
        return 'Yes' if random.random() > 0.1 else 'No'  # 90% if within time
    else:
        return 'No' if random.random() > 0.3 else 'Yes'  # 30% even if over time


def generate_work_order(order_id: int, agents: List[str]) -> dict:
    """Generate a single work order record."""
    # Select provider and complexity
    provider = random.choices(SERVICE_PROVIDERS, weights=PROVIDER_WEIGHTS)[0]
    complexity = random.choices(COMPLEXITY_LEVELS, weights=COMPLEXITY_WEIGHTS)[0]
    
    # Get status and priority based on complexity
    status = random.choices(STATUS_OPTIONS, weights=STATUS_WEIGHTS[complexity])[0]
    priority = random.choices(PRIORITY_LEVELS, weights=PRIORITY_WEIGHTS[complexity])[0]
    
    # Select location
    city, region = random.choice(CITIES)
    
    # Generate dates
    created_date = generate_date_range()
    completed_date = generate_completion_date(created_date, complexity, status)
    resolution_time = generate_resolution_time(complexity, status)
    
    # Generate other fields
    order_type = random.choice(ORDER_TYPES[provider])
    vehicle_type = random.choice(VEHICLE_TYPES[provider])
    customer_type = random.choices(CUSTOMER_TYPES, weights=CUSTOMER_WEIGHTS)[0]
    issue_category = random.choices(ISSUE_CATEGORIES, weights=ISSUE_WEIGHTS[complexity])[0]
    
    cost = generate_cost(provider, complexity, order_type)
    rating = generate_rating(status, complexity) if status in ['Completed', 'Cancelled', 'Escalated'] else 0
    escalation_count = generate_escalation_count(complexity, status)
    sla_met = generate_sla_met(complexity, resolution_time, status)
    
    agent = random.choice(agents)
    notes = random.choice(NOTES_TEMPLATES[complexity])
    
    return {
        'work_order_id': f'WO-{order_id:06d}',
        'service_provider': provider,
        'complexity': complexity,
        'order_type': order_type,
        'status': status,
        'priority': priority,
        'created_date': created_date.strftime('%Y-%m-%d %H:%M:%S'),
        'completed_date': completed_date,
        'region': region,
        'city': city,
        'customer_type': customer_type,
        'vehicle_type': vehicle_type,
        'assigned_agent': agent,
        'resolution_time_hrs': resolution_time,
        'cost_inr': cost,
        'issue_category': issue_category,
        'sla_met': sla_met,
        'customer_rating': rating if rating > 0 else '',
        'escalation_count': escalation_count,
        'notes': notes
    }


def main():
    """Main function to generate work orders CSV."""
    print(f"🚀 Starting generation of {NUM_RECORDS:,} work orders...")
    
    # Create output directory
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    # Generate agent pool
    agents = generate_agents(500)
    print(f"✓ Generated pool of {len(agents)} agents")
    
    # Define CSV columns
    fieldnames = [
        'work_order_id', 'service_provider', 'complexity', 'order_type',
        'status', 'priority', 'created_date', 'completed_date', 'region',
        'city', 'customer_type', 'vehicle_type', 'assigned_agent',
        'resolution_time_hrs', 'cost_inr', 'issue_category', 'sla_met',
        'customer_rating', 'escalation_count', 'notes'
    ]
    
    # Generate and write records
    with open(OUTPUT_FILE, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        
        for i in range(1, NUM_RECORDS + 1):
            record = generate_work_order(i, agents)
            writer.writerow(record)
            
            if i % 10000 == 0:
                print(f"  Generated {i:,} records...")
    
    print(f"\n✅ Successfully generated {NUM_RECORDS:,} work orders!")
    print(f"📁 Output file: {OUTPUT_FILE}")
    
    # Print summary statistics
    print("\n📊 Quick Statistics:")
    print(f"   - File size: {os.path.getsize(OUTPUT_FILE) / (1024*1024):.2f} MB")


if __name__ == '__main__':
    main()
