'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { 
  Shield, 
  AlertTriangle, 
  BarChart3, 
  Users, 
  Upload,
  Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnalyticsDashboard } from '@/components/admin/analytics-dashboard';
import { ModelList } from '@/components/admin/model-list';
import { ModelEditor } from '@/components/admin/model-editor';

type Tab = 'analytics' | 'models' | 'upload' | 'settings';

function AdminContent() {
  const searchParams = useSearchParams();
  const adminKey = searchParams.get('key');
  const [activeTab, setActiveTab] = useState<Tab>('analytics');
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [isAddingModel, setIsAddingModel] = useState(false);

  if (!adminKey) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-card border border-white/10 rounded-xl p-8 max-w-md text-center">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-muted-foreground">
            Admin key required. Add <code className="bg-white/10 px-2 py-1 rounded">?key=YOUR_KEY</code> to the URL.
          </p>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: typeof BarChart3 }[] = [
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'models', label: 'Models', icon: Users },
    { id: 'upload', label: 'Quick Upload', icon: Upload },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  // If editing a model, show the editor
  if (editingModelId || isAddingModel) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-white/10">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-3">
            <Shield className="w-6 h-6 text-[#00FF85]" />
            <span className="font-bold text-white">TransHere Admin</span>
            <span className="px-2 py-1 bg-[#7A27FF]/20 text-[#7A27FF] text-xs rounded-full">
              Model Editor
            </span>
          </div>
        </header>
        
        <main className="max-w-7xl mx-auto px-4 py-6">
          <ModelEditor
            adminKey={adminKey}
            modelId={editingModelId}
            onBack={() => {
              setEditingModelId(null);
              setIsAddingModel(false);
            }}
            onSaved={() => {
              setEditingModelId(null);
              setIsAddingModel(false);
            }}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Admin Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="w-6 h-6 text-[#00FF85]" />
              <span className="font-bold text-white">TransHere Admin</span>
            </div>
            
            {/* Tabs */}
            <div className="flex gap-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                    activeTab === tab.id
                      ? "bg-[#7A27FF] text-white"
                      : "text-muted-foreground hover:text-white hover:bg-white/5"
                  )}
                >
                  <tab.icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'analytics' && (
          <AnalyticsDashboard adminKey={adminKey} />
        )}
        
        {activeTab === 'models' && (
          <ModelList
            adminKey={adminKey}
            onEditModel={(id) => setEditingModelId(id)}
            onAddModel={() => setIsAddingModel(true)}
          />
        )}
        
        {activeTab === 'upload' && (
          <div className="text-center py-20 text-muted-foreground">
            <Upload className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Quick Upload functionality</p>
            <p className="text-sm mt-2">
              Use the Models tab to upload content for specific models
            </p>
          </div>
        )}
        
        {activeTab === 'settings' && (
          <div className="text-center py-20 text-muted-foreground">
            <Settings className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Settings panel coming soon</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-[#7A27FF] border-t-transparent rounded-full" />
      </div>
    }>
      <AdminContent />
    </Suspense>
  );
}
