<template>
    <div>
        <button class="export-button" @click="showExport">
            Export
        </button>
        <div v-if="isExportVisible" class="modal-background" @click="hideExport">
            <transition name="fade">
                <div class="export-modal" @click.stop>
                    <button class="close-button" @click="hideExport">X</button>
                    <div class="export-content">
                        WOOOOOOO
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
            isExportVisible: false,
        };
    },
    methods: {
        showExport() {
            this.isExportVisible = true;
        },
        hideExport() {
            this.isExportVisible = false;
        },
    }
};
</script>

<style scoped>
.export-button {
    position: fixed;
    top: 50px;
    right: 160px;
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
    width: 105px;
}

.export-modal {
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

.close-button {
    position: sticky;
    top: 10px;
    right: 10px;
    background-color: transparent;
    border: none;
    font-size: 20px;
    cursor: pointer;
    float: right;
}

.help-content {
  font-size: 14px;
  line-height: 1.6;
  text-align: left;
}
</style>