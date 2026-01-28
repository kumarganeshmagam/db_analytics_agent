from typing import List, Dict, Any, Optional
import pandas as pd

class VisualizationAgent:
    """
    Sub-agent responsible for generating chart configurations for the frontend.
    """
    
    def process(self, data: List[Dict[str, Any]], intent_params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generates Chart.js compatible configuration.
        """
        if not data:
            return {}
            
        df = pd.DataFrame(data)
        chart_type = intent_params.get('chart_type', 'bar')
        
        # Determine dimension and measure
        # Simplified logic: use first object/string column as dimension and first numeric as measure
        obj_cols = df.select_dtypes(include=['object']).columns
        num_cols = df.select_dtypes(include=['number']).columns
        
        if len(obj_cols) == 0 or len(num_cols) == 0:
            # Fallback for count queries
            if len(obj_cols) > 0:
                dim = obj_cols[0]
                counts = df[dim].value_counts()
                return self._format_chart(counts.index.tolist(), counts.tolist(), chart_type, f"Count by {dim}")
            return {}
            
        dim = obj_cols[0]
        measure = num_cols[0]
        
        grouped = df.groupby(dim)[measure].sum().sort_values(ascending=False).head(10)
        
        return self._format_chart(
            labels=grouped.index.tolist(),
            values=grouped.tolist(),
            chart_type=chart_type,
            title=f"{measure} by {dim}"
        )
        
    def _format_chart(self, labels: List[Any], values: List[Any], chart_type: str, title: str) -> Dict[str, Any]:
        return {
            "type": chart_type,
            "title": title,
            "labels": labels,
            "datasets": [{
                "label": title,
                "data": values,
                "backgroundColor": self._get_colors(len(labels))
            }]
        }
        
    def _get_colors(self, count: int) -> List[str]:
        # Simple palette
        colors = [
            '#F2C811', '#00D4AA', '#FF4D4D', '#4D94FF', '#B366FF',
            '#FF9933', '#33CCCC', '#FF66B3', '#99FF33', '#6666FF'
        ]
        return colors[:count] if count <= len(colors) else colors * (count // len(colors) + 1)
