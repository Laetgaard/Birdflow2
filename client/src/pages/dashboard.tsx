import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Globe, Plus, Settings, CreditCard, LogOut, User as UserIcon, Loader2 } from "lucide-react";

export default function Dashboard() {
  const { user, profile, signOut, isLoading, isEmailVerified } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading) {
      // Redirect to auth if not logged in
      if (!user) {
        setLocation("/auth");
        return;
      }
      
      // Redirect to check-email if email not verified
      if (!isEmailVerified) {
        setLocation("/check-email");
        return;
      }
    }
  }, [user, isLoading, isEmailVerified, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !isEmailVerified) {
    return null;
  }

  const displayName = profile?.fullName || user.user_metadata?.full_name || user.email || "User";
  const displayEmail = profile?.email || user.email || "";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-lg">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground">
              <Globe className="w-5 h-5" />
            </div>
            SaaSify <span className="text-muted-foreground font-normal ml-2">Dashboard</span>
          </div>

          <div className="flex items-center gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full" data-testid="button-profile-menu">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={`https://avatar.vercel.sh/${displayEmail}`} alt={displayName} />
                    <AvatarFallback>{displayName.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none" data-testid="text-profile-name">{displayName}</p>
                    <p className="text-xs leading-none text-muted-foreground" data-testid="text-profile-email">
                      {displayEmail}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem data-testid="menu-item-profile">
                  <UserIcon className="mr-2 h-4 w-4" />
                  <span>Edit Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem data-testid="menu-item-billing">
                  <CreditCard className="mr-2 h-4 w-4" />
                  <span>Billing</span>
                </DropdownMenuItem>
                <DropdownMenuItem data-testid="menu-item-settings">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()} className="text-destructive focus:text-destructive" data-testid="menu-item-logout">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
          <div className="p-6 rounded-full bg-secondary mb-4">
            <Globe className="w-12 h-12 text-muted-foreground" />
          </div>
          
          <div className="max-w-md space-y-2">
            <h2 className="text-2xl font-bold tracking-tight" data-testid="text-empty-state-title">
              You haven't created any websites yet
            </h2>
            <p className="text-muted-foreground">
              Welcome to your dashboard, {displayName.split(' ')[0]}. To get started, create your first website project.
            </p>
          </div>

          <Button size="lg" className="gap-2" data-testid="button-create-website">
            <Plus className="w-4 h-4" />
            Create Website
          </Button>
        </div>
      </main>
    </div>
  );
}
