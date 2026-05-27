export function keyboardCommandsHandler(event: KeyboardEvent) {
    if (event.key == 'c' && event.altKey) {
        const chatContainer = document.getElementById('chat-container') as HTMLDivElement
        chatContainer.classList.toggle('closed')
    }
    else if (event.key == 't' && event.altKey) {
        const toolsDiv = document.getElementById('test-tools') as HTMLDivElement
        toolsDiv.classList.toggle('closed')
    }
    else if (event.key == 'v' && event.altKey) {
        const vectorsDiv = document.getElementById('object-positions-display') as HTMLDivElement
        vectorsDiv.classList.toggle('closed')
    }
}