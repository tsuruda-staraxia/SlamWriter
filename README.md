# SlamWriter

by Shogo Tsuruda

A browser-based riff sketchpad for slam / death metal: a 7-string Drop A tab editor, a random riff
generator (power chords and dissonant chords), preset metal drum beats, and MIDI export.

Open `index.html` through any static web server (samples are loaded with `fetch`, so opening the
file directly falls back to built-in synthesized sounds):

    python3 -m http.server 5178

## Credits

- Guitar, bass and drum samples: FluidR3_GM SoundFont by Frank Wen (MIT), via
  [midi-js-soundfonts](https://github.com/gleitz/midi-js-soundfonts) and
  [webaudiofontdata](https://github.com/surikov/webaudiofontdata).
- Cabinet impulse response (`samples/cab/cab.wav`): from
  [spiceAmp](https://github.com/olegkapitonov/spiceAmp) by Oleg Kapitonov, licensed GPL-3.0,
  trimmed to 180 ms mono.

See `samples/README.md` for details.
