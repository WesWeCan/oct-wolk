import { registerMotionBlockPlugin, setFallbackMotionBlockPlugin } from '@/front-end/motion-blocks/core/registry';
import { unsupportedMotionBlockPlugin } from '@/front-end/motion-blocks/core/unsupported-plugin';
import { subtitleMotionBlockPlugin } from '@/front-end/motion-blocks/subtitle/plugin';

let bootstrapped = false;

export function ensureMotionBlockPluginsRegistered(): void {
    if (bootstrapped) return;
    registerMotionBlockPlugin(unsupportedMotionBlockPlugin);
    registerMotionBlockPlugin(subtitleMotionBlockPlugin);
    setFallbackMotionBlockPlugin(unsupportedMotionBlockPlugin);
    bootstrapped = true;
}

export { subtitleMotionBlockPlugin };
