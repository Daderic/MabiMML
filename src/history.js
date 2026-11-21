const NOTE_FIELDS = ['id', 'name', 'left', 'top', 'pitch', 'width', 'length', 'start', 'end', 'volume', 'trackId'];

function sameNote(note_a, note_b) {
    for (const field of NOTE_FIELDS) {
        if (note_a[field] !== note_b[field]) return false;
    }
    return true;
}

function shareUnchangedNotes(prevNotes, nextNotes) {
    const prevById = new Map();
    for (const note of prevNotes) prevById.set(note.id, note);
    return nextNotes.map(nextNote => {
        const prevNote = prevById.get(nextNote.id);
        return prevNote && sameNote(prevNote, nextNote) ? prevNote : nextNote;
    });
}

function sameState(state_a, state_b) {
    if (state_a.notes.length != state_b.notes.length) return false;
    for (let i = 0; i < state_a.notes.length; i++) {
        if (state_a.notes[i] !== state_b.notes[i]) return false;
    }
    return JSON.stringify(state_a.tracks) === JSON.stringify(state_b.tracks)
        && JSON.stringify(state_a.tempoMarkers) === JSON.stringify(state_b.tempoMarkers);
}

export function createHistory(limit = 100) {
    let stack = [];
    let index = -1;

    return {
        reset(state) {
            stack = [state];
            index = 0;
        },
        commit(state) {
            if (index >= 0) {
                state = { ...state, notes: shareUnchangedNotes(stack[index].notes, state.notes) };
                if (sameState(stack[index], state)) return false;
            }
            stack.length = index + 1;
            stack.push(state);
            if (stack.length > limit) stack.shift();
            index = stack.length - 1;
            return true;
        },
        undo() {
            if (index <= 0) return null;
            index--;
            return stack[index];
        },
        redo() {
            if (index < 0 || index >= stack.length - 1) return null;
            index++;
            return stack[index];
        },
        get current() { return index >= 0 ? stack[index] : null; },
        get canUndo() { return index > 0; },
        get canRedo() { return index >= 0 && index < stack.length - 1; },
        get size() { return stack.length; }
    };
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

export function describeChange(before, after, programName = p => `program ${p}`) {
    const parts = [];

    const beforeNotes = new Map(before.notes.map(n => [n.id, n]));
    const afterIds = new Set(after.notes.map(n => n.id));
    const added = [], removed = [];
    let moved = 0, resized = 0, volume = 0, retracked = 0;
    let lastMoved = null;
    
    for (const n of after.notes) {
        const p = beforeNotes.get(n.id);
        if (!p) { added.push(n); continue; }
        if (p === n) continue;
        if (p.left !== n.left || p.top !== n.top) { moved++; lastMoved = n; }
        if (p.length !== n.length) resized++;
        if (p.volume !== n.volume) volume++;
        if (p.trackId !== n.trackId) retracked++;
    }
    
    for (const n of before.notes) {
        if (!afterIds.has(n.id)) removed.push(n);
    }

    if (added.length)   parts.push(added.length === 1 ? `added note ${added[0].name}` : `added ${plural(added.length, 'note')}`);
    if (removed.length) parts.push(removed.length === 1 ? `deleted note ${removed[0].name}` : `deleted ${plural(removed.length, 'note')}`);
    if (moved)          parts.push(moved === 1 ? `moved note ${lastMoved.name}` : `moved ${plural(moved, 'note')}`);
    if (resized)        parts.push(`resized ${plural(resized, 'note')}`);
    if (volume)         parts.push(`changed volume of ${plural(volume, 'note')}`);
    if (retracked)      parts.push(`changed track of ${plural(retracked, 'note')}`);

    const beforeTracks = new Map(before.tracks.map(t => [t.id, t]));
    const afterTrackIds = new Set(after.tracks.map(t => t.id));
    const addedTracks = after.tracks.filter(t => !beforeTracks.has(t.id));
    const removedTracks = before.tracks.filter(t => !afterTrackIds.has(t.id));

    if (addedTracks.length)
        parts.push(addedTracks.length === 1 ? `added track "${addedTracks[0].name}"` : `added ${plural(addedTracks.length, 'track')}`);
    if (removedTracks.length)
        parts.push(removedTracks.length === 1 ? `deleted track "${removedTracks[0].name}"` : `deleted ${plural(removedTracks.length, 'track')}`);

    for (const t of after.tracks) {
        const p = beforeTracks.get(t.id);
        if (!p) continue;
        if (p.name !== t.name)       parts.push(`renamed track "${p.name}" to "${t.name}"`);
        if (p.color !== t.color)     parts.push(`changed color of "${t.name}"`);
        if (p.program !== t.program) parts.push(`changed "${t.name}" to ${programName(t.program)}`);
    }

    const bt = before.tempoMarkers, at = after.tempoMarkers;
    if (at.length > bt.length)       parts.push(at.length - bt.length === 1 ? 'added tempo marker' : `added ${plural(at.length - bt.length, 'tempo marker')}`);
    else if (at.length < bt.length)  parts.push(bt.length - at.length === 1 ? 'removed tempo marker' : `removed ${plural(bt.length - at.length, 'tempo marker')}`);
    else if (JSON.stringify(bt) !== JSON.stringify(at)) parts.push('changed tempo marker');

    if (parts.length === 0) return 'no visible change';
    if (parts.length > 3) return parts.slice(0, 3).join(', ') + ', ...';
    return parts.join(', ');
}