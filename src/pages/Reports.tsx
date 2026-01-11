import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { AuthForm } from '@/components/auth/AuthForm';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ThemeToggle } from '@/components/ThemeToggle';
import { VehicleComparisonDashboard } from '@/components/reports/VehicleComparisonDashboard';
import { CarbonFootprintDashboard } from '@/components/reports/CarbonFootprintDashboard';
import { CustomReportBuilder } from '@/components/reports/CustomReportBuilder';
import { useSavedReports } from '@/hooks/useSavedReports';
import { ArrowLeft, BarChart3, Car, Leaf, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Reports() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { createReport } = useSavedReports();
  const [activeTab, setActiveTab] = useState('comparison');

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <AuthForm />
      </div>
    );
  }

  const handleSaveComparisonReport = (config: { vehicleIds: string[]; dateRange: { start: string; end: string } }) => {
    createReport.mutate({
      name: `Vehicle Comparison - ${new Date().toLocaleDateString()}`,
      report_type: 'comparison',
      config: {
        vehicleIds: config.vehicleIds.length > 0 ? config.vehicleIds : undefined,
        dateRange: config.dateRange,
      },
    });
  };

  const handleSaveCarbonReport = (config: { dateRange: { start: string; end: string } }) => {
    createReport.mutate({
      name: `Carbon Footprint - ${new Date().toLocaleDateString()}`,
      report_type: 'carbon',
      config: {
        dateRange: config.dateRange,
      },
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50 safe-area-top">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-6 w-6 text-primary" />
                <h1 className="text-xl font-bold">Reports & Analytics</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button variant="ghost" onClick={signOut}>
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
            <TabsTrigger value="comparison" className="flex items-center gap-2">
              <Car className="h-4 w-4" />
              <span className="hidden sm:inline">Vehicle Comparison</span>
              <span className="sm:hidden">Compare</span>
            </TabsTrigger>
            <TabsTrigger value="carbon" className="flex items-center gap-2">
              <Leaf className="h-4 w-4" />
              <span className="hidden sm:inline">Carbon Footprint</span>
              <span className="sm:hidden">Carbon</span>
            </TabsTrigger>
            <TabsTrigger value="custom" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Saved Reports</span>
              <span className="sm:hidden">Saved</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="comparison">
            <VehicleComparisonDashboard onSaveReport={handleSaveComparisonReport} />
          </TabsContent>

          <TabsContent value="carbon">
            <CarbonFootprintDashboard onSaveReport={handleSaveCarbonReport} />
          </TabsContent>

          <TabsContent value="custom">
            <CustomReportBuilder />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
