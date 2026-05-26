import { jest } from '@jest/globals';
import { debounce } from '../../modules/utils/functionUtils.js';

describe('functionUtils', () => {
    describe('debounce', () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it('delays execution until wait elapses', () => {
            const fn = jest.fn();
            const debounced = debounce(fn, 100);

            debounced();
            expect(fn).not.toHaveBeenCalled();

            jest.advanceTimersByTime(99);
            expect(fn).not.toHaveBeenCalled();

            jest.advanceTimersByTime(1);
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('collapses rapid calls into a single invocation', () => {
            const fn = jest.fn();
            const debounced = debounce(fn, 100);

            debounced();
            debounced();
            debounced();

            jest.advanceTimersByTime(100);
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('passes the latest arguments through', () => {
            const fn = jest.fn();
            const debounced = debounce(fn, 100);

            debounced('first');
            debounced('second');
            debounced('third');

            jest.advanceTimersByTime(100);
            expect(fn).toHaveBeenCalledWith('third');
        });

        it('restarts the wait window on a new call', () => {
            const fn = jest.fn();
            const debounced = debounce(fn, 100);

            debounced();
            jest.advanceTimersByTime(80);
            debounced();
            jest.advanceTimersByTime(80);
            expect(fn).not.toHaveBeenCalled();

            jest.advanceTimersByTime(20);
            expect(fn).toHaveBeenCalledTimes(1);
        });
    });
});
