// ***** Listener *****
// Listen for incoming port connections
browser.runtime.onConnect.addListener((port) => {
	// Create new popupconnection object which handles the connection until popup closes
	if (port.name === 'edit_cursors') new PopupConnection(port)
})

// ***** Connection handler *****
// Handle port connection to popup
class PopupConnection {
	constructor(port) {
		// ***** Constants *****
		// Select cursor container
		this.userCursorsContainerElement = document.querySelector('.user-cursors-container')

		// ***** Variables *****
		// Port for communication
		this.port = port
		// Inverval to send pings
		this.pingInterval = null
		// Store pending pings
		this.pendingPings = 0

		// ***** Bound Functions *****
		// onMsg function bound to this
		this.onMsgBound = this.onMsg.bind(this)

		// ***** Listeners *****
		// Add listener for incoming messages
		this.port.onMessage.addListener(this.onMsgBound)

		// ***** Init *****
		// Starts sending pings to popup to check if it is still open
		this.startPing()
	}

	// ***** Messages *****
	// Send messages to popup
	sendMsg(type) {
		this.port.postMessage(type)
	}
	// Handle incoming messages
	onMsg([type, data]) {
		if (data) data = JSON.parse(data)
		if (type === 'pong') {
			this.pendingPings = 0
		} else if (type === 'change_cursor_display') {
			// Hide or show cursor
			this.userCursorsContainerElement.querySelector(`[data-uuid='${data.uuid}']`).style.display = data.enable ? 'initial' : 'none'
		}
	}

	// ***** Ping *****
	// Send ping messages to popup
	startPing() {
		this.pingInterval = setInterval(() => {
			if (this.pendingPings < 2) {
				this.pendingPings++
				this.sendMsg('ping')
			} else {
				// 2 Pings not answered
				this.popupNotResponding()
			}
		}, 5000)
	}
	// Popup did not respond to ping, clean up by removing listeners
	popupNotResponding() {
		clearInterval(this.pingInterval)
		this.port.onMessage.removeListener(this.onMsgBound)
	}
}
