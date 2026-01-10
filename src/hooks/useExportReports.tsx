import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Vehicle } from '@/types/fleet';
import { FuelRecord } from '@/types/fuel';
import { format } from 'date-fns';

interface ServiceRecord {
  id: string;
  vehicle_id: string;
  service_date: string;
  service_type: string;
  description: string | null;
  cost: number;
  mileage: number | null;
  provider: string | null;
}

interface ExportData {
  vehicles: Vehicle[];
  fuelRecords: FuelRecord[];
  serviceRecords: ServiceRecord[];
  analytics: {
    totalCost: number;
    totalFuelCost: number;
    totalServiceCost: number;
    totalFinanceCost: number;
    totalTaxCost: number;
    totalLitres: number;
    avgCostPerLitre: number;
  };
}

export function useExportReports() {
  const formatCurrency = (value: number) => 
    `£${value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd/MM/yyyy');
    } catch {
      return dateString;
    }
  };

  const getVehicleName = (vehicleId: string, vehicles: Vehicle[]) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    return vehicle ? `${vehicle.registration} - ${vehicle.make} ${vehicle.model}` : 'Unknown';
  };

  const exportFuelRecordsCSV = (fuelRecords: FuelRecord[], vehicles: Vehicle[]) => {
    const headers = ['Date', 'Vehicle', 'Station', 'Litres', 'Cost/Litre', 'Total Cost', 'Mileage'];
    const rows = fuelRecords.map(record => [
      formatDate(record.fill_date),
      getVehicleName(record.vehicle_id, vehicles),
      record.station || '',
      record.litres.toFixed(2),
      formatCurrency(record.cost_per_litre),
      formatCurrency(record.total_cost),
      record.mileage?.toString() || '',
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    downloadFile(csvContent, `fuel-records-${format(new Date(), 'yyyy-MM-dd')}.csv`, 'text/csv');
  };

  const exportServiceRecordsCSV = (serviceRecords: ServiceRecord[], vehicles: Vehicle[]) => {
    const headers = ['Date', 'Vehicle', 'Type', 'Description', 'Provider', 'Cost', 'Mileage'];
    const rows = serviceRecords.map(record => [
      formatDate(record.service_date),
      getVehicleName(record.vehicle_id, vehicles),
      record.service_type,
      record.description || '',
      record.provider || '',
      formatCurrency(record.cost),
      record.mileage?.toString() || '',
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    downloadFile(csvContent, `service-records-${format(new Date(), 'yyyy-MM-dd')}.csv`, 'text/csv');
  };

  const exportFleetSummaryCSV = (data: ExportData) => {
    const { vehicles, fuelRecords, serviceRecords, analytics } = data;

    // Summary section
    const summaryRows = [
      ['FLEET SUMMARY REPORT'],
      [`Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`],
      [''],
      ['COST BREAKDOWN'],
      ['Category', 'Amount'],
      ['Total Fleet Cost', formatCurrency(analytics.totalCost)],
      ['Fuel Costs', formatCurrency(analytics.totalFuelCost)],
      ['Service Costs', formatCurrency(analytics.totalServiceCost)],
      ['Finance Costs', formatCurrency(analytics.totalFinanceCost)],
      ['Tax Costs', formatCurrency(analytics.totalTaxCost)],
      [''],
      ['FUEL STATISTICS'],
      ['Total Litres', `${analytics.totalLitres.toFixed(1)}L`],
      ['Average Cost/Litre', formatCurrency(analytics.avgCostPerLitre)],
      [''],
      ['VEHICLES'],
      ['Registration', 'Make', 'Model', 'Year', 'Annual Tax', 'Monthly Finance'],
      ...vehicles.map(v => [
        v.registration,
        v.make,
        v.model,
        v.year?.toString() || '',
        formatCurrency(v.annual_tax || 0),
        formatCurrency(v.monthly_finance || 0),
      ]),
      [''],
      ['FUEL RECORDS'],
      ['Date', 'Vehicle', 'Station', 'Litres', 'Cost/Litre', 'Total Cost', 'Mileage'],
      ...fuelRecords.map(record => [
        formatDate(record.fill_date),
        getVehicleName(record.vehicle_id, vehicles),
        record.station || '',
        record.litres.toFixed(2),
        formatCurrency(record.cost_per_litre),
        formatCurrency(record.total_cost),
        record.mileage?.toString() || '',
      ]),
      [''],
      ['SERVICE RECORDS'],
      ['Date', 'Vehicle', 'Type', 'Provider', 'Cost', 'Mileage'],
      ...serviceRecords.map(record => [
        formatDate(record.service_date),
        getVehicleName(record.vehicle_id, vehicles),
        record.service_type,
        record.provider || '',
        formatCurrency(record.cost),
        record.mileage?.toString() || '',
      ]),
    ];

    const csvContent = summaryRows
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    downloadFile(csvContent, `fleet-summary-${format(new Date(), 'yyyy-MM-dd')}.csv`, 'text/csv');
  };

  const exportFleetSummaryPDF = (data: ExportData) => {
    const { vehicles, fuelRecords, serviceRecords, analytics } = data;
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(20);
    doc.setTextColor(33, 33, 33);
    doc.text('Fleet Summary Report', 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 30);

    let yPos = 40;

    // Cost Summary
    doc.setFontSize(14);
    doc.setTextColor(33, 33, 33);
    doc.text('Cost Breakdown (12 Months)', 14, yPos);
    yPos += 8;

    autoTable(doc, {
      startY: yPos,
      head: [['Category', 'Amount']],
      body: [
        ['Total Fleet Cost', formatCurrency(analytics.totalCost)],
        ['Fuel Costs', formatCurrency(analytics.totalFuelCost)],
        ['Service Costs', formatCurrency(analytics.totalServiceCost)],
        ['Finance Costs', formatCurrency(analytics.totalFinanceCost)],
        ['Tax Costs', formatCurrency(analytics.totalTaxCost)],
      ],
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
      margin: { left: 14 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;

    // Fuel Statistics
    doc.setFontSize(14);
    doc.text('Fuel Statistics', 14, yPos);
    yPos += 8;

    autoTable(doc, {
      startY: yPos,
      head: [['Metric', 'Value']],
      body: [
        ['Total Litres', `${analytics.totalLitres.toFixed(1)}L`],
        ['Average Cost/Litre', formatCurrency(analytics.avgCostPerLitre)],
        ['Total Fuel Spend', formatCurrency(analytics.totalFuelCost)],
      ],
      theme: 'striped',
      headStyles: { fillColor: [245, 158, 11] },
      margin: { left: 14 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;

    // Vehicles
    doc.setFontSize(14);
    doc.text('Fleet Vehicles', 14, yPos);
    yPos += 8;

    autoTable(doc, {
      startY: yPos,
      head: [['Registration', 'Make', 'Model', 'Year', 'Annual Tax', 'Monthly Finance']],
      body: vehicles.map(v => [
        v.registration,
        v.make,
        v.model,
        v.year?.toString() || '-',
        formatCurrency(v.annual_tax || 0),
        formatCurrency(v.monthly_finance || 0),
      ]),
      theme: 'striped',
      headStyles: { fillColor: [99, 102, 241] },
      margin: { left: 14 },
      styles: { fontSize: 9 },
    });

    // New page for records
    doc.addPage();
    yPos = 20;

    // Fuel Records
    doc.setFontSize(14);
    doc.text('Fuel Records', 14, yPos);
    yPos += 8;

    if (fuelRecords.length > 0) {
      autoTable(doc, {
        startY: yPos,
        head: [['Date', 'Vehicle', 'Station', 'Litres', 'Cost/L', 'Total']],
        body: fuelRecords.slice(0, 30).map(record => [
          formatDate(record.fill_date),
          vehicles.find(v => v.id === record.vehicle_id)?.registration || '-',
          record.station || '-',
          record.litres.toFixed(2),
          formatCurrency(record.cost_per_litre),
          formatCurrency(record.total_cost),
        ]),
        theme: 'striped',
        headStyles: { fillColor: [245, 158, 11] },
        margin: { left: 14 },
        styles: { fontSize: 8 },
      });
      
      if (fuelRecords.length > 30) {
        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(`+ ${fuelRecords.length - 30} more records (see CSV export for full list)`, 14, (doc as any).lastAutoTable.finalY + 5);
      }
      
      yPos = (doc as any).lastAutoTable.finalY + 15;
    } else {
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text('No fuel records found.', 14, yPos);
      yPos += 10;
    }

    // Service Records
    if (yPos > 200) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(14);
    doc.setTextColor(33, 33, 33);
    doc.text('Service Records', 14, yPos);
    yPos += 8;

    if (serviceRecords.length > 0) {
      autoTable(doc, {
        startY: yPos,
        head: [['Date', 'Vehicle', 'Type', 'Provider', 'Cost']],
        body: serviceRecords.slice(0, 30).map(record => [
          formatDate(record.service_date),
          vehicles.find(v => v.id === record.vehicle_id)?.registration || '-',
          record.service_type,
          record.provider || '-',
          formatCurrency(record.cost),
        ]),
        theme: 'striped',
        headStyles: { fillColor: [16, 185, 129] },
        margin: { left: 14 },
        styles: { fontSize: 8 },
      });

      if (serviceRecords.length > 30) {
        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(`+ ${serviceRecords.length - 30} more records (see CSV export for full list)`, 14, (doc as any).lastAutoTable.finalY + 5);
      }
    } else {
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text('No service records found.', 14, yPos);
    }

    doc.save(`fleet-summary-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return {
    exportFuelRecordsCSV,
    exportServiceRecordsCSV,
    exportFleetSummaryCSV,
    exportFleetSummaryPDF,
  };
}
