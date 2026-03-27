import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import MotionEnterExitEditor from '@/front-end/components/editor/motion/MotionEnterExitEditor.vue';
import { createDefaultSubtitleEnter, createDefaultSubtitleExit } from '@/front-end/motion-blocks/subtitle/defaults';

describe('MotionEnterExitEditor', () => {
    it('applies the All Off preset to enter motion without clearing timing', async () => {
        const enterValue = createDefaultSubtitleEnter();
        const wrapper = mount(MotionEnterExitEditor, {
            props: {
                enterValue,
                exitValue: createDefaultSubtitleExit(),
            },
        });

        const buttons = wrapper.findAll('button').filter((button) => button.text() === 'All Off');
        await buttons[0].trigger('click');

        const emitted = wrapper.emitted('update-enter-exit');
        expect(emitted).toBeTruthy();
        expect(emitted![0][0]).toBe('enter');
        expect(emitted![0][1]).toMatchObject({
            fraction: enterValue.fraction,
            minFrames: enterValue.minFrames,
            maxFrames: enterValue.maxFrames,
            easing: enterValue.easing,
            style: 'none',
            opacityStart: 1,
            opacityEnd: 1,
            fade: { enabled: false, opacityStart: 1, opacityEnd: 1 },
            move: { enabled: false },
            scale: { enabled: false },
        });
    });
});
