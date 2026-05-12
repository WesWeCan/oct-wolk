import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import App from '@/front-end/App.vue';
import { RENDERER_MENU_COMMAND_EVENT, type ProjectEditorCommandId } from '@/shared/projectEditorCommands';
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

    const wrapper = mount(App, {
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

    wrapper.unmount();
  });

  it('runs native edit commands for focused text targets without dispatching project commands', async () => {
    const electronAPI = installMockElectronAPI();
    let menuListener: ((commandId: ProjectEditorCommandId) => void) | null = null;
    vi.mocked(electronAPI.onMenuCommand).mockImplementation((callback: (commandId: ProjectEditorCommandId) => void) => {
      menuListener = callback;
      return vi.fn();
    });
    const rendererCommand = vi.fn();
    window.addEventListener(RENDERER_MENU_COMMAND_EVENT, rendererCommand);

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'Index', component: { template: '<div />' } },
        { path: '/project/:projectId', name: 'ProjectEditor', component: { template: '<div />' } },
      ],
    });

    router.push('/project/project-1');
    await router.isReady();

    const wrapper = mount(App, {
      global: {
        plugins: [router],
        stubs: {
          RouterView: { template: '<div />' },
        },
      },
    });
    await flushPromises();

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    menuListener?.('edit.paste');
    await flushPromises();

    expect(electronAPI.performNativeEditCommand).toHaveBeenCalledWith('paste');
    expect(rendererCommand).not.toHaveBeenCalled();

    input.remove();
    window.removeEventListener(RENDERER_MENU_COMMAND_EVENT, rendererCommand);
    wrapper.unmount();
  });

  it('dispatches project edit commands when no text target is focused', async () => {
    const electronAPI = installMockElectronAPI();
    let menuListener: ((commandId: ProjectEditorCommandId) => void) | null = null;
    vi.mocked(electronAPI.onMenuCommand).mockImplementation((callback: (commandId: ProjectEditorCommandId) => void) => {
      menuListener = callback;
      return vi.fn();
    });
    const rendererCommand = vi.fn();
    window.addEventListener(RENDERER_MENU_COMMAND_EVENT, rendererCommand);

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'Index', component: { template: '<div />' } },
        { path: '/project/:projectId', name: 'ProjectEditor', component: { template: '<div />' } },
      ],
    });

    router.push('/project/project-1');
    await router.isReady();

    const wrapper = mount(App, {
      global: {
        plugins: [router],
        stubs: {
          RouterView: { template: '<div />' },
        },
      },
    });
    await flushPromises();

    menuListener?.('edit.paste');
    await flushPromises();

    expect(electronAPI.performNativeEditCommand).not.toHaveBeenCalled();
    expect(rendererCommand).toHaveBeenCalledTimes(1);
    expect((rendererCommand.mock.calls[0][0] as CustomEvent<ProjectEditorCommandId>).detail).toBe('edit.paste');

    window.removeEventListener(RENDERER_MENU_COMMAND_EVENT, rendererCommand);
    wrapper.unmount();
  });
});
