<template>
    <div>
      <div class="track-tab-container" ref="tabContainerRef">
        <div
          v-for="(track, index) in tracks"
          :key="track.id"
          :class="['track-tab', { selected: selectedTrackIndex === index }]"
          @click="selectTrack(index)"
          :style="{ backgroundColor: track.color }"
          :title="track.name"
        >
          <div class="tab-header">
            <input
              v-if="track.isEditingName"
              v-model="track.name"
              @blur="track.isEditingName = false"
              @keyup.enter="track.isEditingName = false"
              class="track-name-input"
            />
            <span
              v-else
              @dblclick="track.isEditingName = true"
              class="track-name"
            >
              {{ track.name }}
            </span>
            <span class="mute-icon" @click.stop="toggleMute(index)">
              {{ track.isMuted ? '🔇' : '🔊' }}
            </span>
            <button @click.stop="removeTrack(index)" class="delete-btn">✖</button>
          </div>
          <div v-if="selectedTrackIndex === index" class="color-picker-container">
            <input
              type="color"
              v-model="trackHexColor"
              class="color-picker"
              @input="updateTrackColor"
            />
          </div>
        </div>
  
        <button
          @click="addTrack"
          class="add-track-btn"
          :disabled="!canAddTrack"
        >
          +
        </button>
      </div>
    </div>
  </template>
  
  <script>
  import { ref, computed, onMounted, onBeforeUnmount, nextTick, reactive } from 'vue';

  export const EventBus = reactive({});

  export const tracks = ref([]);
  export const selectedTrackIndex = ref(null);
  export const selectedTrack = computed(() => tracks.value[selectedTrackIndex.value] || null);
  export const trackHexColor = ref('#ffffff');
  export default {
    created() {
      EventBus.addTrack = this.addTrack;
    },
    setup(props, { emit }) {
      const containerWidth = ref(0);
      const tabContainerRef = ref(null);
  
  
      const canAddTrack = computed(() => {
        if (tracks.value.length > 15)
          return false;
        const minWidth = 75;
        const totalWidth = tracks.value.length * minWidth;
        return containerWidth.value - totalWidth - 50 > minWidth; // Limit to 16 tracks
      });
  
      const updateContainerWidth = () => {
        if (tabContainerRef.value) {
          containerWidth.value = tabContainerRef.value.clientWidth; // Get container width
        }
      };
  
      const getRandomColor = () => {
        const hue = Math.floor(Math.random() * 360);
        const saturation = 75 + Math.random() * 25;
        const lightness = 50 + Math.random() * 10;
        
        const chroma = (1 - Math.abs(2 * lightness / 100 - 1)) * (saturation / 100);
        const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
        const m = lightness / 100 - chroma / 2;
  
        let [r, g, b] =
          hue < 60 ? [chroma, x, 0]
          : hue < 120 ? [x, chroma, 0]
          : hue < 180 ? [0, chroma, x]
          : hue < 240 ? [0, x, chroma]
          : hue < 300 ? [x, 0, chroma]
          : [chroma, 0, x];
  
        r = Math.round((r + m) * 255);
        g = Math.round((g + m) * 255);
        b = Math.round((b + m) * 255);
  
        // Return the color in hex format
        return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
      };
  
      const root = process.env.NODE_ENV === 'production' ? '../MabiMML/' : '../';

      const addTrack = (pointerEvent=null, instr=null, color=null, name=null) => {
        const newTrack = {
          id: tracks.value.length + Date.now(),
          name: name || `Track ${tracks.value.length + 1}`,
          isMuted: false,
          color: color || getRandomColor(),
          isEditingName: false,
          notes: [],
          instrument: instr || { name: 'Lute', program: 0, min: 16, max: 88 },
        };
        tracks.value.push(newTrack);
        selectTrack(tracks.value.length - 1);
        emit('add-track', newTrack, tracks.value.length - 1);
        return newTrack;
      };
  
      const removeTrack = (index) => {
        if (tracks.value.length === 1) return;

        let confirmation = true;
        if (tracks.value[index].notes.length !== 0)
          confirmation = confirm(`Are you sure you want to delete the track "${tracks.value[index].name}"? All notes belonging to this track will also be deleted.`);
        if (!confirmation) return;

        let trackClone = tracks.value[index];
        tracks.value.splice(index, 1);
  
        if (tracks.value.length === 0) {
          selectedTrackIndex.value = null;
          trackHexColor.value = '#ffffff'; // Reset color picker when no tracks are left
        } else {
          if (index === selectedTrackIndex.value) {
            // If the removed track was selected, select the next available track
            const newIndex = index < tracks.value.length ? index : index - 1;
            selectedTrackIndex.value = newIndex;
            trackHexColor.value = tracks.value[newIndex].color; // Update the color picker to the new selected track's color
          } else if (selectedTrackIndex.value > index) {
            selectedTrackIndex.value--;
          }
  
          // Update color picker for the currently selected track
          if (selectedTrack.value) {
            trackHexColor.value = selectedTrack.value.color;
          }
        }

        emit('remove-track', trackClone, selectedTrack.value);
      };
  
  
      const selectTrack = (index) => {
        selectedTrackIndex.value = index;
        trackHexColor.value = tracks.value[index].color; // Update color picker when track is selected
        emit('track-selected', tracks.value[index]);
      };
  
      const toggleMute = (index) => {
        tracks.value[index].isMuted = !tracks.value[index].isMuted;
        if (tracks.value[index].isMuted)
          for (const note of tracks.value[index].notes) {
            note.muted = true;
          }
        else {
          for (const note of tracks.value[index].notes) {
            note.muted = false;
          }
        }
        emit('mute-track', index);
      };
  
      const updateTrackColor = (event) => {
        const newColor = event.target.value;
        if (selectedTrack.value) {
          selectedTrack.value.color = newColor;
          trackHexColor.value = newColor; // Update hex color for the picker
          for (const note of selectedTrack.value.notes) {
            note.color = newColor;
          }
        }
        emit('color-change', selectedTrack.value, newColor);
      };
  
      onMounted(() => {
        addTrack(); // Always start with one track
        nextTick(() => {
          updateContainerWidth(); // Get initial container width
        });
        window.addEventListener('resize', updateContainerWidth);
      });
  
      onBeforeUnmount(() => {
        window.removeEventListener('resize', updateContainerWidth);
      });
  
      return {
        tracks,
        selectedTrackIndex,
        trackHexColor,
        containerWidth,
        addTrack,
        removeTrack,
        selectTrack,
        toggleMute,
        updateTrackColor,
        selectedTrack,
        canAddTrack,
        tabContainerRef,
      };
    },
  };
  </script>
  
  <style scoped>
  .track-tab-container {
    display: flex;
    align-items: flex-end;
    max-width: 83%;
    background-color: #f1f1f1;
    flex-wrap: nowrap;
    height: 50px;
  }
  
  .track-tab {
    user-select: none;
    display: flex;
    flex-direction: column;
    margin-right: -10px;
    flex-grow: 1;
    min-width: 75px;
    max-width: 200px;
    height: 40px;
    border: 2px solid #ccc;
    border-radius: 8px 8px 0 0;
    cursor: pointer;
    transition: background-color 0.3s ease;
    position: relative;
    z-index: 1;
    align-self: flex-end;
    overflow: hidden;
  }
  
  .track-tab.selected {
    padding-bottom: 10px;
    z-index: 10;
    border-bottom: none;
  }
  
  .tab-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 5px 10px;
    border-radius: 8px 8px 0 0;
    font-weight: bold;
    font-size: 1em;
    color: white;
  }
  
  .track-name-input {
    width: 100%;
    font-size: 1em;
    background-color: transparent;
    border: none;
    color: white;
    outline: none;
  }
  
  .track-name {
    color: white;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .mute-icon {
    font-size: 1.2em;
    cursor: pointer;
    margin-left: 10px;
    color: white;
  }
  
  .delete-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    color: white;
    font-size: 1.1em;
    font-weight: bold;
  }
  
  .add-track-btn {
    user-select: none;
    width: 50px;
    height: 50px;
    font-size: 2em;
    background-color: #007bff;
    color: white;
    border: none;
    border-radius: 8px;
    margin-left: 12px;
    flex-shrink: 0;
    cursor: pointer;
    position: relative;
    z-index: 5;
    transition: background-color 0.3s ease;
  }
  
  .add-track-btn:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }
  
  .color-picker-container {
  }
  
  .color-picker {
    margin-left: 10px;
  }
  
  .track-tab:hover::after {
    content: attr(title);
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    background-color: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 5px;
    border-radius: 4px;
    white-space: nowrap;
    z-index: 10;
    margin-bottom: 5px;
    opacity: 0;
    transition: opacity 0.2s ease;
  }
  
  .track-tab:hover::after {
    opacity: 1;
  }
  </style>