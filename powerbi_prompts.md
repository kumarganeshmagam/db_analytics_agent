# Power BI Report Creation Guide
## Work Orders Analytics Dashboard for Ola, Rapido, and Transit

This guide provides step-by-step instructions and prompts for creating an interactive Power BI report using the `work_orders_100k.csv` dataset.

---

## 📥 Step 1: Import the CSV Data

1. Open **Power BI Desktop**
2. Click **Home** → **Get Data** → **Text/CSV**
3. Navigate to: `E:\AI\agent_bi_analytics\data\work_orders_100k.csv`
4. Click **Load** (or **Transform Data** for cleaning)

### Data Type Adjustments
After loading, ensure correct data types in **Power Query Editor**:

| Column | Data Type |
|--------|-----------|
| `created_date` | DateTime |
| `completed_date` | DateTime |
| `resolution_time_hrs` | Decimal Number |
| `cost_inr` | Decimal Number |
| `customer_rating` | Whole Number |
| `escalation_count` | Whole Number |

---

## 📊 Step 2: Create Key Measures (DAX)

Open the **Modeling** tab and create these measures:

```dax
-- Total Work Orders
Total Orders = COUNTROWS('work_orders_100k')

-- Completion Rate
Completion Rate = 
DIVIDE(
    CALCULATE(COUNTROWS('work_orders_100k'), 'work_orders_100k'[status] = "Completed"),
    COUNTROWS('work_orders_100k'),
    0
) * 100

-- Average Resolution Time
Avg Resolution Time = 
CALCULATE(
    AVERAGE('work_orders_100k'[resolution_time_hrs]),
    'work_orders_100k'[status] = "Completed"
)

-- SLA Compliance Rate
SLA Compliance % = 
DIVIDE(
    CALCULATE(COUNTROWS('work_orders_100k'), 'work_orders_100k'[sla_met] = "Yes"),
    CALCULATE(COUNTROWS('work_orders_100k'), 'work_orders_100k'[sla_met] IN {"Yes", "No"}),
    0
) * 100

-- Average Customer Rating
Avg Customer Rating = AVERAGE('work_orders_100k'[customer_rating])

-- Total Revenue
Total Revenue = SUM('work_orders_100k'[cost_inr])

-- Complex Orders Count
Complex Orders = 
CALCULATE(COUNTROWS('work_orders_100k'), 'work_orders_100k'[complexity] = "Complex")

-- Escalation Rate
Escalation Rate = 
DIVIDE(
    CALCULATE(COUNTROWS('work_orders_100k'), 'work_orders_100k'[escalation_count] > 0),
    COUNTROWS('work_orders_100k'),
    0
) * 100
```

---

## 🎨 Step 3: Design the Report Layout

### Page 1: Executive Summary Dashboard

#### Top Row - KPI Cards (4 cards)
| Card | Measure | Format |
|------|---------|--------|
| Total Orders | `Total Orders` | Whole number with commas |
| Completion Rate | `Completion Rate` | Percentage with 1 decimal |
| Avg Resolution | `Avg Resolution Time` | Number with "hrs" suffix |
| SLA Compliance | `SLA Compliance %` | Percentage with 1 decimal |

#### Charts Row 1
1. **Line Chart** - Orders Trend Over Time
   - X-Axis: `created_date` (Month)
   - Y-Axis: `Total Orders`
   - Legend: `service_provider`

2. **Donut Chart** - Orders by Provider
   - Values: Count of `work_order_id`
   - Legend: `service_provider`

#### Charts Row 2
3. **Stacked Bar Chart** - Complexity by Provider
   - Y-Axis: `service_provider`
   - X-Axis: Count of orders
   - Legend: `complexity`

4. **Clustered Column Chart** - Status Distribution
   - X-Axis: `status`
   - Y-Axis: Count of orders
   - Color by: Status (use conditional formatting)

#### Bottom Row
5. **Map** - Orders by City
   - Location: `city`
   - Size: Count of orders
   - Color: Average rating

---

### Page 2: Operational Metrics

#### Slicers (Top)
- Date Range Slicer: `created_date`
- Provider Dropdown: `service_provider`
- Complexity Dropdown: `complexity`
- Status Dropdown: `status`

#### Charts
1. **Gauge** - SLA Compliance
   - Value: `SLA Compliance %`
   - Target: 90%

2. **Bar Chart** - Top 10 Agents by Orders
   - Y-Axis: `assigned_agent`
   - X-Axis: Count of orders
   - Filter: Top 10

3. **Heatmap/Matrix** - Issue Categories by Priority
   - Rows: `issue_category`
   - Columns: `priority`
   - Values: Count of orders

4. **Scatter Plot** - Resolution Time vs Cost
   - X-Axis: `resolution_time_hrs`
   - Y-Axis: `cost_inr`
   - Details: `complexity`
   - Color: `service_provider`

---

### Page 3: Customer Analytics

1. **Bar Chart** - Customer Rating Distribution
2. **Pie Chart** - Customer Type Breakdown
3. **Table** - Low Rated Orders (Rating ≤ 2)
4. **Line Chart** - Customer Satisfaction Trend

---

## 🎯 Step 4: Add Interactivity

### Slicers to Add
```
- Date Range Slicer (created_date)
- Service Provider (single/multi-select)
- Complexity Level
- Region/City
- Status
- Priority
```

### Drill-Through
1. Create a detail page for individual work orders
2. Right-click on any chart → **Drill through** → **work_order_id**

### Bookmarks
Create bookmarks for:
- Overview (default view)
- Ola Focus
- Rapido Focus
- Transit Focus
- Complex Orders Only

---

## 💡 Manual Visualization Instructions (No Copilot Required)

Since you don't have AI/Copilot enabled, here are the **manual steps** to create each visualization:

---

### Chart 1: Total Orders by Provider (Pie Chart)
1. Click on empty canvas
2. From **Visualizations** panel (right side), click **Pie chart** icon
3. From **Data** panel, drag:
   - `service_provider` → **Legend**
   - `work_order_id` → **Values** (it will auto-count)

---

### Chart 2: Orders Trend Over Time (Line Chart)
1. Click empty area on canvas
2. Click **Line chart** icon
3. Drag:
   - `created_date` → **X-axis**
   - `work_order_id` → **Y-axis**
4. In the X-axis field, click dropdown → select **Month** hierarchy

---

### Chart 3: Status Distribution (Bar Chart)
1. Click **Clustered bar chart** icon
2. Drag:
   - `status` → **Y-axis**
   - `work_order_id` → **X-axis**

---

### Chart 4: Complexity Breakdown (Donut Chart)
1. Click **Donut chart** icon
2. Drag:
   - `complexity` → **Legend**
   - `work_order_id` → **Values**

---

### Chart 5: Top Cities (Horizontal Bar)
1. Click **Clustered bar chart**
2. Drag:
   - `city` → **Y-axis**
   - `work_order_id` → **X-axis**
3. Click on the chart → In **Filters** panel (right), find `city`
4. Change filter to **Top N** → Enter `10`

---

### Chart 6: KPI Card - Total Orders
1. Click **Card** visual icon
2. Drag `work_order_id` → **Fields** (shows count automatically)

---

### Chart 7: KPI Card - Average Cost
1. Click **Card** visual
2. Drag `cost_inr` → **Fields**
3. Click the dropdown on `cost_inr` → Select **Average**

---

### Chart 8: Table with Details
1. Click **Table** visual
2. Drag these fields in order:
   - `work_order_id`
   - `service_provider`
   - `complexity`
   - `status`
   - `city`
   - `cost_inr`
   - `customer_rating`

---

### Adding Slicers (Filters)
Slicers let users filter the entire report:

1. Click **Slicer** visual icon
2. Drag `service_provider` → **Field**
3. Repeat for: `complexity`, `status`, `region`
4. Arrange slicers at the top of your report

---

### Page Layout Suggestion
```
┌─────────────────────────────────────────────────────────┐
│  [Slicer: Provider] [Slicer: Status] [Slicer: Region]   │
├─────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│ │  TOTAL   │ │   AVG    │ │   AVG    │ │   SLA    │     │
│ │  ORDERS  │ │   COST   │ │  RATING  │ │    %     │     │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘     │
├───────────────────────┬─────────────────────────────────┤
│                       │                                 │
│   Orders by Provider  │      Orders Trend (Line)        │
│      (Pie Chart)      │                                 │
│                       │                                 │
├───────────────────────┼─────────────────────────────────┤
│                       │                                 │
│   Status Distribution │      Top 10 Cities (Bar)        │
│      (Bar Chart)      │                                 │
│                       │                                 │
└───────────────────────┴─────────────────────────────────┘
```

---

## 🎨 Recommended Theme & Colors

### Provider Colors
| Provider | Primary Color | Hex Code |
|----------|--------------|----------|
| Ola | Yellow/Green | `#3EB656` |
| Rapido | Yellow | `#F9C80E` |
| Transit | Blue | `#1E88E5` |

### Status Colors
| Status | Color | Hex |
|--------|-------|-----|
| Completed | Green | `#28A745` |
| In Progress | Blue | `#007BFF` |
| Pending | Orange | `#FD7E14` |
| Cancelled | Gray | `#6C757D` |
| Escalated | Red | `#DC3545` |

### Complexity Colors
| Level | Color | Hex |
|-------|-------|-----|
| Simple | Light Green | `#90EE90` |
| Medium | Yellow | `#FFD700` |
| Complex | Orange-Red | `#FF6347` |

---

## 📱 Mobile Layout

1. Go to **View** → **Mobile Layout**
2. Arrange cards and key visuals for mobile viewing
3. Prioritize: KPI cards, Provider donut chart, Trend line

---

## 🔄 Refresh Schedule (Power BI Service)

If publishing to Power BI Service:
1. Upload the CSV to OneDrive/SharePoint
2. Set up Scheduled Refresh (daily/weekly)
3. Configure data source credentials

---

## ✅ Final Checklist

- [ ] All data types correctly set
- [ ] DAX measures created and validated
- [ ] All visualizations responding to slicers
- [ ] Color scheme consistently applied
- [ ] Report title and descriptions added
- [ ] Mobile layout configured
- [ ] Performance optimized (aggregations if needed)
