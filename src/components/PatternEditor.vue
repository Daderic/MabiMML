<template>
    <div class="pattern-editor">
        <div class="scroll-container" ref="scrollContainer">
            <PianoRoll />
        </div>
    </div>
</template>

<script>
import { ref } from 'vue';
import PianoRoll from './PianoRoll.vue';
import Sequencer from './Sequencer.vue';

export default {
    name: 'PatternEditor',
    components: {
        PianoRoll
    },
    setup() {
        const scrollContainer = ref(null);

        return {
            scrollContainer
        };
    }
};
</script>

<style scoped>
.pattern-editor {
    height: 100%;
    width: 100%;
    overflow: hidden;
}

.scroll-container {
    height: 100%;
    width: 100%;
    overflow: auto;
    display: flex;
}
</style>
