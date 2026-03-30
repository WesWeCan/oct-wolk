import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import App from '@/front-end/App.vue';
import { installMockElectronAPI } from '../../mocks/electron';

describe('App', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('navigates to an imported project when the main process emits the import event', async () => {
    const electronAPI = installMockElectronAPI();
    let importedListener: ((payload: { projectId?: string }) => void) | null = null;
    vi.mocked(electronAPI.onProjectsImported).mockImplementation((callback: (payload: { projectId?: string }) => void) => {
      importedListener = callback;
      return vi.fn();
    });

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'Index', component: { template: '<div />' } },
        { path: '/project/:projectId', name: 'ProjectEditor', component: { template: '<div />' } },
      ],
    });

    router.push('/');
    await router.isReady();

    mount(App, {
      global: {
        plugins: [router],
        stubs: {
          RouterView: { template: '<div />' },
          AppHeaderFileActions: { template: '<div />' },
        },
      },
    });

    await flushPromises();

    importedListener?.({ projectId: 'imported-42' });
    await flushPromises();

    expect(router.currentRoute.value.name).toBe('ProjectEditor');
    expect(router.currentRoute.value.params.projectId).toBe('imported-42');
  });
});
