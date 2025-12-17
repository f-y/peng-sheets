import { ReactiveController, ReactiveControllerHost } from 'lit';

export class EditController implements ReactiveController {
    host: ReactiveControllerHost;

    isEditing: boolean = false;
    editingMetadata: boolean = false;
    pendingEditValue: string | null = null;

    // Metadata State
    pendingTitle: string = '';
    pendingDescription: string = '';

    constructor(host: ReactiveControllerHost) {
        this.host = host;
        host.addController(this);
    }

    hostConnected() {}
    hostDisconnected() {}

    startEditing(initialValue: string | null = null) {
        this.isEditing = true;
        this.pendingEditValue = initialValue;
        this.host.requestUpdate();
    }

    cancelEditing() {
        this.isEditing = false;
        this.editingMetadata = false; // Reset metadata edit mode too
        this.pendingEditValue = null;
        this.host.requestUpdate();
    }

    commitEditing() {
        // Validation or logic requires calling back to host method usually,
        // or ensure host reads controller state.
        // For simplicity, we just flag state change, host triggers logic via 'updated'
        // or we dispatch event directly here?
        // Ideally controller dispatches the logical intent.
    }

    // Simplified handlers that just update model state
    setPendingValue(val: string) {
        this.pendingEditValue = val;
    }
}
