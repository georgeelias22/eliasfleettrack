import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NavLink } from '@/components/NavLink';
import { ThemeToggle } from '@/components/ThemeToggle';
import { DriverList } from '@/components/drivers/DriverList';
import { UpcomingCheckCodes } from '@/components/drivers/UpcomingCheckCodes';

export default function Drivers() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-foreground">Driver Management</h1>
              <p className="text-sm text-muted-foreground">Track licenses and check code reminders</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <nav className="hidden md:flex items-center gap-1">
              <NavLink to="/">Dashboard</NavLink>
              <NavLink to="/drivers">Drivers</NavLink>
              <NavLink to="/maintenance">Maintenance</NavLink>
              <NavLink to="/reports">Reports</NavLink>
              <NavLink to="/settings">Settings</NavLink>
            </nav>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <DriverList />
          </div>
          <div>
            <UpcomingCheckCodes />
          </div>
        </div>
      </main>
    </div>
  );
}
