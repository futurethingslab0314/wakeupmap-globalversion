(function (root) {
  'use strict';
  function create(options) {
    const speech = options.speech;
    const Utterance = options.Utterance;
    const schedule = options.setTimeout || root.setTimeout.bind(root);
    const unschedule = options.clearTimeout || root.clearTimeout.bind(root);
    let generation = 0, timer = null, current = null, active = false;
    function clearTimer() { if (timer !== null) unschedule(timer); timer = null; }
    function cancelSpeech() { try { if (speech) speech.cancel(); } catch {} current = null; }
    function start(country, city) {
      const token = ++generation;
      active = true;
      clearTimer();
      cancelSpeech();
      const alive = () => active && generation === token;
      function fallback() {
        if (!alive()) return;
        active = false;
        clearTimer();
        cancelSpeech();
        options.startRinging();
      }
      let voices;
      try { voices = speech && Utterance && speech.getVoices(); } catch { fallback(); return; }
      const voice = voices && (voices.find(v => /^zh[-_]TW$/i.test(v.lang)) || voices.find(v => /^zh(?:[-_]|$)/i.test(v.lang)));
      if (!voice || !country || !city) { fallback(); return; }
      function say(round) {
        if (!alive()) return;
        try {
          const utterance = new Utterance(`${country}的${city}到了`);
          current = utterance;
          utterance.voice = voice;
          utterance.lang = voice.lang;
          utterance.rate = 1;
          let finished = false;
          const valid = () => alive() && current === utterance && !finished;
          utterance.onstart = () => {
            if (!valid()) return;
            clearTimer();
            timer = schedule(fallback, 15000);
          };
          utterance.onerror = () => { if (valid()) fallback(); };
          utterance.onend = () => {
            if (!valid()) return;
            finished = true;
            clearTimer();
            if (round === 1) timer = schedule(() => say(2), 3000);
            else fallback();
          };
          timer = schedule(fallback, 3000);
          speech.speak(utterance);
        } catch { fallback(); }
      }
      say(1);
    }
    function stop() {
      ++generation;
      active = false;
      clearTimer();
      cancelSpeech();
      options.stopRinging();
    }
    // Warm the voice list before an unattended alarm (some browsers populate it lazily).
    try { if (speech) speech.getVoices(); } catch {}
    return { start, stop };
  }
  root.WakeupHereAnnouncement = { create };
})(typeof window !== 'undefined' ? window : globalThis);
