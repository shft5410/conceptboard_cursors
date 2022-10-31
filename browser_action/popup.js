// ***** One Line Utils *****
// Generates a new color that is lighter
const getLighterColor = (color) => '#' + color.match(/#([\da-fA-F]{2})([\da-fA-F]{2})([\da-fA-F]{2})/).slice(1).map((v) => parseInt(v, 16) + 128).map((v) => (v > 255 ? 255 : v).toString(16)).join('') // prettier-ignore

// ***** Constants *****
// Select app container
const appContainerElement = document.querySelector('.app-container')
// Select container which holds all cursor control elements
const cursorContainerElement = document.querySelector('.cursor-controls-list-container')
// Select switch to control all cursor display states
const allCursorsSwitchElement = document.querySelector('.controls-group-container .cursor-controls-container:nth-child(1) input.switch')

// ***** Variables *****
// Current tab object
let tabId = null
// Connection Port
let port = null
// Code that identifies a specific concept board
let boardCode = null
// State of of 'all cursors' switch
let allCursorsEnabled = false
// Cursor data
let lastCursorData = []

// ***** Init *****
;(async () => {
	// Get currently shown tab
	const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
	// Exit if url does not match pattern
	if (!tab?.url.startsWith('https://app.conceptboard.com/board/')) return invalidUrl()
	// Tab id to set up port connection
	tabId = tab.id
	// Extract board code from url
	boardCode = tab.url.match(/(?:\b[a-z0-9]{4}\b-){4}(?:\b[a-z0-9]{4}\b)/)[0]
	// Init port communication
	initPort()
	// Init local storage and load data
	await initStorage()

	// ***** Listeners *****
	// Add listener for 'all cursors' switch
	allCursorsSwitchElement.addEventListener('click', async (e) => {
		allCursorsEnabled = e.target.checked
		changeAllSwitches(e.target.checked)
		await setValue('all_cursors', e.target.checked)
	})
	// Add listener for storage change
	browser.storage.local.onChanged.addListener(handleStorageChange)
})()
// Init port communication to content script
function initPort() {
	port = browser.tabs.connect(tabId, { name: 'edit_cursors' })
	port.onMessage.addListener(onMsg)
}
// Init local storage and load data
async function initStorage() {
	const [allCursors, cursors] = await Promise.all([getValue('all_cursors'), getValue('cursors')])
	update(cursors || [])
	allCursorsEnabled = allCursors === undefined ? true : allCursors
	allCursorsSwitchElement.checked = allCursorsEnabled
	if (allCursors === undefined) await setValue('all_cursors', true)
}

// ***** Messages *****
// Send messages to content script
function sendMsg(type, data) {
	port.postMessage([type, JSON.stringify(data)])
}
// Handle incoming messages
function onMsg(type) {
	if (type === 'ping') sendMsg('pong')
}

// ***** Storage *****
// Set values in local storage
async function setValue(key, value) {
	await browser.storage.local.set({ [`boardStorage_${boardCode}#${key}`]: value })
}
// Get values from local storage
async function getValue(key) {
	const data = await browser.storage.local.get(`boardStorage_${boardCode}#${key}`)
	return data[`boardStorage_${boardCode}#${key}`]
}
// Handle incoming messages
function handleStorageChange(changes) {
	Object.keys(changes).forEach((fullKey) => {
		if (!fullKey.startsWith(`boardStorage_${boardCode}#`)) return
		const key = fullKey.match(/boardStorage_.+#(.+)/)[1]
		const { oldValue, newValue } = changes[fullKey]
		if (key === 'cursors') {
			update(newValue, oldValue)
		}
	})
}

// ***** Cursors controls *****
// Create control elements for cursor
function createCursorControls(name, color, uuid, enable, displayName = true, opacity = 100) {
	const CONTROLS = [
		{ type: 'switch', send: 'change_cursor_display', text: name, state: enable },
		{ type: 'switch', send: 'change_name_display', text: 'Display Name', state: displayName },
		{ type: 'slider', send: 'change_cursor_opacity', text: 'Opacity', state: opacity, config: { min: 1, max: 100 } },
	]

	const group = document.createElement('div')
	group.classList.add('controls-group-container')
	group.dataset.uuid = uuid

	CONTROLS.forEach((c, index) => {
		const container = document.createElement('div')
		container.classList.add('cursor-controls-container')
		const text = document.createElement('span')
		text.classList.add('description-text')
		text.textContent = c.text
		if (c.type === 'switch') {
			const checkbox = document.createElement('input')
			checkbox.type = 'checkbox'
			checkbox.checked = c.state
			checkbox.classList.add('switch')
			checkbox.classList.add('cursor-switch')
			checkbox.id = index + '-switch-' + uuid
			checkbox.addEventListener('click', async (e) => {
				sendMsg(c.send, { uuid, enable: e.target.checked })
			})
			const label = document.createElement('label')
			label.setAttribute('for', index + '-switch-' + uuid)
			label.style = `--color-fg: ${color}; --color-bg: ${getLighterColor(color)};`
			container.append(text, checkbox, label)
		} else if (c.type === 'slider') {
			const range = document.createElement('input')
			range.type = 'range'
			range.min = c.config.min
			range.max = c.config.max
			range.value = c.state
			range.classList.add('slider')
			range.classList.add('cursor-slider')
			range.addEventListener('input', async (e) => {
				sendMsg(c.send, { uuid, value: e.target.value })
			})
			range.style = `--color-fg: ${color}; --color-bg: ${getLighterColor(color)};`
			container.append(text, range)
		}
		group.append(container)
	})
	cursorContainerElement.append(group)
}
// Update cursor list
async function update(updates, oldCursorData = []) {
	const { added, removed } = arrayDiff(
		oldCursorData.map((cursor) => cursor.uuid),
		updates.map((update) => update.uuid)
	)
	removed.forEach((uuid) => cursorContainerElement.querySelector(`[data-uuid='${uuid}'`)?.remove())
	added.forEach((uuid) => {
		const c = updates.find((update) => update.uuid === uuid)
		createCursorControls(c.name, c.color, c.uuid, c.enable)
	})
}
// Control all switches
async function changeAllSwitches(enable) {
	const cursorControlSwitchElements = cursorContainerElement.querySelectorAll('.controls-group-container .cursor-controls-container:nth-child(1) input.switch')
	cursorControlSwitchElements.forEach((control) => {
		if (control.checked !== enable) control.click()
	})
}
// Handle pages with invalid urls
function invalidUrl() {
	appContainerElement.classList.add('disabled')
}

// ***** Utils *****
// Get difference of two arrays
function arrayDiff(arr1, arr2) {
	if (!arr1 && !arr2) return { added: [], removed: [] }
	else if (!arr1) return { added: [...arr2], removed: [] }
	else if (!arr2) return { added: [], removed: [...arr1] }
	const removed = arr1.filter((elem) => !arr2.includes(elem))
	const added = arr2.filter((elem) => !arr1.includes(elem))
	return { added, removed }
}
