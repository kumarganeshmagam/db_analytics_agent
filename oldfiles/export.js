/**
 * Export Utilities
 * CSV and PDF export functionality for query results
 */

const ExportUtils = {
    /**
     * Export data to CSV file
     * @param {Array} data - Array of work order objects
     * @param {string} filename - Output filename
     */
    toCSV(data, filename = 'work_orders.csv') {
        if (!data || data.length === 0) {
            console.warn('No data to export');
            return;
        }

        // Get headers from first object
        const headers = Object.keys(data[0]);

        // Build CSV content
        const csvRows = [
            headers.join(','), // Header row
            ...data.map(row =>
                headers.map(header => {
                    let value = row[header] || '';
                    // Escape quotes and wrap in quotes if contains comma
                    value = String(value).replace(/"/g, '""');
                    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                        value = `"${value}"`;
                    }
                    return value;
                }).join(',')
            )
        ];

        const csvContent = csvRows.join('\n');

        // Create and trigger download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    },

    /**
     * Export data to PDF file
     * @param {Array} data - Array of work order objects
     * @param {Object} summary - Summary statistics
     * @param {Object} query - Query parameters used
     * @param {string} filename - Output filename
     */
    toPDF(data, summary, query = {}, filename = 'work_orders.pdf') {
        if (!data || data.length === 0) {
            console.warn('No data to export');
            return;
        }

        // Access jsPDF from the global window object
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Colors
        const primaryColor = [242, 200, 17]; // Power BI Yellow
        const darkColor = [18, 18, 26];
        const textColor = [60, 60, 70];

        // Header
        doc.setFillColor(...darkColor);
        doc.rect(0, 0, 210, 40, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text('Power BI Query Results', 14, 20);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('Transit Work Order Report', 14, 28);

        // Timestamp
        doc.setFontSize(8);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 35);

        // Query Summary Box
        let yPos = 50;
        doc.setDrawColor(...primaryColor);
        doc.setLineWidth(0.5);
        doc.roundedRect(14, yPos, 182, 30, 3, 3);

        doc.setTextColor(...textColor);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('Query Parameters', 20, yPos + 8);

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        const queryParams = [];
        queryParams.push(`Time Range: ${query.dateRange || 'All'}`);
        if (query.status) queryParams.push(`Status: ${query.status}`);
        if (query.priority) queryParams.push(`Priority: ${query.priority}`);
        if (query.type) queryParams.push(`Type: ${query.type}`);

        doc.text(queryParams.join('  |  '), 20, yPos + 18);
        doc.text(`Total Records: ${data.length}`, 20, yPos + 26);

        yPos += 40;

        // Summary Statistics
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...textColor);
        doc.text('Summary Statistics', 14, yPos);
        yPos += 8;

        // Status breakdown
        if (summary.byStatus) {
            const statusText = Object.entries(summary.byStatus)
                .map(([status, count]) => `${status}: ${count}`)
                .join('  |  ');
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.text(`By Status: ${statusText}`, 14, yPos);
            yPos += 6;
        }

        // Priority breakdown
        if (summary.byPriority) {
            const priorityText = Object.entries(summary.byPriority)
                .map(([priority, count]) => `${priority}: ${count}`)
                .join('  |  ');
            doc.text(`By Priority: ${priorityText}`, 14, yPos);
            yPos += 6;
        }

        yPos += 10;

        // Data Table
        const tableHeaders = ['ID', 'Title', 'Status', 'Priority', 'Type', 'Date'];
        const tableData = data.map(row => [
            row.id,
            row.title.length > 35 ? row.title.substring(0, 32) + '...' : row.title,
            row.status,
            row.priority,
            row.type,
            row.createdDate
        ]);

        doc.autoTable({
            startY: yPos,
            head: [tableHeaders],
            body: tableData,
            theme: 'grid',
            headStyles: {
                fillColor: darkColor,
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 8
            },
            bodyStyles: {
                fontSize: 7,
                textColor: textColor
            },
            alternateRowStyles: {
                fillColor: [248, 248, 250]
            },
            columnStyles: {
                0: { cellWidth: 25 },
                1: { cellWidth: 60 },
                2: { cellWidth: 22 },
                3: { cellWidth: 20 },
                4: { cellWidth: 25 },
                5: { cellWidth: 25 }
            },
            margin: { left: 14, right: 14 }
        });

        // Footer
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text(
                `Page ${i} of ${pageCount}`,
                doc.internal.pageSize.width / 2,
                doc.internal.pageSize.height - 10,
                { align: 'center' }
            );
            doc.text(
                'Power BI Query Assistant - Transit Work Orders',
                14,
                doc.internal.pageSize.height - 10
            );
        }

        // Save
        doc.save(filename);
    },

    /**
     * Generate filename with timestamp
     * @param {string} prefix - Filename prefix
     * @param {string} extension - File extension
     * @returns {string} Generated filename
     */
    generateFilename(prefix = 'work_orders', extension = 'csv') {
        const date = new Date();
        const timestamp = date.toISOString().slice(0, 10).replace(/-/g, '');
        return `${prefix}_${timestamp}.${extension}`;
    }
};

// Export for use in other modules
window.ExportUtils = ExportUtils;
