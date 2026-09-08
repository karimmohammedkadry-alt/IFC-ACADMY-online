/**
 * Sound and Web Notification Utility for IFC Academy
 * Provides synthesized notification chimes via Web Audio API
 * and Web Desktop/Mobile Notifications.
 */

class SoundAlertManager {
  private audioCtx: AudioContext | null = null;

  private initAudio() {
    if (!this.audioCtx && typeof window !== 'undefined') {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
  }

  private isSoundEnabled = true;

  public setSoundEnabled(enabled: boolean) {
    this.isSoundEnabled = enabled;
  }

  public getSoundEnabled(): boolean {
    return this.isSoundEnabled;
  }

  /**
   * Resumes AudioContext on user interaction
   */
  public resumeAudioContext() {
    this.initAudio();
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
  }

  /**
   * Authentic Warning Bell Chime using Web Audio API:
   * Generates a clear, resonant brass alert bell (two sequential chime strikes: high-bell strike followed by gentle harmonic ring)
   * used specifically when there are expiring or overdue subscriptions upon opening the academy.
   */
  public playWarningBellChime() {
    if (!this.isSoundEnabled) return;
    try {
      this.initAudio();
      if (!this.audioCtx) return;

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;

      // Strike 1: A5 (880 Hz) fundamental + E6 (1320 Hz) overtone
      const chime1 = (startTime: number, baseFreq: number, volume: number) => {
        if (!this.audioCtx) return;
        const osc = this.audioCtx.createOscillator();
        const overtone = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(baseFreq, startTime);

        overtone.type = 'triangle';
        overtone.frequency.setValueAtTime(baseFreq * 2.76, startTime); // metallic harmonic

        gain.gain.setValueAtTime(volume, startTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.9);

        osc.connect(gain);
        overtone.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(startTime);
        overtone.start(startTime);
        osc.stop(startTime + 0.9);
        overtone.stop(startTime + 0.9);
      };

      // Bell Strike 1
      chime1(now, 784, 0.25); // G5 bell chime
      // Bell Strike 2 (higher, ringing response)
      chime1(now + 0.22, 1046.5, 0.3); // C6 bell chime
    } catch (e) {
      console.warn('Warning bell chime could not be played:', e);
    }
  }

  /**
   * Plays an alert chime (two-tone alert) for subscription expiration or new warnings.
   */
  public playAlertSound() {
    if (!this.isSoundEnabled) return;
    try {
      this.initAudio();
      if (!this.audioCtx) return;

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;

      // First beep (800 Hz)
      const osc1 = this.audioCtx.createOscillator();
      const gain1 = this.audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(800, now);
      gain1.gain.setValueAtTime(0.15, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc1.connect(gain1);
      gain1.connect(this.audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.25);

      // Second beep (1000 Hz)
      const osc2 = this.audioCtx.createOscillator();
      const gain2 = this.audioCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1050, now + 0.15);
      gain2.gain.setValueAtTime(0.18, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc2.connect(gain2);
      gain2.connect(this.audioCtx.destination);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.45);
    } catch (e) {
      console.warn('Audio alert could not be played:', e);
    }
  }

  /**
   * Plays a success chime (e.g. renewal completed)
   */
  public playSuccessSound() {
    try {
      this.initAudio();
      if (!this.audioCtx) return;

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.12); // E5
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.25); // G5

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.5);
    } catch (e) {
      console.warn('Success sound could not be played:', e);
    }
  }

  /**
   * Cash register / financial tone
   */
  public playCashRegisterTone() {
    try {
      this.initAudio();
      if (!this.audioCtx) return;

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(987.77, now); // B5
      osc.frequency.exponentialRampToValueAtTime(1318.51, now + 0.1); // E6
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.4);
    } catch (e) {
      console.warn('Cash register sound could not be played:', e);
    }
  }

  public playAlertTone() {
    this.playAlertSound();
  }

  public playSuccessTone() {
    this.playSuccessSound();
  }

  /**
   * Requests permission for native browser notifications.
   */
  public async requestNotificationPermission(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return false;
    }
    if (Notification.permission === 'granted') {
      return true;
    }
    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  }

  /**
   * Sends a system background notification with sound.
   */
  public sendSystemNotification(title: string, body: string, icon = '/ifc_logo.jpg') {
    this.playAlertSound();

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon,
          badge: icon,
          dir: 'rtl',
          lang: 'ar',
        });
      } catch (e) {
        console.warn('System notification error:', e);
      }
    }
  }
}

export const soundAlert = new SoundAlertManager();
export const soundAlertManager = soundAlert;
