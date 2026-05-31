"use client";

import { useState } from "react";
import { SettingsShell, type SettingsTab } from "@/components/features/settings/SettingsShell";
import { ProfileSettingsPage } from "@/components/features/settings/ProfileSettingsPage";
import { SecuritySettingsPage } from "@/components/features/settings/SecuritySettingsPage";

export default function Page() {
    const [currentTab, setCurrentTab] = useState<SettingsTab>("profile");

    const renderContent = () => {
        switch (currentTab) {
            case "profile":
                return <ProfileSettingsPage />;
            case "security":
                return <SecuritySettingsPage />;
            default:
                return null;
        }
    };

    return (
        <SettingsShell currentTab={currentTab} onTabChange={setCurrentTab}>
            {renderContent()}
        </SettingsShell>
    );
}
