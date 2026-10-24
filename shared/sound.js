/**
 * Web Audio API synthesizer for phase transition chimes.
 * Works without any external audio files or dependencies.
 */
(function (root) {
  let audioCtx = null;

  function getAudioContext() {
    if (!audioCtx && typeof (window.AudioContext || window.webkitAudioContext) !== "undefined") {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioCtxClass();
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    return audioCtx;
  }

  /**
   * Plays a calm, melodic chime when a phase completes.
   * type: 'focus' (end of focus, time for break) | 'break' (end of break, time to focus)
   */
  function playPhaseChime(type = "focus") {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      // Chord notes (frequencies in Hz)
      // Focus complete: upbeat rising chord (C5 -> E5 -> G5)
      // Break complete: energizing attention chime (E5 -> A5)
      const notes = type === "focus"
        ? [523.25, 659.25, 783.99, 1046.50]
        : [659.25, 880.00, 1174.66];

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);

        // Envelope: soft attack, natural exponential release
        const startTime = now + idx * 0.12;
        const duration = 0.9;
        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.exponentialRampToValueAtTime(0.2, startTime + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + duration);
      });
    } catch (e) {
      console.warn("Audio playback not allowed or failed:", e);
    }
  }

  const FocusSound = {
    playPhaseChime
  };

  root.FocusSound = FocusSound;
})(typeof self !== "undefined" ? self : this);
