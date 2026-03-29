import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import AppHeaderFileActions from '@/front-end/components/AppHeaderFileActions.vue';
import { ArchiveService } from '@/front-end/services/ArchiveService';

describe('AppHeaderFileActions', () => {
  it('exports the current project from the project route', async () => {
    const exportProject = vi.spyOn(ArchiveService, 'exportProject').mockResolvedValue({
      canceled: false,
      filePath: '/tmp/exported.wolk',
    });

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'Index', component: { template: '<div />' } },
        { path: '/project/:projectId', name: 'ProjectEditor', component: { template: '<div />' } },
      ],
    });

    router.push({ name: 'ProjectEditor', params: { projectId: 'project-123' } });
    await router.isReady();

    const wrapper = mount(AppHeaderFileActions, {
      global: {
        plugins: [router],
      },
    });

    const buttons = wrapper.findAll('button');
    await buttons[1].trigger('click');
    await flushPromises();

    expect(exportProject).toHaveBeenCalledWith('project-123');
    expect(wrapper.text()).toContain('/tmp/exported.wolk');
  });
});
