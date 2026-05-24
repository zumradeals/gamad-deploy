import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AnalysisResult } from '@/api/types';

export type ProjectType = 'git' | 'template' | 'lovable' | 'bolt' | 'replit';

export interface NewServerForm {
  name: string;
  host: string;
  port: string;
  agentToken: string;
}

interface WizardState {
  step: number;
  projectType: ProjectType | null;
  repoUrl: string;
  branch: string;
  gitToken: string;
  analysisResult: AnalysisResult | null;
  serverId: string | null;
  newServer: NewServerForm | null;
  domain: string;
  httpsEnabled: boolean;
  // actions
  setStep: (step: number) => void;
  setProjectType: (type: ProjectType) => void;
  setRepoUrl: (url: string) => void;
  setBranch: (branch: string) => void;
  setGitToken: (token: string) => void;
  setAnalysisResult: (result: AnalysisResult) => void;
  setServerId: (id: string | null) => void;
  setNewServer: (server: NewServerForm | null) => void;
  setDomain: (domain: string) => void;
  setHttpsEnabled: (enabled: boolean) => void;
  reset: () => void;
}

const initial = {
  step: 1,
  projectType: null,
  repoUrl: '',
  branch: 'main',
  gitToken: '',
  analysisResult: null,
  serverId: null,
  newServer: null,
  domain: '',
  httpsEnabled: true,
} as const;

export const useWizardStore = create<WizardState>()(
  persist(
    (set) => ({
      ...initial,
      setStep: (step) => set({ step }),
      setProjectType: (projectType) => set({ projectType }),
      setRepoUrl: (repoUrl) => set({ repoUrl }),
      setBranch: (branch) => set({ branch }),
      setGitToken: (gitToken) => set({ gitToken }),
      setAnalysisResult: (analysisResult) => set({ analysisResult }),
      setServerId: (serverId) => set({ serverId, newServer: null }),
      setNewServer: (newServer) => set({ newServer, serverId: null }),
      setDomain: (domain) => set({ domain }),
      setHttpsEnabled: (httpsEnabled) => set({ httpsEnabled }),
      reset: () => set({ ...initial }),
    }),
    {
      name: 'gamad-wizard',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
