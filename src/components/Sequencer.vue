<template>
  <div class="grid" ref="grid">
    <div v-for="note in notesInGrid" :key="note.id" class="note"
    :style="{
      left: note.left + 'px',
      top: note.top + 'px',
      width: note.width + 'px',
      height: note.height + 'px'
    }"
    @mousedown="startDrag(note, $event)" @mouseup="endDrag" @contextmenu.prevent="removeNote(note)"
    @mousedown.right="showContextMenu(note, $event)">
    {{ note.name }}
    </div>
  </div>
</template>

<script>
import { ref } from 'vue';
export default {
  name: 'Sequencer',
  setup() {
    const sequencer = ref(null);
    const gridSize = 50;
    const notesInGrid = ref([
      { id: 1, name: 'C4', left: 10, top: 20, width: 50, height: 30 },
    ]);
    const draggingNote = ref(null);
    const startX = ref(0);
    const startY = ref(0);
    const startLeft = ref(0);
    const startTop = ref(0);

    const startDrag = (note, event) => {
      event.preventDefault();
      draggingNote.value = note;
      startX.value = event.clientX;
      startY.value = event.clientY;
      startLeft.value = note.left;
      startTop.value = note.top;
      document.addEventListener('mousemove', onDrag);
      document.addEventListener('mouseup', endDrag);
    };

    const onDrag = (event) => {
      if (draggingNote.value) {
        const dx = event.clientX - startX.value;
        const dy = event.clientY - startY.value;
        draggingNote.value.left = Math.round((startLeft.value + dx) / gridSize) * gridSize;
        draggingNote.value.top = Math.round((startTop.value + dy) / gridSize) * gridSize;
      }
    };

    const endDrag = () => {
      draggingNote.value = null;
      document.removeEventListener('mousemove', onDrag);
      document.removeEventListener('mouseup', endDrag);
    };

    const showContextMenu = (note, event) => {
      console.log('Right Clicked Note:', note);
    };

    const removeNote = (note) => {
      notesInGrid.value = notesInGrid.value.filter(n => n.id !== note.id);
    };

    return {
      notesInGrid,
      startDrag,
      endDrag,
      showContextMenu,
      removeNote,
      gridSize,
      sequencer,
    };
  },
};
</script>

<style scoped>

.grid {
    position: absolute;
    width: 100%;
    height: 100%;
    background: repeating-linear-gradient(
        0deg,
        #ccc,
        #ccc 1px,
        transparent 1px,
        transparent 50px
    ),
    repeating-linear-gradient(
        90deg,
        #ccc,
        #ccc 1px,
        transparent 1px,
        transparent 50px
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
}

.note:active {
    background-color: rgba(0, 120, 255, 0.7);
}

</style>