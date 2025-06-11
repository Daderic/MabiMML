<template>
    <div class="tempo-marker" :style="{ left: left + 'px', visibility: visible}" @click="clickMarker">
      <div class="tempo-triangle" :style="{ borderTop: '10px solid ' + color, visibility: visible }"></div>
      <div class="tempo-label" :style="{ visibility: visible }">T{{ tempo }}</div>
    </div>
</template>
  
  
<script>
export default {
    props: {
        left: Number,
        tempo: Number,
        index: Number, // For identifying which marker to remove
        color: String,
        visible: String
    },
    emits: ['click'],
    setup(props, { emit }) {
        const clickMarker = (event) => {
            emit('click', event, props.index);
        };

        return {
        clickMarker,
        };
    },
};
</script>
  
<style scoped>
    .tempo-marker {
        z-index: 1;
        position: absolute;
        bottom: 0;
        transform: translateX(-50%);
        cursor: pointer;
        pointer-events: auto; /* Allows clicking */
    }

    .tempo-triangle {
        z-index: 1;
        position: absolute;
        width: 0;
        height: 0;
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-top: 10px solid #333; /* Dark grey color */
        left: 50%;
        transform: translateX(-50%);
    }

    .tempo-label {
        z-index: 13;
        position: absolute;
        top: -20px; /* Adjusts the label position above the triangle */
        left: 50%;
        transform: translateX(-50%);
        font-size: 12px;
        background-color: #fff;
        color: #333; /* Dark grey text */
        padding: 2px 4px;
        border-radius: 3px;
        white-space: nowrap;
        border: 1px solid #ccc; /* Optional border to highlight the label */
    }
</style>
  
  