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
        get canUndo() { return index > 0; },
        get canRedo() { return index >= 0 && index < stack.length - 1; },
        get size() { return stack.length; }
    };
}