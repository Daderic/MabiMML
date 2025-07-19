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
                        <h1>Export</h1>
                        <div class="flex-row">
                            <!-- Left Panel: Track List -->
                            <div class="left-panel">
                                <div class="track-header">Track</div>
                                <div class="track-list">
                                    <label v-for="(track, index) in tracks" :key="index">
                                        <input type="checkbox" :checked="isSelected(track)"
                                            :disabled="(!isSelected(track) && selectedTracks.length >= maxSelectable) || trackHasPolyphony(track)"
                                            @change="toggleTrack(track)" />
                                        {{ track.name }} : {{ trackHasPolyphony(track) ? '-' : getRenderedTrackTokens(track, index).rendered.length + ' char(s)'}} {{ trackHasPolyphony(track) ? '*' : '' }}
                                    </label>
                                </div>
                                <button class="clear-btn" @click="clearSelection">Clear Selection</button>
                            </div>

                            <!-- Right Panel: Info + Output -->
                            <div class="right-panel">

                                <!-- Output Settings -->
                                <div class="output-settings">
                                    <strong>Output Settings</strong>
                                    <li><input type="radio" name="format" checked /> Mabinogi MML@ Format </li>
                                    <!-- <li><input type="radio" name="format" /> Sitaraba MML Template </li>
                                    <li><input type="radio" name="format" /> MabiMML Compatible Format </li> -->
                                    <li><input type="checkbox" v-model="sortTracksByLength" checked /> Sort tracks by
                                        text length. </li>
                                    <li><input type="checkbox" v-model="excludeSongPart" /> Exclude Song Part </li>
                                    <li><input type="checkbox" v-model="jabSplit" /> Split Score for Jabs (WIP) </li>
                                    <li>
                                        <select id="rank-select" :disabled="!jabSplit" v-model="selectedRank"
                                            @change="changeComposeRank">
                                            <option v-for="(rank, index) in composeRanks" :key="index" :value="rank">
                                                Rank: {{ rank.name }} {{ [rank.melody, rank.harmony1, rank.harmony2] }}
                                            </option>
                                        </select>
                                    </li>
                                </div>

                                <!-- Information -->
                                <div class="info-box">
                                    <strong>Information</strong>
                                    <div v-for="(score, index) in generatedScores" :key="index" class="score-block">
                                        <p>
                                            <strong>Score {{ index + 1 }}:</strong> Rank {{ score.rank }}
                                            <button @click="copyScore(index)">📋</button>
                                        </p>
                                        <ul>
                                            <li v-for="(part, pIndex) in score.parts" :key="pIndex">
                                                Part {{ pIndex + 1 }}: {{ part.length }} char(s)
                                                <button @click="copyScorePiece(index, pIndex)">📋</button>
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </transition>
        </div>
    </div>
</template>

<script>
export default {
    props: {
        tracks: Array,
        generateTokens: Function,
        renderTokens: Function,
        copyToClipboard: Function
    },
    data() {
        return {
            isExportVisible: false,
            selectedTracks: [],
            excludeSongPart: false,
            jabSplit: false,
            sortTracksByLength: true,
            composeRanks: [
                { name: 'Impossible', melody: Infinity, harmony1: Infinity, harmony2: Infinity},
                { name: '1', melody: 1200, harmony1: 800, harmony2: 500 },
                { name: '2', melody: 1150, harmony1: 700, harmony2: 400 },
                { name: '3', melody: 1100, harmony1: 600, harmony2: 350 },
                { name: '4', melody: 1050, harmony1: 550, harmony2: 300 },
                { name: '5', melody: 1000, harmony1: 500, harmony2: 250 },
                { name: '6', melody: 950, harmony1: 450, harmony2: 200 },
                { name: '7', melody: 900, harmony1: 400, harmony2: 200 },
                { name: '8', melody: 850, harmony1: 400, harmony2: 200 },
                { name: '9', melody: 800, harmony1: 350, harmony2: 200 },
                { name: 'A', melody: 750, harmony1: 300, harmony2: 200 },
                { name: 'B', melody: 700, harmony1: 300, harmony2: 200 },
                { name: 'C', melody: 650, harmony1: 250, harmony2: 200 },
                { name: 'D', melody: 600, harmony1: 250, harmony2: 150 },
                { name: 'E', melody: 500, harmony1: 200, harmony2: 100 },
                { name: 'F', melody: 400, harmony1: 200, harmony2: 100 },
                { name: 'Practice', melody: 200, harmony1: 100, harmony2: 0 },
            ],
            selectedRank: { name: '1', melody: 1200, harmony1: 800, harmony2: 500 },
            selectedRankIndex: 1,
            generatedScores: [],
            tokenCache: new Map()
        };
    },
    computed: {
        maxSelectable() {
            return this.excludeSongPart ? 3 : 4;
        }
    },
    watch: {
        excludeSongPart(newVal) {
            const limit = newVal ? 3 : 4;
            if (this.selectedTracks.length > limit) {
                this.selectedTracks.splice(limit);
            }

            if (newVal) {
                this.composeRanks = [
                    { name: 'Impossible', melody: Infinity, harmony1: Infinity, harmony2: Infinity},
                    { name: '1*', melody: 1600, harmony1: 1200, harmony2: 900 },
                    { name: '2*', melody: 1533, harmony1: 1083, harmony2: 783 },
                    { name: '3*', melody: 1466, harmony1: 966, harmony2: 716 },
                    { name: '4*', melody: 1400, harmony1: 900, harmony2: 650 },
                    { name: '5*', melody: 1333, harmony1: 833, harmony2: 583 },
                    { name: '6*', melody: 1266, harmony1: 766, harmony2: 516 },
                    { name: '7*', melody: 1200, harmony1: 700, harmony2: 500 },
                    { name: '8*', melody: 1133, harmony1: 683, harmony2: 483 },
                    { name: '9*', melody: 1066, harmony1: 616, harmony2: 466 },
                    { name: 'A*', melody: 1000, harmony1: 550, harmony2: 450 },
                    { name: 'B*', melody: 933, harmony1: 533, harmony2: 433 },
                    { name: 'C*', melody: 866, harmony1: 466, harmony2: 416 },
                    { name: 'D*', melody: 800, harmony1: 450, harmony2: 350 },
                    { name: 'E*', melody: 666, harmony1: 366, harmony2: 233 },
                    { name: 'F*', melody: 553, harmony1: 333, harmony2: 233 },
                    { name: 'Practice*', melody: 266, harmony1: 166, harmony2: 66 },
                ];
            } else {
                this.composeRanks = [
                    { name: 'Impossible', melody: Infinity, harmony1: Infinity, harmony2: Infinity},
                    { name: '1', melody: 1200, harmony1: 800, harmony2: 500 },
                    { name: '2', melody: 1150, harmony1: 700, harmony2: 400 },
                    { name: '3', melody: 1100, harmony1: 600, harmony2: 350 },
                    { name: '4', melody: 1050, harmony1: 550, harmony2: 300 },
                    { name: '5', melody: 1000, harmony1: 500, harmony2: 250 },
                    { name: '6', melody: 950, harmony1: 450, harmony2: 200 },
                    { name: '7', melody: 900, harmony1: 400, harmony2: 200 },
                    { name: '8', melody: 850, harmony1: 400, harmony2: 200 },
                    { name: '9', melody: 800, harmony1: 350, harmony2: 200 },
                    { name: 'A', melody: 750, harmony1: 300, harmony2: 200 },
                    { name: 'B', melody: 700, harmony1: 300, harmony2: 200 },
                    { name: 'C', melody: 650, harmony1: 250, harmony2: 200 },
                    { name: 'D', melody: 600, harmony1: 250, harmony2: 150 },
                    { name: 'E', melody: 500, harmony1: 200, harmony2: 100 },
                    { name: 'F', melody: 400, harmony1: 200, harmony2: 100 },
                    { name: 'Practice', melody: 200, harmony1: 100, harmony2: 0 },
                ];
            }
            this.selectedRank = this.composeRanks[this.selectedRankIndex];
            this.generateScores();

        },
        jabSplit() {
            this.generateScores();
        },
        selectedRank() {
            this.generateScores();
        },
        sortTracksByLength() {
            this.generateScores();
        },
        tracks: {
            handler() {
                this.tokenCache.clear();
                this.clearSelection();
            },
            deep: true
        }
    },
    methods: {
        isSelected(track) {
            return this.selectedTracks.includes(track);
        },
        toggleTrack(track) {
            const index = this.selectedTracks.indexOf(track);

            if (index !== -1) {
                this.selectedTracks.splice(index, 1);
            } else {
                if (this.selectedTracks.length < this.maxSelectable) {
                    this.selectedTracks.push(track);
                }
            }

            this.generateScores();

        },
        trackHasPolyphony(track) {
            track.notes.sort((a,b) => {return b.left - a.left; });
            for (let i = 0; i < track.notes.length; ++i) {
                const rightNote = track.notes[i];
                const leftNote = i + 1 < track.notes.length ? track.notes[i + 1] : null;
                if (leftNote === null) return false;
                // Scan from left to right. The next note should not have a left value <= note.end
                if (rightNote.left < leftNote.left + leftNote.width + 1) {
                    return true;
                }
            }
            return false;
        },
        clearSelection() {
            this.selectedTracks = [];
            this.generateScores();
        },
        changeComposeRank() {
            this.selectedRankIndex = this.composeRanks.indexOf(this.selectedRank);
        },
        showExport() {
            this.isExportVisible = true;
        },
        hideExport() {
            this.isExportVisible = false;
        },
        getRenderedTrackTokens(track) {
            if (this.tokenCache.has(track)) return this.tokenCache.get(track);
            if (this.trackHasPolyphony(track)) return { tokens: [], rendered: '' };
            const tokens = this.generateTokens(track)[0];
            const rendered = this.renderTokens(tokens);
            const result = { tokens, rendered };
            this.tokenCache.set(track, result);
            return result;
        },
        splitTokensByLimit(tokens, limit) {
            const chunks = [];
            let current = [];
            let length = 0;

            for (let i = 0; i < tokens.length; i++) {
                const next = [...current, tokens[i]];
                const rendered = this.renderTokens(next);
                const renderedLength = rendered.length;

                if (renderedLength > limit) {
                    if (current.length) {
                        chunks.push(current);
                        current = [tokens[i]];
                        length = this.renderTokens(current).length;
                    } else {
                        // Single token too big: force split anyway
                        chunks.push([tokens[i]]);
                        current = [];
                        length = 0;
                    }
                } else {
                    current.push(tokens[i]);
                    length = renderedLength;
                }
            }

            if (current.length) {
                chunks.push(current);
            }

            return chunks;
        },
        generateScores() {
            const selected = [...this.selectedTracks];

            if (this.sortTracksByLength) {
                selected.sort((a, b) => {
                    const aIndex = this.tracks.indexOf(a);
                    const bIndex = this.tracks.indexOf(b);
                    return this.getRenderedTrackTokens(b, bIndex).rendered.length - this.getRenderedTrackTokens(a, aIndex).rendered.length;
                });
            }

            const numParts = this.excludeSongPart ? 3 : 4;
            const tokenized = selected.map(track => {
                const index = this.tracks.indexOf(track);
                return this.getRenderedTrackTokens(track, index).tokens;
            });
            const rendered = selected.map(track => {
                const index = this.tracks.indexOf(track);
                return this.getRenderedTrackTokens(track, index).rendered;
            });

            const availableRanks = [...this.composeRanks].reverse(); // lowest to highest
            this.generatedScores = [];

            if (!this.jabSplit) {
                // Attempt to fit the entire track set into the lowest viable rank
                for (const rank of availableRanks) {
                    const limits = [rank.melody, rank.harmony1, rank.harmony2, rank.melody].slice(0, numParts);
                    const fits = rendered.every((mml, i) => mml.length <= limits[i]);

                    if (fits) {
                        this.generatedScores.push({ parts: rendered.slice(0, numParts), rank: rank.name });
                        break;
                    }
                }
            } else {
                const rank = this.selectedRank;
                const limits = [rank.melody, rank.harmony1, rank.harmony2, rank.melody].slice(0, numParts);
                const allSplitTokens = tokenized.map((tokens, i) => {
                    return this.splitTokensByLimit(tokens, limits[i]);
                });

                const maxChunks = Math.max(...allSplitTokens.map(chunks => chunks.length));

                for (let chunkIndex = 0; chunkIndex < maxChunks; chunkIndex++) {
                    const scoreParts = [];

                    for (let i = 0; i < numParts; i++) {
                        const chunk = allSplitTokens[i]?.[chunkIndex] || [];
                        const renderedChunk = this.renderTokens(chunk);
                        scoreParts.push(renderedChunk);
                    }

                    const allEmpty = scoreParts.every(str => str === '');
                    if (allEmpty) break;

                    this.generatedScores.push({ parts: scoreParts, rank: rank.name });
                }

            }
        },
        copyScore(index) {
            const score = this.generatedScores[index];
            const joined = `MML@${score.parts.join(',')};`;
            this.copyToClipboard(joined);
        },
        copyScorePiece(scoreIndex, pieceIndex) {
            const score = this.generatedScores[scoreIndex];
            this.copyToClipboard(score.parts[pieceIndex]);
        }
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

.export-content {
    font-size: 14px;
    line-height: 1.6;
    text-align: left;
    width: 100%;
}

.flex-row {
    display: flex;
    flex-direction: row;
    gap: 20px;
}

.left-panel {
    width: 200px;
    display: flex;
    flex-direction: column;
    background-color: #fff;
    padding: 10px;
    border: 1px solid #ccc;
}

.track-header {
    font-weight: bold;
    margin-bottom: 5px;
}

.track-list {
    display: flex;
    flex-direction: column;
    gap: 5px;
    margin-bottom: auto;
}

.clear-btn {
    margin-top: 10px;
    align-self: flex-start;
}

.right-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 15px;
}

.info-box,
.output-settings {
    background-color: #fff;
    border: 1px solid #ccc;
    padding: 10px;
}

li {
    list-style: none;
}
</style>