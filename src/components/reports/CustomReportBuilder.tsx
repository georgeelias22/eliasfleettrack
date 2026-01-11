import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useVehicles } from '@/hooks/useVehicles';
import { useSavedReports } from '@/hooks/useSavedReports';
import { SavedReport, ReportConfig } from '@/types/reports';
import { Plus, FileText, Trash2, Play, Edit2, Calendar, Car, BarChart3 } from 'lucide-react';
import { format, subMonths } from 'date-fns';
import { VehicleComparisonDashboard } from './VehicleComparisonDashboard';
import { CarbonFootprintDashboard } from './CarbonFootprintDashboard';

export function CustomReportBuilder() {
  const { data: vehicles } = useVehicles();
  const { reports, isLoading, createReport, deleteReport } = useSavedReports();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<SavedReport | null>(null);
  const [showReportView, setShowReportView] = useState(false);

  // New report form state
  const [newReport, setNewReport] = useState({
    name: '',
    description: '',
    report_type: 'comparison' as SavedReport['report_type'],
    vehicleIds: [] as string[],
    dateStart: format(subMonths(new Date(), 12), 'yyyy-MM-dd'),
    dateEnd: format(new Date(), 'yyyy-MM-dd'),
    includeInactive: false,
  });

  const activeVehicles = vehicles?.filter(v => v.is_active) || [];

  const handleCreateReport = async () => {
    const config: ReportConfig = {
      vehicleIds: newReport.vehicleIds.length > 0 ? newReport.vehicleIds : undefined,
      dateRange: {
        start: newReport.dateStart,
        end: newReport.dateEnd,
      },
      includeInactive: newReport.includeInactive,
    };

    await createReport.mutateAsync({
      name: newReport.name,
      description: newReport.description || undefined,
      report_type: newReport.report_type,
      config,
    });

    setIsCreateDialogOpen(false);
    setNewReport({
      name: '',
      description: '',
      report_type: 'comparison',
      vehicleIds: [],
      dateStart: format(subMonths(new Date(), 12), 'yyyy-MM-dd'),
      dateEnd: format(new Date(), 'yyyy-MM-dd'),
      includeInactive: false,
    });
  };

  const toggleVehicle = (vehicleId: string) => {
    setNewReport(prev => ({
      ...prev,
      vehicleIds: prev.vehicleIds.includes(vehicleId)
        ? prev.vehicleIds.filter(id => id !== vehicleId)
        : [...prev.vehicleIds, vehicleId],
    }));
  };

  const handleRunReport = (report: SavedReport) => {
    setSelectedReport(report);
    setShowReportView(true);
  };

  const getReportTypeIcon = (type: SavedReport['report_type']) => {
    switch (type) {
      case 'comparison': return <Car className="h-4 w-4" />;
      case 'carbon': return <BarChart3 className="h-4 w-4 text-green-500" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getReportTypeLabel = (type: SavedReport['report_type']) => {
    switch (type) {
      case 'comparison': return 'Vehicle Comparison';
      case 'carbon': return 'Carbon Footprint';
      case 'costs': return 'Cost Analysis';
      case 'fuel': return 'Fuel Analysis';
      case 'custom': return 'Custom Report';
      default: return type;
    }
  };

  if (showReportView && selectedReport) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => setShowReportView(false)}>
            ← Back to Reports
          </Button>
          <h2 className="text-xl font-semibold">{selectedReport.name}</h2>
        </div>
        
        {selectedReport.report_type === 'comparison' && (
          <VehicleComparisonDashboard />
        )}
        {selectedReport.report_type === 'carbon' && (
          <CarbonFootprintDashboard />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Custom Report Builder
              </CardTitle>
              <CardDescription>Create and save custom reports for quick access</CardDescription>
            </div>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New Report
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Create New Report</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Report Name</Label>
                    <Input
                      value={newReport.name}
                      onChange={(e) => setNewReport(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Monthly Fleet Overview"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Description (optional)</Label>
                    <Textarea
                      value={newReport.description}
                      onChange={(e) => setNewReport(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="What does this report show?"
                      rows={2}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Report Type</Label>
                    <Select
                      value={newReport.report_type}
                      onValueChange={(v) => setNewReport(prev => ({ ...prev, report_type: v as SavedReport['report_type'] }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="comparison">Vehicle Comparison</SelectItem>
                        <SelectItem value="carbon">Carbon Footprint</SelectItem>
                        <SelectItem value="costs">Cost Analysis</SelectItem>
                        <SelectItem value="fuel">Fuel Analysis</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Date Range</Label>
                    <div className="flex gap-2">
                      <Input
                        type="date"
                        value={newReport.dateStart}
                        onChange={(e) => setNewReport(prev => ({ ...prev, dateStart: e.target.value }))}
                      />
                      <span className="flex items-center text-muted-foreground">to</span>
                      <Input
                        type="date"
                        value={newReport.dateEnd}
                        onChange={(e) => setNewReport(prev => ({ ...prev, dateEnd: e.target.value }))}
                      />
                    </div>
                  </div>

                  {newReport.report_type === 'comparison' && (
                    <div className="space-y-2">
                      <Label>Select Vehicles (optional)</Label>
                      <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                        {activeVehicles.map(vehicle => (
                          <label
                            key={vehicle.id}
                            className="flex items-center gap-2 px-2 py-1 border rounded cursor-pointer hover:bg-muted/50"
                          >
                            <Checkbox
                              checked={newReport.vehicleIds.includes(vehicle.id)}
                              onCheckedChange={() => toggleVehicle(vehicle.id)}
                            />
                            <span className="text-sm">{vehicle.registration}</span>
                          </label>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Leave empty to include all active vehicles
                      </p>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="includeInactive"
                      checked={newReport.includeInactive}
                      onCheckedChange={(checked) => setNewReport(prev => ({ ...prev, includeInactive: !!checked }))}
                    />
                    <Label htmlFor="includeInactive" className="text-sm cursor-pointer">
                      Include inactive vehicles
                    </Label>
                  </div>

                  <Button
                    onClick={handleCreateReport}
                    disabled={!newReport.name || createReport.isPending}
                    className="w-full"
                  >
                    {createReport.isPending ? 'Creating...' : 'Create Report'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading saved reports...</div>
          ) : reports.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No saved reports yet</p>
              <p className="text-sm">Create your first custom report above</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {reports.map(report => (
                <Card key={report.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getReportTypeIcon(report.report_type)}
                        <h3 className="font-medium">{report.name}</h3>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteReport.mutate(report.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    {report.description && (
                      <p className="text-sm text-muted-foreground mb-3">{report.description}</p>
                    )}
                    
                    <div className="space-y-1 text-xs text-muted-foreground mb-3">
                      <div className="flex items-center gap-1">
                        <BarChart3 className="h-3 w-3" />
                        {getReportTypeLabel(report.report_type)}
                      </div>
                      {report.config.dateRange && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(report.config.dateRange.start), 'MMM d, yyyy')} - {format(new Date(report.config.dateRange.end), 'MMM d, yyyy')}
                        </div>
                      )}
                      {report.config.vehicleIds && report.config.vehicleIds.length > 0 && (
                        <div className="flex items-center gap-1">
                          <Car className="h-3 w-3" />
                          {report.config.vehicleIds.length} vehicle(s) selected
                        </div>
                      )}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => handleRunReport(report)}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Run Report
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
