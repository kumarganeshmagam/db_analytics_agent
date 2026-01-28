from typing import List, Dict, Any, Optional
import pandas as pd

class AnalyticsAgent:
    """
    Sub-agent responsible for computing metrics and aggregations from raw data.
    """
    
    def process(self, data: List[Dict[str, Any]], intent_params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Processes raw data to compute aggregations and metrics.
        """
        if not data:
            return {"total": 0}
            
        df = pd.DataFrame(data)
        
        summary = {
            "total": len(df),
            "columns": list(df.columns)
        }
        
        # Numerical metrics
        numeric_cols = df.select_dtypes(include=['number']).columns
        for col in numeric_cols:
            summary[f"{col}_sum"] = float(df[col].sum())
            summary[f"{col}_avg"] = float(df[col].mean())
            summary[f"{col}_min"] = float(df[col].min())
            summary[f"{col}_max"] = float(df[col].max())
            
        # SLA calculation if column exists
        if 'sla_met' in df.columns:
            sla_met_count = (df['sla_met'] == 'Yes').sum()
            summary['sla_compliance'] = round((sla_met_count / len(df)) * 100, 2) if len(df) > 0 else 0
            
        return summary
