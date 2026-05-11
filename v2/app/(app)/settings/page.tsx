import { SettingsPanel } from "@/components/settings/settings-panel";

export default function SettingsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Working days · country holiday presets · RAG thresholds · budget bands
        </p>
      </div>
      <SettingsPanel />
    </div>
  );
}
