/**
 * API Key Configuration Dialog
 */

class APIKeyDialog {
    constructor(agent, onSave) {
        this.agent = agent;
        this.onSave = onSave;
    }

    show() {
        const existingDialog = document.querySelector('.api-key-dialog');
        if (existingDialog) existingDialog.remove();

        const dialog = document.createElement('div');
        dialog.className = 'api-key-dialog';
        dialog.innerHTML = `
            <div class="api-key-modal">
                <div class="api-key-header">
                    <h3>🔑 Configure AI</h3>
                    <button class="api-key-close">&times;</button>
                </div>
                <div class="api-key-body">
                    <p>Enter your Gemini API key to enable AI-powered queries:</p>
                    <input type="password" class="api-key-input" placeholder="AIza..." value="${this.agent.apiKey || ''}">
                    <p class="api-key-hint">Get your free API key from <a href="https://aistudio.google.com/apikey" target="_blank">Google AI Studio</a></p>
                </div>
                <div class="api-key-footer">
                    <button class="api-key-cancel">Cancel</button>
                    <button class="api-key-save">Save & Enable AI</button>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);

        // Event listeners
        dialog.querySelector('.api-key-close').onclick = () => dialog.remove();
        dialog.querySelector('.api-key-cancel').onclick = () => dialog.remove();
        dialog.querySelector('.api-key-save').onclick = () => {
            const key = dialog.querySelector('.api-key-input').value.trim();
            if (key) {
                this.agent.setApiKey(key);
                this.onSave();
                dialog.remove();
            }
        };

        // Close on background click
        dialog.onclick = (e) => {
            if (e.target === dialog) dialog.remove();
        };
    }
}

// Add dialog styles
const dialogStyles = document.createElement('style');
dialogStyles.textContent = `
.api-key-dialog {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    backdrop-filter: blur(4px);
}

.api-key-modal {
    background: #12121a;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 16px;
    width: 400px;
    max-width: 90%;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
}

.api-key-header {
    padding: 16px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid rgba(255,255,255,0.1);
}

.api-key-header h3 {
    margin: 0;
    font-size: 1rem;
    color: #fff;
}

.api-key-close {
    background: transparent;
    border: none;
    color: #666;
    font-size: 1.5rem;
    cursor: pointer;
    padding: 0;
    line-height: 1;
}

.api-key-body {
    padding: 20px;
}

.api-key-body p {
    margin: 0 0 12px;
    color: #aaa;
    font-size: 0.9rem;
}

.api-key-input {
    width: 100%;
    padding: 12px 14px;
    background: #1a1a24;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px;
    color: #fff;
    font-size: 0.9rem;
    font-family: monospace;
}

.api-key-input:focus {
    outline: none;
    border-color: #F2C811;
}

.api-key-hint {
    font-size: 0.75rem !important;
    color: #666 !important;
    margin-top: 8px !important;
}

.api-key-hint a {
    color: #F2C811;
}

.api-key-footer {
    padding: 16px 20px;
    display: flex;
    gap: 10px;
    justify-content: flex-end;
    border-top: 1px solid rgba(255,255,255,0.1);
}

.api-key-cancel, .api-key-save {
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 0.85rem;
    cursor: pointer;
    font-family: inherit;
}

.api-key-cancel {
    background: transparent;
    border: 1px solid rgba(255,255,255,0.1);
    color: #aaa;
}

.api-key-save {
    background: linear-gradient(135deg, #F2C811, #FFE066);
    border: none;
    color: #000;
    font-weight: 600;
}

.api-key-save:hover {
    transform: translateY(-1px);
}
`;
document.head.appendChild(dialogStyles);

window.APIKeyDialog = APIKeyDialog;
