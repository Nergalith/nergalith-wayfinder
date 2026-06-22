import {useEffect, useRef, useState} from 'react';
import {AppState, type AppStateStatus} from 'react-native';
import {Wayfinder} from '../utils/wayfinder';

export type PinState = {
  configured: boolean;
  unlocked: boolean;
  pin: string;
  confirmPin: string;
  error: string;
};

export function emptyPinState(): PinState {
  return {
    configured: false,
    unlocked: false,
    pin: '',
    confirmPin: '',
    error: '',
  };
}

export function usePinLock() {
  const [pinState, setPinState] = useState<PinState>(emptyPinState());
  const suppressLockRef = useRef(false);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        suppressLockRef.current = false;
        return;
      }

      if ((next === 'background' || next === 'inactive') && !suppressLockRef.current) {
        setPinState(current =>
          current.configured
            ? {...current, unlocked: false, pin: '', confirmPin: '', error: ''}
            : current,
        );
      }
    });

    return () => subscription.remove();
  }, []);

  async function refreshPinConfigured() {
    const configured = await Wayfinder.isPinConfigured();
    setPinState(current => ({
      ...current,
      configured,
      unlocked: configured ? current.unlocked : true,
    }));
  }

  function suppressPinForNativeIntent() {
    suppressLockRef.current = true;
  }

  function clearNativeIntentSuppression() {
    suppressLockRef.current = false;
  }

  return {
    pinState,
    setPinState,
    suppressLockRef,
    refreshPinConfigured,
    suppressPinForNativeIntent,
    clearNativeIntentSuppression,
  };
}