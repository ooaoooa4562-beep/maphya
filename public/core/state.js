export const state = {
    myName: null,
    roomId: null,
    myRole: null,
    currentRoom: null,
    selectedTarget: null,
    isHost: false
};

export function resetState() {
    state.myName = null;
    state.roomId = null;
    state.myRole = null;
    state.currentRoom = null;
    state.selectedTarget = null;
    state.isHost = false;
}
