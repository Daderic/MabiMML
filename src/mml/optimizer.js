import Heap from 'heap-js';

export function optimDijkstra(tokens) {
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
        const lengthString = Math.round((960 * 4) / tl * (td ? 1.5 : 1)) + (td ? '.' : '');
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

            let isTied = token.name.startsWith('&');


            if (Math.abs(octaveDiff) > 2) {
                octaveString = `o${token.octave}`;
            } else {
                octaveString = (octaveDiff > 0 ? '>' : '<').repeat(Math.abs(octaveDiff));
            }

            if (token.length === u.implicitLen) {
                u.addChild(new GraphNode(`${volumeString}${octaveString}${token.name}`, token.octave, u.implicitLen, token.volume));

                if (!isTied)
                    u.addChild(new GraphNode(`${volumeString}N${token.pitch}`, u.implicitOct, u.implicitLen, token.volume));

                if (token.name === 'b') {
                    octaveDiff = (token.octave+1) - u.implicitOct;
                    if (Math.abs(octaveDiff) > 2) {
                        octaveString = `o${token.octave + 1}`;
                    } else {
                        octaveString = (octaveDiff > 0 ? '>' : '<').repeat(Math.abs(octaveDiff));
                    }
                    u.addChild(new GraphNode(`${volumeString}${octaveString}c-`, token.octave + 1, u.implicitLen, token.volume));
                }

                if (token.name === 'c') {
                    octaveDiff = (token.octave-1) - u.implicitOct;
                    if (Math.abs(octaveDiff) > 2) {
                        octaveString = `o${token.octave - 1}`;
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
                        octaveString = `o${token.octave + 1}`;
                    } else {
                        octaveString = (octaveDiff > 0 ? '>' : '<').repeat(Math.abs(octaveDiff));
                    }
                    u.addChild(new GraphNode(`${volumeString}L${lengthString}${octaveString}c-`, token.octave + 1, token.length, token.volume));
                    u.addChild(new GraphNode(`${volumeString}${octaveString}c-${suffixLengthString}`, token.octave + 1, u.implicitLen, token.volume));
                }

                if (token.name === 'c') {
                    octaveDiff = (token.octave-1) - u.implicitOct;
                    if (Math.abs(octaveDiff) > 2) {
                        octaveString = `o${token.octave - 1}`;
                    } else {
                        octaveString = (octaveDiff > 0 ? '>' : '<').repeat(Math.abs(octaveDiff));
                    }
                    u.addChild(new GraphNode(`${volumeString}L${lengthString}${octaveString}b+`, token.octave - 1, token.length, token.volume));
                    u.addChild(new GraphNode(`${volumeString}${octaveString}b+${suffixLengthString}`, token.octave - 1, u.implicitLen, token.volume));
                }

                if (!isTied)
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

function getMinCharLengthWidth(notes, targetWidth, ) {
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

const noteLengths = [];
const widthCache = {};

export function getOptimalNoteLengths(width) {
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

const patterns = {
    LENGTH: /[Ll](\d+)\.?/g,  // Matches note lengths, e.g., L4, L8.
    NOTE: /[a-gA-G][-+#]?\d*\.?|N\d+/g,         // Matches notes like N60, N62.
    REST: /[Rr]\d*\.?/g,      // Matches rests like R4, R8.
    TIE: /&/g,              // Matches ties.
    VOLUME: /[Vv](\d+)/g,
    TEMPO: /[Tt](\d+)/g,
    OCTAVE: /[Oo](\d+)|[<>]/g
};

export function tokenizeMML(mmlString) {
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

const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function getEnharmonicEquivalent(note) {
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

export function splitRenderedMML(rendered, limit) {
    const tokenRegex = /T\d+|[Oo]\d+|[<>]|[Ll]\d+\.?|[Vv]\d+|[a-gA-G][+#-]?\d*\.?&?|[Rr]\d*\.?|N\d+|&/g;
    let oct = 4, len = '4', vol = 8, tempo = 120;
    let inTie = false;
    let chunkStart = 0;
    let lastCutPos = 0;
    let stateAtLastCut = { oct, len, vol, tempo };
    const chunks = [];
    let match;
    while ((match = tokenRegex.exec(rendered)) !== null) {
        const token = match[0];
        const tokenEnd = tokenRegex.lastIndex;
        const currentChunkLen = tokenEnd - chunkStart;

        if (currentChunkLen > limit && lastCutPos > chunkStart) {
            chunks.push(rendered.slice(chunkStart, lastCutPos));

            const s = stateAtLastCut;
            let pre = '';
            if (s.tempo !== 120) pre += `T${s.tempo}`;
            if (s.oct !== 4)     pre += `o${s.oct}`;
            if (s.len !== '4')   pre += `L${s.len}`;
            if (s.vol !== 8)     pre += `V${s.vol}`;

            rendered = rendered.slice(0, lastCutPos) + pre + rendered.slice(lastCutPos);
            chunkStart = lastCutPos;
            tokenRegex.lastIndex = lastCutPos + pre.length;
            oct = s.oct; len = s.len; vol = s.vol; tempo = s.tempo;
            inTie = false;
            continue;
        }

        if      (/^[Tt]/.test(token))        tempo = parseInt(token.slice(1));
        else if (/^[Oo]\d/.test(token))      oct = parseInt(token.slice(1));
        else if (token === '>')              oct = Math.min(8, oct + 1);
        else if (token === '<')             oct = Math.max(0, oct - 1);
        else if (/^[Ll]/.test(token))        len = token.slice(1);
        else if (/^[Vv]/.test(token))        vol = parseInt(token.slice(1));
        else if (token === '&')             inTie = true;
        else if (/^[a-gA-GNRr]/.test(token)) {
            if (!inTie) {
                if (!token.endsWith('&')) {
                    lastCutPos = tokenEnd;
                    stateAtLastCut = { oct, len, vol, tempo };
                }
            }
            inTie = false;
        }
    }

    if (chunkStart < rendered.length)
        chunks.push(rendered.slice(chunkStart));

    return chunks;
}