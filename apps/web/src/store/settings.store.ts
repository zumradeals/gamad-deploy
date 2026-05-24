import { create } from 'zustand';
import type { UserProfile, OrgSettings, NotificationPrefs } from '@/api/types';

interface SettingsState {
  profile: UserProfile | null;
  orgSettings: OrgSettings | null;
  notifications: NotificationPrefs | null;
  isLoaded: boolean;
  load: (data: {
    profile: UserProfile;
    org: OrgSettings;
    notifications: NotificationPrefs;
  }) => void;
  setProfile: (profile: UserProfile) => void;
  setOrgSettings: (orgSettings: OrgSettings) => void;
  setNotification: (key: keyof Omit<NotificationPrefs, 'webhookUrl'>, value: boolean) => void;
  setWebhookUrl: (url: string) => void;
  reset: () => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  profile: null,
  orgSettings: null,
  notifications: null,
  isLoaded: false,

  load: ({ profile, org, notifications }) =>
    set({ profile, orgSettings: org, notifications, isLoaded: true }),

  setProfile: (profile) => set({ profile }),

  setOrgSettings: (orgSettings) => set({ orgSettings }),

  setNotification: (key, value) =>
    set((s) => ({
      notifications: s.notifications ? { ...s.notifications, [key]: value } : null,
    })),

  setWebhookUrl: (url) =>
    set((s) => ({
      notifications: s.notifications ? { ...s.notifications, webhookUrl: url } : null,
    })),

  reset: () =>
    set({ profile: null, orgSettings: null, notifications: null, isLoaded: false }),
}));
