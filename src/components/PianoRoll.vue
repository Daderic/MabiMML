<template>
    <div class="piano-container">
        <button class="play-button" @click="playSequence">Play Sequence</button>
        <div class="instrument-selector">
            <label for="instrument-select">Select Instrument: </label>
            <select id="instrument-select" v-model="selectedInstrument" @change="changeInstrument">
                <option v-for="(instrument, index) in instruments" :key="index" :value="instrument">
                    {{ instrument.name }}
                </option>
            </select>
        </div>
        <div class="piano-roll" ref="pianoRoll">
            <div class="piano-keys">
                <!-- Generate piano keys for multiple octaves -->
                <div v-for="octave in octaves" :key="octave" class="octave">
                    <div class="keys-wrapper">
                        <!-- Keys should be in reverse order to have higher notes at the top -->
                        <div v-for="(note, index) in notes.slice().reverse()" :key="note.name"
                            :class="['piano-key', note.isBlack ? 'black-key' : 'white-key']"
                            @mousedown="startNote(0, note, octave)"
                            @mouseover="mouseOverNote(0, note, octave)"
                            @mouseup="endNote(0, note, octave)"
                            @mouseleave="mouseLeaveNote(0, note, octave)"
                            :style="note.isBlack ? { zIndex: 1 } : {}">
                            {{ note.name + octave }}
                        </div>
                    </div>
                </div>
            </div>
            <div class="grid-wrapper">
                <div class="grid" ref="grid" :style="{ width: gridSpan + 'px' }" @mousedown.left="startPlacingNote" @contextmenu.prevent="startNoteRemove">
                    <div v-for="note in notesInGrid" :key="note.id" class="note"
                        :style="{
                        left: note.left + 'px',
                        top: note.top + 'px',
                        width: note.width + 'px',
                        height: gridHeight + 'px'
                        }"
                        @mousedown.left="startDrag(note, $event)"
                        @mouseup.left="endDrag"
                        @mousedown.right.prevent="removeNote(note)">
                        <div class="resize-handle" @mousedown="startResize(note, $event)"></div>
                        {{ note.name }}
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { ref, onMounted, watchEffect } from 'vue';
import { Synthetizer, MIDIBuilder, writeMIDIFile, Sequencer } from "spessasynth_lib";

export default {
    name: 'PianoRoll',
    setup() {
        const pianoRoll = ref(null);
        const grid = ref(null);
        const synth = ref(null);
        const context = ref(null);
        const isMouseDown = ref(false);
        const selectedInstrument = ref({ name: 'Piano', sf2: '../soundfonts/piano.sf2' });
        const midiBuilder = ref(null);

        const instruments = ref([
            { name: 'Piano', sf2: '../soundfonts/piano.sf2' },
            { name: 'Harp', sf2: '../soundfonts/harp.sf2' },
            { name: 'Lyre', sf2: '../soundfonts/lyre.sf2' },
            { name: 'Lute', sf2: '../soundfonts/lute.sf2' },
            { name: 'Ukulele', sf2: '../soundfonts/ukulele.sf2' },
            { name: 'Mandolin', sf2: '../soundfonts/mandolin.sf2' },
            { name: 'Electric Guitar', sf2: '../soundfonts/electric_guitar.sf2' },
            { name: 'Violin', sf2: '../soundfonts/violin.sf2' },
            { name: 'Cello', sf2: '../soundfonts/cello.sf2' },
            { name: 'Flute', sf2: '../soundfonts/flute.sf2' },
            { name: 'Whistle', sf2: '../soundfonts/whistle.sf2' },
            { name: 'Chalumeau', sf2: '../soundfonts/chalumeau.sf2' },
            { name: 'Roncadora', sf2: '../soundfonts/roncadora.sf2' },
            { name: 'Physis Tuba', sf2: '../soundfonts/tuba.sf2' },
            { name: 'Festival Lute', sf2: '../soundfonts/festival_lute.sf2' },
            { name: 'Festival Ukulele', sf2: '../soundfonts/festival_ukulele.sf2' },
            { name: 'Festival Mandolin', sf2: '../soundfonts/festival_mandolin.sf2' },
            { name: 'Fest/Tuned Flute', sf2: '../soundfonts/festival_flute.sf2' },
            { name: 'Fest/Tuned Whistle', sf2: '../soundfonts/festival_whistle.sf2' },
            { name: 'Tuned Violin', sf2: '../soundfonts/tuned_violin.sf2' },
            { name: 'Tuned Cello', sf2: '../soundfonts/tuned_cello.sf2' },
            { name: 'Drum Kit', sf2: '../soundfonts/drum_kit.sf2' },
            { name: 'Bass Drum', sf2: '../soundfonts/bass_drum.sf2' },
            { name: 'Snare Drum', sf2: '../soundfonts/snare_drum.sf2' },
            { name: 'Cymbals', sf2: '../soundfonts/cymbals.sf2' },
            { name: 'Hand Chimes', sf2: '../soundfonts/hand_chimes.sf2' },
            { name: 'Male Voice', sf2: '../soundfonts/male_voice.sf2' },
            { name: 'Male Chorus', sf2: '../soundfonts/male_chorus.sf2' },
            { name: 'Female Voice', sf2: '../soundfonts/female_voice.sf2' },
            { name: 'Female Chorus', sf2: '../soundfonts/female_chorus.sf2' },
            { name: "'C' Tone Bottle", sf2: '../soundfonts/c_tone_bottle.sf2' },
            { name: "'D' Tone Bottle", sf2: '../soundfonts/d_tone_bottle.sf2' },
            { name: "'E' Tone Bottle", sf2: '../soundfonts/e_tone_bottle.sf2' },
            { name: "'F' Tone Bottle", sf2: '../soundfonts/f_tone_bottle.sf2' },
            { name: "'G' Tone Bottle", sf2: '../soundfonts/g_tone_bottle.sf2' },
            { name: "'A' Tone Bottle", sf2: '../soundfonts/a_tone_bottle.sf2' },
            { name: "'B' Tone Bottle", sf2: '../soundfonts/b_tone_bottle.sf2' },
            { name: "'C' Tone Handbell", sf2: '../soundfonts/c_tone_handbell.sf2' },
            { name: "'D' Tone Handbell", sf2: '../soundfonts/d_tone_handbell.sf2' },
            { name: "'E' Tone Handbell", sf2: '../soundfonts/e_tone_handbell.sf2' },
            { name: "'F' Tone Handbell", sf2: '../soundfonts/f_tone_handbell.sf2' },
            { name: "'G' Tone Handbell", sf2: '../soundfonts/g_tone_handbell.sf2' },
            { name: "'A' Tone Handbell", sf2: '../soundfonts/a_tone_handbell.sf2' },
            { name: "'B' Tone Handbell", sf2: '../soundfonts/b_tone_handbell.sf2' },
            { name: 'High \'C\' Tone Handbell', sf2: '../soundfonts/high_c_tone_handbell.sf2' }
        ]);

        var currentNoteLength = ref(16);
        const gridWidth = 16;
        const gridHeight = 24;
        const notesInGrid = ref([]);
        const draggingNote = ref(null);
        const resizingNote = ref(null);
        const startX = ref(0);
        const startY = ref(0);
        const startLeft = ref(0);
        const startTop = ref(0);
        const startWidth = ref(0);
        const gridSpan = ref(window.innerWidth);

        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const blackNotes = ['C#', 'D#', 'F#', 'G#', 'A#'];
        const notes = ref(noteNames.map((name, index) => ({
            name: name,
            index: index,
            isBlack: blackNotes.includes(name)
        })));
        const octaves = ref([0, 1, 2, 3, 4, 5, 6, 7, 8]);

        watchEffect(() => {
            const maxRightPosition = Math.max(...notesInGrid.value.map(note => note.left + note.width), 0);
            gridSpan.value = Math.max(maxRightPosition + window.innerWidth, window.innerWidth);
        });

        const loadSoundFont = async (instrument) => {
            try {
                const response = await fetch(instrument.sf2);
                const soundFontArrayBuffer = await response.arrayBuffer();
                return soundFontArrayBuffer;
            } catch (error) {
                console.error("Failed to load SoundFont:", error);
                return null;
            }
        };

        onMounted(async () => {
            try {
                context.value = new AudioContext();
                await context.value.audioWorklet.addModule("../worklet_processor.min.js");
                const soundFontArrayBuffer = await loadSoundFont(selectedInstrument.value);
                if (!soundFontArrayBuffer) return;
                synth.value = new Synthetizer(context.value.destination, soundFontArrayBuffer, true, undefined, {chorusEnabled: false, reverbEnabled: false});
                await synth.value.isReady;

            } catch (error) {
                console.error("Error initializing sequencer or synthesizer:", error);
            }
        });

        const playSequence = async () => {
            try {
                midiBuilder.value = new MIDIBuilder("untitled", 480, 120);
                //midiBuilder.value.addEvent(0, 0, 0xC0, [selectedInstrument.value.program - 1]);
                
                context.value.resume();
                if (!synth.value) return;

                notesInGrid.value.forEach(note => {
                    const channel = 0;
                    const pitch = noteNames.indexOf(note.name.slice(0, -1)) + 12 * (parseInt(note.name.slice(-1)) + 1);
                    const startTime = note.left / gridWidth*120;
                    const duration = note.width * (480/(gridWidth*4));

                    midiBuilder.value.addNoteOn(startTime, 0, channel, pitch, 127);
                    midiBuilder.value.addNoteOff(startTime + duration, 0, channel, pitch);
                });

                midiBuilder.value.flush();

                const b = await(writeMIDIFile(midiBuilder.value));
                const seq = new Sequencer([{binary: b}], synth.value);
                seq.loop = false;
                await synth.value.isReady;
                seq.play();
            } catch (error) {
                console.error("Error playing sequence: ", error);
            }
        };

        const startNote = async (channel, note, octave) => {
            try {
                context.value.resume();
                await synth.value.isReady;
                synth.value.noteOn(channel, note.index + 12 * (octave + 1), 127, false);
            } catch (error) {
                console.error(error);
            }
        };

        const endNote = async (channel, note, octave) => {
            try {
                await synth.value.isReady;
                if (synth.value) {
                    synth.value.noteOff(channel, note.index + 12 * (octave + 1));
                }
            } catch (error) {
                console.error(error);
            }
        };

        const mouseOverNote = (channel, note, octave) => {
            if (isMouseDown.value && !draggingNote.value && !resizingNote.value) {
                startNote(channel, note, octave);
            }
        };

        const mouseLeaveNote = (channel, note, octave) => {
            if (isMouseDown.value && !draggingNote.value && !resizingNote.value) {
                endNote(channel, note, octave);
            }
        };

        const changeInstrument = async () => {
            if (synth.value) {

            }
            if (synth.value && selectedInstrument.value) {
                const soundFontArrayBuffer = await loadSoundFont(selectedInstrument.value);

                if (!soundFontArrayBuffer) return;

                //context.value = new AudioContext();
                //await context.value.audioWorklet.addModule("../worklet_processor.min.js");

                //synth.value = new Synthetizer(context.value.destination, soundFontArrayBuffer, true, undefined, {chorusEnabled: false, reverbEnabled: false});
                
                await synth.value.soundfontManager.reloadManager(soundFontArrayBuffer);
                await synth.value.isReady;
            }
        };

        const startDrag = (note, event) => {
            event.preventDefault();
            if (event.button === 0 && !resizingNote.value) { // Ensure we're dragging with left button
                draggingNote.value = note;
                startX.value = event.clientX;
                startY.value = event.clientY;
                startLeft.value = note.left;
                startTop.value = note.top;
                currentNoteLength.value = draggingNote.value.width / gridWidth;
                document.addEventListener('mousemove', onDrag);
                document.addEventListener('mouseup', endDrag);
            }
        };

        const onDrag = (event) => {
            if (draggingNote.value && !resizingNote.value) {
                const dx = event.clientX - startX.value;
                const dy = event.clientY - startY.value;
                var newLeft = Math.round((startLeft.value + dx) / gridWidth) * gridWidth;
                var newTop = Math.round((startTop.value + dy) / gridHeight) * gridHeight;

                if (newLeft < 0) {
                    newLeft = 0;
                }

                if (newTop < 0) {
                    newTop = 0;
                } else if (newTop > 2568) {
                    newTop = 2568;
                }

                draggingNote.value.left = newLeft;
                draggingNote.value.top = newTop;

                const number = (1284-(draggingNote.value.top/2))/144;
                const noteName = noteNames[number * 12 % 12] + "" + Math.floor(number);
                if (draggingNote.value.name != noteName) {
                    startNote(0, {name: noteName, index: number * 12 % 12}, Math.floor(number))
                    endNote(0, {name: noteName, index: number * 12 % 12}, Math.floor(number))
                }
                draggingNote.value.name = noteName;
            }
        };

        const endDrag = () => {
            draggingNote.value = null;
            document.removeEventListener('mousemove', onDrag);
            document.removeEventListener('mouseup', endDrag);
        };

        const startResize = (note, event) => {
            event.preventDefault();
            resizingNote.value = note;
            startX.value = event.clientX;
            startWidth.value = note.width;
            document.addEventListener('mousemove', onResize);
            document.addEventListener('mouseup', endResize);
        };

        const onResize = (event) => {
            if (resizingNote.value) {
                const dx = event.clientX - startX.value;
                let newWidth = Math.max(gridWidth, Math.round((startWidth.value + dx)/gridWidth)*gridWidth);
                resizingNote.value.width = newWidth;
                currentNoteLength.value = newWidth / gridWidth;
            }
        }

        const endResize = () => {
            resizingNote.value = null;
            document.removeEventListener('mousemove', onResize);
            document.removeEventListener('mouseup', endResize);
        }

        const startPlacingNote = (event) => {
            if (draggingNote.value || resizingNote.value) {
                return;
            }

            const gridElement = grid.value;
            const rect = gridElement.getBoundingClientRect();
            const x = event.clientX - rect.left + gridElement.scrollLeft;
            const y = event.clientY - rect.top + gridElement.scrollTop;

            const left = Math.round((x - gridWidth / 2) / gridWidth) * gridWidth;
            const top = Math.round((y - gridHeight / 2) / gridHeight) * gridHeight;

            const number = (1284-(top/2))/144;
            const noteName = noteNames[number * 12 % 12] + "" + Math.floor(number);
            startNote(0, {name: noteName, index: number * 12 % 12}, Math.floor(number))
            endNote(0, {name: noteName, index: number * 12 % 12}, Math.floor(number))

            const existingNote = notesInGrid.value.find(note =>
                note.left === left && note.top === top
            );

            if (!existingNote) {
                 // You can adjust this logic if needed
                notesInGrid.value.push({
                    id: Date.now(),
                    name: noteName,
                    left: left,
                    top: top,
                    width: gridWidth * currentNoteLength.value,
                });
            } else {
                // Start dragging if a note already exists at the clicked position
                startDrag(existingNote, event);
            }
        };

        const startNoteRemove = (note, event) => {
            if (event.button === 2) { // Ensure we're removing with right button
                removeNote(note);
            }
        };

        const removeNote = (note) => {
            notesInGrid.value = notesInGrid.value.filter(n => n.id !== note.id);
        };

        document.addEventListener('mousedown', (event) => {
            isMouseDown.value = true;
        });

        document.addEventListener('mouseup', () => {
            isMouseDown.value = false;
        });

        return {
            notes,
            octaves,
            startNote,
            endNote,
            mouseOverNote,
            mouseLeaveNote,
            instruments,
            selectedInstrument,
            changeInstrument,
            pianoRoll,
            grid,
            notesInGrid,
            startDrag,
            endDrag,
            startPlacingNote,
            removeNote,
            gridWidth,
            gridHeight,
            gridSpan,
            startResize,
            endResize,
            resizingNote,
            onResize,
            currentNoteLength,
            playSequence
        };
    }
};
</script>

<style scoped>

.piano-container {
    position: fixed;
    /* Fix to the left side of the screen */
    top: 0;
    left: 0;
    height: 100%;
    /* Full height */
    width: 100%;
    /* Width of the piano roll */
    background-color: #ddd;
}

.instrument-selector {
    padding: 10px;
    background-color: #f0f0f0;
    border-bottom: 1px solid #ccc;
}

.piano-roll {
    height: 100vh;
    flex-wrap: wrap;
    display: flex;
    overflow-y: auto;
    box-sizing: border-box;
    padding-bottom: 36px;
}

.piano-keys {
    width: 10%;
    display: flex;
    flex-direction: column-reverse;
    padding-bottom: 18px;
    /* Higher notes at the top */
}

.octave {
    flex-direction: column;
    position: relative;
}

.keys-wrapper {
    flex-direction: column-reverse;
    /* Ensure keys are in the correct order */
}

.piano-key {
    box-sizing: border-box;
    border: 1px solid #ccc;
    cursor: pointer;
    position: relative;
    user-select: none;
}

.white-key {
    width: 100%;
    height: 24px;
    align-content: center;
    /* Adjust based on desired key height */
    background: white;
    border-bottom: 1px solid #ccc;
    text-align: right;
    padding-right: 10px;
    user-select: none;
    font-size: 80%;
}

.black-key {
    background: black;
    color: #fff;
    width: 100%;
    height: 24px;
    align-content: center;
    /* Adjust based on desired key height */
    position: relative;
    /* Center black key over white key */
    text-align: right;
    padding-right: 10px;
    user-select: none;
    font-size: 80%;
}

.white-key:nth-child(2n+1) {
    background: #fff;
}

.white-key:nth-child(12n) {
    background: #bbb;
}

.grid-wrapper {
    overflow-x: scroll;
    overflow-y: hidden;
    flex-grow: 1;
    position: relative;
}

.grid {
    position: absolute;
    display: flex;
    min-width: 200%;
    align-self: top;
    height: 100%;/*2592px;*/
    background: repeating-linear-gradient(
        0deg,
        #ccc,
        #ccc 2px,
        transparent 2px,
        transparent 24px
    ),
    repeating-linear-gradient(
        90deg,
        #ccc,
        #ccc 2px,
        transparent 2px,
        transparent 16px
    );
    z-index: 10;
    overflow: hidden;
}

.note {
  position: absolute;
  background-color: rgba(0, 120, 255, 0.5);
  border: 1px solid #0078d4;
  cursor: pointer;
  box-sizing: border-box;
  user-select: none;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20;
  font-size: 70%;
}

.note:active {
    background-color: rgba(0, 120, 255, 0.7);
}

.resize-handle {
    position: absolute;
    right: 0;
    top: 0;
    width: 10px; /* Adjust as needed */
    height: 100%;
    cursor: ew-resize;
    background-color: rgba(0, 0, 0, 0.2);
}

.play-button {
  position: fixed;
  top: 10px;
  right: 10px;
  padding: 10px 20px;
  font-size: 16px;
  cursor: pointer;
  border: none;
  border-radius: 5px;
  background-color: #0078d4;
  color: white;
  z-index: 1000; /* Ensure it's on top of other elements */
  outline: none;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

</style>