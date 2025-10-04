<template>
    <div class="piano-container">
        <button class="play-button" @click="playSequence">Play Sequence</button>
        <label class="loop-wrapper">
            Loop:
            <input type="checkbox" v-model="loopSong" />
        </label>
        <label class="scroll-wrapper">
            Auto-scroll:
            <input type="checkbox" v-model="autoScrollSong" />
        </label>
        <ExportMenu :tracks="tracks" :generateTokens="genTokensOutright" :renderTokens="renderTokens"
            :copyToClipboard="copyToClipboard" />
        <HelpMenu />
        <div v-if="showSuccessNotification" class="copyNotification">
            {{ successNotificationText }}
        </div>
        <div v-if="showFailedNotification" class="copyNotification" style="background-color: #d44;">
            {{ failedNotificationText }}
        </div>

        <Tracks @track-selected="handleTrackSelected" @add-track="handleAddTrack" @remove-track="handleRemoveTrack"
            @mute-track="handleMuteTrack" @color-change="updateColor" />
        <div class="controls">
            <div class="instrument-selector">
                <label for="instrument-select">Select Instrument: </label>
                <select id="instrument-select" v-model="selectedInstrument" @change="changeInstrument(false)">
                    <option v-for="(instrument, index) in instruments" :key="index" :value="instrument">
                        {{ instrument.name }}
                    </option>
                </select>
            </div>
            <div class="tempo-selector">
                <label for="tempo-select">Tempo: </label>
                <input type="number" id="tempo-select" v-model.number="tempo" min="40" max="240">
            </div>
            <button class="track-splitter" @click="trackify">Split Track</button>
            <!--<button class="MML-converter" @click="genTokensOutright" style="margin-left: 10px;">Gen MML</button>-->
            <button @click="parseMMLFromClipboard" style="margin-left: 10px;">Import MML From Clipboard</button>
            <button @click="importMidi" style="margin-left: 10px;">Import MIDI</button>
            <button @click="exportMidi" style="margin-left: 10px;">Export MIDI</button>
            <input type="file" id="hiddenFileInput" style="display: none" accept=".mid,.midi" />
            <div class="grid-division-selector">
                <label for="grid-select" style="padding-left: 10px">Grid Spacing: </label>
                <select id="grid-select" v-model="gridWidth">
                    <option
                        v-for="(value) in [{ displayName: '16ths', width: 256 / 16 }, { displayName: '12ths', width: 256 / 12 }]"
                        :key="value.displayName" :value="value.width">
                        {{ value.displayName }}
                    </option>
                </select>
            </div>
            <label style="padding: 10px;"> {{ 'Current Note Volume: ' + currentNoteVolume }} </label>
        </div>
        <div class="piano-roll" ref="pianoRoll">
            <div class="piano-keys">
                <!-- Generate piano keys for multiple octaves -->
                <div v-for="octave in octaves" :key="octave" class="octave">
                    <div class="keys-wrapper">
                        <!-- Keys should be in reverse order to have higher notes at the top -->
                        <div v-for="(note, index) in notes.slice().reverse()" :key="note.name"
                            :class="['piano-key', note.isBlack ? 'black-key' : 'white-key']"
                            @mousedown="startNote(0, note, octave)" @mouseover="mouseOverNote(0, note, octave)"
                            @mouseup="endNote(0, note, octave)" @mouseleave="mouseLeaveNote(0, note, octave)" :style="{
                                zIndex: note.isBlack ? 1 : 0,
                                background: note.index + 12 * octave < instrKeyMin || note.index + 12 * octave > instrKeyMax ? '#d44' : (note.isBlack ? '#000' : '#fff')
                            }">
                            {{ note.name + octave }}
                        </div>
                    </div>
                </div>
            </div>
            <div class="ruler" ref="ruler" @mousedown="handleRulerClick" :style="{
                width: 'calc( 10% + ' + gridSpan * zoomScalar + 'px )',
                background: `repeating-linear-gradient(
                        90deg,
                        #bbb,
                        #bbb 2px,
                        #eee 2px,
                        #eee ${256 * zoomScalar}px
                    )`,
                float: 'bottom'
            }">
                <div v-for="index in Math.ceil((gridSpan / 256))" :key="index" class="ruler-tick-label"
                    :style="{ left: `calc(${(index - 1) * 256 * zoomScalar}px)` }">
                    {{ index }}
                </div>
                <div class="marker-replay-triangle" :style="{ left: markerReplayPosition * zoomScalar + 'px' }"></div>
                <div class="marker-wrapper" :style="{ left: markerPosition * zoomScalar + 'px' }">
                    <div class="marker-triangle"></div>
                    <div class="marker-line"></div>
                </div>

                <TempoMarker v-for="(tempoMarker, index) in tempoMarkers" :key="tempoMarker.left"
                    :left="(tempoMarker.left) * zoomScalar + 1" :tempo="tempoMarker.tempo" :index="index"
                    :color="tempoMarker.color" :visible="tempoMarker.muted ? 'hidden' : 'visible'"
                    @click="clickTempoMarker" @click.stop />

            </div>
            <div class="grid-wrapper">
                <div class="grid" ref="grid" :style="{ width: gridSpan * zoomScalar + 'px', height: 2622 + 'px' }">
                    <div :style="{ width: scrollX + 'px' }" />
                    <canvas class="gridCanvas" ref="gridCanvas" :width="windowWidth * 0.9 - 14" :height="2592"
                        @mousemove="tryRemoveNote" @mousedown="handleGridClick" @contextmenu.prevent="startNoteRemove"
                        @wheel="handleGridScroll" />
                    <div v-if="isSelecting" class="selection-rect" :style="rectangleStyle"></div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { ref, onMounted, watchEffect, computed, onBeforeUnmount, watch, nextTick, mergeProps, useCssModule } from 'vue';
import { Synthetizer, MIDIBuilder, writeMIDIFile, Sequencer, consoleColors, SpessaSynthLogging, MIDI } from "spessasynth_lib";
import Heap from 'heap-js';
import HelpMenu from '@/components/HelpMenu.vue'
import Tracks from '@/components/Tracks.vue'
import { selectedTrack, tracks, selectedTrackIndex, trackHexColor, EventBus } from '@/components/Tracks.vue'
import { _ } from 'core-js';
import TempoMarker from './TempoMarker.vue';
import ExportMenu from './ExportMenu.vue';

export default {
    name: 'PianoRoll',
    components: {
        HelpMenu, Tracks, TempoMarker, ExportMenu
    },
    setup() {
        const root = process.env.NODE_ENV === 'production' ? '../MabiMML/' : '../';
        const pianoRoll = ref(null);
        const grid = ref(null);
        const synth = ref(null);
        const context = ref(null);
        const isMouseDown = ref(false);
        const selectedInstrument = ref({ name: 'Lute', program: 0, min: 16, max: 88 });
        const midiBuilder = ref(null);
        const tempo = ref(120);
        const loopSong = ref(false);
        const autoScrollSong = ref(false);
        const gridCanvas = ref(null);
        const windowWidth = ref(window.innerWidth);

        const instruments = ref([
            { name: 'Lute', program: 0, min: 16, max: 88 },
            { name: 'Ukulele', program: 1, min: 16, max: 88 },
            { name: 'Mandolin', program: 2, min: 16, max: 88 },
            { name: 'Whistle', program: 3, min: 12, max: 88 },
            { name: 'Roncadora', program: 4, min: 12, max: 88 },
            { name: 'Flute', program: 5, min: 15, max: 88 },
            { name: 'Chalumeau', program: 6, min: 16, max: 88 },
            { name: 'Tuba', program: 18, min: 12, max: 95 },
            { name: 'Lyre', program: 19, min: 9, max: 80 },
            { name: 'Electric Guitar', program: 20, min: 4, max: 99 },
            { name: 'Piano', program: 21, min: 0, max: 84 },
            { name: 'Violin', program: 22, min: 16, max: 59 },
            { name: 'Cello', program: 23, min: 0, max: 46 },
            { name: 'Harp', program: 24, min: 9, max: 83 },
            { name: 'Tuned Violin', program: 25, min: 16, max: 59 },
            { name: 'Tuned Cello', program: 26, min: 0, max: 46 },
            { name: 'Drum Kit', program: 27, min: 29, max: 53 },
            { name: 'Festival Lute', program: 50, min: 16, max: 88 },
            { name: 'Festival Ukulele', program: 51, min: 16, max: 88 },
            { name: 'Festival Mandolin', program: 52, min: 16, max: 88 },
            { name: 'Fest/Tuned Whistle', program: 53, min: 12, max: 83 },
            { name: 'Fest/Tuned Flute', program: 54, min: 15, max: 83 },
            { name: 'Bass Drum', program: 66, min: 12, max: 84 },
            { name: 'Snare Drum', program: 67, min: 12, max: 84 },
            { name: 'Cymbals', program: 68, min: 12, max: 84 },
            { name: 'Hand Chimes', program: 77, min: 9, max: 80 },
            { name: 'Female Chorus', program: 110, min: 19, max: 48 },
            { name: 'Male Chorus', program: 100, min: 14, max: 46 },
            { name: 'Male Voice', program: 120, min: 17, max: 49 },
            { name: 'Female Voice', program: 121, min: 12, max: 45 },
        ]);


        let currentNoteLength = ref((960*4));
        let currentNoteVolume = ref(8);
        const gridWidth = ref(256 / 16); // This makes the base size an x-th note
        const gridHeight = 24;
        const notesInGrid = ref([]);
        const draggingNotes = ref([]);
        const resizingNotes = ref([]);
        const volumeChangingNotes = ref([]);
        const startX = ref(0);
        const startY = ref(0);
        const startLeft = ref(0);
        const startTop = ref(0);
        const startWidth = ref(0);
        const gridSpan = ref(window.innerWidth);
        const gridWrapper = ref(null);

        const scrollX = ref(0);

        const selectedNotes = ref([]);
        const isSelecting = ref(false);
        const currentX = ref(0);
        const currentY = ref(0);

        const ruler = ref(null);
        const markerPosition = ref(0);
        const markerReplayPosition = ref(0);
        const tempoMarkers = ref([]);
        const seq = ref(null);
        const isPlaying = ref(false);

        const zoomScalar = ref(1);

        const rectangleStyle = computed(() => ({
            left: `${Math.min(startX.value, currentX.value)}px`,
            top: `${Math.min(startY.value, currentY.value) + 30}px`,
            width: `${Math.abs(currentX.value - startX.value)}px`,
            height: `${Math.abs(currentY.value - startY.value)}px`,
            backgroundColor: 'rgba(0, 100, 255, 0.3)', // Transparent blue
            border: '1px solid rgba(0, 100, 255, 0.5)' // Optional border
        }));

        const backgroundStyle = computed(() => ({
            background: `repeating-linear-gradient( /*This is the horizontal lines*/
                0deg,
                #bbb,
                #bbb 2px,
                transparent 2px,
                transparent 24px
            ),
            repeating-linear-gradient( /*This is the Bar line*/
                90deg,
                #777,
                #777 2px,
                transparent 2px,
                transparent ${256 * zoomScalar.value}px
            ),
            repeating-linear-gradient( /*This is the vertical lines*/
                90deg,
                #c0c0c0,
                #c0c0c0 2px,
                transparent 2px,
                transparent ${gridWidth.value * zoomScalar.value}px
            ),
            repeating-linear-gradient(/*This is the background colors*/
                90deg,
                #e0e0e0,
                #e0e0e0 ${64 * zoomScalar.value}px,
                #ccc ${64 * zoomScalar.value}px,
                #ccc ${128 * zoomScalar.value}px
            )`
        }));

        let ctx = null;

        function drawCanvasGrid() {
            if (!ctx) return;

            const screenLeft = scrollX.value;
            const screenRight = screenLeft + window.innerWidth;
            const zoom = zoomScalar.value;
            const grid = gridWidth.value;
            const width = gridSpan.value * zoom;
            const height = 12 * 9 * gridHeight; // numKeys * keyHeight
            const gridwidth = 256 / grid;

            ctx.clearRect(0, 0, width, height);

            // --- Draw Background Quarter Notes ---
            const bgSpacing = 64 * zoom;
            ctx.fillStyle = '#e0e0e0';
            for (let i = 0; i <= width; i += 2 * bgSpacing) {
                const x = i - screenLeft;
                ctx.fillRect(x, 0, bgSpacing, height);
            }
            ctx.fillStyle = '#ccc';
            for (let i = bgSpacing; i <= width; i += 2 * bgSpacing) {
                const x = i - screenLeft;
                ctx.fillRect(x, 0, bgSpacing, height);
            }

            // --- Draw Horizontal Grid Lines ---
            ctx.strokeStyle = '#bbb';
            ctx.lineWidth = 2;
            const horizontalSpacing = 24;
            const hCount = Math.ceil(height / horizontalSpacing);
            ctx.beginPath();
            for (let i = 0; i <= hCount; i++) {
                const y = i * horizontalSpacing;
                ctx.moveTo(0, y);
                ctx.lineTo(screenRight, y);
            }
            ctx.stroke();

            if (zoom > 1 / 8) {

                // --- Vertical Subdivisions ---
                ctx.strokeStyle = '#c0c0c0';
                ctx.lineWidth = 2;
                let verticalSpacing = 0;
                if (zoom > 1 / 8 && zoom <= 1 / 2) {
                    verticalSpacing = gridwidth == 12 ? grid * 4 * zoom : grid * 8 * zoom;
                } else if (zoom > 1 / 2 && zoom <= 7 / 8) {
                    verticalSpacing = grid * 4 * zoom;
                } else if (zoom > 7 / 8 && zoom < 2.5) {
                    verticalSpacing = grid * 2 * zoom;
                } else if (zoom >= 2.5) {
                    verticalSpacing = grid * zoom;
                }
                const vStart = Math.max(0, Math.floor(screenLeft / verticalSpacing) - 1);
                const vEnd = Math.ceil(screenRight / verticalSpacing) + 1;
                ctx.beginPath();
                for (let i = vStart; i <= vEnd; i++) {
                    const x = i * verticalSpacing - screenLeft;
                    ctx.moveTo(x, 0);
                    ctx.lineTo(x, height);
                }
                ctx.stroke();
            }

            // --- Bar Lines ---
            ctx.strokeStyle = '#777';
            ctx.lineWidth = 2;
            const barSpacing = 256 * zoom;
            const bStart = Math.max(0, Math.floor(screenLeft / barSpacing) - 1);
            const bEnd = Math.ceil(screenRight / barSpacing) + 1;
            ctx.beginPath();
            for (let i = bStart; i <= bEnd; i++) {
                const x = i * barSpacing - screenLeft;
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
            }
            ctx.stroke();

            // --- Notes ---
            const notes = notesInGrid.value;
            if (!notes || notes.length === 0) return;

            const visibleNotes = [];
            const leftLimit = screenLeft / zoom;
            const rightLimit = screenRight / zoom;

            for (const note of notes) {
                const noteLeft = note.left;
                const noteRight = noteLeft + note.width;
                if (noteRight < leftLimit || noteLeft > rightLimit) continue;
                if (note.muted) continue;
                visibleNotes.push(note);
            }

            for (const note of visibleNotes) {
                const x = note.left * zoom - screenLeft;
                const y = note.top;
                const noteWidth = (note.width + 1) * zoom - 1;
                const h = gridHeight;

                // Note body
                ctx.fillStyle = hexToRgba(note.color, (note.volume + 1) / 15);
                ctx.fillRect(x, y, noteWidth, h);

                // Border
                ctx.strokeStyle = note.highlighted ? 'white' : note.color;
                ctx.lineWidth = note.highlighted ? 2 : 1;
                ctx.strokeRect(x, y, noteWidth, h);

                // Volume handle (semi-circle)
                const semiCircleRadius = Math.max(0, Math.min(6, noteWidth / 4));
                const centerX = x + noteWidth / 2;
                const centerY = y + h + semiCircleRadius * 0.35 - 1;
                ctx.beginPath();
                ctx.arc(centerX, centerY, semiCircleRadius, Math.PI, 0, false);
                ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
                ctx.fill();

                // Resize handle
                const barWidth = Math.min(10, noteWidth * 0.4);
                ctx.fillRect(x + noteWidth - barWidth, y, barWidth, h);

                // Text
                ctx.font = '11px sans-serif';
                ctx.fillStyle = '#444';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                const fullText = `${note.name} (${note.volume})`;
                const truncatedText = truncateTextToWidth(ctx, fullText, noteWidth);

                if (truncatedText) {
                    ctx.fillText(truncatedText, x + noteWidth / 2, y + h / 2);
                }
            }
        }

        function truncateTextToWidth(ctx, text, maxWidth) {
            const ellipsis = '…';
            if (ctx.measureText(text).width <= maxWidth) return text;

            let truncated = text;
            while (truncated.length > 0) {
                truncated = truncated.slice(0, -1);
                if (ctx.measureText(truncated + ellipsis).width <= maxWidth) {
                    return truncated + ellipsis;
                }
            }
            return '';
        }



        // Left-hand Piano notes, not grid notes
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const blackNotes = ['C#', 'D#', 'F#', 'G#', 'A#'];
        const notes = ref(noteNames.map((name, index) => ({
            name: name,
            index: index,
            isBlack: blackNotes.includes(name)
        })));
        const octaves = ref([0, 1, 2, 3, 4, 5, 6, 7, 8]);

        const showSuccessNotification = ref(false);
        const successNotificationText = ref('');
        const showFailedNotification = ref(false);
        const failedNotificationText = ref('');

        const instrKeyMin = ref(16);
        const instrKeyMax = ref(88);

        let noteClipboard = [];

        watchEffect(() => {
            const maxRightPosition = Math.max(...notesInGrid.value.map(note => note.left + note.width), 0);
            gridSpan.value = Math.max((maxRightPosition + window.innerWidth / zoomScalar.value), window.innerWidth / zoomScalar.value);
            windowWidth.value = window.innerWidth;
            if (document.querySelector('.grid-wrapper'))
                scrollX.value = gridWrapper.value.scrollLeft;
        });

        watch(notesInGrid, () => {
            drawCanvasGrid();
        }, { deep: true });

        watch(gridSpan, async () => {
            await nextTick();
            drawCanvasGrid();
        }, { deep: true });

        watch(gridWidth, () => {
            drawCanvasGrid();
        }, { deep: true });

        const addTrack = (instr, color, name) => {
            return EventBus.addTrack(null, instr, color, name);
        };

        const handleTrackSelected = (track) => {
            selectedInstrument.value = track.instrument;
            selectedTrackIndex.value = tracks.value.indexOf(track);
            changeInstrument(true);
        };

        const handleAddTrack = async (newTrack, index) => {
            // if (synth.value)
            //     await synth.value.soundfontManager.addNewSoundFont(newTrack.instrument, `main${index}`, index);
        };

        const handleRemoveTrack = async (oldTrack, newTrack) => {
            const idsToRemove = new Set(oldTrack.notes.map(n => n.id));

            selectedNotes.value = selectedNotes.value.filter(n => !idsToRemove.has(n.id));
            notesInGrid.value = notesInGrid.value.filter(n => !idsToRemove.has(n.id));

            for (const track of tracks.value) {
                track.notes = track.notes.filter(n => !idsToRemove.has(n.id));
            }

            tempoMarkers.value = tempoMarkers.value.filter(marker => marker.parentTrack.id !== oldTrack.id);

            // if (selectedTrackIndex.value === newTrack.index)
            //     selectedInstrument.value = newTrack.instrument;
            // if (synth.value)
            //     await synth.value.soundfontManager.deleteSoundFont(`main${index}`);
        };

        const handleMuteTrack = async (trackIndex) => {
            if (isPlaying.value)
                playSequence();
            const track = tracks.value[trackIndex];
            for (const tempoMarker of tempoMarkers.value) {
                if (tempoMarker.parentTrack === track) {
                    tempoMarker.muted = track.isMuted;
                }
            }

        };

        const updateColor = (track, newColor) => {
            for (const marker of tempoMarkers.value) {
                if (marker.parentTrack === track) {
                    marker.color = newColor;
                }
            }
        };

        const loadSoundFont = async () => {
            try {
                const response = await fetch(root + 'soundfonts/mabi_instruments_high_quality.sf3');
                const soundFontArrayBuffer = await response.arrayBuffer();
                return soundFontArrayBuffer;
            } catch (error) {
                console.error("Failed to load SoundFont:", error);
                return null;
            }
        };

        const handleBeforeUnload = (event) => {
            const message = 'Leave Site? Changes you made may not be saved.';
            event.preventDefault();
            event.returnValue = message;
            return 'message';
        }

        onMounted(async () => {
            try {
                windowWidth.value = window.innerWidth;

                const gridWrapperVar = document.querySelector('.grid-wrapper');
                if (gridWrapperVar) {
                    gridWrapper.value = gridWrapperVar;
                    gridWrapperVar.addEventListener('scroll', updateRuler);
                    updateRuler();
                }

                document.addEventListener('keydown', handleKeyPress);
                window.addEventListener('beforeunload', handleBeforeUnload);
                // Setting up audio context
                context.value = new AudioContext();

                await context.value.audioWorklet.addModule(root + "worklet_processor.min.js");
                const soundFontArrayBuffer = await loadSoundFont();
                if (!soundFontArrayBuffer) return;
                synth.value = new Synthetizer(context.value.destination, soundFontArrayBuffer, true, undefined, { chorusEnabled: false, reverbEnabled: false });
                synth.value.setMainVolume(2);
                synth.value.setLogLevel(false, false, false, false);
                await synth.value.isReady;

            } catch (error) {
                console.error("Error initializing sequencer or synthesizer:", error);
            }
            await nextTick();
            if (gridCanvas.value) {
                ctx = gridCanvas.value.getContext('2d', { alpha: false });
                drawCanvasGrid();
            }
        });



        onBeforeUnmount(() => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        });

        const handleRulerClick = (event) => {
            if (event.button === 0) {
                if (!event.shiftKey) {
                    startMarkerDrag(event);
                } else {
                    placeTempoMarker(event);
                }
            }
        };

        const placeTempoMarker = (event) => {
            const granularity = event.altKey ? gridWidth.value / 4 : gridWidth.value;
            const left = Math.round((event.clientX - ruler.value.getBoundingClientRect().left) / granularity / zoomScalar.value) * granularity;
            const enteredTempo = prompt("Enter tempo (BPM):", tempo.value);
            if (enteredTempo !== null && !isNaN(enteredTempo) && enteredTempo !== '') {
                tempoMarkers.value.push({
                    left: left,
                    tempo: Number(enteredTempo),
                    color: selectedTrack.value.color,
                    parentTrack: selectedTrack.value,
                    muted: false
                });
            }
        };

        const clickTempoMarker = (event, index) => {
            event.preventDefault();
            if (event.button === 0) {
                const enteredTempo = prompt("Enter tempo (BPM):", tempoMarkers.value[index].tempo);
                if (enteredTempo === null)
                    return;
                if (!isNaN(enteredTempo) && enteredTempo !== '') {
                    tempoMarkers.value[index].tempo = Number(enteredTempo);
                } else {
                    tempoMarkers.value.splice(index, 1);
                }
            } else if (event.button === 2) {
                tempoMarkers.value[index].parentTrack = selectedTrack.value;
                tempoMarkers.value[index].color = selectedTrack.value.color;
            }
        };

        const startMarkerDrag = (event) => {
            if (isPlaying) {
                stopPlaying();
            }
            updateMarkerPos(event.clientX, event.altKey, true);
            document.addEventListener('mousemove', onMarkerDrag);
            document.addEventListener('mouseup', onMarkerDragEnd);
        };

        const onMarkerDrag = (event) => {
            updateMarkerPos(event.clientX, event.altKey, true);
        };

        const onMarkerDragEnd = async () => {
            document.removeEventListener('mousemove', onMarkerDrag);
            document.removeEventListener('mouseup', onMarkerDragEnd);
        };

        let markerInterval;
        let markerStartPos;
        let startTempo;
        let tempoIdx = 0;

        async function startMarkerAnim() {
            isPlaying.value = true;
            markerStartPos = markerPosition.value;
            startTempo = tempo.value;
            tempoMarkers.value.sort((a, b) => { return a.left - b.left });
            doMarkerAnim();
        }

        function doMarkerAnim() {
            let timeChange = 0;
            tempoIdx = 0;
            startTempo = tempo.value;
            let marker = tempoMarkers.value[tempoIdx];
            while (marker && marker.left < markerPosition.value) { // Skip ahead to proper first marker
                if (markerPosition.value > 0) {
                    startTempo = marker.tempo;
                }
                tempoIdx++;
                marker = tempoMarkers.value[tempoIdx];
            }
            function tick() {
                if (markerPosition.value < 0) {
                    startTempo = tempo.value;
                    tempoIdx = 0;
                    timeChange = 0;
                    markerStartPos = 0;
                    markerPosition.value = 0;
                }
                marker = tempoMarkers.value[tempoIdx];
                while (marker && marker.muted) { // Skip ahead to the next unmuted marker
                    tempoIdx++;
                    marker = tempoMarkers.value[tempoIdx];
                }
                if (marker && marker !== null) {
                    if (markerPosition.value >= marker.left) {
                        tempoIdx++;
                        markerStartPos = markerPosition.value;
                        timeChange = seq.value.currentTime;
                        startTempo = marker.tempo;
                    }
                }

                markerPosition.value = ((seq.value.currentTime - timeChange) * 4 * 16 * startTempo / 60) + markerStartPos;
                if (autoScrollSong.value) {
                    gridWrapper.value.scrollLeft = markerPosition.value * zoomScalar.value - window.innerWidth * 0.66;
                }
                if (seq.value && !loopSong.value)
                    seq.value.loop = loopSong.value;
            }
            clearInterval(markerInterval);
            tick();
            markerInterval = setInterval(tick, 20);
        }

        const noteLengths = [];
        const widthCache = {};

        function getUniquePermutations(nums) {
            nums.sort((a, b) => a - b); // Sort to enable duplicate skipping
            const used = new Array(nums.length).fill(false);
            const result = [];

            function backtrack(path) {
                if (path.length === nums.length) {
                    result.push([...path]);
                    return;
                }

                for (let i = 0; i < nums.length; i++) {
                    if (used[i]) continue;

                    // Skip duplicate numbers at the same tree depth
                    if (i > 0 && nums[i] === nums[i - 1] && !used[i - 1]) {
                        continue;
                    }

                    used[i] = true;
                    path.push(nums[i]);
                    backtrack(path);
                    path.pop();
                    used[i] = false;
                }
            }

            backtrack([]);
            return result;
        }

        function getOptimalNoteLengths(width) {
            if (width in widthCache)
                return widthCache[width];
            let outString = '';
            let mmlWidth = width;

            if (noteLengths.length === 0) {
                for (let i = 1; i <= 64; ++i) {
                    let val1 = Math.round(256 * 32 / (i/960*64) );
                    let val2 = Math.round(256 * 32 / (i/960*64) * 1.5);

                    noteLengths.push({
                        length: val2,
                        name: i + '.',
                        charLength: ('L' + i + '.').length
                    });
                    noteLengths.push({
                        length: val1,
                        name: i + '',
                        charLength: ('L' + i).length
                    });
                }
            }

            const best = new Map();
            for (const note of noteLengths) {
                if (!best.has(note.length) || note.charLength < best.get(note.length).charLength) {
                    best.set(note.length, note);
                }
            }

            let result = getMinCharLengthWidth([...best.values()], mmlWidth);
            outString = result.noteCombination.map(note => note.name).join('&');
            // Rather than returning a single string combining the notes, we should return a list of such strings (or a list of a list of lengths like lengths: [[1., 2], [2, 1.]])
            // let outputs = getUniquePermutations(result.noteCombination.map(note => note.name));
            widthCache[width] = result;
            return result; // returns a list of lists of note lenths
        }

        function getMinCharLengthWidth(notes, targetWidth) {
            let amount = Math.round(targetWidth * 32);

            // === Compress notes to keep only the shortest representation for each length ===
            const best = new Map();
            for (const note of notes) {
                if (!best.has(note.length) || note.charLength < best.get(note.length).charLength) {
                    best.set(note.length, note);
                }
            }
            const compressedNotes = [...best.values()];

            // Flatten notes into arrays for fast lookup
            const n = compressedNotes.length;
            const lengths = new Int32Array(n);
            const charLens = new Int32Array(n);
            for (let j = 0; j < n; j++) {
                lengths[j] = compressedNotes[j].length;
                charLens[j] = compressedNotes[j].charLength;
            }

            // === DP arrays ===
            const INF = 0x7fffffff;
            const dp = new Uint32Array(amount + 1);
            dp.fill(INF);
            dp[0] = 0;

            const prev = new Int32Array(amount + 1);
            prev.fill(-1);

            const last = new Int32Array(amount + 1);
            last.fill(-1);

            // === Core DP ===
            for (let j = 0; j < n; j++) {
                const noteValue = lengths[j];
                const noteChars = charLens[j];
                for (let i = noteValue; i <= amount; i++) {
                    const candidate = dp[i - noteValue] + noteChars;
                    if (candidate < dp[i]) {
                        dp[i] = candidate;
                        prev[i] = i - noteValue;
                        last[i] = j;
                    }
                }
            }

            if (dp[amount] === INF) {
                return { minChars: null, noteCombination: [] };
            }

            // === Backtrack ===
            const result = [];
            let i = amount;
            while (i > 0) {
                const j = last[i];
                result.push(compressedNotes[j]);
                i = prev[i];
            }

            return { minChars: dp[amount], noteCombination: result };
        }


        const stopMarkerAnim = () => {
            clearInterval(markerInterval);
            isPlaying.value = false;
        }

        const updateMarkerPos = (clientX, altKey, fromClick) => {
            if (ruler.value) {
                const rulerRect = ruler.value.getBoundingClientRect();
                let newPos = Math.round((clientX - rulerRect.left) / zoomScalar.value / (gridWidth.value / 4)) * (gridWidth.value / 4);
                let gridSnap = gridWidth.value * (zoomScalar.value <= 0.5 ? 64 / gridWidth.value : 1);

                if (!altKey) {
                    newPos = Math.round(newPos / (gridSnap)) * gridSnap;
                }

                newPos = Math.max(0, Math.min(gridSpan.value, newPos));

                markerPosition.value = newPos;
                if (fromClick) {
                    markerReplayPosition.value = newPos;
                }

            }
        }

        function handleKeyPress(event) {
            if (selectedTrack.value.isEditingName)
                return;
            if (event.key === 'Backspace' || event.key === 'Delete') {
                for (const note of selectedNotes.value) {
                    removeNote(note, true);
                }

                if (isPlaying.value)
                    playSequence();
            }
            if (event.code === 'Space') {
                event.preventDefault();
                if (isPlaying.value) {
                    stopPlaying();
                    if (!event.ctrlKey) {
                        markerPosition.value = markerReplayPosition.value;
                    }
                } else {
                    playSequence();
                }
            } else if (event.key === 'a' && event.ctrlKey && !selectedTrack.value.isEditingName) {
                event.preventDefault();
                for (const note of notesInGrid.value) {
                    selectNote(note);
                }

                showSuccessMessage(`Selected ${selectedNotes.value.length} notes!`, 1000);
            } else if (event.key === 'ArrowUp') {
                if (event.ctrlKey || event.shiftKey) {
                    event.preventDefault();
                    let movementValue = event.ctrlKey ? 12 : 1;
                    for (const note of selectedNotes.value) {
                        if (note.top - gridHeight * movementValue < -0) return;
                    }
                    for (const note of selectedNotes.value) {
                        note.top -= gridHeight * movementValue
                        const number = (1284 - (note.top / 2)) / 144;
                        const noteName = noteNames[number * 12 % 12] + "" + Math.floor(number);
                        note.name = noteName;
                        note.pitch = number * 12 % 12 + 12 * (Math.floor(number) + 1);
                    }
                    if (isPlaying.value)
                        playSequence();
                }
            } else if (event.key === 'ArrowDown') {
                if (event.ctrlKey || event.shiftKey) {
                    event.preventDefault();
                    let movementValue = event.ctrlKey ? 12 : 1;
                    for (const note of selectedNotes.value) {
                        if (note.top + gridHeight * movementValue >= octaves.value.length * gridHeight * 12) return;
                    }
                    for (const note of selectedNotes.value) {
                        note.top += gridHeight * movementValue
                        const number = (1284 - (note.top / 2)) / 144;
                        const noteName = noteNames[number * 12 % 12] + "" + Math.floor(number);
                        note.name = noteName;
                        note.pitch = number * 12 % 12 + 12 * (Math.floor(number) + 1);
                    }
                    if (isPlaying.value)
                        playSequence();
                }
            } else if (event.key === 'ArrowLeft') {
                if (event.ctrlKey || event.shiftKey) {
                    event.preventDefault();
                    let movementValue = event.ctrlKey ? 1 : 4;
                    for (const note of selectedNotes.value) {
                        if (Math.round((note.left - gridWidth.value / movementValue) * 1000) / 1000 < 0) return;
                    }
                    for (const note of selectedNotes.value) {
                        note.left = Math.round((note.left - gridWidth.value / movementValue) * 1000) / 1000;
                        note.start = Math.round(note.left / (256) * (960*4));
                        note.end = Math.round(note.start + note.length);
                    }
                    if (isPlaying.value)
                        playSequence();
                }
            } else if (event.key === 'ArrowRight') {
                if (event.ctrlKey || event.shiftKey) {
                    event.preventDefault();
                    let movementValue = event.ctrlKey ? 1 : 4;
                    for (const note of selectedNotes.value) {
                        note.left = Math.round((note.left + gridWidth.value / movementValue) * 1000) / 1000;
                        note.start = Math.round(note.left / (256) * (960*4));
                        note.end = Math.round(note.start + note.length);
                    }
                    if (isPlaying.value)
                        playSequence();
                }
            } else if (event.key === 'c' && event.ctrlKey) {
                event.preventDefault();
                // Copy selected notes to some "clipboard".
                noteClipboard = [];
                for (const note of selectedNotes.value) {
                    noteClipboard.push(note);
                }

                showSuccessMessage(`Copied ${noteClipboard.length} note${noteClipboard.length > 1 ? 's' : ''} to the clipboard!`, 1000);
            } else if (event.key === 'x' && event.ctrlKey) {
                event.preventDefault();
                // Copy and delete selected notes to some "clipboard".
                noteClipboard = [];
                for (const note of selectedNotes.value) {
                    noteClipboard.push(note);
                    removeNote(note, true);
                }
                if (isPlaying.value)
                    playSequence();
                showSuccessMessage(`Cut ${noteClipboard.length} note${noteClipboard.length > 1 ? 's' : ''} and put them in the clipboard!`, 1000);
            } else if (event.key === 'v' && event.ctrlKey) {
                event.preventDefault();
                // Paste selected notes from "clipboard" into the selected track.
                clearSelection();
                const baseId = Date.now(); // Avoid calling Date.now() in every iteration
                const track = selectedTrack.value;
                const trackColor = track.color;
                const scroll = scrollX.value;
                const zoom = zoomScalar.value;
                const grid = gridWidth.value;

                const idOffset = notesInGrid.value.length;

                const newNotes = [];

                for (let i = 0; i < noteClipboard.length; i++) {
                    const note = noteClipboard[i];
                    const newLeft = Math.round(Math.round((note.left + scroll / zoom) * grid / 4) * 4 / grid);
                    const newNote = {
                        id: baseId + idOffset + i,
                        name: note.name,
                        left: newLeft,
                        top: note.top,
                        pitch: note.pitch,
                        width: note.width,
                        length: note.length,
                        highlighted: true,
                        color: trackColor,
                        start: Math.round(newLeft / (256) * (960*4)),
                        end: Math.round(Math.round(newLeft / (256) * (960*4)) + note.length),
                        volume: note.volume,
                        muted: false,
                        track: track
                    };
                    newNotes.push(newNote);
                }

                // Push all at once
                selectedNotes.value.push(...newNotes);
                notesInGrid.value.push(...newNotes);
                track.notes.unshift(...newNotes.reverse()); // unshift in correct order
                if (isPlaying.value)
                    playSequence();

                showSuccessMessage(`Pasted ${noteClipboard.length} notes from the clipboard!`, 1000);
            } else if (event.key === 't' && selectedNotes.value.length > 0) {
                const selectedSet = new Set(selectedNotes.value);

                for (const track of tracks.value) {
                    track.notes = track.notes.filter(note => !selectedSet.has(note));
                }

                selectedNotes.value.forEach(note => {
                    note.track = selectedTrack.value;
                    note.color = selectedTrack.value.color;
                });

                selectedTrack.value.notes.unshift(...[...selectedNotes.value].reverse());

                showSuccessMessage(`Moved ${selectedNotes.value.length} notes into track "${selectedTrack.value.name}"!`, 1000);
            }
        }


        function updateRuler() {
            if (gridWrapper.value && ruler.value) {
                scrollX.value = gridWrapper.value.scrollLeft;
                ruler.value.style.left = -scrollX.value + 'px'; // Adjust ruler's left position
            }
            drawCanvasGrid();
        }

        function stopPlaying() {
            if (seq.value)
                seq.value.stop();
            stopMarkerAnim();
            synth.value.programChange(0, selectedInstrument.value.program);
        }

        async function getMidiBlob(name="MySong", startPosition=0, forPlayback=false) {
            const tempMidiBuilder = new MIDIBuilder(name, 480, tempo.value);
            await context.value.resume();
                if (!synth.value) return;

                let notesAdded = 0;

                let audibleTracks = [];

                for (const track of tracks.value) {
                    if (!track.isMuted) {
                        audibleTracks.push(track);
                        tempMidiBuilder.addNewTrack(track.name + tracks.value.indexOf(track));
                    }
                }

                // Setting the instruments per track.
                audibleTracks.forEach((track, idx) => {
                    let index = idx >= 9 ? idx + 1 : idx
                    const channel = index % 16;
                    tempMidiBuilder.addEvent(0, index, 0xC0 | channel , [track.instrument.program]);
                });

                notesInGrid.value.forEach(note => {
                    if (!note.muted && note.left + note.width >= startPosition) {

                        // Code to get the note's parent track
                        let containingTrack = note.track;
                        // for (const track of tracks.value) {
                        //     if (track.notes.some(n => n.id === note.id)) {
                        //         containingTrack = track;
                        //     }
                        // }
                        const trackIndex = audibleTracks.indexOf(containingTrack) >= 9 ? audibleTracks.indexOf(containingTrack) + 1 : audibleTracks.indexOf(containingTrack);
                        const channel = trackIndex % 16;//trackIndex;
                        const pitch = note.pitch;
                        // Conversion from pixels to time.
                        const noteStartTime = note.start / (960/4) * 120;
                        const noteDuration = (note.length) / (960/4) * 120;
                        const markerTime = startPosition / 16 * 120;
                        const startTime = Math.max(noteStartTime, markerTime) - markerTime;
                        const duration = Math.min(noteDuration, noteStartTime + noteDuration - markerTime);
                        const volume = Math.max(0, Math.min(127, (note.volume + 1) * 8 - 1));

 

                        //tempMidiBuilder.addEvent(startTime, trackIndex, 0xC0 | (channel & 0x0F), [containingTrack.instrument.program]);
                        tempMidiBuilder.addNoteOn(startTime, trackIndex, channel, pitch, volume);
                        tempMidiBuilder.addNoteOff(startTime + duration - (forPlayback), trackIndex, channel, pitch);
                        notesAdded++;
                    }
                });

                for (const tempoMarker of tempoMarkers.value) {
                    if (tempoMarker.parentTrack.isMuted)
                        continue;
                    const tempoStartTime = tempoMarker.left / 16 * 120;
                    const markerTime = startPosition / 16 * 120;
                    const tempoChangeTime = Math.max(tempoStartTime, markerTime) - markerTime;
                    tempMidiBuilder.addSetTempo(tempoChangeTime, tempoMarker.tempo);
                }

                if (notesAdded === 0) {
                    return;
                }

                tempMidiBuilder.flush();

                midiBuilder.value = tempMidiBuilder;

                const b = await (writeMIDIFile(midiBuilder.value));
                return b;
        }

        const playSequence = async (fromClick = null) => {
            try {
                if (fromClick && isPlaying.value) {
                    stopPlaying();
                    markerPosition.value = markerReplayPosition.value;
                    return;
                }

                const b = await getMidiBlob("untitled", markerPosition.value, true);
                seq.value = new Sequencer([{ binary: b }], synth.value);
                seq.value.skipToFirstNoteOn = false;
                seq.value.loop = loopSong.value && markerPosition.value === 0;
                await synth.value.isReady;
                seq.value.addOnSongEndedEvent(() => {
                    stopMarkerAnim();
                    markerPosition.value = markerReplayPosition.value;
                    if (loopSong.value && !seq.value.loop) {
                        markerPosition.value = 0;
                        playSequence();
                    }
                }, 'test2');
                await seq.value.play();
                startMarkerAnim();
            } catch (error) {
                console.error("Error playing sequence: ", error);
            }
        };

        const startNote = async (channel, note, octave) => {
            try {
                context.value.resume();
                await synth.value.isReady;
                synth.value.noteOn(channel, note.index + 12 * (octave + 1), Math.max(0, Math.min(127, (currentNoteVolume.value + 1) * 8 - 1)), false);
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

        const showSuccessMessage = (text, timeout = 2000) => {
            successNotificationText.value = text;
            showSuccessNotification.value = true; // Show notification

            // Hide notification after 2 seconds
            setTimeout(() => {
                showSuccessNotification.value = false;
            }, timeout);
        };

        const showFailureMessage = (text, timeout = 2000) => {
            failedNotificationText.value = text;
            showFailedNotification.value = true; // Show notification

            // Hide notification after 2 seconds
            setTimeout(() => {
                showFailedNotification.value = false;
            }, timeout);
        };

        const mouseOverNote = (channel, note, octave) => {
            if (isMouseDown.value && draggingNotes.value.length === 0 && resizingNotes.value.length === 0) {
                startNote(channel, note, octave);
            }
        };

        const mouseLeaveNote = (channel, note, octave) => {
            if (isMouseDown.value && draggingNotes.value.length === 0 && resizingNotes.value.length === 0) {
                endNote(channel, note, octave);
            }
        };

        const changeInstrument = async (fromTrack = false) => {
            if (synth.value && selectedInstrument.value) {
                selectedTrack.value.instrument = selectedInstrument.value;

                instrKeyMin.value = selectedInstrument.value.min;
                instrKeyMax.value = selectedInstrument.value.max;

                synth.value.programChange(0, selectedInstrument.value.program);
                if (isPlaying.value && !fromTrack)
                    playSequence();

                await synth.value.isReady;
            }
        };

        const startPositions = new Map();

        const startDrag = (note, event, placeNote = true) => {
            event.preventDefault();
            if (event.button === 0 && resizingNotes.value.length === 0 && volumeChangingNotes.value.length === 0) { // Ensure we're dragging with left button
                if (note.highlighted) {
                    draggingNotes.value = selectedNotes.value;
                } else {
                    clearSelection();
                    draggingNotes.value.push(note);
                }

                if (event.shiftKey && placeNote) {
                    const baseId = Date.now();
                    const initialLength = notesInGrid.value.length;
                    const newNotes = [];

                    for (let i = 0; i < draggingNotes.value.length; i++) {
                        const note = draggingNotes.value[i];
                        const newNote = {
                            id: baseId + initialLength + i,
                            name: note.name,
                            left: note.left,
                            top: note.top,
                            pitch: note.pitch,
                            width: note.width,
                            length: note.length,
                            highlighted: false,
                            color: note.color,
                            start: note.start,
                            end: note.end,
                            volume: note.volume,
                            muted: false,
                            track: note.track
                        };
                        newNotes.push(newNote);
                    }

                    // Bulk update reactive arrays outside the loop
                    notesInGrid.value.push(...newNotes);
                    newNotes.forEach(note => {
                        note.track.notes.unshift(note);
                    });

                }

                for (const draggingNote of draggingNotes.value) {
                    startPositions.set(draggingNote.id, {
                        x: event.clientX,
                        y: event.clientY,
                        left: draggingNote.left,
                        top: draggingNote.top
                    });
                }

                currentNoteLength.value = note.length;
                currentNoteVolume.value = note.volume;
                selectedTrackIndex.value = tracks.value.indexOf(note.track);
                trackHexColor.value = note.track.color;
                document.addEventListener('mousemove', onDrag);
                document.addEventListener('mouseup', endDrag);
            }
        };

        const onDrag = (event) => {
            if (draggingNotes.value && resizingNotes.value.length === 0 && volumeChangingNotes.value.length === 0) {

                let outOfBounds = false;
                const newPositions = [];

                let offGridNote = false;

                for (const note of draggingNotes.value) {
                    if (event.altKey || (note.highlighted && note.left % gridWidth.value !== 0)) {
                        offGridNote = true;
                        break;
                    }
                }

                const noteSnapScale = offGridNote ? gridWidth.value / 4 : gridWidth.value;

                let noteDelta = 0;

                for (let i = 0; i < draggingNotes.value.length; ++i) {
                    const note = draggingNotes.value[i];

                    const startPos = startPositions.get(note.id);
                    if (!startPos) continue;

                    const dx = (event.clientX - startPos.x) / zoomScalar.value;
                    const dy = event.clientY - startPos.y;

                    let newLeft = 0;

                    if (i === 0) {
                        newLeft = Math.round((startPos.left + dx) / noteSnapScale) * noteSnapScale;
                        noteDelta = newLeft - startPos.left;
                    } else {
                        newLeft = startPos.left + noteDelta;
                    }

                    let newTop = Math.round((startPos.top + dy) / gridHeight) * gridHeight;

                    if (newLeft < 0 || newTop < 0 || newTop > 2568) {
                        outOfBounds = true;
                        break; // Exit loop if any note is out of bounds
                    }

                    newPositions.push({ note, newLeft, newTop });

                }

                if (outOfBounds) return;

                // Auto-scroll stuff doesnt work super well yet, so I'll leave it out for now
                let rightMost = Infinity;
                let leftMost = Infinity;
                let topMost = Infinity;
                let bottomMost = 0;

                for (const { note, newLeft, newTop } of newPositions) {

                    note.left = newLeft;
                    note.start = Math.round(note.left / (256) * (960*4));
                    note.end = Math.round(note.start + note.length);
                    note.top = newTop;

                    const number = (1284 - (note.top / 2)) / 144;
                    const noteName = noteNames[number * 12 % 12] + "" + Math.floor(number);
                    if (note.name != noteName && draggingNotes.value.length === 1) {
                        startNote(0, { name: noteName, index: number * 12 % 12 }, Math.floor(number))
                        endNote(0, { name: noteName, index: number * 12 % 12 }, Math.floor(number))
                    }
                    note.name = noteName;
                    note.pitch = number * 12 % 12 + 12 * (Math.floor(number) + 1);

                    // if (note.left + note.width < rightMost)
                    //     rightMost = note.left + note.width;

                    // if (note.left < leftMost)
                    //     leftMost = note.left;

                    // if (note.top < topMost)
                    //     topMost = note.top;

                    // if (note.top > bottomMost)
                    //     bottomMost = note.top;

                }
                // const gridWrapper = document.querySelector('.grid-wrapper');
                // const pianoRoll = document.querySelector('.piano-roll');
                // if (rightMost > gridWrapper.scrollLeft + window.innerWidth) {
                //     gridWrapper.scrollLeft = rightMost - window.innerWidth;
                // } else if (leftMost < gridWrapper.scrollLeft) {
                //     gridWrapper.scrollLeft = leftMost;
                // } else if (bottomMost - topMost < window.innerHeight && topMost < pianoRoll.scrollTop) {
                //     pianoRoll.scrollTop = topMost;
                // } else if (bottomMost - topMost < window.innerHeight && bottomMost > window.innerHeight*0.85 + pianoRoll.scrollTop) {
                //     pianoRoll.scrollTop = bottomMost - window.innerHeight*0.85;
                // }

            }
        };

        const endDrag = () => {
            if (isPlaying.value)
                playSequence();
            draggingNotes.value = [];
            document.removeEventListener('mousemove', onDrag);
            document.removeEventListener('mouseup', endDrag);
            startPositions.clear();
        };

        const startResizeData = new Map();

        const startResize = (note, event) => {
            event.preventDefault();
            if (event.button === 0) { // Ensure we're resizing with the left button
                resizingNotes.value = [];
                startX.value = event.clientX;
                startResizeData.clear(); // Clear previous data

                if (note.highlighted) {
                    // If note is highlighted, prepare to resize all selected notes
                    selectedNotes.value.forEach(n => {
                        startResizeData.set(n.id, { width: n.width, startX: event.clientX });
                    });
                    resizingNotes.value = selectedNotes.value;
                } else {
                    // If note is not highlighted, resize only this note
                    clearSelection();
                    startResizeData.set(note.id, { width: note.width, startX: event.clientX });
                    resizingNotes.value = [note];
                }

                document.addEventListener('mousemove', onResize);
                document.addEventListener('mouseup', endResize);
            }
        };

        const onResize = (event) => {
            if (resizingNotes.value.length > 0) {
                let allInBounds = true;

                const newWidths = [];

                resizingNotes.value.forEach(note => {
                    const startData = startResizeData.get(note.id);
                    if (!startData) return;

                    const dx = (event.clientX - startData.startX) / zoomScalar.value;
                    let newWidth = 0;
                    if (event.altKey) {
                        newWidth = Math.round((startData.width + dx) / (gridWidth.value / 4)) * gridWidth.value / 4 - 1;
                    } else {
                        newWidth = Math.round((startData.width + dx) / gridWidth.value) * gridWidth.value - 1;
                    }

                    // Check if newWidth is valid for the note
                    if (newWidth < gridWidth.value - 1 && !event.altKey || newWidth < 3) {
                        allInBounds = false;
                        return;
                    }

                    newWidths.push({ note, newWidth })

                });

                // If any note was resized to an invalid width, stop resizing
                if (allInBounds) {
                    for (const { note, newWidth } of newWidths) {
                        note.width = newWidth;
                        note.length = (960*4) * ((newWidth + 1) / 256);
                        note.end = note.start + note.length;
                        currentNoteLength.value = note.length;
                    };
                }
            }
        };

        const endResize = () => {
            resizingNotes.value = [];
            startResizeData.clear();
            document.removeEventListener('mousemove', onResize);
            document.removeEventListener('mouseup', endResize);
        };

        let startingNoteVolumes = [];

        const startVolumeChange = (note, event) => {
            event.preventDefault();
            if (event.button === 0) { // Ensure we're clicking with the left button
                volumeChangingNotes.value = [];
                startY.value = event.clientY;

                if (note.highlighted) {
                    // If note is highlighted, prepare to re-volume all selected notes
                    volumeChangingNotes.value = selectedNotes.value;
                } else {
                    // If note is not highlighted, re-volume only this note
                    clearSelection();
                    volumeChangingNotes.value = [note];
                }
                startingNoteVolumes = volumeChangingNotes.value.map((note) => { return note.volume });

                document.addEventListener('mousemove', onVolumeChange);
                document.addEventListener('mouseup', endVolumeChange);
            }
        };

        const onVolumeChange = (event) => {
            event.preventDefault();
            if (volumeChangingNotes.value.length > 0) {
                let i = 0;
                for (const note of volumeChangingNotes.value) {
                    const dy = startY.value - event.clientY;
                    let newVolume = Math.round(Math.max(1, Math.min(15, startingNoteVolumes[i] + dy / 10)));
                    note.volume = newVolume;
                    currentNoteVolume.value = newVolume;
                    i++;
                }
            }
        };

        const endVolumeChange = () => {
            volumeChangingNotes.value = [];
            if (isPlaying.value)
                playSequence();
            document.removeEventListener('mousemove', onVolumeChange);
            document.removeEventListener('mouseup', endVolumeChange);
        };

        const handleGridClick = (event) => {
            if (event.ctrlKey && draggingNotes.value.length <= 0 && event.button === 0) {
                if (!event.shiftKey)
                    clearSelection();
                startSelection(event);
            } else {
                startPlacingNote(event);
            }
        };

        const handleGridScroll = (event) => {
            // TODO: WE HAVE TO MAINTAIN A CONSTANT SIZED CANVAS. THE EXPANSION OF THE CANVAS CAUSES MUCHO LAG
            const deltaY = -Math.sign(event.deltaY) * 1 / 8;
            if (event.ctrlKey) {
                event.preventDefault();
                const z1 = zoomScalar.value;
                const l = gridWrapper.value.scrollLeft;
                const x = (event.clientX - gridWrapper.value.getBoundingClientRect().left + l);
                zoomScalar.value = Math.min(8, Math.max(1 / 8, Math.round((zoomScalar.value + deltaY) * 8) / 8)); // Making sure that the zoom is in multiples of 1/8th
                const z2 = zoomScalar.value;
                gridWrapper.value.scrollLeft += x * (z2 / z1 - 1);
            }
        }

        function clearSelection() {
            selectedNotes.value.forEach((note) => {
                note.highlighted = false;
            });
            selectedNotes.value = [];
        }

        const startSelection = (event) => {
            event.preventDefault();
            isSelecting.value = true;
            const rect = gridCanvas.value.getBoundingClientRect();
            startX.value = event.clientX - rect.left + scrollX.value;
            startY.value = event.clientY - rect.top;
            currentX.value = event.clientX - rect.left + scrollX.value;
            currentY.value = event.clientY - rect.top;
            document.addEventListener('mousemove', onSelectionMove);
            document.addEventListener('mouseup', onSelectionEnd);
        };

        const onSelectionMove = (event) => {
            if (isSelecting.value) {
                const rect = gridCanvas.value.getBoundingClientRect();
                currentX.value = event.clientX - rect.left + scrollX.value;
                currentY.value = event.clientY - rect.top;
            }
        };

        const onSelectionEnd = () => {
            if (isSelecting.value) {
                isSelecting.value = false;
                document.removeEventListener('mousemove', onSelectionMove);
                document.removeEventListener('mouseup', onSelectionEnd);
                // This is where we add the logic to actually select the notes
                checkIntersections();
            }
        };

        function checkIntersections() {
            const selectionRect = {
                left: Math.min(startX.value, currentX.value) / zoomScalar.value,
                top: Math.min(startY.value, currentY.value),
                right: Math.max(startX.value, currentX.value) / zoomScalar.value,
                bottom: Math.max(startY.value, currentY.value),
            };

            notesInGrid.value.forEach(note => {
                const itemRect = {
                    left: note.left,
                    top: note.top,
                    right: note.left + note.width,
                    bottom: note.top + gridHeight,
                };

                if (intersects(selectionRect, itemRect)) {
                    selectNote(note);
                }
            });

        };

        function selectNote(note) {
            if (!selectedNotes.value.includes(note) && !note.muted) {
                selectedNotes.value.push(note);
                note.highlighted = true;
            }
        }

        function intersects(rect1, rect2) {
            return !(rect2.left >= rect1.right ||
                rect2.right <= rect1.left ||
                rect2.top >= rect1.bottom ||
                rect2.bottom <= rect1.top);
        }


        const startPlacingNote = (event) => {
            if (draggingNotes.value.length > 0 || resizingNotes.value.length > 0 || volumeChangingNotes.value.length > 0) {
                return;
            }

            const rect = gridCanvas.value.getBoundingClientRect();
            const x = (event.clientX - rect.left + scrollX.value) / zoomScalar.value;
            const y = event.clientY - rect.top + grid.value.scrollTop;

            let left = Math.round((x - gridWidth.value / 2) / gridWidth.value) * gridWidth.value;
            if (event.altKey)
                left = Math.round((x - gridWidth.value / 8) / (gridWidth.value / 4)) * gridWidth.value / 4;

            const top = Math.round((y - gridHeight / 2) / gridHeight) * gridHeight;

            const number = (1284 - (top / 2)) / 144;
            const noteName = noteNames[number * 12 % 12] + "" + Math.floor(number);
            startNote(0, { name: noteName, index: number * 12 % 12 }, Math.floor(number));
            endNote(0, { name: noteName, index: number * 12 % 12 }, Math.floor(number));

            const existingNote = notesInGrid.value.find(note =>
                note.left <= x && x <= note.left + note.width + 1 && note.top === top && !note.muted
            );

            if (!existingNote) {
                if (event.button !== 0)
                    return;
                clearSelection();
                const id = notesInGrid.value.length + Date.now();
                const newNote = {
                    left: left,
                    top: top,
                    width: 256 * (currentNoteLength.value/(960*4)) - 1,
                    highlighted: false,
                    color: selectedTrack.value ? selectedTrack.value.color : 'hsla(212, 100%, 50%, 0.5)',
                    id: id,
                    name: noteName,
                    pitch: number * 12 % 12 + 12 * (Math.floor(number) + 1),
                    length: currentNoteLength.value,
                    start: Math.round(left / (256) * (960*4)),
                    end: Math.round(left / (256) * (960*4) + currentNoteLength.value),
                    volume: currentNoteVolume.value,
                    track: selectedTrack.value
                };
                notesInGrid.value.push(newNote);
                selectedTrack.value.notes.unshift(newNote);
                startDrag(notesInGrid.value.find(note => note.id == id), event, false);
            } else {
                // Here, we have identified that we clicked on an existing note.
                if (event.button === 0) {
                    const resizeHandleWidth = Math.min(10, (existingNote.width + 1) * 0.4) / zoomScalar.value;
                    const volumeHandleCenter = { x: existingNote.left + (existingNote.width + 1) / 2, y: existingNote.top + gridHeight };
                    const squaredDistToCenter = ((volumeHandleCenter.x - x) * zoomScalar.value) ** 2 + (volumeHandleCenter.y - y) ** 2;
                    const radius = Math.min(6, ((existingNote.width + 1) / 4) * zoomScalar.value);
                    if (x >= existingNote.left + existingNote.width - resizeHandleWidth && x <= existingNote.left + existingNote.width + 1) {
                        startResize(existingNote, event);
                        selectedTrackIndex.value = tracks.value.indexOf(existingNote.track);
                        currentNoteLength.value = existingNote.length;
                        currentNoteVolume.value = existingNote.volume;
                    } else if (squaredDistToCenter <= radius * radius) {
                        startVolumeChange(existingNote, event);
                        selectedTrackIndex.value = tracks.value.indexOf(existingNote.track);
                        currentNoteLength.value = existingNote.length;
                        currentNoteVolume.value = existingNote.volume;
                    } else {
                        startDrag(existingNote, event);
                    }
                } else if (event.button === 2) {
                    removeNote(existingNote, false);
                }
                
                //console.log(existingNote.length, existingNote.left, existingNote.start, existingNote.end);
            }
        };

        //let trackWrappers = [];

        const trackify = () => {
            let notesList = [...selectedTrack.value.notes].sort((a, b) => {
                if (a.start === b.start) {
                    return a.top - b.top;
                }
                return a.start - b.start;
            });
            //let trackWrappers = [];
            // for (let i = 0; i < tracks.value.length; ++i) {   
            //     trackWrappers.push({
            //         notes: [],
            //         track: tracks.value[i]
            //     });
            // }

            // Idea: Take the selected track and split it into more tracks.
            // This involves adding new tracks (only if allowed, otherwise cancel the operation)
            // if (tracks.value.length < 16)
            //     addTrack();
            // Then, put the proper notes into the proper tracks.

            // For all notes in the selected track
            // starting with selected track:
            // if note can go into this track, then add it
            // otherwise, add a new track, and put the note in there.

            // after all notes are situated, loop through all tracks in the wrapper and set their notes equal to the new note lists

            let trackWrappers = [];
            trackWrappers.push({
                notes: [],
                track: selectedTrack.value,
                index: 0
            });

            for (const note of notesList) {
                for (const trackWrapper of trackWrappers) {
                    if (!trackWrapper.notes[0] || trackWrapper.notes[0].end <= note.start) {
                        trackWrapper.notes.unshift(note);
                        break;
                    } else {
                        if (trackWrapper.index === trackWrappers.length - 1) {
                            trackWrappers.push({
                                notes: [],
                                track: { instrument: trackWrapper.track.instrument, color: null, name: selectedTrack.value.name + ` (${trackWrappers.length})` },
                                index: trackWrappers.length
                            });
                        }
                    }
                }
            }

            if (tracks.value.length + trackWrappers.length - 1 > 15) {
                showFailureMessage('Failed to split track! (Process would create too many tracks!)');
                return;
            }

            showSuccessMessage(`Successfully split the track "${selectedTrack.value.name}" into ${trackWrappers.length} tracks!`, 3000);

            for (const trackWrapper of trackWrappers) {
                if (!tracks.value.includes(trackWrapper.track)) {
                    trackWrapper.track = addTrack(trackWrapper.track.instrument, trackWrapper.track.color, trackWrapper.track.name);
                }
                trackWrapper.track.notes = trackWrapper.notes;
                for (const note of trackWrapper.track.notes) {
                    note.track = trackWrapper.track;
                    note.color = trackWrapper.track.color;
                }
            }

        };

        function hexToRgba(originalColor, alpha) {
            let hex = originalColor.replace('#', '');

            if (hex.length === 3) {
                hex = hex.split('').map(char => char + char).join('');
            }

            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);

            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }

        function copyToClipboard(text) {
            navigator.clipboard.writeText(text).then(() => {
                successNotificationText.value = "MML copied to clipboard!";
                showSuccessNotification.value = true; // Show notification

                // Hide notification after 2 seconds
                setTimeout(() => {
                    showSuccessNotification.value = false;
                }, 2000);
            }).catch(err => {
                console.error('Could not copy text: ', err);
            });
        }

        function optimDijkstra(tokens) {
            // An early exit Dijkstra's algorithm
            // Priority Queue worklist to which I add nodes whose priority is the total distance to reach that node.
            // uniform cost search
            const n = tokens.length;
            // if depth = n then stop and return the string from the parents of the shortest path.

            class GraphNode {
                constructor (textValue, implicitOct, implicitLen, implicitVol) {
                    this.implicitOct = implicitOct;
                    this.implicitLen = implicitLen;
                    this.implicitVol = implicitVol;
                    this.parent = null;
                    this.children = [];
                    this.textValue = textValue;
                    this.accCost = textValue.length;
                    this.depth = 0;
                }

                addChild(child) {
                    this.children.push(child);
                    child.parent = this;
                    child.accCost += this.accCost;
                    child.depth = this.depth + 1;
                }

            }

            function stateKey(depth, len, oct, vol) {
                return `${depth}|${len}|${oct}|${vol}`;
            }

            const bestCost = new Map();

            const startNode = new GraphNode('', 4, 960, 8);
            const worklist = new Heap((a, b) => a.priority - b.priority);
            let endNode = null;
            worklist.push( {node: startNode, priority: 0} );

            while (worklist.size() > 0) {
                const { node: u, priority } = worklist.pop();
                const key = stateKey(u.depth, u.implicitLen, u.implicitOct, u.implicitVol);

                if (bestCost.has(key) && bestCost.get(key) <= priority) continue;
                bestCost.set(key, priority);

                const d = u.depth;
                const token = tokens[d];
                const tl = token?.length;
                const td = token?.dotted;
                const lengthString = Math.floor((960 * 4) / tl * (td ? 1.5 : 1)) + (td ? '.' : '');
                let suffixLengthString = lengthString;
                if (tl === u.implicitLen * 1.5 && td) {
                    suffixLengthString = '.';
                }

                if (d === n) {
                    endNode = u;
                    break;
                }

                // create the children then add them to the worklist.
                if (token.type === 'NOTE') {
                    let octaveString = '';
                    let volumeString = token.volume === u.implicitVol ? '' : `V${token.volume}`;

                    let octaveDiff = token.octave - u.implicitOct;
                    if (Math.abs(octaveDiff) > 2) {
                        octaveString = `o${token.octave}`;
                    } else {
                        octaveString = (octaveDiff > 0 ? '>' : '<').repeat(Math.abs(octaveDiff));
                    }

                    if (token.length === u.implicitLen) {
                        u.addChild(new GraphNode(`${volumeString}${octaveString}${token.name}`, token.octave, u.implicitLen, token.volume));
                        u.addChild(new GraphNode(`${volumeString}N${token.pitch}`, u.implicitOct, u.implicitLen, token.volume));

                        if (token.name === 'b') {
                            octaveDiff = (token.octave+1) - u.implicitOct;
                            if (Math.abs(octaveDiff) > 2) {
                                octaveString = `o${token.octave}`;
                            } else {
                                octaveString = (octaveDiff > 0 ? '>' : '<').repeat(Math.abs(octaveDiff));
                            }
                            u.addChild(new GraphNode(`${volumeString}${octaveString}c-`, token.octave + 1, u.implicitLen, token.volume));
                        }

                        if (token.name === 'c') {
                            octaveDiff = (token.octave-1) - u.implicitOct;
                            if (Math.abs(octaveDiff) > 2) {
                                octaveString = `o${token.octave}`;
                            } else {
                                octaveString = (octaveDiff > 0 ? '>' : '<').repeat(Math.abs(octaveDiff));
                            }
                            u.addChild(new GraphNode(`${volumeString}${octaveString}b+`, token.octave - 1, u.implicitLen, token.volume));
                        }

                    } else {
                        u.addChild(new GraphNode(`${volumeString}L${lengthString}${octaveString}${token.name}`, token.octave, token.length, token.volume));
                        u.addChild(new GraphNode(`${volumeString}${octaveString}${token.name}${suffixLengthString}`, token.octave, u.implicitLen, token.volume));

                        if (token.name === 'b') {
                            octaveDiff = (token.octave+1) - u.implicitOct;
                            if (Math.abs(octaveDiff) > 2) {
                                octaveString = `o${token.octave}`;
                            } else {
                                octaveString = (octaveDiff > 0 ? '>' : '<').repeat(Math.abs(octaveDiff));
                            }
                            u.addChild(new GraphNode(`${volumeString}L${lengthString}${octaveString}c-`, token.octave + 1, token.length, token.volume));
                            u.addChild(new GraphNode(`${volumeString}${octaveString}c-${suffixLengthString}`, token.octave + 1, u.implicitLen, token.volume));
                        }

                        if (token.name === 'c') {
                            octaveDiff = (token.octave-1) - u.implicitOct;
                            if (Math.abs(octaveDiff) > 2) {
                                octaveString = `o${token.octave}`;
                            } else {
                                octaveString = (octaveDiff > 0 ? '>' : '<').repeat(Math.abs(octaveDiff));
                            }
                            u.addChild(new GraphNode(`${volumeString}L${lengthString}${octaveString}b+`, token.octave - 1, token.length, token.volume));
                            u.addChild(new GraphNode(`${volumeString}${octaveString}b+${suffixLengthString}`, token.octave - 1, u.implicitLen, token.volume));
                        }

                        u.addChild(new GraphNode(`${volumeString}L${lengthString}N${token.pitch}`, u.implicitOct, token.length, token.volume));
                    }
                } else if (token.type === 'REST') {
                    if (token.length === u.implicitLen) {
                        u.addChild(new GraphNode(`${token.name}`, u.implicitOct, u.implicitLen, u.implicitVol));
                    } else {
                        u.addChild(new GraphNode(`L${lengthString}${token.name}`, u.implicitOct, token.length, u.implicitVol));
                        u.addChild(new GraphNode(`${token.name}${suffixLengthString}`, u.implicitOct, u.implicitLen, u.implicitVol));
                    }
                } else if (token.type === 'TEMPO') {
                    u.addChild(new GraphNode(`T${token.tempo}`, u.implicitOct, u.implicitLen, u.implicitVol));
                }

                for (const child of u.children) {
                    worklist.push({node: child, priority: child.accCost});
                }

            }

            // Rebuild string with list from recursively checking parents.
            const pieces = [];
            let currentNode = endNode;
            while (currentNode !== null) {
                pieces.push(currentNode.textValue);
                currentNode = currentNode.parent;
            }

            return pieces.reverse().join('');

        }

        function OxLxTokensDP(tokens) {
            const n = tokens.length;

            // All possible lengths and octaves we may encounter
            const lengths = new Set(['4', ...tokens.filter(t => t.type !== 'TEMPO').map(t => t.lengthString)]);
            const octaves = new Set(tokens.filter(t => t.type === 'NOTE').map(t => t.octave));
            octaves.add(4);

            const dp = {};
            const action = {};

            function getDP(i, len, oct) {
                return dp[i]?.[len]?.[oct] ?? Infinity;
            }

            function setDP(i, len, oct, val, act) {
                dp[i] ??= {};
                dp[i][len] ??= {};
                dp[i][len][oct] = val;

                action[i] ??= {};
                action[i][len] ??= {};
                action[i][len][oct] = act;
            }

            // Base case: finishing at end has 0 cost
            for (const len of lengths) {
                for (const oct of octaves) {
                    setDP(n, len, oct, 0, null);
                }
            }

            // Helper: compute encoding cost/options for a note/rest in current state
            function encodingsFor(lengthString, curLen, tie, noteName, notePitch, useTies) {
                const results = [];

                const isDotted = lengthString.endsWith('.');
                const undotted = isDotted ? lengthString.slice(0, -1) : lengthString;
                const tieString = tie ? '&' : '';

                // Implicit (length same as current)
                if (lengthString === curLen) {
                    if (noteName) {
                        const implicit = tieString + noteName;
                        results.push({
                            spelling: implicit,
                            newLen: curLen,
                            cost: implicit.length,
                            type: 'implicit'
                        });
                    } else {
                        const implicit = tieString + 'r';
                        results.push({
                            spelling: implicit,
                            newLen: curLen,
                            cost: implicit.length,
                            type: 'implicit'
                        });
                    }
                }

                // Switch (change L then note)
                const sw = 'L' + lengthString + tieString + (noteName || 'r');
                results.push({
                    spelling: tieString + (noteName || 'r'),
                    newLen: lengthString,
                    cost: sw.length,
                    type: 'switch',
                    needLengthCmd: true
                });

                // Explicit (append undotted)
                if (noteName) {
                    const ex = tieString + noteName + undotted;
                    results.push({
                        spelling: ex,
                        newLen: curLen,
                        cost: ex.length,
                        type: 'explicit'
                    });
                }

                // Pitch-notation (when useTies and we have pitch)
                if (useTies && notePitch !== undefined) {
                    if (lengthString === curLen) {
                        const usePitch = tieString + `N${notePitch}`;
                        results.push({
                            spelling: usePitch,
                            newLen: curLen,
                            cost: usePitch.length,
                            type: 'pitchImplicit',
                            pitch: notePitch
                        });
                    }
                    const exPitch = `L${lengthString}${tieString}N${notePitch}`;
                    results.push({
                        spelling: tieString + `N${notePitch}`,
                        newLen: lengthString,
                        cost: exPitch.length,
                        type: 'pitchSwitch',
                        pitch: notePitch,
                        needLengthCmd: true
                    });
                }

                return results;
            }

            // Bottom-up DP
            for (let i = n - 1; i >= 0; i--) {
                const token = tokens[i];
                for (const len of lengths) {
                    for (const oct of octaves) {
                        let best = Infinity;
                        let bestAct = null;

                        if (token.type === 'REST') {
                            const options = encodingsFor(token.lengthString, len, false, null, null, false);
                            for (const opt of options) {
                                const cand = opt.cost + getDP(i + 1, opt.newLen, oct);
                                if (cand < best) {
                                    best = cand;
                                    bestAct = { type: 'rest', ...opt };
                                }
                            }

                        } else if (token.type === 'NOTE') {
                            const spellings = [];

                            // Normal spelling
                            spellings.push({ name: token.name, oct: token.octave });

                            // Enharmonics
                            if (token.name.toLowerCase() === 'b' && token.octave + 1 <= 8) {
                                spellings.push({ name: 'c-', oct: token.octave + 1 });
                            }
                            if (token.name.toLowerCase() === 'c' && token.octave - 1 >= 0) {
                                spellings.push({ name: 'b+', oct: token.octave - 1 });
                            }

                            for (const sp of spellings) {
                                const options = encodingsFor(token.lengthString, len, false, sp.name, token.pitch, true);

                                for (const opt of options) {
                                    // A) Implicit octave (same as current)
                                    const isPitchNotation = opt.type.startsWith('pitch');
                                    if (isPitchNotation || sp.oct === oct) {
                                        const cand = opt.cost + getDP(i + 1, opt.newLen, oct);
                                        if (cand < best) {
                                            best = cand;
                                            bestAct = { type: 'spell', newOct: oct, ...opt };
                                        }
                                    }

                                    if (isPitchNotation) continue;

                                    // B) Relative octave (within ±2)
                                    const diff = sp.oct - oct;
                                    if (Math.abs(diff) <= 2 && diff !== 0) {
                                        const relPrefix = (diff > 0 ? '>' : '<').repeat(Math.abs(diff));
                                        const cand = relPrefix.length + opt.cost + getDP(i + 1, opt.newLen, sp.oct);
                                        if (cand < best) {
                                            best = cand;
                                            bestAct = { type: 'spell+relOct', shift: diff, newOct: sp.oct, ...opt };
                                        }
                                    }

                                    // C) Absolute octave
                                    const absPrefix = `o${sp.oct}`;
                                    const cand = absPrefix.length + opt.cost + getDP(i + 1, opt.newLen, sp.oct);
                                    if (cand < best) {
                                        best = cand;
                                        bestAct = { type: 'spell+absOct', newOct: sp.oct, ...opt };
                                    }
                                }
                            }
                        }

                        setDP(i, len, oct, best, bestAct);
                    }
                }
            }

            // Rebuild token list
            let implicitLen = '4';
            let implicitOct = 4;
            const output = [];

            for (let i = 0; i < tokens.length; i++) {
                const token = tokens[i];
                if (token.type === 'TEMPO') {
                    output.push(token);
                    continue;
                }

                const a = action[i][implicitLen][implicitOct];
                if (!a) continue;

                if (a.newOct !== undefined && a.type !== 'spell') {
                    let text;
                    if (a.type === 'spell+absOct') {
                        text = `o${a.newOct}`;
                    } else if (a.type === 'spell+relOct') {
                        const shift = a.shift;
                        text = (shift > 0 ? '>' : '<').repeat(Math.abs(shift));
                    }
                    output.push({ type: 'OCTAVE', start: token.start, text });
                    implicitOct = a.newOct;
                }

                if (a.needLengthCmd) {
                    output.push({
                        type: 'LENGTH',
                        start: token.start,
                        lengthString: a.newLen,
                        length: Number(a.newLen),
                        dotted: a.newLen.endsWith('.')
                    });
                    implicitLen = a.newLen;
                }

                output.push({
                    type: token.type,
                    start: token.start,
                    name: a.spelling,
                    lengthString: a.newLen,
                    length: Number(a.newLen),
                    dotted: a.newLen.endsWith('.'),
                    tie: false,
                    pitch: a.pitch
                });

                implicitLen = a.newLen;
            }

            return output;
        }

        const getTrackTokens = (track) => {
            let tokens = [];
            // Add Note tokens to list
            for (const note of track.notes) {
                const noteLengths = getOptimalNoteLengths(note.length); // Returns a list of lists of raw note length strings
                const noteName = note.name.slice(0, note.name.length - 1).toLowerCase();
                let useTies = false;
                let prevNoteEnd = 0;
                for (const noteLength of noteLengths.noteCombination) {
                    tokens.push({
                        type: 'NOTE',
                        pitch: note.pitch - 12,
                        volume: note.volume,
                        length: noteLength.length / 32,
                        lengthString: noteLength.name,
                        dotted: noteLength.name.endsWith('.'),
                        start: note.start + prevNoteEnd,
                        octave: Math.floor((note.pitch - 12) / 12),
                        name: (useTies ? '&' : '') + noteName
                    });
                    useTies = true;
                    prevNoteEnd += noteLength.length / 32;
                }
            }
            // Add tempo markers before rests
            // Remove any duplicate tempo markers and push only relevant ones
            const latestTempoMarkers = new Map();

            if (tempo.value !== 120) {
                latestTempoMarkers.set(0, {
                    parentTrack: track,
                    tempo: tempo.value,
                    left: 0
                });
            }

            for (const marker of tempoMarkers.value) {
                if (marker.parentTrack === track) {
                    latestTempoMarkers.set(marker.left, marker);
                }
            }

            for (const marker of latestTempoMarkers.values()) {
                tokens.push({
                    type: 'TEMPO',
                    tempo: marker.tempo,
                    start: marker.left / 256 * 960 * 4,
                    length: 0
                });
            }

            tokens.sort((a, b) => {
                if (a.start - b.start === 0) {
                    if (a.type === 'TEMPO')
                        return -1
                }
                return a.start - b.start;
            });

            // Add Rests between notes and tempo markers
            for (let i = -1; i < tokens.length - 1; ++i) {
                const token1 = i > -1 ? tokens[i] : {
                    type: 'TEMPO',
                    length: 0,
                    start: 0
                };
                const token2 = tokens[i + 1];

                if (token1.type === 'REST' || token2.type === 'REST') continue;

                const gap = Math.max(0, token2.start - (token1.start + token1.length));
                if (gap > 0) {
                    const restLengths = getOptimalNoteLengths(gap);
                    let prevRestEnd = 0;
                    for (const restLength of restLengths.noteCombination) {
                        tokens.splice(i + 1, 0, {
                            type: "REST",
                            length: restLength.length / 32,
                            lengthString: restLength.name, // This IS MML REPRESENTATION
                            start: token1.start + token1.length + prevRestEnd,
                            name: "r",
                            dotted: restLength.name.endsWith('.')
                        });
                        prevRestEnd += restLength.length / 32;
                        i++;
                    }
                }
            }
            // Run dynamic programming algorithm to place length tokens in proper spots (ignoring tempo tokens).
            const tempoTokens = tokens.filter(t => t.type === 'TEMPO');
            const dpTokens = tokens.filter(t => t.type !== 'TEMPO');

            const testStr = optimDijkstra(tokens);
            return { tokens: tokens, rendered: testStr };
        };

        const renderTrackTokens = (tokenList) => {
            let output = [];
            let activeDefault = 4;
            let activeDotted = false;

            if (!tokenList) {
                return;
            }

            for (const tok of tokenList) {
                let rendered = '';
                if (tok.type === 'LENGTH') {
                    activeDefault = tok.length;
                    activeDotted = tok.dotted;
                    rendered = `L${activeDefault}${tok.dotted ? '.' : ''}`;
                } else if (tok.type === 'OCTAVE') {
                    rendered = tok.text;
                } else if (tok.type === 'VOLUME') {
                    rendered = `V${tok.volume}`;
                } else if (tok.type === 'REST') {
                    rendered = tok.name;
                } else if (tok.type === 'NOTE') {
                    rendered = tok.name;
                } else if (tok.type === 'TEMPO') {
                    rendered = `T${tok.tempo}`;
                }

                if (rendered)
                    output.push(rendered);
            }

            let outputText = output.join('');
            return outputText;
        };

        const genTokensOutright = (singleTrack = null) => {
            // Should split this per track.
            const tracksToConsider = [singleTrack] || tracks.value;
            if (tracksToConsider[0] === null || tracksToConsider === 0)
                return;
            const allTokens = [];
            for (const track of tracksToConsider) {
                allTokens.push(getTrackTokens(track));
            }
            return allTokens;
        };

        function renderTokens(tokenList) {
            const outputText = renderTrackTokens(tokenList);
            return outputText;
        }

        function getEnharmonicEquivalent(note) {
            if (note.length === 1)
                return note;
            let root = note[0];
            let accidental = note[1];
            let noteIndex = noteNames.indexOf(root);
            if (accidental === '#' || accidental === '+') {
                noteIndex = (noteIndex + 1) % 12;
            } else if (accidental === '-') {
                noteIndex = ((noteIndex - 1) % 12 + 12) % 12;
            }
            return noteNames[noteIndex];
        }

        const patterns = {
            LENGTH: /[Ll](\d+)\.?/g,  // Matches note lengths, e.g., L4, L8.
            NOTE: /[a-gA-G][-+#]?\d*\.?|N\d+/g,         // Matches notes like N60, N62.
            REST: /[Rr]\d*\.?/g,      // Matches rests like R4, R8.
            TIE: /&/g,              // Matches ties.
            VOLUME: /[Vv](\d+)/g,
            TEMPO: /[Tt](\d+)/g,
            OCTAVE: /[Oo](\d+)|[<>]/g
        };

        function tokenizeMML(mmlString) {
            let tokens = [];

            // Run regex patterns over the input
            for (const [key, regex] of Object.entries(patterns)) {
                let match;
                while ((match = regex.exec(mmlString)) !== null) {
                    tokens.push({ type: key, value: match[0], index: match.index });
                }
            }

            // Sort tokens by their original index in the string
            tokens.sort((a, b) => { return a.index - b.index });

            return tokens;
        }

        function mmlToNewTrack(title, mmlTokens) {
            let newTokenList = [...mmlTokens];
            // Creates a new track with title and with data from mmlTokens
            let newTrack = addTrack(instruments.value[10], null, title);
            let octave = 4;
            let length = '4';
            let tempo = '120';
            let volume = '8';
            let builderX = 0; // We will update the currentX based on note length/width/etc
            let previousNote = null;
            for (let i = 0; i < newTokenList.length; i++) {
                let token = newTokenList[i];
                if (token.type === 'LENGTH') {
                    let tokenLength = token.value.split('L')[1];
                    if (tokenLength !== length) {
                        length = tokenLength;
                    }
                } else if (token.type === 'TIE') {
                    if (previousNote === null || newTokenList[i + 1] == null)
                        continue;
                    // if the next note has the same pitch as the previous note, then we modify the duration of previous note and increment builderX and i
                    let nextNote = newTokenList[i + 1];
                    let noteLength = length;
                    let noteName = 'C';
                    let noteOctave = octave;
                    let notePitch = 0;

                    if (nextNote.value.startsWith('N')) {
                        notePitch = Number(nextNote.value.split('N')[1]);
                        noteOctave = Math.floor(notePitch / 12);
                        noteName = noteNames[(notePitch - 12 * noteOctave) % 12];
                        let dotted = noteLength.includes('.');
                        noteLength = Number(noteLength.slice(0, noteLength.length - dotted)) * (dotted ? 2 / 3 : 1);
                    } else {
                        let sharp = nextNote.value.includes('#') || nextNote.value.includes('+')
                        let flat = nextNote.value.includes('-');
                        let dotted = nextNote.value.includes('.');
                        noteName = getEnharmonicEquivalent(nextNote.value.slice(0, 1 + sharp + flat));
                        let noteIndex = noteNames.indexOf(noteName);
                        if (noteIndex === 11 && flat)
                            noteOctave -= 1;
                        if (noteIndex === 0 && sharp)
                            noteOctave += 1;
                        if (nextNote.value.length - dotted > 1 + sharp + flat) { // If the note has a length added on
                            noteLength = Number(nextNote.value.slice(((sharp || flat) ? 2 : 1), nextNote.value.length - dotted)) * (dotted ? 2 / 3 : 1);
                        } else {// If the note has no added length
                            let Ldotted = length.includes('.');
                            dotted = Ldotted || dotted;
                            noteLength = Number(length.slice(0, length.length - Ldotted)) * (dotted ? 2 / 3 : 1);
                        }
                        notePitch = noteNames.indexOf(noteName) + 12 * noteOctave;
                    }
                    if (previousNote.pitch - 12 === notePitch) {
                        builderX += 256 / noteLength;
                        previousNote.width += 256 / noteLength;
                        previousNote.length += (960*4) / noteLength;
                        previousNote.end += (960*4) / noteLength;
                        i++;
                    }

                } else if (token.type === 'OCTAVE') {
                    let tokenOctave = token.value;
                    if (tokenOctave === '<') {
                        octave -= 1;
                    } else if (tokenOctave === '>') {
                        octave += 1;
                    } else {
                        octave = Number(tokenOctave.split('O')[1]);
                    }
                } else if (token.type === 'VOLUME') {
                    let tokenVolume = token.value.split('V')[1];
                    if (tokenVolume !== volume) {
                        volume = tokenVolume;
                    }
                } else if (token.type === 'TEMPO') {
                    let tokenTempo = token.value.split('T')[1];
                    if (tokenTempo !== tempo) {
                        tempo = tokenTempo;
                        tempoMarkers.value.push({
                            left: builderX,
                            tempo: Number(tempo),
                            color: newTrack.color,
                            parentTrack: newTrack,
                            muted: false
                        });
                    }
                } else if (token.type === 'REST') {
                    let restLength = token.value.split('R')[1];
                    if (restLength === length || Number(restLength) === 0 || isNaN(Number(restLength))) {
                        let dotted = length.includes('.') || restLength.includes('.');
                        let lengthNum = Number(length);
                        builderX += (256 / lengthNum) * (dotted ? 1.5 : 1); // 1 bar is 256 pixels (no matter the tempo)
                    } else {
                        let dotted = restLength.includes('.');
                        let lengthNum = Number(restLength);
                        builderX += (256 / lengthNum) * (dotted ? 1.5 : 1); // 1 bar is 256 pixels (no matter the tempo)
                    }
                } else if (token.type === 'NOTE') {
                    // notes will be placed starting from builderX
                    // each note COULD have its own length, but notes starting with 'N' or not having a following number use the global length value
                    let noteLength = length;
                    let noteName = 'C';
                    let noteOctave = octave;
                    let notePitch = 0;

                    if (token.value.startsWith('N')) {
                        notePitch = Number(token.value.split('N')[1]);
                        noteOctave = Math.floor(notePitch / 12);
                        noteName = noteNames[(notePitch - 12 * noteOctave) % 12];
                        let dotted = noteLength.includes('.');
                        noteLength = Number(noteLength) * (dotted ? 2 / 3 : 1);
                    } else {
                        let sharp = token.value.includes('#') || token.value.includes('+');
                        let flat = token.value.includes('-');
                        let dotted = token.value.includes('.');
                        noteName = getEnharmonicEquivalent(token.value.slice(0, 1 + sharp + flat));
                        let noteIndex = noteNames.indexOf(noteName);
                        if (noteIndex === 11 && flat)
                            noteOctave -= 1;
                        if (noteIndex === 0 && sharp)
                            noteOctave += 1;
                        if (token.value.length - dotted > 1 + sharp + flat) { // If the note has a length added on
                            noteLength = Number(token.value.slice(((sharp || flat) ? 2 : 1), token.value.length)) * (dotted ? 2 / 3 : 1);
                        } else { // If the note has no added length
                            let Ldotted = length.includes('.');
                            dotted = Ldotted || dotted;
                            noteLength = Number(length) * (dotted ? 2 / 3 : 1);
                        }
                        notePitch = noteNames.indexOf(noteName) + 12 * noteOctave;
                    }

                    const newNote = {
                        left: builderX, // In pixels
                        top: 2568 - notePitch * gridHeight, // In pixels, the top of the note
                        width: 256 / noteLength - 1, // In pixels (we assume 4/4 time, which is 16 pixels per beat)
                        highlighted: false,
                        color: newTrack.color,
                        id: notesInGrid.value.length + Date.now(),
                        name: noteName + noteOctave,
                        pitch: notePitch + 12,
                        length: (960*4) / noteLength, // In beats
                        start: builderX / 256 * (960*4), // In beats
                        end: builderX / 256 * (960*4) + (960*4) / noteLength, // In beats
                        volume: Number(volume),
                        track: newTrack
                    };
                    notesInGrid.value.push(newNote);
                    newNote.track.notes.unshift(newNote);
                    builderX += newNote.width + 1;
                    previousNote = newNote;
                }
            }
        }

        function parseMMLNotation(mmlString) {
            const segments = mmlString.replace(/\s/, '').toUpperCase().match(/MML@([^;]+);/)[1].split(',');
            for (const segment of segments) {
                if (segment.length > 0)
                    mmlToNewTrack(null, tokenizeMML(segment));
            }
        }

        function parseMabiNotation(mabiString) {
            const lines = mabiString.split("\r\n"); // Goes title, composer, melody, harmony1, harmony2, song
            let tokenizedSections = [];
            for (let i = 2; i < lines.length; ++i) {
                let line = lines[i].split(" : ");
                if (line.length < 2) {
                    continue;
                }
                tokenizedSections.push({ title: line[0].trim(), tokens: tokenizeMML(line[1].trim().toUpperCase()) });
            }

            // Convert the titles and tokens into tracks with notes in them (and any tempo markers).
            for (const section of tokenizedSections) {
                if (section.tokens.length > 0) {
                    mmlToNewTrack(section.title, section.tokens);
                }
            }

        }

        function parseMML(mmlString) {
            if (mmlString.trim().startsWith("MML@") && mmlString.trim().endsWith(";")) {
                parseMMLNotation(mmlString);
            } else {
                parseMabiNotation(mmlString);
            }
        }

        function importMidi() {
            // Let user choose and "upload" MIDI file
            const hiddenFileInput = document.getElementById('hiddenFileInput');
            hiddenFileInput.click();

            let handleFileSelect = async () => {
                const file = hiddenFileInput.files[0];

                hiddenFileInput.removeEventListener('change', handleFileSelect);

                if (file) {
                    const reader = new FileReader();

                    reader.onload = async function (e) {
                        const arrayBuffer = e.target.result;

                        try {
                            const parsedMIDI = new MIDI(arrayBuffer);
                            await parsedMIDI.isReady;

                            const ticksPerBeat = parsedMIDI.timeDivision;
                            const fileDuration = parsedMIDI.duration;
                            const fileTempo = parsedMIDI.tempoChanges.at(-2).tempo;

                            const firstAddedTrackIndex = tracks.value.length;

                            parsedMIDI.tracks.forEach((track, idx) => {

                                const trackName = track.name || `Track ${idx}`;
                                const activeNotes = []; // {pitch: 66, ticks: 44, velocity: 127}
                                const sustainBuffer = [];
                                const pairedNotes = []; // {startTicks: 1, pitch: 66, duration: 76 (in ticks, end ticks minus start ticks), velocity: 65}

                                let pedalDown = false;

                                track.forEach(midiMessage => {
                                    const status = midiMessage.messageStatusByte;
                                    const data = midiMessage.messageData;
                                    const ticks = midiMessage.ticks;

                                    if ((status & 0xF0) === 0x90 && data[1] > 0) {
                                        activeNotes.push({
                                            pitch: data[0],
                                            ticks,
                                            velocity: data[1]
                                        });
                                    }

                                    // Note-off (either via 0x80 or 0x90 velocity=0)
                                    else if (((status & 0xF0) === 0x80) || ((status & 0xF0) === 0x90 && data[1] === 0)) {
                                        const pitch = data[0];
                                        const endTicks = ticks;

                                        const index = activeNotes.findIndex(n => n.pitch === pitch);
                                        if (index !== -1) {
                                            const startNote = activeNotes.splice(index, 1)[0];

                                            if (pedalDown) {
                                                sustainBuffer.push({
                                                    pitch: startNote.pitch,
                                                    startTicks: startNote.ticks,
                                                    velocity: startNote.velocity,
                                                    originalEndTicks: endTicks
                                                });
                                            } else {
                                                pairedNotes.push({
                                                    startTicks: startNote.ticks,
                                                    pitch: startNote.pitch,
                                                    duration: endTicks - startNote.ticks,
                                                    velocity: startNote.velocity
                                                });
                                            }
                                        }
                                    }

                                    // Sustain Pedal (Control Change 64)
                                    else if ((status & 0xF0) === 0xB0 && data[0] === 64) {
                                        const value = data[1];
                                        const wasDown = pedalDown;
                                        pedalDown = value >= 64;

                                        if (wasDown && !pedalDown) {
                                            // Pedal released – finalize all sustained notes
                                            for (const note of sustainBuffer) {
                                                pairedNotes.push({
                                                    startTicks: note.startTicks,
                                                    pitch: note.pitch,
                                                    duration: ticks - note.startTicks,
                                                    velocity: note.velocity
                                                });
                                            }
                                            sustainBuffer.length = 0;
                                        }
                                    }

                                    // Optionally, handle program change, tempo, etc., elsewhere
                                });

                                // Optional: handle any dangling notes at end of track
                                for (const note of activeNotes) {
                                    pairedNotes.push({
                                        startTicks: note.ticks,
                                        pitch: note.pitch,
                                        duration: 0, // or default duration
                                        velocity: note.velocity
                                    });
                                }

                                for (const note of sustainBuffer) {
                                    pairedNotes.push({
                                        startTicks: note.startTicks,
                                        pitch: note.pitch,
                                        duration: note.originalEndTicks - note.startTicks, // fallback if pedal never released
                                        velocity: note.velocity
                                    });
                                }

                                if (pairedNotes.length !== 0) {

                                    const newTrack = addTrack(instruments.value[10], null, trackName);

                                    for (const note of pairedNotes) {

                                        const notePitch = note.pitch - 12;
                                        const noteOctave = Math.floor(notePitch / 12);
                                        const noteName = noteNames[notePitch % 12];
                                        const noteLength = Math.max(60, Math.round(note.duration / ticksPerBeat * 960)); // in beats
                                        const noteWidth = Math.max(3, Math.round(note.duration / ticksPerBeat * 64 / 4) * 4 - 1);
                                        const noteLeft = Math.round(note.startTicks / ticksPerBeat * 64 / 4) * 4; // t * b/t * 64px/b = px (1/4 note at 120 bpm (default) is 64 px wide)
                                        const noteVolume = Math.floor(note.velocity / 8);

                                        const newNote = {
                                            left: noteLeft, // In pixels
                                            top: 2568 - notePitch * gridHeight, // In pixels, the top of the note
                                            width: noteWidth, // In pixels (we assume 4/4 time, which is 16 pixels per beat)
                                            highlighted: false,
                                            color: newTrack.color,
                                            id: notesInGrid.value.length + Date.now(),
                                            name: noteName + noteOctave,
                                            pitch: notePitch + 12,
                                            length: noteLength, // In beats
                                            start: Math.round(noteLeft / (256) * (960*4)), // In beats
                                            end: Math.round(noteLeft / (256) * (960*4)) + noteLength, // In beats
                                            volume: noteVolume,
                                            track: newTrack
                                        };

                                        notesInGrid.value.push(newNote);
                                        newNote.track.notes.unshift(newNote);
                                    }
                                }

                            });

                            tempo.value = Math.round(fileTempo);

                            const tempoMarkersTemp = [];
                            let previousTempo = fileTempo;

                            let idx = 0;
                            for (const tempo of parsedMIDI.tempoChanges) {
                                idx++;
                                if (Math.round(tempo.tempo) === previousTempo || tempo.ticks === 0 && idx === parsedMIDI.tempoChanges.length) {
                                    continue;
                                }
                                let marker = {
                                    left: Math.round(tempo.ticks / ticksPerBeat * 16) * 4,
                                    tempo: Math.round(tempo.tempo),
                                    color: tracks.value[firstAddedTrackIndex].color,
                                    parentTrack: tracks.value[firstAddedTrackIndex],
                                    muted: false
                                };

                                tempoMarkersTemp.push(marker);
                                previousTempo = Math.round(tempo.tempo);
                            }

                            tempoMarkers.value = [...tempoMarkers.value, ...tempoMarkersTemp];
                            hiddenFileInput.value = "";

                        } catch (err) {
                            console.error('Error parsing MIDI file:', err);
                        }
                    };

                    reader.readAsArrayBuffer(file);
                }
            };

            hiddenFileInput.addEventListener('change', handleFileSelect);
        }

        async function exportMidi() {
            const b = await getMidiBlob("MySong", 0);
            const blob = new Blob([b.buffer], {type: "audio/mid"});
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "MySong.mid";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }


        async function parseMMLFromClipboard() {
            const textFromClipboard = await navigator.clipboard.readText();
            parseMML(textFromClipboard);
            showSuccessMessage(`Successfully imported tracks from clipboard!`, 1000);
        }

        function tryRemoveNote(event) {
            if (event && event.buttons !== 2)
                return;

            const rect = gridCanvas.value.getBoundingClientRect();
            const x = (event.clientX - rect.left + scrollX.value) / zoomScalar.value;
            const y = event.clientY - rect.top + grid.value.scrollTop;

            for (const note of notesInGrid.value) {
                const left = note.left;
                const right = left + note.width;
                const top = note.top;
                const bottom = note.top + gridHeight;
                const intersects = left <= x && x <= right && y >= top && y <= bottom;
                if (intersects) {
                    removeNote(note, false, event);
                }
            }
        }

        const removeNote = (note, fromList, event = null) => {
            if (event && event.buttons !== 2)
                return;
            selectedNotes.value = selectedNotes.value.filter(n => n.id !== note.id);
            let oldSize = notesInGrid.value.length;
            notesInGrid.value = notesInGrid.value.filter(n => n.id !== note.id);
            let diff = oldSize - notesInGrid.value.length;
            for (const track of tracks.value) {
                track.notes = track.notes.filter(n => n.id !== note.id);
            }
            if (!fromList && isPlaying.value)
                playSequence();
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
            startVolumeChange,
            removeNote,
            gridWidth,
            gridHeight,
            gridSpan,
            startResize,
            endResize,
            onResize,
            currentNoteLength,
            playSequence,
            tempo,
            handleGridClick,
            handleGridScroll,
            isSelecting,
            rectangleStyle,
            handleRulerClick,
            markerPosition,
            markerReplayPosition,
            ruler,
            loopSong,
            trackify,
            tracks,
            backgroundStyle,
            genTokensOutright,
            renderTokens,
            showSuccessNotification,
            successNotificationText,
            showFailedNotification,
            failedNotificationText,
            handleTrackSelected,
            handleAddTrack,
            handleRemoveTrack,
            handleMuteTrack,
            instrKeyMin,
            instrKeyMax,
            hexToRgba,
            currentNoteVolume,
            clickTempoMarker,
            tempoMarkers,
            updateColor,
            zoomScalar,
            autoScrollSong,
            parseMMLFromClipboard,
            gridCanvas,
            windowWidth,
            scrollX,
            gridWrapper,
            tryRemoveNote,
            importMidi,
            exportMidi,
            copyToClipboard
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

.copyNotification {
    position: fixed;
    top: 20px;
    right: 20px;
    background-color: #4caf50;
    color: white;
    padding: 10px 20px;
    border-radius: 5px;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
    z-index: 1000;
}

.instrument-selector {
    padding: 10px;
    background-color: #f0f0f0;
    border-bottom: 1px solid #ccc;
}

.piano-roll {
    height: 94vh;
    flex-wrap: wrap;
    display: flex;
    overflow-y: auto;
    box-sizing: border-box;
    padding-bottom: 36px;
}

.piano-keys {
    padding-top: 30px;
    background-color: #ccc;
    width: 10%;
    display: flex;
    flex-direction: column-reverse;
    padding-bottom: 18px;
    /* Higher notes at the top */
    z-index: 12;
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

.ruler {
    position: absolute;
    left: 0;
    margin-left: calc(10% - 2px);
    background-color: #eee;
    height: 29px;
    border-bottom: 1px solid #ccc;
    display: flex;
    align-items: end;
    font-size: 12px;
    color: #333;
    z-index: 11;
    user-select: none;
    cursor: pointer;
}

.ruler-tick-label {
    position: absolute;
    bottom: 0;
    white-space: nowrap;
    transform: translateX(5px);
    font-size: 14px;
    color: #333;
}

.marker-replay-triangle {
    position: absolute;
    width: 0;
    height: 0;
    border-left: 10px solid transparent;
    border-right: 10px solid transparent;
    border-top: 10px solid #bbb;
    /* Triangle color */
    left: 50%;
    bottom: 0;
    /* Inside the ruler */
    transform: translateX(-50%);
}

.marker-wrapper {
    position: absolute;
    bottom: 0;
    left: 0;
    transform: translateX(-50%);
    pointer-events: none;
}

.marker-triangle {
    position: absolute;
    width: 0;
    height: 0;
    border-left: 10px solid transparent;
    border-right: 10px solid transparent;
    border-top: 10px solid #f00;
    /* Triangle color */
    left: 50%;
    bottom: 0;
    /* Inside the ruler */
    transform: translateX(-50%);
    z-index: 100;
}

.marker-line {
    position: absolute;
    width: 2px;
    height: 100vh;
    background-color: #f00;
    left: 50%;
    bottom: - 100%;
    /* Below the ruler */
    transform: translateX(-50%);
    z-index: 100;
}

.grid {
    position: absolute;
    overflow: hidden;
    display: flex;
    /* padding-top: 17px;
    margin-top: 30px;
    left: -1px;
    position: absolute;
    display: flex;
    min-width: 100%;
    align-self: top;
    height: 100%;/*2592px;
    background: repeating-linear-gradient( /*This is the horizontal lines
        0deg,
        #bbb,
        #bbb 2px,
        transparent 2px,
        transparent 24px
    ),
    repeating-linear-gradient( /*This is the Bar line
        90deg,
        #777,
        #777 2px,
        transparent 2px,
        transparent 256px
    ),
    repeating-linear-gradient( /*This is the vertical lines
        90deg,
        #c0c0c0,
        #c0c0c0 2px,
        transparent 2px,
        transparent 16px
    ),
    repeating-linear-gradient(/*This is the background colors
        90deg,
        #e0e0e0,
        #e0e0e0 64px,
        #ccc 64px,
        #ccc 128px
    );
    z-index: 10;
    overflow: hidden; */
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
    margin-left: 1px;
    overflow: hidden;
}

.note:active {
    background-color: rgba(0, 120, 255, 0.7);
}

.resize-handle {
    position: absolute;
    right: 0;
    top: 0;
    width: 40%;
    /* Adjust as needed */
    max-width: 10px;
    height: 100%;
    cursor: ew-resize;
    background-color: rgba(0, 0, 0, 0.2);
}

.volume-handle {
    width: 12px;
    height: 60%;
    /* Half the width to create the half-circle */
    background-color: rgba(0, 0, 0, 0.2);
    position: absolute;
    bottom: -35%;
    /* Align to the bottom of the note */
    left: 50%;
    transform: translateX(-50%);
    border-radius: 50%;
    /* Create a circle */
    clip-path: inset(0 0 50% 0);
    /* Clip top half, making it a half-circle */
    cursor: ns-resize;
    /* Show a pointer to indicate draggable */
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
    z-index: 1000;
    /* Ensure it's on top of other elements */
    outline: none;
    box-shadow: 0 3px 4px rgba(0, 0, 0, 0.3);
}

.loop-wrapper {
    position: fixed;
    top: 10px;
    right: 160px;
    padding: 10px 20px;
    height: 18px;
    font-size: 16px;
    cursor: pointer;
    user-select: none;
    background-color: #0078d4;
    color: white;
    border-radius: 5px;
    box-shadow: 0 3px 4px rgba(0, 0, 0, 0.3);
    z-index: 1000;
    width: 65px;
}

.scroll-wrapper {
    position: fixed;
    width: 108px;
    top: 50px;
    right: 10px;
    padding: 10px 20px;
    height: 18px;
    font-size: 16px;
    cursor: pointer;
    border: none;
    border-radius: 5px;
    background-color: #0078d4;
    color: white;
    z-index: 1000;
    /* Ensure it's on top of other elements */
    outline: none;
    box-shadow: 0 3px 4px rgba(0, 0, 0, 0.3);
}

.controls {
    display: flex;
    align-items: center;
}

.instrument-selector,
.tempo-selector {
    margin-right: 15px;
}

.selection-rect {
    position: absolute;
    border: 1px solid rgba(0, 100, 255, 0.5);
    background-color: rgba(0, 100, 255, 0.3);
    z-index: 30;
}

.gridCanvas {
    margin-top: 30px;
    display: block;
    z-index: 10;
    left: 0px;
}
</style>