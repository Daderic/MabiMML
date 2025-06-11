<template>
    <div>
      <!-- Help Button -->
      <button 
        class="help-button"
        @click="showHelp"
      >
        <span v-if="hoverHelp">Help</span>
        <span v-else> ? </span>
      </button>
  
      <!-- Help Modal -->
      <div v-if="isHelpVisible" class="modal-background">
        <transition name="fade">
          <div class="help-modal">
            <button class="close-button" @click="closeHelp">X</button>
            <div class="help-content">
              <h1>Help</h1>
              <p class="credits">MOS v1.1</p>

              <h3>Navigating the Grid</h3>
              <ul>
                <li>Scroll within the grid using the scroll bars, or directly with your mouse wheel.</li>
                <li>Scrolling your mouse wheel normally will move the grid vertically.</li>
                <li>Holding <strong>Shift</strong> while scrolling will move the grid horizontally.</li>
                <li>Holding <strong>Ctrl</strong> and scrolling will zoom the grid in and out.</li>
                <li>If the grid is focused (after clicking inside it), you can use the arrow keys to navigate around the grid.</li>
              </ul>

              <h3>Placing Notes</h3>
              <ul>
                <li>To place notes, click anywhere on the grid.</li>
                <li>The size of the note will be the same size as the note that was last placed/moved.</li>
                <li>Placed notes are instantly draggable.</li>
                <li>The color of the placed notes will depend on the color of the track they belong to.</li>
                <li>By changing the "Grid Spacing" dropdown, you can control whether the grid is in 16ths or 12ths.</li>
                <li>Each instrument has a different range of notes that it can play. The red keys on the piano to the left indicate notes that will not make a sound with the current instrument.</li>
              </ul>

              <h3>Dragging Notes</h3>
              <ul>
                <li>To drag a note, click on the left side of the note. Then, move your mouse around within the bounds of the grid.</li>
                <li>Holding <strong>Alt</strong> will move notes freely (not locked to the grid).</li>
                <li>If multiple notes are selected, all selected notes will be moved together (even if they are from different tracks).</li>
              </ul>

              <h3>Resizing Notes</h3>
              <ul>
                <li>To resize a note, click on the right side of the note, then drag left or right.</li>
                <li>Notes have a minimum length of 1/64th of a beat.</li>
                <li>Holding <strong>Alt</strong> will resize notes freely (not locked to the grid)</li>
                <li>If multiple notes are selected, all selected notes will be resized together.</li>
              </ul>

              <h3>Note Volume</h3>
              <ul>
                <li>The current note volume can be seen at the top of the screen.</li>
                <li>A note's volume is indicated by the opacity of the note, as well as the number next to the note's name.</li>
                <li>To change a note's volume, left click and hold on the half-circle at the bottom center of the note. Then, drag your mouse up and down. Dragging up will increase the note's volume, and dragging down will decrease it.</li>
                <li>Notes start with a default volume of 8.</li>
                <li>Notes have a volume range from 1 to 15.</li>
              </ul>

              <h3>Selecting Multiple Notes</h3>
              <ul>
                <li>To select multiple notes at once, hold <strong>Ctrl</strong> on the grid and drag your mouse.</li>
                <li>If you hold <strong>Ctrl+Shift</strong> and drag, you will "add on" to your note selection. <i>(Previously selected notes will not be unselected, and you can select additional notes.)</i></li>
                <li>If you hold <strong>Shift</strong> and drag a note, you will clone it (if that note is highlighted, it will clone all highlighted notes).</li>
                <li>Pressing <strong>Ctrl+A</strong> will select all notes in the grid.</li>
                <li>Pressing the <strong>Backspace</strong> or <strong>Delete</strong> keys will delete all selected notes.</li>
                <li>Holding <strong>Ctrl</strong> and pressing the left or right arrows will move the selected notes a whole grid space (i.e. 1/16th or 1/12th).</li>
                <li>Holding <strong>Ctrl</strong> and pressing the up or down arrows will move the selected notes an octave (if possible).</li>
                <li>Holding <strong>Shift</strong> and pressing the left or right arrows will move the selected notes a fourth of a grid space (i.e. 1/64th or 1/48th).</li>
                <li>Holding <strong>Shift</strong> and pressing the up or down arrows will move the selected notes up or down a single note (if possible).</li>
                <li>Pressing <strong>T</strong> with notes selected will move them into the currently selected track.</li>
              </ul>

              <h3>Tracks</h3>
              <ul>
                <li>Each track has its own name, instrument, color, and visibility/mute toggle.</li>
                <li>To add a track, click on the blue plus button to the right of the tracks.</li>
                <li>To rename a track, double click on the track's name. When done with renaming, press <strong>Enter</strong>.</li>
                <li>To mute/unmute a track, click on the volume icon next to the track's name.</li>
                <li>Clicking on a note from another track will cause you to switch to that note's track.</li>
                <li>You can remove a track by clicking on the <strong>X</strong>. This will also remove the notes belonging to that track.</li>
                <li>To change the color of a track and its notes, click on the outlined box at the bottom-center of the selected track's tab.</li>
                <li>You can have a minimum of 1 track, and a maximum of 16 tracks.</li>
                <li>The number of tracks you can have at once is dependant on screen width. This is so that smaller screens can still access all of their created tabs easily.</li>
                <li>Hovering over a track tab will show you the name of the track.</li>
                <li>With notes selected, pressing <strong>Ctrl+C</strong> or <strong>Ctrl+X</strong> will copy/cut notes.</li>
                <li>After copying/cutting notes, you can paste them back in with <strong>Ctrl+V</strong>. This will paste all previously copied notes into the current track.</li>
              </ul>

              <h3>Track Splitting</h3>
              <ul>
                <li>With a track selected, click the "Split Track" button. This will separate the track into multiple other tracks (unless that number would exceed 16).</li>
                <li>A track is split from left to right, then top to bottom. This can sometimes lead to weird splits.</li>
                <li>The purpose of this feature is so that you can compose parts of your piece in a single track, then split them up if you need to.</li>
              </ul>

              <h3>Exporting to MML</h3>
              <ul>
                <li>Clicking on the "Gen MML" button will copy the MML of audible tracks to your clipboard.</li>
                <li>Only unmuted/audible tracks will be copied to your clipboard.</li>
                <li>A maximum of four tracks can be exported at once.</li>
                <li>Remember that the fourth track in a score is always the 'song' track.</li>
                <li>Tracks that have multiple notes playing at once will NOT export properly, so be sure to split them before export.</li>
                <li>The exported MML will be moderately optimized for length, but don't expect them to be perfect.</li>
                <li>Tracks will be exported sorted by number of notes. If a track has more notes, then it will be first.</li>
              </ul>

              <h3>Importing MML</h3>
              <ul>
                <li>Clicking on the "Import MML From Clipboard" button will attempt to copy whatever is in your clipboard into new sequencer tracks.</li>
                <li>Available import types are MMLs that start with `MML@` and end with a semicolon (;), or MMLs taken straight from Mabinogi score scrolls.</li>
                <li>Imported MMLs should not have any extraneous spaces, characters, or new line characters. Otherwise, they will not import properly.</li>
                <li>Importing from Mabinogi directly will named the tracks according to which track they came from (e.g. Melody, Harmony 1, Harmony 2, Song)</li>
              </ul>

              <h3>Tempo</h3>
              <ul>
                <li>You can change the tempo by entering a number at the top left of the page. Note that this will only change the starting tempo of the song.</li>
                <li>If you hold <strong>Shift</strong> and left click on the ruler on top of the grid, you will be prompted to enter a tempo (BPM).</li>
                <li>Tempo markers will automatically be assigned to the currently selected track. This is visible through the color of the marker. Deleting the selected track will delete all associated tempo markers.</li>
                <li>Holding <strong>Alt</strong> while placing a marker will allow for more freedom in placement.</li>
                <li>Clicking on an existing tempo marker will allow you to modify it. By entering an empty string, you will delete the marker.</li>
                <li>Muting a track will also hide the tempo markers associated with that track.</li>
              </ul>

              <h3>Misc</h3>
              <ul>
                <li>Click and hold on the piano keys to play them. <br><em>(Note: some instruments can only play certain keys)</em></li>
                <li>Press <strong>Space</strong> to play your song. It will start from the marker.</li>
                <li>Press <strong>Space</strong> again to pause your song. If you press <strong>Ctrl+Space</strong>, it will stop the marker where it was.</li>
                <li>Check the <strong>Loop</strong> checkbox to loop your song.</li>
                <li>Click and drag on the timeline to move the marker.</li>
                <li>If you hold <strong>ALT</strong> while dragging, the marker will move freely.</li>
                <li>You can change instruments using the spinner at the top left of the page.</li>
              </ul>

              <h3>Planned Features</h3>
              <ul>
                <li>MML export that lets you select track order manually.</li>
                <li>MIDI import/export support</li>
                <li>Support for saving/loading "projects"</li>
                <li>Undo/Redo functionality</li>
              </ul>

              <p class="credits">Credits: Made by Daderic</p>

            </div>
          </div>
        </transition>
      </div>
    </div>
  </template>
  
  <script>
  export default {
    data() {
      return {
        hoverHelp: false,
        isHelpVisible: true, // Initially visible when the page loads
      };
    },
    methods: {
      showHelp() {
        this.isHelpVisible = true;
      },
      closeHelp() {
        this.isHelpVisible = false;
      },
    },
  };
  </script>
  
  <style scoped>
  .help-button {
    position: fixed;
    top: 14px;
    right: 280px;
    width: 34px;
    height: 34px;
    cursor: pointer;
    border-radius: 50%;
    background-color: white;
    border-width: 2px;
    border-style: solid;
    font-size: 24px;
    border-color: black;
    font-weight: lighter;
    color: black;
    z-index: 1000;
    box-shadow: 0 3px 4px rgba(0, 0, 0, 0.3);
  }
  
  .help-button span {
    display: block;
  }
  
  .modal-background {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  }
  
  .help-modal {
    background-color: white;
    padding: 20px;
    width: 500px;
    max-height: 80%;
    overflow-y: auto;
    border-radius: 8px;
    position: relative;
    justify-items: left;
    justify-content: left;
  }
  
  .close-button {
    position: absolute;
    top: 10px;
    right: 10px;
    background-color: transparent;
    border: none;
    font-size: 20px;
    cursor: pointer;
  }
  
  .fade-enter-active, .fade-leave-active {
    transition: opacity 0.5s;
  }
  .fade-enter, .fade-leave-to /* .fade-leave-active in <2.1.8 */ {
    opacity: 0;
  }
  
  .help-content {
    font-size: 14px;
    line-height: 1.6;
    text-align: left;
  }

  .help-content h1 {
    text-align: center;
  }
  
  .credits {
    margin-top: 20px;
    font-style: italic;
    text-align: center;
  }
  </style>
  